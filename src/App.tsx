import React, { useState, useEffect } from 'react';
import {
  initStorage,
  subscribeToStorage,
  getCurrentUser,
} from './services/storage';
import { Header } from './components/Header';
import { PatientDashboard } from './components/patient/PatientDashboard';
import { DoctorDashboard } from './components/doctor/DoctorDashboard';
import { ReceptionDashboard } from './components/reception/ReceptionDashboard';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { SuperAdminDashboard } from './components/superadmin/SuperAdminDashboard';
import { OpdDisplayBoard } from './components/kiosk/OpdDisplayBoard';
import { AiAssistantModal } from './components/ai/AiAssistantModal';
import { Sparkles } from 'lucide-react';

export default function App() {
  const [, setTick] = useState(0);
  const [showKiosk, setShowKiosk] = useState(false);
  const [showAiAssistant, setShowAiAssistant] = useState(false);

  useEffect(() => {
    initStorage();
    const unsubscribe = subscribeToStorage(() => {
      setTick((t) => t + 1);
    });
    return () => unsubscribe();
  }, []);

  const currentUser = getCurrentUser();

  return (
    <div className="min-h-screen bg-slate-50/80 text-slate-900 font-sans antialiased flex flex-col selection:bg-teal-500 selection:text-white">
      {/* Top Navigation */}
      <Header
        onOpenKiosk={() => setShowKiosk(true)}
        onOpenAiAssistant={() => setShowAiAssistant(true)}
      />

      {/* Main Body per Role */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentUser.role === 'PATIENT' && (
          <PatientDashboard onOpenAiAssistant={() => setShowAiAssistant(true)} />
        )}
        {currentUser.role === 'DOCTOR' && <DoctorDashboard />}
        {currentUser.role === 'RECEPTIONIST' && <ReceptionDashboard />}
        {currentUser.role === 'HOSPITAL_ADMIN' && <AdminDashboard />}
        {currentUser.role === 'SUPER_ADMIN' && <SuperAdminDashboard />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">MEDFLOW AI</span>
            <span>•</span>
            <span>Enterprise Hospital Appointment & OPD Queue Management Platform</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Role-Based Access Control (RBAC)</span>
            <span>•</span>
            <span>HIPAA-Ready Architecture</span>
          </div>
        </div>
      </footer>

      {/* Fullscreen OPD Kiosk Display Board */}
      {showKiosk && <OpdDisplayBoard onClose={() => setShowKiosk(false)} />}

      {/* AI Assistant Modal */}
      {showAiAssistant && (
        <AiAssistantModal
          onClose={() => setShowAiAssistant(false)}
          onSelectDoctor={(docId) => {
            // Patient view will select this doctor
          }}
        />
      )}

      {/* Floating AI Launcher */}
      {!showKiosk && (
        <button
          onClick={() => setShowAiAssistant(true)}
          className="fixed bottom-6 right-6 z-30 p-3.5 rounded-2xl bg-gradient-to-tr from-teal-700 to-emerald-600 text-white shadow-xl shadow-teal-700/30 hover:scale-105 transition flex items-center gap-2 font-bold text-xs group"
          title="Ask MEDFLOW AI Assistant"
        >
          <Sparkles className="w-5 h-5 text-teal-200 animate-pulse group-hover:rotate-12 transition-transform" />
          <span className="hidden sm:inline">Ask MEDFLOW AI</span>
        </button>
      )}
    </div>
  );
}
