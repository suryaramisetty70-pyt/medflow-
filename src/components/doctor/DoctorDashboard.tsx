import React, { useState, useEffect } from 'react';
import {
  User,
  Clock,
  CheckCircle,
  AlertCircle,
  Play,
  Check,
  Plus,
  Trash2,
  Volume2,
  FileText,
  Calendar,
  AlertTriangle,
  Stethoscope,
  XCircle,
  Send,
  Video,
} from 'lucide-react';
import {
  Doctor,
  Appointment,
  PrescriptionItem,
  Consultation,
} from '../../types';
import {
  getCurrentUser,
  getDoctors,
  getDoctor,
  updateDoctor,
  getAppointments,
  saveAppointment,
  addNotification,
  getActiveHospitalId,
  getDepartments,
} from '../../services/storage';
import { validateAppointmentTransition } from '../../services/schedulingEngine';
import { announceToken } from '../../services/audioService';

export const DoctorDashboard: React.FC = () => {
  const currentUser = getCurrentUser();
  const hospitalId = getActiveHospitalId();
  const departments = getDepartments(hospitalId);
  const doctors = getDoctors(hospitalId);

  // Active doctor (defaults to Dr. Priya Sharma if currentUser has doctorId 'doc-1')
  const doctorId = currentUser.doctorId || 'doc-1';
  const doctor = getDoctor(doctorId) || doctors[0];
  const department = departments.find((d) => d.id === doctor.departmentId);

  const todayStr = new Date().toISOString().split('T')[0];
  const allAppointments = getAppointments({ doctorId: doctor.id, date: todayStr });

  // Today's appointments categorized
  const inConsultationApt = allAppointments.find((a) => a.status === 'IN_CONSULTATION');
  const waitingApts = allAppointments
    .filter((a) => a.status === 'WAITING' || a.status === 'CHECKED_IN')
    .sort((a, b) => {
      // Prioritize EMERGENCY, then WALK_IN, then regular time
      if (a.priority === 'EMERGENCY' && b.priority !== 'EMERGENCY') return -1;
      if (b.priority === 'EMERGENCY' && a.priority !== 'EMERGENCY') return 1;
      return a.startTime.localeCompare(b.startTime);
    });
  const upcomingConfirmed = allAppointments.filter((a) => a.status === 'CONFIRMED');
  const completedApts = allAppointments.filter((a) => a.status === 'COMPLETED');
  const cancelledOrMissed = allAppointments.filter((a) => a.status === 'CANCELLED' || a.status === 'MISSED');

  // Consultation in progress state
  const [diagnosis, setDiagnosis] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([
    { id: '1', medicine: '', dosage: '', frequency: '', duration: '', instructions: '' },
  ]);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [delayInput, setDelayInput] = useState<number>(doctor.currentDelayMinutes || 0);

  // Live timer for active consultation
  useEffect(() => {
    let interval: any = null;
    if (inConsultationApt) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setTimerSeconds(0);
    }
    return () => clearInterval(interval);
  }, [inConsultationApt?.id]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Prescription builder helpers
  const handleAddPrescriptionRow = () => {
    setPrescriptions([
      ...prescriptions,
      { id: Date.now().toString(), medicine: '', dosage: '', frequency: '', duration: '', instructions: '' },
    ]);
  };

  const handleRemovePrescriptionRow = (id: string) => {
    setPrescriptions(prescriptions.filter((p) => p.id !== id));
  };

  const handlePrescriptionChange = (id: string, field: keyof PrescriptionItem, val: string) => {
    setPrescriptions(
      prescriptions.map((p) => (p.id === id ? { ...p, [field]: val } : p))
    );
  };

  // 1. Call Next Patient Workflow
  const handleCallNextPatient = async (targetApt?: Appointment) => {
    const nextPatient = targetApt || waitingApts[0];
    if (!nextPatient) {
      alert('No waiting patients in queue.');
      return;
    }

    // Validate transition
    const transition = validateAppointmentTransition(nextPatient.status, 'IN_CONSULTATION');
    if (!transition.valid) {
      alert(transition.reason);
      return;
    }

    // If another consultation was active, complete or prompt
    if (inConsultationApt && inConsultationApt.id !== nextPatient.id) {
      if (!confirm(`Patient ${inConsultationApt.patientName} (${inConsultationApt.tokenNumber}) is currently in consultation. Conclude their session to call ${nextPatient.patientName}?`)) {
        return;
      }
      handleCompleteConsultation();
    }

    const updatedApt: Appointment = {
      ...nextPatient,
      status: 'IN_CONSULTATION',
      consultationStartedAt: new Date().toISOString(),
    };

    saveAppointment(updatedApt, {
      id: currentUser.id,
      name: currentUser.name,
      role: currentUser.role,
    });

    // Announce token with chime + Gemini TTS
    announceToken({
      tokenNumber: updatedApt.tokenNumber,
      patientName: updatedApt.patientName,
      doctorName: doctor.name,
      roomNumber: doctor.roomNumber,
      departmentName: department?.name || 'OPD',
    });

    // Notify patient
    addNotification({
      userId: updatedApt.patientId,
      title: `Token ${updatedApt.tokenNumber} is Now Calling!`,
      message: `Dr. ${doctor.name} is ready for you in Room ${doctor.roomNumber}. Please enter the consultation room.`,
      channel: 'SMS',
      type: 'QUEUE_ALERT',
    });

    // Reset notes form for new patient
    setDiagnosis('');
    setClinicalNotes('');
    setPrescriptions([{ id: '1', medicine: '', dosage: '', frequency: '', duration: '', instructions: '' }]);
  };

  // 2. Complete Consultation Workflow
  const handleCompleteConsultation = () => {
    if (!inConsultationApt) return;

    const transition = validateAppointmentTransition(inConsultationApt.status, 'COMPLETED');
    if (!transition.valid) {
      alert(transition.reason);
      return;
    }

    const consultationData: Consultation = {
      id: `cons-${Date.now()}`,
      appointmentId: inConsultationApt.id,
      doctorId: doctor.id,
      patientId: inConsultationApt.patientId,
      chiefComplaint: inConsultationApt.reason,
      diagnosis: diagnosis || 'Clinical evaluation completed. Vitals within expected parameters.',
      clinicalNotes: clinicalNotes || 'Patient examined. Advised routine follow-up and dietary discipline.',
      prescriptions: prescriptions.filter((p) => p.medicine.trim() !== ''),
      completedAt: new Date().toISOString(),
    };

    saveAppointment(
      {
        ...inConsultationApt,
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
        consultation: consultationData,
      },
      { id: currentUser.id, name: currentUser.name, role: currentUser.role }
    );

    addNotification({
      userId: inConsultationApt.patientId,
      title: 'Consultation Completed & e-Prescription Issued',
      message: `Your consultation with ${doctor.name} is complete. Your prescription is available on the patient dashboard.`,
      channel: 'IN_APP',
      type: 'BOOKING',
    });

    setDiagnosis('');
    setClinicalNotes('');
    setPrescriptions([{ id: '1', medicine: '', dosage: '', frequency: '', duration: '', instructions: '' }]);
  };

  // 3. Mark No-show
  const handleMarkNoShow = (apt: Appointment) => {
    if (confirm(`Mark Token ${apt.tokenNumber} (${apt.patientName}) as Missed / No-Show?`)) {
      saveAppointment(
        {
          ...apt,
          status: 'MISSED',
          cancellationReason: 'Patient failed to appear after multiple announcement calls.',
        },
        { id: currentUser.id, name: currentUser.name, role: currentUser.role }
      );
    }
  };

  // 4. Update Delay
  const handleUpdateDelay = (minutes: number) => {
    setDelayInput(minutes);
    const updatedDoc: Doctor = {
      ...doctor,
      currentDelayMinutes: minutes,
      status: minutes > 0 ? 'DELAYED' : 'AVAILABLE',
    };
    updateDoctor(updatedDoc, {
      id: currentUser.id,
      name: currentUser.name,
      role: currentUser.role,
    });

    if (minutes > 0) {
      // Broadcast notification to all waiting patients
      waitingApts.forEach((a) => {
        addNotification({
          userId: a.patientId,
          title: `OPD Delay Notice: ${doctor.name}`,
          message: `Doctor is currently delayed by ~${minutes} minutes due to clinical case complexity. Your estimated wait has been updated.`,
          channel: 'SMS',
          type: 'DELAY',
        });
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Doctor OPD Status */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img
            src={doctor.avatarUrl || 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=256'}
            alt={doctor.name}
            className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shadow-sm"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{doctor.name}</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Room {doctor.roomNumber}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {doctor.title} • {department?.name} • OPD Suite
            </p>
          </div>
        </div>

        {/* Doctor Delay Broadcaster Control */}
        <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200">
          <div className="text-xs font-semibold text-slate-600 px-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Clinic Delay:</span>
            <span className={`font-bold ${doctor.currentDelayMinutes > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              +{doctor.currentDelayMinutes}m
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handleUpdateDelay(0)}
              className={`px-2 py-1 rounded text-[11px] font-bold transition ${
                doctor.currentDelayMinutes === 0
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              On Time
            </button>
            <button
              onClick={() => handleUpdateDelay(10)}
              className={`px-2 py-1 rounded text-[11px] font-bold transition ${
                doctor.currentDelayMinutes === 10
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              +10m
            </button>
            <button
              onClick={() => handleUpdateDelay(15)}
              className={`px-2 py-1 rounded text-[11px] font-bold transition ${
                doctor.currentDelayMinutes === 15
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              +15m
            </button>
            <button
              onClick={() => handleUpdateDelay(30)}
              className={`px-2 py-1 rounded text-[11px] font-bold transition ${
                doctor.currentDelayMinutes === 30
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              +30m
            </button>
          </div>
        </div>
      </div>

      {/* OPD KPI Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold uppercase text-slate-400">Total Today</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{allAppointments.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Scheduled appointments</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold uppercase text-slate-400">Waiting in Queue</div>
          <div className="text-2xl font-black text-teal-600 mt-1">{waitingApts.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Checked in & waiting</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold uppercase text-slate-400">Completed</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{completedApts.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Consultations finished</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold uppercase text-slate-400">Avg Consult Pace</div>
          <div className="text-2xl font-black text-blue-600 mt-1">{doctor.avgConsultationMinutes}m</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Target slot duration</div>
        </div>
      </div>

      {/* MAIN TWO COLUMN CLINICAL WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Current Patient Consultation Console (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-700">
                  Active Consultation Room
                </span>
                <h2 className="text-lg font-bold text-slate-900 mt-0.5">Clinical Examination Console</h2>
              </div>

              {inConsultationApt && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="font-mono font-bold text-sm">{formatTimer(timerSeconds)}</span>
                </div>
              )}
            </div>

            {inConsultationApt ? (
              <div className="space-y-4">
                {/* Patient Header Card */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-extrabold text-teal-800 bg-teal-100 px-2 py-0.5 rounded">
                        Token {inConsultationApt.tokenNumber}
                      </span>
                      <h3 className="text-base font-bold text-slate-900">{inConsultationApt.patientName}</h3>
                      <span className="text-xs text-slate-500">
                        ({inConsultationApt.patientAge || '34'}y • {inConsultationApt.patientGender || 'Adult'})
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      <span className="font-semibold text-slate-700">Chief Complaint:</span>{' '}
                      {inConsultationApt.reason}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {inConsultationApt.meetLink && (
                      <a
                        href={inConsultationApt.meetLink}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-semibold flex items-center gap-1"
                      >
                        <Video className="w-3.5 h-3.5" /> Video Call
                      </a>
                    )}
                    <button
                      onClick={() => handleMarkNoShow(inConsultationApt)}
                      className="px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 text-xs font-semibold hover:bg-rose-50"
                    >
                      Patient Absent
                    </button>
                  </div>
                </div>

                {/* Clinical Notes Inputs */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Diagnosis / Clinical Impression
                  </label>
                  <input
                    type="text"
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    placeholder="e.g., Essential Hypertension, Acute Bronchitis, Tension Headache"
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Doctor Clinical Notes & Findings
                  </label>
                  <textarea
                    rows={3}
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                    placeholder="Physical examination notes, auscultation, blood pressure readings, lifestyle advice..."
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                {/* e-Prescription Builder */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      e-Prescriptions (Medications)
                    </label>
                    <button
                      type="button"
                      onClick={handleAddPrescriptionRow}
                      className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Drug
                    </button>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {prescriptions.map((rx) => (
                      <div key={rx.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            type="text"
                            placeholder="Medicine Name (e.g. Amoxicillin)"
                            value={rx.medicine}
                            onChange={(e) => handlePrescriptionChange(rx.id, 'medicine', e.target.value)}
                            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"
                          />
                          <input
                            type="text"
                            placeholder="Dosage (e.g. 500 mg)"
                            value={rx.dosage}
                            onChange={(e) => handlePrescriptionChange(rx.id, 'dosage', e.target.value)}
                            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"
                          />
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              placeholder="Frequency (1-0-1)"
                              value={rx.frequency}
                              onChange={(e) => handlePrescriptionChange(rx.id, 'frequency', e.target.value)}
                              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 w-full"
                            />
                            {prescriptions.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemovePrescriptionRow(rx.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Duration (e.g. 7 days)"
                            value={rx.duration}
                            onChange={(e) => handlePrescriptionChange(rx.id, 'duration', e.target.value)}
                            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"
                          />
                          <input
                            type="text"
                            placeholder="Instructions (e.g. After food)"
                            value={rx.instructions}
                            onChange={(e) => handlePrescriptionChange(rx.id, 'instructions', e.target.value)}
                            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Conclude Session Button */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Duration: {formatTimer(timerSeconds)}
                  </span>
                  <button
                    onClick={handleCompleteConsultation}
                    className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-600/20 flex items-center gap-2 transition"
                  >
                    <Check className="w-4 h-4" />
                    <span>Complete Consultation & Save Rx</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Stethoscope className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-slate-800">No Patient in Room Currently</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Select a waiting patient from your queue or click &quot;Call Next Patient&quot; to begin the consultation session.
                </p>
                {waitingApts.length > 0 && (
                  <button
                    onClick={() => handleCallNextPatient()}
                    className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/20 inline-flex items-center gap-2 transition"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>Call Next Patient ({waitingApts[0].tokenNumber})</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live OPD Queue & Waiting Patients (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Waiting OPD Queue</h2>
                <p className="text-xs text-slate-500">{waitingApts.length} checked-in patients in waiting lobby</p>
              </div>

              {waitingApts.length > 0 && (
                <button
                  onClick={() => handleCallNextPatient()}
                  className="px-3 py-1.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 text-xs font-bold hover:bg-teal-100 transition flex items-center gap-1.5"
                  title="Audible chime + voice announcement"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  Call Next
                </button>
              )}
            </div>

            {waitingApts.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                No patients waiting currently in the lobby.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {waitingApts.map((apt, idx) => (
                  <div
                    key={apt.id}
                    className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 transition flex items-center justify-between gap-3 bg-white"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                          {apt.tokenNumber}
                        </span>
                        <span className="font-bold text-xs text-slate-900 truncate">
                          {apt.patientName}
                        </span>
                        {apt.priority === 'EMERGENCY' && (
                          <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                            Emergency
                          </span>
                        )}
                        {apt.priority === 'WALK_IN' && (
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                            Walk-In
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-1">
                        Scheduled: {apt.startTime} • {apt.reason}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleCallNextPatient(apt)}
                        className="px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition flex items-center gap-1"
                        title="Call patient to consultation room"
                      >
                        <Play className="w-3 h-3" /> Call
                      </button>
                      <button
                        onClick={() => handleMarkNoShow(apt)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Mark No-Show"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Today's Completed Patients */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              Completed Today ({completedApts.length})
            </h3>
            {completedApts.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No completed consultations yet today.</p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto text-xs">
                {completedApts.map((apt) => (
                  <div key={apt.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-800">
                        {apt.tokenNumber} • {apt.patientName}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {apt.consultation?.diagnosis || 'Consultation concluded'}
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-600 px-2 py-0.5 rounded bg-emerald-50">
                      Done
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
