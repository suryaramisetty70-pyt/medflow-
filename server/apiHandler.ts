import { GoogleGenAI } from '@google/genai';
import type { Request, Response, NextFunction } from 'express';

// Initialize Gemini client using server-side API key
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export async function handleTtsRequest(req: Request, res: Response): Promise<void> {
  try {
    const { text } = req.body || {};
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Text prompt is required' });
      return;
    }

    if (!ai) {
      // Graceful fallback to client Web Speech API
      res.status(200).json({
        fallbackToBrowser: true,
        message: 'No GEMINI_API_KEY provided on server, falling back to browser speech synthesis.',
      });
      return;
    }

    // Call Gemini 3.8 Flash TTS
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-tts',
      contents: text,
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Kore', // Pleasant, clear voice
            },
          },
        },
      },
    });

    const candidate = response.candidates?.[0];
    const audioPart = candidate?.content?.parts?.find((p) => p.inlineData?.data);

    if (audioPart && audioPart.inlineData?.data) {
      res.json({
        audioBase64: audioPart.inlineData.data,
        mimeType: audioPart.inlineData.mimeType || 'audio/wav',
      });
      return;
    }

    res.status(200).json({
      fallbackToBrowser: true,
      message: 'Model did not return inline audio, using browser TTS.',
    });
  } catch (error) {
    console.error('Gemini TTS error:', error);
    res.status(200).json({
      fallbackToBrowser: true,
      message: 'TTS error, client should use browser synthesis fallback.',
    });
  }
}

