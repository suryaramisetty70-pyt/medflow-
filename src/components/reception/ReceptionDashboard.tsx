import React, { useState } from 'react';
import {
  UserPlus,
  Search,
  CheckCircle,
  Clock,
  Download,
  AlertTriangle,
  Building,
  User,
  Activity,
  FileSpreadsheet,
  XCircle,
  Plus,
  Play,
  RotateCcw,
} from 'lucide-react';
import {
  Department,
  Doctor,
  Appointment,
  QueuePriority,
} from '../../types';
import {
  getCurrentUser,
  getDoctors,
  getDepartments,
  getAppointments,
  saveAppointment,
  addNotification,
  getActiveHospitalId,
  getHospitals,
} from '../../services/storage';
import {
  generateTokenNumber,
  validateAppointmentTransition,
} from '../../services/schedulingEngine';
import { exportAppointmentsToCsv } from '../../services/workspaceService';

export const ReceptionDashboard: React.FC = () => {
  const currentUser = getCurrentUser();
  const hospitalId = getActiveHospitalId();
  const hospitals = getHospitals();
  const currentHospital = hospitals.find((h) => h.id === hospitalId) || hospitals[0];
  const departments = getDepartments(hospitalId);
  const doctors = getDoctors(hospitalId);

  const todayStr = new Date().toISOString().split('T')[0];
  const allAppointments = getAppointments({ hospitalId, date: todayStr });

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');

  // Walk-in modal state
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientAge, setPatientAge] = useState<number>(30);
  const [patientGender, setPatientGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('MALE');
  const [walkInDeptId, setWalkInDeptId] = useState(departments[0]?.id || 'dept-6');
  const [walkInDocId, setWalkInDocId] = useState('');
  const [walkInReason, setWalkInReason] = useState('');
  const [walkInPriority, setWalkInPriority] = useState<QueuePriority>('WALK_IN');

  // Reception Stats calculations
  const totalToday = allAppointments.length;
  const checkedInCount = allAppointments.filter((a) => a.status === 'CHECKED_IN').length;
  const waitingCount = allAppointments.filter((a) => a.status === 'WAITING').length;
  const inConsultCount = allAppointments.filter((a) => a.status === 'IN_CONSULTATION').length;
  const completedCount = allAppointments.filter((a) => a.status === 'COMPLETED').length;
  const cancelledCount = allAppointments.filter((a) => a.status === 'CANCELLED').length;
  const noShowCount = allAppointments.filter((a) => a.status === 'MISSED').length;
  const walkInCount = allAppointments.filter((a) => a.bookingSource === 'WALK_IN').length;

  // Filtered Appointments
  const filteredAppointments = allAppointments.filter((a) => {
    const matchesDept = selectedDeptFilter === 'ALL' || a.departmentId === selectedDeptFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      a.tokenNumber.toLowerCase().includes(q) ||
      a.patientName.toLowerCase().includes(q) ||
      a.patientPhone.includes(q) ||
      a.doctorName.toLowerCase().includes(q);
    return matchesDept && matchesSearch;
  });

  // Fast Check-In Workflow
  const handleCheckIn = (apt: Appointment) => {
    const transition = validateAppointmentTransition(apt.status, 'CHECKED_IN');
    if (!transition.valid) {
      alert(transition.reason);
      return;
    }

    // Move to CHECKED_IN -> WAITING in queue
    saveAppointment(
      {
        ...apt,
        status: 'WAITING',
        checkedInAt: new Date().toISOString(),
      },
      { id: currentUser.id, name: currentUser.name, role: currentUser.role }
    );

    addNotification({
      userId: apt.patientId,
      title: 'Check-In Complete • You are in Queue',
      message: `Token ${apt.tokenNumber} checked in. Please proceed to ${apt.departmentName} waiting lobby.`,
      channel: 'SMS',
      type: 'QUEUE_ALERT',
    });
  };

  // Bump to Emergency Priority
  const handleElevatePriority = (apt: Appointment) => {
    if (confirm(`Elevate Token ${apt.tokenNumber} (${apt.patientName}) to EMERGENCY priority?`)) {
      saveAppointment(
        {
          ...apt,
          priority: 'EMERGENCY',
        },
        { id: currentUser.id, name: currentUser.name, role: currentUser.role }
      );
    }
  };

  // Submit Walk-in Form
  const handleCreateWalkIn = (e: React.FormEvent) => {
    e.preventDefault();
    const dept = departments.find((d) => d.id === walkInDeptId) || departments[0];
    const availableDocs = doctors.filter((d) => d.departmentId === walkInDeptId);
    const doc = doctors.find((d) => d.id === walkInDocId) || availableDocs[0];

    if (!doc) {
      alert('Please select an active doctor for this walk-in.');
      return;
    }

    const todayDeptApts = allAppointments.filter((a) => a.departmentId === dept.id);
    const token = generateTokenNumber(dept.code, todayDeptApts.length);

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const endMinutes = now.getMinutes() + (doc.avgConsultationMinutes || 15);
    const endHours = now.getHours() + Math.floor(endMinutes / 60);
    const endTimeStr = `${endHours.toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;

    const newApt: Appointment = {
      id: `apt-walkin-${Date.now()}`,
      hospitalId,
      patientId: `pat-walkin-${Date.now()}`,
      patientName: patientName.trim(),
      patientPhone: patientPhone.trim(),
      patientAge,
      patientGender,
      doctorId: doc.id,
      doctorName: doc.name,
      departmentId: dept.id,
      departmentName: dept.name,
      appointmentDate: todayStr,
      startTime: timeStr,
      endTime: endTimeStr,
      status: 'WAITING', // Directly into waiting queue
      reason: walkInReason || 'Walk-in triage consultation',
      tokenNumber: token,
      priority: walkInPriority,
      bookingSource: 'WALK_IN',
      noShowRiskScore: 0,
      noShowRiskLevel: 'LOW',
      estimatedWaitMinutes: doc.currentDelayMinutes || 10,
      checkedInAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveAppointment(newApt, {
      id: currentUser.id,
      name: currentUser.name,
      role: currentUser.role,
    });

    alert(`Walk-In Registered! Assigned Token: ${token} for ${doc.name} (Room ${doc.roomNumber}).`);
    setShowWalkInModal(false);
    setPatientName('');
    setPatientPhone('');
    setWalkInReason('');
  };

  const handleExportCsv = () => {
    exportAppointmentsToCsv(allAppointments, currentHospital.name);
  };

  return (
    <div className="space-y-6">
      {/* Top Reception Desk Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-purple-700 uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-purple-600"></span>
            OPD Central Reception & Triage Desk
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
            Reception Control Center
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Patient physical check-in, immediate walk-in registration, and live OPD queue dispatch.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowWalkInModal(true)}
            className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/20 flex items-center gap-2 transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>Register Walk-In Patient</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition"
            title="Export Today's Manifest to Google Sheets / CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">Export Sheets</span>
          </button>
        </div>
      </div>

      {/* OPD High-Information Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 sm:gap-3">
        <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
          <div className="text-[10px] font-bold uppercase text-slate-400">Total Today</div>
          <div className="text-xl font-black text-slate-900 mt-0.5">{totalToday}</div>
        </div>
        <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
          <div className="text-[10px] font-bold uppercase text-slate-400">Checked-In</div>
          <div className="text-xl font-black text-blue-600 mt-0.5">{checkedInCount}</div>
        </div>
        <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
          <div className="text-[10px] font-bold uppercase text-slate-400">In Waiting</div>
          <div className="text-xl font-black text-teal-600 mt-0.5">{waitingCount}</div>
        </div>
        <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
          <div className="text-[10px] font-bold uppercase text-slate-400">In Room</div>
          <div className="text-xl font-black text-amber-500 mt-0.5">{inConsultCount}</div>
        </div>
        <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
          <div className="text-[10px] font-bold uppercase text-slate-400">Completed</div>
          <div className="text-xl font-black text-emerald-600 mt-0.5">{completedCount}</div>
        </div>
        <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
          <div className="text-[10px] font-bold uppercase text-slate-400">Cancelled</div>
          <div className="text-xl font-black text-rose-500 mt-0.5">{cancelledCount}</div>
        </div>
        <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
          <div className="text-[10px] font-bold uppercase text-slate-400">No-Show</div>
          <div className="text-xl font-black text-slate-400 mt-0.5">{noShowCount}</div>
        </div>
        <div className="p-3 bg-white rounded-xl border border-slate-200 text-center bg-teal-50/40 border-teal-200/50">
          <div className="text-[10px] font-bold uppercase text-teal-700">Walk-Ins</div>
          <div className="text-xl font-black text-teal-800 mt-0.5">{walkInCount}</div>
        </div>
      </div>

      {/* Doctor OPD Roster Status Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-900">Physicians On Duty & Clinic Delay Monitor</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="pb-2">Doctor</th>
                <th className="pb-2">Department</th>
                <th className="pb-2">Room</th>
                <th className="pb-2">Calling Token</th>
                <th className="pb-2">Waiting Queue</th>
                <th className="pb-2">Delay Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {doctors.map((doc) => {
                const dept = departments.find((d) => d.id === doc.departmentId);
                const docApts = allAppointments.filter((a) => a.doctorId === doc.id);
                const activeCalling = docApts.find((a) => a.status === 'IN_CONSULTATION');
                const queueCount = docApts.filter((a) => a.status === 'WAITING' || a.status === 'CHECKED_IN').length;

                return (
                  <tr key={doc.id} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 font-bold text-slate-900">{doc.name}</td>
                    <td className="py-2.5 text-slate-600">{dept?.name}</td>
                    <td className="py-2.5 font-mono font-semibold">Room {doc.roomNumber}</td>
                    <td className="py-2.5">
                      {activeCalling ? (
                        <span className="font-mono font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {activeCalling.tokenNumber}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2.5 font-bold text-teal-700">{queueCount} waiting</td>
                    <td className="py-2.5">
                      {doc.currentDelayMinutes > 0 ? (
                        <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Delayed +{doc.currentDelayMinutes}m
                        </span>
                      ) : (
                        <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          On Time
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* OPD Manifest & Check-In Search */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by token (e.g. C-024), patient name, or doctor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Department:</span>
            <select
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-semibold text-slate-700"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Manifest Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="pb-2.5">Token</th>
                <th className="pb-2.5">Patient Details</th>
                <th className="pb-2.5">Doctor & Dept</th>
                <th className="pb-2.5">Time</th>
                <th className="pb-2.5">Status</th>
                <th className="pb-2.5">Priority</th>
                <th className="pb-2.5">Source</th>
                <th className="pb-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAppointments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No matching patient records found.
                  </td>
                </tr>
              ) : (
                filteredAppointments.map((apt) => (
                  <tr key={apt.id} className="hover:bg-slate-50 transition">
                    <td className="py-3">
                      <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                        {apt.tokenNumber}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="font-bold text-slate-900">{apt.patientName}</div>
                      <div className="text-[11px] text-slate-400">{apt.patientPhone}</div>
                    </td>
                    <td className="py-3">
                      <div className="font-semibold text-slate-800">{apt.doctorName}</div>
                      <div className="text-[11px] text-slate-500">{apt.departmentName}</div>
                    </td>
                    <td className="py-3 font-mono text-[11px] text-slate-600">
                      {apt.startTime} - {apt.endTime}
                    </td>
                    <td className="py-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          apt.status === 'CONFIRMED'
                            ? 'bg-blue-50 text-blue-700'
                            : apt.status === 'WAITING'
                            ? 'bg-teal-50 text-teal-700'
                            : apt.status === 'IN_CONSULTATION'
                            ? 'bg-amber-50 text-amber-700'
                            : apt.status === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {apt.status}
                      </span>
                    </td>
                    <td className="py-3">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          apt.priority === 'EMERGENCY'
                            ? 'bg-rose-100 text-rose-800 font-extrabold'
                            : apt.priority === 'WALK_IN'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {apt.priority}
                      </span>
                    </td>
                    <td className="py-3 text-[11px] text-slate-500 font-medium">
                      {apt.bookingSource}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {apt.status === 'CONFIRMED' && (
                          <button
                            onClick={() => handleCheckIn(apt)}
                            className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition"
                          >
                            Check In
                          </button>
                        )}
                        {apt.priority !== 'EMERGENCY' && apt.status === 'WAITING' && (
                          <button
                            onClick={() => handleElevatePriority(apt)}
                            className="p-1 rounded text-amber-600 hover:bg-amber-50"
                            title="Escalate to Emergency"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* WALK-IN REGISTRATION MODAL */}
      {showWalkInModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-teal-700">
                  Quick Desk Triage
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  Walk-In Patient Registration
                </h3>
              </div>
              <button
                onClick={() => setShowWalkInModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWalkIn} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Patient Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mobile Phone</label>
                  <input
                    type="text"
                    required
                    placeholder="+1 (555) 000-0000"
                    value={patientPhone}
                    onChange={(e) => setPatientPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Age</label>
                  <input
                    type="number"
                    min="1"
                    max="110"
                    value={patientAge}
                    onChange={(e) => setPatientAge(parseInt(e.target.value) || 30)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Gender</label>
                  <select
                    value={patientGender}
                    onChange={(e) => setPatientGender(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Queue Priority</label>
                  <select
                    value={walkInPriority}
                    onChange={(e) => setWalkInPriority(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold"
                  >
                    <option value="WALK_IN">Walk-In</option>
                    <option value="NORMAL">Standard</option>
                    <option value="FOLLOW_UP">Follow-Up</option>
                    <option value="EMERGENCY">Emergency (Urgent)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Department</label>
                  <select
                    value={walkInDeptId}
                    onChange={(e) => {
                      setWalkInDeptId(e.target.value);
                      const fDoc = doctors.find((d) => d.departmentId === e.target.value);
                      if (fDoc) setWalkInDocId(fDoc.id);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Assign Doctor</label>
                  <select
                    value={walkInDocId}
                    onChange={(e) => setWalkInDocId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold"
                  >
                    {doctors
                      .filter((d) => d.departmentId === walkInDeptId)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} (Room {d.roomNumber})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Presenting Symptoms / Triage Note</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., High fever, severe headache, ankle sprain"
                  value={walkInReason}
                  onChange={(e) => setWalkInReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowWalkInModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold shadow-md shadow-teal-600/20"
                >
                  Generate Token & Queue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
