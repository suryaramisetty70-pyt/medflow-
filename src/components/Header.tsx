import React, { useState } from 'react';
import {
  Hospital as HospitalIcon,
  User as UserIcon,
  Volume2,
  VolumeX,
  Bell,
  Tv,
  CheckCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Hospital, User, UserRole, Notification } from '../types';
import {
  getHospitals,
  getActiveHospitalId,
  setActiveHospitalId,
  getCurrentUser,
  switchRole,
  getNotifications,
  markNotificationRead,
  isAudioEnabled,
  setAudioEnabled,
  resetDatabase,
} from '../services/storage';

interface HeaderProps {
  onOpenKiosk: () => void;
  onOpenAiAssistant: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenKiosk, onOpenAiAssistant }) => {
  const hospitals = getHospitals();
  const activeHospitalId = getActiveHospitalId();
  const currentUser = getCurrentUser();
  const notifications = getNotifications(currentUser.id);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const [showNotifications, setShowNotifications] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [audioOn, setAudioOn] = useState(isAudioEnabled());

  const activeHospital = hospitals.find((h) => h.id === activeHospitalId) || hospitals[0];

  const handleHospitalChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setActiveHospitalId(e.target.value);
  };

  const handleRoleChange = (role: UserRole) => {
    switchRole(role);
    setShowRoleMenu(false);
  };

  const toggleAudio = () => {
    const next = !audioOn;
    setAudioOn(next);
    setAudioEnabled(next);
  };

  const handleResetData = () => {
    if (confirm('Reset MEDFLOW database to initial seed data?')) {
      resetDatabase();
    }
  };

  const roleLabels: Record<UserRole, { label: string; badge: string; color: string }> = {
    PATIENT: { label: 'Patient Portal', badge: 'Patient (Alex Morgan)', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    DOCTOR: { label: 'Doctor OPD Console', badge: 'Doctor (Dr. Priya Sharma)', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    RECEPTIONIST: { label: 'Reception Control Desk', badge: 'Receptionist (Sarah Jenkins)', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    HOSPITAL_ADMIN: { label: 'Hospital Administration', badge: 'Admin (David Vance)', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    SUPER_ADMIN: { label: 'Platform Director', badge: 'Super Admin (Dr. Elena)', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Hospital Selection */}
          <div className="flex items-center gap-3 md:gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-teal-500/20">
                <HospitalIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg tracking-tight text-slate-900">MEDFLOW</span>
                  <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
                    AI OPD
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium hidden sm:block">
                  Hospital Queue & Scheduling Platform
                </p>
              </div>
            </div>

            {/* Hospital Switcher */}
            <div className="hidden lg:flex items-center">
              <div className="relative">
                <select
                  value={activeHospitalId}
                  onChange={handleHospitalChange}
                  className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 pr-8 text-slate-700 hover:bg-slate-100 transition focus:outline-hidden focus:ring-2 focus:ring-teal-500 cursor-pointer"
                >
                  {hospitals.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Quick Actions & Role Switcher */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* AI Assistant Button */}
            <button
              onClick={onOpenAiAssistant}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-linear-to-r from-teal-50 to-emerald-50 hover:from-teal-100 hover:to-emerald-100 border border-teal-200/70 text-teal-800 text-xs font-semibold shadow-xs transition"
              title="Open MEDFLOW AI Scheduling Assistant"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-600 animate-pulse" />
              <span className="hidden sm:inline">AI Assistant</span>
            </button>

            {/* OPD Display Kiosk Button */}
            <button
              onClick={onOpenKiosk}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
              title="Open OPD Waiting Room TV Display"
            >
              <Tv className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden md:inline">OPD Screen</span>
            </button>

            {/* Audio Announcement Toggle */}
            <button
              onClick={toggleAudio}
              className={`p-2 rounded-lg text-xs font-medium transition ${
                audioOn
                  ? 'bg-teal-50 text-teal-700 hover:bg-teal-100'
                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
              }`}
              title={audioOn ? 'Voice & Chime Announcements Active' : 'Announcements Muted'}
            >
              {audioOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white"></span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
                    <span className="font-semibold text-xs text-slate-800 uppercase tracking-wider">
                      OPD Notifications
                    </span>
                    <span className="text-[11px] text-teal-600 font-medium">
                      {unreadCount} unread
                    </span>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-center text-xs text-slate-400">No notifications yet.</p>
                    ) : (
                      notifications.slice(0, 6).map((n) => (
                        <div
                          key={n.id}
                          onClick={() => markNotificationRead(n.id)}
                          className={`p-3 text-xs hover:bg-slate-50 transition cursor-pointer ${
                            !n.read ? 'bg-teal-50/40' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-semibold text-slate-900">{n.title}</span>
                            <span className="text-[10px] text-slate-400 shrink-0">
                              {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-slate-600 mt-1 line-clamp-2 leading-relaxed">{n.message}</p>
                          <span className="inline-block mt-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                            {n.channel}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Role Switcher Menu */}
            <div className="relative">
              <button
                onClick={() => setShowRoleMenu(!showRoleMenu)}
                className={`flex items-center gap-2 pl-2 pr-3 py-1 rounded-lg border text-xs font-semibold transition ${
                  roleLabels[currentUser.role].color
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center">
                  {currentUser.avatarUrl ? (
                    <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-3.5 h-3.5" />
                  )}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-[11px] font-bold leading-tight">{currentUser.name}</div>
                  <div className="text-[9px] opacity-75 font-semibold">{currentUser.role}</div>
                </div>
              </button>

              {/* Role Dropdown */}
              {showRoleMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
                  <div className="px-3 py-1.5 border-b border-slate-100">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Switch Demo Role (RBAC)</p>
                  </div>
                  {(['PATIENT', 'DOCTOR', 'RECEPTIONIST', 'HOSPITAL_ADMIN', 'SUPER_ADMIN'] as UserRole[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => handleRoleChange(r)}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition ${
                        currentUser.role === r ? 'font-bold text-teal-700 bg-teal-50/50' : 'text-slate-700'
                      }`}
                    >
                      <div>
                        <div>{roleLabels[r].badge}</div>
                        <div className="text-[10px] text-slate-400">{roleLabels[r].label}</div>
                      </div>
                      {currentUser.role === r && <CheckCircle className="w-3.5 h-3.5 text-teal-600" />}
                    </button>
                  ))}
                  <div className="border-t border-slate-100 mt-2 pt-2 px-3">
                    <button
                      onClick={handleResetData}
                      className="w-full flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-rose-600 transition py-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Reset Demo Data
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