export async function handleAiAssistantRequest(req: Request, res: Response): Promise<void> {
  try {
    const { message, context } = req.body || {};
    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    if (!ai) {
      // Offline fallback: Rule-based semantic extractor
      const fallbackResponse = generateDeterministicAssistantReply(message, context);
      res.json(fallbackResponse);
      return;
    }

    const systemInstruction = `
You are the MEDFLOW AI Hospital Scheduling & OPD Queue Assistant.
Your primary role is to assist patients and staff with administrative scheduling:
- Finding doctors and available appointment slots
- Checking current queue status and estimated wait times
- Inquiring about doctor delays
- Answering questions about clinic hours, departments, and booking procedures

CRITICAL CLINICAL SAFETY BOUNDARIES:
- You are an administrative assistant, NOT a medical doctor.
- NEVER diagnose diseases, recommend medications, or interpret lab tests.
- If a patient describes life-threatening symptoms (chest pain, stroke signs, difficulty breathing, severe bleeding), urge them to immediately call emergency services (911/112) or go to the nearest Emergency Room.
- Always include a polite, brief medical disclaimer when symptoms are mentioned.

Output must be in JSON format conforming to:
{
  "reply": "string (human friendly message)",
  "intent": "SEARCH_SLOTS" | "CHECK_QUEUE" | "CHECK_DELAY" | "CANCEL" | "GENERAL_INFO" | "EMERGENCY_REDIRECT",
  "extractedData": {
    "departmentName"?: string,
    "specialty"?: string,
    "doctorName"?: string,
    "preferredDate"?: string, // YYYY-MM-DD or 'today' or 'tomorrow'
    "timeOfDay"?: "morning" | "afternoon" | "evening",
    "tokenNumber"?: string
  },
  "suggestedActions"?: Array<{
    "label": string,
    "action": "SELECT_DOCTOR" | "VIEW_QUEUE" | "BOOK_SLOT" | "CALL_EMERGENCY",
    "payload"?: any
  }>
}
`;

    const userPrompt = `
Context of Available Departments: Cardiology, Neurology, Orthopedics, Pediatrics, Dermatology, General Medicine, ENT, Oncology.
Doctors Available Today: Dr. Priya Sharma (Cardiology), Dr. Marcus Vance (Cardiology), Dr. Aris Thorne (Neurology), Dr. Elena Rostova (Orthopedics), Dr. David Cho (Pediatrics), Dr. Camille Laurent (Dermatology), Dr. Rajiv Menon (General Medicine).

Patient Query: "${message}"
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    const replyText = response.text || '';
    try {
      const parsed = JSON.parse(replyText);
      res.json(parsed);
    } catch {
      res.json({
        reply: replyText || 'I am ready to help you schedule an appointment with our specialists.',
        intent: 'GENERAL_INFO',
      });
    }
  } catch (error) {
    console.error('AI assistant error:', error);
    // Graceful fallback to deterministic assistant
    const fallbackResponse = generateDeterministicAssistantReply(req.body?.message || '', req.body?.context);
    res.json(fallbackResponse);
  }
}

// Rule-based fallback if offline or no Gemini key
function generateDeterministicAssistantReply(message: string, context?: any) {
  const lower = message.toLowerCase();

  if (lower.includes('chest pain') || lower.includes('can\'t breathe') || lower.includes('stroke') || lower.includes('heart attack')) {
    return {
      reply: '🚨 MEDICAL EMERGENCY WARNING: If you are experiencing acute chest pain, shortness of breath, or emergency symptoms, please call emergency services (911) or visit the nearest emergency room immediately. MedFlow AI cannot handle urgent life-threatening conditions.',
      intent: 'EMERGENCY_REDIRECT',
      suggestedActions: [
        { label: 'Emergency Room Hotline', action: 'CALL_EMERGENCY' },
      ],
    };
  }

  if (lower.includes('cardio') || lower.includes('heart') || lower.includes('priya') || lower.includes('vance')) {
    return {
      reply: 'We have two senior cardiologists available at MEDFLOW Central Hospital: Dr. Priya Sharma (Interventional Cardiology) and Dr. Marcus Vance (Electrophysiology). Would you like to view available slots for today or tomorrow?',
      intent: 'SEARCH_SLOTS',
      extractedData: {
        departmentName: 'Cardiology',
        specialty: 'Cardiology',
      },
      suggestedActions: [
        { label: 'View Dr. Priya Sharma Slots', action: 'SELECT_DOCTOR', payload: { doctorId: 'doc-1' } },
        { label: 'View Dr. Marcus Vance Slots', action: 'SELECT_DOCTOR', payload: { doctorId: 'doc-2' } },
      ],
    };
  }

  if (lower.includes('neuro') || lower.includes('brain') || lower.includes('headache') || lower.includes('migraine')) {
    return {
      reply: 'Dr. Aris Thorne (Chief of Neurology) is available for consultations regarding migraines, neurogenetics, and epilepsy in Room 201.',
      intent: 'SEARCH_SLOTS',
      extractedData: {
        departmentName: 'Neurology',
        specialty: 'Neurology',
        doctorId: 'doc-3',
      },
      suggestedActions: [
        { label: 'Book Dr. Aris Thorne', action: 'SELECT_DOCTOR', payload: { doctorId: 'doc-3' } },
      ],
    };
  }

  if (lower.includes('skin') || lower.includes('derma') || lower.includes('rash') || lower.includes('acne')) {
    return {
      reply: 'Dr. Camille Laurent in Dermatology is available in Room 301 for clinical dermatology and skin consultations.',
      intent: 'SEARCH_SLOTS',
      extractedData: {
        departmentName: 'Dermatology',
        specialty: 'Dermatology',
        doctorId: 'doc-6',
      },
      suggestedActions: [
        { label: 'Book Dr. Camille Laurent', action: 'SELECT_DOCTOR', payload: { doctorId: 'doc-6' } },
      ],
    };
  }

  if (lower.includes('queue') || lower.includes('wait') || lower.includes('token') || lower.includes('ahead')) {
    return {
      reply: 'You can check your live OPD queue token, current token called, and real-time wait estimation directly from the Patient Dashboard. Dr. Priya Sharma currently has 2 patients in queue with approximately 15 minutes of estimated wait.',
      intent: 'CHECK_QUEUE',
      suggestedActions: [
        { label: 'Open Live Queue Tracker', action: 'VIEW_QUEUE' },
      ],
    };
  }

  if (lower.includes('late') || lower.includes('delay')) {
    return {
      reply: 'Dr. Priya Sharma is on schedule (0 min delay). Dr. Marcus Vance currently has a 15-minute operational delay due to an urgent cardiac catheterization review.',
      intent: 'CHECK_DELAY',
    };
  }

  return {
    reply: 'Hello! I am MEDFLOW AI Assistant. I can help you search for doctors, book appointments, check live queue status, and answer questions about our hospital services. Which department or specialist would you like to consult?',
    intent: 'GENERAL_INFO',
    suggestedActions: [
      { label: 'Book Cardiology Appointment', action: 'SELECT_DOCTOR', payload: { doctorId: 'doc-1' } },
      { label: 'Book General Medicine', action: 'SELECT_DOCTOR', payload: { doctorId: 'doc-7' } },
      { label: 'Track OPD Queue', action: 'VIEW_QUEUE' },
    ],
  };
}
