import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Send,
  Volume2,
  AlertTriangle,
  Calendar,
  Clock,
  User,
  CheckCircle,
  HelpCircle,
  Stethoscope,
} from 'lucide-react';
import { speakTextBrowser } from '../../services/audioService';

interface Message {
  id: string;
  sender: 'USER' | 'AI';
  text: string;
  suggestedActions?: Array<{ label: string; action: string; payload?: any }>;
}

export const AiAssistantModal: React.FC<{
  onClose: () => void;
  onSelectDoctor?: (doctorId: string) => void;
}> = ({ onClose, onSelectDoctor }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'AI',
      text: 'Hello! I am MEDFLOW AI, your administrative hospital scheduling assistant. How can I help you today? I can help you find available specialist slots, check live OPD waiting times, or look up clinic hours.',
      suggestedActions: [
        { label: 'Book Cardiologist', action: 'PROMPT', payload: 'Find me an available cardiologist' },
        { label: 'Check Doctor Delays', action: 'PROMPT', payload: 'Is any doctor running late today?' },
        { label: 'Check Waiting Queue', action: 'PROMPT', payload: 'How many patients are waiting in OPD?' },
        { label: 'Dermatology Slots', action: 'PROMPT', payload: 'Book a dermatologist for tomorrow' },
      ],
    },
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim()) return;

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      sender: 'USER',
      text: query.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/v1/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query }),
      });

      if (response.ok) {
        const data = await response.json();
        const aiMsg: Message = {
          id: `ai-${Date.now()}`,
          sender: 'AI',
          text: data.reply || 'I am ready to help you with your appointment.',
          suggestedActions: data.suggestedActions,
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        throw new Error('API response failed');
      }
    } catch {
      // Local fallback
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'AI',
          text: 'I can assist you in booking appointments across our 8 specialties. Dr. Priya Sharma (Cardiology) and Dr. Rajiv Menon (General Medicine) are on duty today.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActionClick = (action: string, payload?: any) => {
    if (action === 'PROMPT' && typeof payload === 'string') {
      handleSendMessage(payload);
    } else if (action === 'SELECT_DOCTOR' && payload?.doctorId) {
      if (onSelectDoctor) {
        onSelectDoctor(payload.doctorId);
        onClose();
      }
    } else if (action === 'CALL_EMERGENCY') {
      alert('🚨 For immediate medical emergencies, please dial 911 (or local emergency services) or proceed to the Hospital Emergency Room directly.');
    } else {
      handleSendMessage(payload?.label || action);
    }
  };

  const handleSpeak = (text: string) => {
    speakTextBrowser(text);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full h-[620px] shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-teal-700 to-emerald-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center text-teal-200">
              <Sparkles className="w-5 h-5 text-teal-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base">MEDFLOW AI Assistant</h3>
                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-white/20 text-white">
                  Gemini 3.8
                </span>
              </div>
              <p className="text-xs text-teal-100">
                Hospital OPD Scheduling & Queue Operations
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Clinical Safety Disclaimer Banner */}
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-[11px] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Administrative Notice:</strong> This AI assists with scheduling only and does not provide medical diagnosis or treatment advice.
          </span>
        </div>

        {/* Chat Messages Body */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/50 text-xs">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.sender === 'USER' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-3.5 leading-relaxed shadow-xs relative group ${
                  m.sender === 'USER'
                    ? 'bg-teal-600 text-white rounded-br-xs'
                    : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                }`}
              >
                <p className="whitespace-pre-line">{m.text}</p>

                {/* Speak button for AI responses */}
                {m.sender === 'AI' && (
                  <button
                    onClick={() => handleSpeak(m.text)}
                    className="absolute bottom-1.5 right-1.5 p-1 rounded-full text-slate-400 hover:text-teal-600 hover:bg-slate-100 transition opacity-0 group-hover:opacity-100"
                    title="Read response aloud (TTS)"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Action Suggestion Chips */}
              {m.suggestedActions && m.suggestedActions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {m.suggestedActions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleActionClick(action.action, action.payload)}
                      className="px-2.5 py-1 rounded-full bg-white border border-teal-200 text-teal-800 text-[11px] font-semibold hover:bg-teal-50 transition shadow-2xs"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-slate-400 text-xs p-2">
              <Sparkles className="w-4 h-4 animate-spin text-teal-600" />
              <span>MEDFLOW AI is checking clinic availability...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3.5 bg-white border-t border-slate-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Ask anything, e.g., 'Book a cardiologist tomorrow morning'..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white transition shadow-sm"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
