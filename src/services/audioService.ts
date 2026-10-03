import { isAudioEnabled } from './storage';

// Pleasant Hospital Chime synthesizer via Web Audio API
class AudioSynthesizer {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // Plays a classic two-tone medical chime: D5 (587 Hz) followed by A5 (880 Hz)
  playHospitalChime(): Promise<void> {
    return new Promise((resolve) => {
      if (!isAudioEnabled()) {
        resolve();
        return;
      }
      const ctx = this.getContext();
      if (!ctx) {
        resolve();
        return;
      }

      const now = ctx.currentTime;

      // Note 1: 587 Hz (D5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.2, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.45);

      // Note 2: 880 Hz (A5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.2);
      gain2.gain.setValueAtTime(0.25, now + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.2);
      osc2.stop(now + 0.7);

      setTimeout(() => resolve(), 750);
    });
  }

  // Play PCM or WAV audio bytes returned from Gemini TTS
  async playAudioBuffer(audioData: ArrayBuffer): Promise<void> {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const buffer = await ctx.decodeAudioData(audioData);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
    } catch (e) {
      console.warn('Could not decode audio data directly, falling back:', e);
    }
  }
}

export const audioSynth = new AudioSynthesizer();

// Text to Speech caller
export async function announceToken(params: {
  tokenNumber: string;
  patientName: string;
  doctorName: string;
  roomNumber: string;
  departmentName: string;
}): Promise<void> {
  if (!isAudioEnabled()) return;

  const { tokenNumber, patientName, doctorName, roomNumber, departmentName } = params;
  const announcementText = `Attention please. Token ${tokenNumber}. ${patientName}, please proceed to ${departmentName}, Room ${roomNumber}, for consultation with ${doctorName}.`;

  // First play the hospital chime
  await audioSynth.playHospitalChime();

  // Try calling the server TTS endpoint (gemini-3.8-flash-tts)
  try {
    const response = await fetch('/api/v1/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: announcementText }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.audioBase64) {
        const binary = atob(data.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        await audioSynth.playAudioBuffer(bytes.buffer);
        return;
      }
    }
  } catch (err) {
    console.info('Server TTS unavailable, using local speech synthesis fallback:', err);
  }

  // Graceful browser fallback with Web Speech API
  speakTextBrowser(announcementText);
}

export function speakTextBrowser(text: string): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  if (!isAudioEnabled()) return;

  window.speechSynthesis.cancel(); // cancel any pending speech
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95; // clear medical announcement speed
  utterance.pitch = 1.0;
  utterance.lang = 'en-US';

  // Prefer a natural voice if available
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(
    (v) => v.name.includes('Google') || v.name.includes('Natural') || (v.lang === 'en-US' && !v.name.includes('Whisper'))
  );
  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  window.speechSynthesis.speak(utterance);
}
