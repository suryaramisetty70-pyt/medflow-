import React, { useState, useEffect } from 'react';
import {
  Tv,
  X,
  Volume2,
  Clock,
  Building,
  Bell,
  Sparkles,
} from 'lucide-react';
import {
  getAppointments,
  getDoctors,
  getDepartments,
  getActiveHospitalId,
  getHospitals,
} from '../../services/storage';
import { announceToken, audioSynth } from '../../services/audioService';

export const OpdDisplayBoard: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const hospitalId = getActiveHospitalId();
  const hospitals = getHospitals();
  const currentHospital = hospitals.find((h) => h.id === hospitalId) || hospitals[0];
  const departments = getDepartments(hospitalId);
  const doctors = getDoctors(hospitalId);

  const todayStr = new Date().toISOString().split('T')[0];
  const appointments = getAppointments({ hospitalId, date: todayStr });

  // Currently calling patient
  const inConsultationApt = appointments.find((a) => a.status === 'IN_CONSULTATION') || appointments[0];
  const callingDoctor = inConsultationApt ? doctors.find((d) => d.id === inConsultationApt.doctorId) : null;
  const callingDept = inConsultationApt ? departments.find((d) => d.id === inConsultationApt.departmentId) : null;

  // Upcoming waiting tokens
  const waitingApts = appointments.filter((a) => a.status === 'WAITING' || a.status === 'CHECKED_IN').slice(0, 8);

  // Live Clock
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleTestAnnouncement = () => {
    if (inConsultationApt && callingDoctor) {
      announceToken({
        tokenNumber: inConsultationApt.tokenNumber,
        patientName: inConsultationApt.patientName,
        doctorName: callingDoctor.name,
        roomNumber: callingDoctor.roomNumber,
        departmentName: callingDept?.name || 'Cardiology',
      });
    } else {
      audioSynth.playHospitalChime();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col overflow-hidden select-none">
      {/* Top TV Header Bar */}
      <div className="h-20 bg-slate-900 border-b border-slate-800 px-6 sm:px-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-500 text-slate-950 flex items-center justify-center font-black text-xl shadow-lg shadow-teal-500/30">
            +
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase">
              {currentHospital.name}
            </div>
            <div className="text-xs text-teal-400 font-bold uppercase tracking-widest">
              Live Outpatient Department (OPD) Queue Display
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Audio Chime Trigger */}
          <button
            onClick={handleTestAnnouncement}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-400 text-xs font-bold transition border border-slate-700"
            title="Play Audio Chime & Announcement"
          >
            <Volume2 className="w-4 h-4" />
            <span className="hidden sm:inline">Chime / Re-Announce</span>
          </button>

          {/* Clock */}
          <div className="text-right">
            <div className="text-2xl sm:text-3xl font-mono font-black text-white">
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-[11px] text-slate-400 uppercase tracking-wider">
              {time.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
            </div>
          </div>

          {/* Close Kiosk Button */}
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white transition"
            title="Exit OPD Kiosk Display"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main Kiosk Layout */}
      <div className="flex-1 p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 overflow-hidden">
        {/* Left: Giant Calling Hero Card (8 cols) */}
        <div className="lg:col-span-8 flex flex-col justify-between bg-linear-to-b from-slate-900 to-slate-900/90 rounded-3xl p-8 sm:p-12 border-2 border-teal-500/40 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div>
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 font-extrabold text-sm uppercase tracking-widest border border-emerald-500/40">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping"></span>
              Now Calling Into Consultation Room
            </div>

            <div className="mt-8 flex flex-col sm:flex-row sm:items-baseline gap-4 sm:gap-8">
              <div className="text-7xl sm:text-9xl font-mono font-black text-emerald-400 tracking-tight drop-shadow-md">
                {inConsultationApt ? inConsultationApt.tokenNumber : 'READY'}
              </div>
              <div className="text-3xl sm:text-5xl font-black text-white">
                Room {callingDoctor?.roomNumber || '101'}
              </div>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <div className="text-xs uppercase font-bold text-slate-400 tracking-wider">Consulting Physician</div>
              <div className="text-2xl font-bold text-white mt-1">
                {callingDoctor?.name || 'Dr. Priya Sharma'}
              </div>
              <div className="text-sm text-teal-400 mt-0.5">{callingDept?.name || 'Cardiology'} Suite</div>
            </div>

            <div>
              <div className="text-xs uppercase font-bold text-slate-400 tracking-wider">Patient Name</div>
              <div className="text-2xl font-bold text-white mt-1">
                {inConsultationApt ? inConsultationApt.patientName : 'Next In Waiting'}
              </div>
              <div className="text-sm text-slate-400 mt-0.5">Please proceed to Room {callingDoctor?.roomNumber || '101'}</div>
            </div>
          </div>
        </div>

        {/* Right: Upcoming Tokens Grid (4 cols) */}
        <div className="lg:col-span-4 bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <span className="font-extrabold uppercase text-xs tracking-wider text-teal-400">
                Next in Queue
              </span>
              <span className="text-xs text-slate-400 font-semibold">{waitingApts.length} Waiting</span>
            </div>

            <div className="mt-4 space-y-3">
              {waitingApts.length === 0 ? (
                <div className="py-12 text-center text-slate-500 font-medium">
                  Queue is clear. Walk-ins will appear instantly.
                </div>
              ) : (
                waitingApts.map((apt, idx) => (
                  <div
                    key={apt.id}
                    className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-slate-400 w-5">#{idx + 1}</span>
                      <span className="text-xl font-mono font-black text-amber-400">{apt.tokenNumber}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-200">{apt.departmentName}</div>
                      <div className="text-[11px] text-slate-400">{apt.doctorName.split(',')[0]}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] text-slate-400 text-center">
            🔔 Please have your token slip or appointment SMS ready at the door.
          </div>
        </div>
      </div>

      {/* Bottom Ticker */}
      <div className="h-10 bg-teal-950 border-t border-teal-800/60 px-6 flex items-center justify-between text-xs text-teal-200 font-semibold">
        <span className="truncate">
          🏥 MEDFLOW AI OPD: Emergency triages receive immediate clinical precedence. Please notify the triage nurse for acute pain or respiratory distress.
        </span>
        <span className="shrink-0 font-mono text-[10px] text-teal-400 ml-4 hidden sm:block">
          STATUS: OPTIMAL FLOW
        </span>
      </div>
    </div>
  );
};
