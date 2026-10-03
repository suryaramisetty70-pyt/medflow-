import React, { useState } from 'react';
import {
  TrendingUp,
  Users,
  Clock,
  Calendar,
  Shield,
  Settings,
  Building,
  CheckCircle,
  AlertCircle,
  FileText,
  Search,
  Sliders,
} from 'lucide-react';
import {
  Department,
  Doctor,
  Appointment,
  AuditLog,
} from '../../types';
import {
  getDepartments,
  getDoctors,
  updateDoctor,
  getAppointments,
  getAuditLogs,
  getCurrentUser,
  getActiveHospitalId,
  getHospitals,
} from '../../services/storage';

export const AdminDashboard: React.FC = () => {
  const currentUser = getCurrentUser();
  const hospitalId = getActiveHospitalId();
  const hospitals = getHospitals();
  const currentHospital = hospitals.find((h) => h.id === hospitalId) || hospitals[0];
  const departments = getDepartments(hospitalId);
  const doctors = getDoctors(hospitalId);
  const allAppointments = getAppointments({ hospitalId });
  const auditLogs = getAuditLogs(hospitalId);

  const [activeAdminTab, setActiveAdminTab] = useState<'ANALYTICS' | 'SCHEDULES' | 'AUDIT'>('ANALYTICS');
  const [auditSearch, setAuditSearch] = useState('');

  // Selected doctor for schedule configuration
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(doctors[0]?.id || '');
  const editingDoctor = doctors.find((d) => d.id === selectedDoctorId) || doctors[0];

  // Schedule editor form state
  const [scheduleState, setScheduleState] = useState({
    startTime: editingDoctor?.schedule.startTime || '09:00',
    endTime: editingDoctor?.schedule.endTime || '17:00',
    breakStart: editingDoctor?.schedule.breakStart || '13:00',
    breakEnd: editingDoctor?.schedule.breakEnd || '14:00',
    slotDurationMinutes: editingDoctor?.schedule.slotDurationMinutes || 15,
  });

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoctor) return;

    const updatedDoc: Doctor = {
      ...editingDoctor,
      schedule: {
        ...editingDoctor.schedule,
        ...scheduleState,
      },
    };

    updateDoctor(updatedDoc, {
      id: currentUser.id,
      name: currentUser.name,
      role: currentUser.role,
    });

    alert(`Schedule for ${editingDoctor.name} updated successfully! Slot duration: ${scheduleState.slotDurationMinutes} mins.`);
  };

  // Analytics Aggregations
  const totalAppointments = allAppointments.length;
  const completedCount = allAppointments.filter((a) => a.status === 'COMPLETED').length;
  const cancelledCount = allAppointments.filter((a) => a.status === 'CANCELLED').length;
  const missedCount = allAppointments.filter((a) => a.status === 'MISSED').length;

  const cancellationRate = totalAppointments > 0 ? Math.round((cancelledCount / totalAppointments) * 100) : 0;
  const noShowRate = totalAppointments > 0 ? Math.round((missedCount / totalAppointments) * 100) : 0;
  const completionRate = totalAppointments > 0 ? Math.round((completedCount / totalAppointments) * 100) : 0;

  // Department Distribution data
  const deptDist = departments.map((dept) => {
    const count = allAppointments.filter((a) => a.departmentId === dept.id).length;
    return { name: dept.name, count };
  });

  // Hourly arrival distribution (8 AM - 5 PM)
  const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
  const hourlyData = hours.map((hr) => {
    const hrInt = parseInt(hr.split(':')[0]);
    const count = allAppointments.filter((a) => {
      const aptHr = parseInt(a.startTime.split(':')[0]);
      return aptHr === hrInt;
    }).length;
    return { hour: hr, count };
  });
  const maxHourly = Math.max(...hourlyData.map((h) => h.count), 1);

  // Filtered Audit Logs
  const filteredAuditLogs = auditLogs.filter((log) => {
    const q = auditSearch.toLowerCase().trim();
    return (
      !q ||
      log.actorName.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q) ||
      log.resource.toLowerCase().includes(q) ||
      log.details.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Admin Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-700 uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Hospital Management & Clinical Operations
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
            {currentHospital.name} Administration
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational analytics, doctor schedule engine configurations, and security audit logs.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveAdminTab('ANALYTICS')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeAdminTab === 'ANALYTICS'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Analytics & KPIs
          </button>
          <button
            onClick={() => setActiveAdminTab('SCHEDULES')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeAdminTab === 'SCHEDULES'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Doctor Schedules
          </button>
          <button
            onClick={() => setActiveAdminTab('AUDIT')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeAdminTab === 'AUDIT'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Security Audit Trail
          </button>
        </div>
      </div>

      {/* TAB 1: OPERATIONAL ANALYTICS & CHARTS */}
      {activeAdminTab === 'ANALYTICS' && (
        <div className="space-y-6">
          {/* Executive KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
              <div className="text-[10px] font-bold uppercase text-slate-400">Total Bookings</div>
              <div className="text-2xl font-black text-slate-900 mt-1">{totalAppointments}</div>
              <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                {completionRate}% Completion Rate
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
              <div className="text-[10px] font-bold uppercase text-slate-400">Cancellation Rate</div>
              <div className="text-2xl font-black text-rose-600 mt-1">{cancellationRate}%</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{cancelledCount} cancelled</div>
            </div>
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
              <div className="text-[10px] font-bold uppercase text-slate-400">No-Show Risk Metric</div>
              <div className="text-2xl font-black text-amber-600 mt-1">{noShowRate}%</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Industry avg ~14%</div>
            </div>
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
              <div className="text-[10px] font-bold uppercase text-slate-400">Avg OPD Wait Time</div>
              <div className="text-2xl font-black text-teal-600 mt-1">18.4m</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Target clinical SLA &lt; 20m</div>
            </div>
          </div>

          {/* Interactive Responsive Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Peak OPD Arrival Hours */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Peak OPD Arrival Hours</h3>
                <p className="text-xs text-slate-500">Distribution of patient appointments throughout clinic hours</p>
              </div>

              {/* Responsive SVG Bar Chart */}
              <div className="h-56 flex items-end justify-between gap-2 pt-6 pb-2 px-2">
                {hourlyData.map((item) => {
                  const heightPercent = Math.max(12, Math.round((item.count / maxHourly) * 100));
                  return (
                    <div key={item.hour} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                      <div className="text-[10px] font-bold text-slate-600 opacity-0 group-hover:opacity-100 transition">
                        {item.count}
                      </div>
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className="w-full rounded-t-lg bg-teal-500 group-hover:bg-teal-600 transition shadow-xs"
                      ></div>
                      <span className="text-[9px] text-slate-400 font-mono mt-1">{item.hour.slice(0, 2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chart 2: Specialty & Department Load */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Department Volume & Utilization</h3>
                <p className="text-xs text-slate-500">Patient consultations categorized by medical specialty</p>
              </div>

              <div className="space-y-3 pt-2">
                {deptDist.map((item) => {
                  const totalCount = totalAppointments || 1;
                  const pct = Math.round((item.count / totalCount) * 100);
                  return (
                    <div key={item.name} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-slate-800">
                        <span>{item.name}</span>
                        <span className="text-slate-500">{item.count} patients ({pct}%)</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          style={{ width: `${Math.max(5, pct)}%` }}
                          className="h-full bg-gradient-to-r from-teal-500 to-blue-500 rounded-full"
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DOCTOR SCHEDULE ENGINE */}
      {activeAdminTab === 'SCHEDULES' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Doctor Scheduling & Slot Engine</h2>
            <p className="text-xs text-slate-500">
              Configure clinic working hours, consultation duration (15m, 20m, 30m), breaks, and leaves.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Doctor Picker */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Physician
              </label>
              <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                {doctors.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => {
                      setSelectedDoctorId(doc.id);
                      setScheduleState({
                        startTime: doc.schedule.startTime,
                        endTime: doc.schedule.endTime,
                        breakStart: doc.schedule.breakStart,
                        breakEnd: doc.schedule.breakEnd,
                        slotDurationMinutes: doc.schedule.slotDurationMinutes,
                      });
                    }}
                    className={`w-full p-3 rounded-xl border text-left text-xs transition flex items-center gap-3 ${
                      selectedDoctorId === doc.id
                        ? 'border-teal-600 bg-teal-50/50 font-bold text-teal-900 shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <img
                      src={doc.avatarUrl || 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=256'}
                      alt={doc.name}
                      className="w-8 h-8 rounded-lg object-cover"
                    />
                    <div className="truncate">
                      <div className="truncate">{doc.name}</div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        Room {doc.roomNumber} • {doc.schedule.slotDurationMinutes}m slots
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Schedule Editor Form */}
            <div className="md:col-span-2">
              <form onSubmit={handleSaveSchedule} className="space-y-4 p-5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="font-bold text-sm text-slate-900 border-b border-slate-200/80 pb-2">
                  Operating Rules for {editingDoctor.name}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Clinic Start Time</label>
                    <input
                      type="time"
                      value={scheduleState.startTime}
                      onChange={(e) => setScheduleState({ ...scheduleState, startTime: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Clinic End Time</label>
                    <input
                      type="time"
                      value={scheduleState.endTime}
                      onChange={(e) => setScheduleState({ ...scheduleState, endTime: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Break Start (Lunch)</label>
                    <input
                      type="time"
                      value={scheduleState.breakStart}
                      onChange={(e) => setScheduleState({ ...scheduleState, breakStart: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Break End</label>
                    <input
                      type="time"
                      value={scheduleState.breakEnd}
                      onChange={(e) => setScheduleState({ ...scheduleState, breakEnd: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Consultation Slot Duration
                    </label>
                    <select
                      value={scheduleState.slotDurationMinutes}
                      onChange={(e) =>
                        setScheduleState({ ...scheduleState, slotDurationMinutes: parseInt(e.target.value) })
                      }
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold"
                    >
                      <option value={15}>15 Minutes (High Throughput)</option>
                      <option value={20}>20 Minutes (Standard Specialty)</option>
                      <option value={30}>30 Minutes (Deep Clinical Review)</option>
                      <option value={45}>45 Minutes (Surgical / Oncology)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Consultation Fee ($)</label>
                    <input
                      type="number"
                      value={editingDoctor.consultationFee}
                      disabled
                      className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-500"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200/80 flex items-center justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/20 transition"
                  >
                    Save & Regenerate Available Slots
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT TRAIL */}
      {activeAdminTab === 'AUDIT' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Hospital Security & Operational Audit Log</h2>
              <p className="text-xs text-slate-500">
                Immutable trace of patient bookings, queue transitions, doctor delays, and cancellations.
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search audit trail..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="pb-2.5">Timestamp</th>
                  <th className="pb-2.5">Actor & Role</th>
                  <th className="pb-2.5">Action</th>
                  <th className="pb-2.5">Resource</th>
                  <th className="pb-2.5">Transition / Details</th>
                  <th className="pb-2.5">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No matching audit records.
                    </td>
                  </tr>
                ) : (
                  filteredAuditLogs.slice(0, 50).map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5">
                        <div className="font-bold text-slate-900">{log.actorName}</div>
                        <div className="text-[10px] text-slate-400 font-semibold">{log.actorRole}</div>
                      </td>
                      <td className="py-2.5">
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 font-semibold text-slate-700">{log.resource}</td>
                      <td className="py-2.5 text-slate-600 max-w-xs truncate" title={log.details}>
                        {log.oldValue && log.newValue ? (
                          <span>
                            <span className="line-through text-slate-400">{log.oldValue}</span> →{' '}
                            <span className="font-bold text-teal-700">{log.newValue}</span>
                          </span>
                        ) : (
                          log.details
                        )}
                      </td>
                      <td className="py-2.5 font-mono text-[10px] text-slate-400">{log.ipAddress}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
