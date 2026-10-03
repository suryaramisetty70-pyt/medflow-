import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  User,
  Heart,
  Brain,
  Bone,
  Baby,
  Sparkles,
  Stethoscope,
  Activity,
  CheckCircle2,
  AlertCircle,
  Video,
  CalendarPlus,
  Mail,
  FileText,
  XCircle,
  ChevronRight,
  ArrowRight,
  ShieldCheck,
  Building,
  Hourglass,
  Download,
} from 'lucide-react';
import {
  Department,
  Doctor,
  Appointment,
  TimeSlot,
  QueuePriority,
} from '../../types';
import {
  getDepartments,
  getDoctors,
  getAppointments,
  saveAppointment,
  addNotification,
  getCurrentUser,
  getActiveHospitalId,
  getHospitals,
} from '../../services/storage';
import {
  generateAvailableSlots,
  generateTokenNumber,
  calculateWaitTime,
  calculateNoShowRisk,
  hasTimeConflict,
  validateAppointmentTransition,
} from '../../services/schedulingEngine';
import {
  createGoogleCalendarUrl,
  downloadIcsFile,
  createGmailComposeUrl,
  generateMeetLink,
} from '../../services/workspaceService';

export const PatientDashboard: React.FC<{ onOpenAiAssistant: () => void }> = ({ onOpenAiAssistant }) => {
  const currentUser = getCurrentUser();
  const hospitalId = getActiveHospitalId();
  const hospitals = getHospitals();
  const currentHospital = hospitals.find((h) => h.id === hospitalId) || hospitals[0];

  const departments = getDepartments(hospitalId);
  const doctors = getDoctors(hospitalId);
  const allAppointments = getAppointments({ hospitalId });

  // Patient's appointments
  const myAppointments = allAppointments.filter(
    (a) => a.patientId === currentUser.patientId || a.patientPhone === currentUser.phone
  );

  const todayStr = new Date().toISOString().split('T')[0];

  // Find active appointment for today
  const activeAppointment = myAppointments.find(
    (a) =>
      a.appointmentDate === todayStr &&
      ['CONFIRMED', 'CHECKED_IN', 'WAITING', 'IN_CONSULTATION'].includes(a.status)
  );

  // Tab State
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'BOOK' | 'MY_APPOINTMENTS' | 'OPD_QUEUES'>('OVERVIEW');

  // Booking Flow State
  const [selectedDeptId, setSelectedDeptId] = useState<string>(departments[0]?.id || 'dept-1');
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [reason, setReason] = useState<string>('');
  const [bookingPriority, setBookingPriority] = useState<QueuePriority>('NORMAL');
  const [isTelehealth, setIsTelehealth] = useState<boolean>(false);
  const [bookingSuccessApt, setBookingSuccessApt] = useState<Appointment | null>(null);
  const [viewingPrescription, setViewingPrescription] = useState<Appointment | null>(null);

  // Active doctor details
  const activeDoctor = activeAppointment ? doctors.find((d) => d.id === activeAppointment.doctorId) : null;

  // Active queue calculations
  const doctorTodayApts = activeDoctor
    ? allAppointments
        .filter((a) => a.doctorId === activeDoctor.id && a.appointmentDate === todayStr)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
    : [];

  const inConsultationApt = doctorTodayApts.find((a) => a.status === 'IN_CONSULTATION');
  const waitingApts = doctorTodayApts.filter((a) => a.status === 'WAITING' || a.status === 'CHECKED_IN');
  const myIndexInQueue = activeAppointment
    ? waitingApts.findIndex((a) => a.id === activeAppointment.id)
    : -1;
  const patientsAhead = myIndexInQueue >= 0 ? myIndexInQueue : 0;

  const waitCalculation = activeDoctor
    ? calculateWaitTime(activeDoctor, patientsAhead, activeAppointment?.priority)
    : { estimatedMinutes: 15, confidence: 'HIGH', varianceMinutes: 5 };

  // Filtered doctors for booking
  const deptDoctors = doctors.filter((d) => d.departmentId === selectedDeptId);

  // Available slots for selected doctor & date
  const bookingDoctor = doctors.find((d) => d.id === selectedDocId) || deptDoctors[0];
  const availableSlots: TimeSlot[] = bookingDoctor
    ? generateAvailableSlots(bookingDoctor, selectedDate, allAppointments)
    : [];

  const handleStartBookingWithDoctor = (docId: string, deptId: string) => {
    setSelectedDeptId(deptId);
    setSelectedDocId(docId);
    setActiveTab('BOOK');
  };

  const handleConfirmBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingDoctor || !selectedSlot) return;

    // Check conflict double protection
    const conflict = hasTimeConflict(
      bookingDoctor.id,
      selectedDate,
      selectedSlot.time,
      selectedSlot.endTime,
      allAppointments
    );

    if (conflict) {
      alert('This slot was just reserved by another patient. Please choose an alternative slot.');
      return;
    }

    const todayDeptApts = allAppointments.filter(
      (a) => a.departmentId === bookingDoctor.departmentId && a.appointmentDate === selectedDate
    );
    const token = generateTokenNumber(
      departments.find((d) => d.id === bookingDoctor.departmentId)?.code || 'GEN',
      todayDeptApts.length
    );

    const leadDays = Math.max(
      0,
      Math.round((new Date(selectedDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24))
    );
    const noShowCalc = calculateNoShowRisk({
      leadTimeDays: leadDays,
      pastNoShows: 0,
      pastTotalAppointments: 2,
      bookingSource: 'ONLINE',
      dayOfWeek: new Date(selectedDate).getDay(),
      timeSlotMinutes: parseInt(selectedSlot.time.split(':')[0]) * 60,
      isConfirmed: true,
    });

    const newAptId = `apt-${Date.now()}`;
    const newAppointment: Appointment = {
      id: newAptId,
      hospitalId,
      patientId: currentUser.patientId || 'pat-1',
      patientName: currentUser.name,
      patientPhone: currentUser.phone,
      patientAge: 34,
      patientGender: 'FEMALE',
      doctorId: bookingDoctor.id,
      doctorName: bookingDoctor.name,
      departmentId: bookingDoctor.departmentId,
      departmentName: departments.find((d) => d.id === bookingDoctor.departmentId)?.name || 'Outpatient',
      appointmentDate: selectedDate,
      startTime: selectedSlot.time,
      endTime: selectedSlot.endTime,
      status: 'CONFIRMED',
      reason: reason || 'General medical consultation and symptom review',
      tokenNumber: token,
      priority: bookingPriority,
      bookingSource: 'ONLINE',
      noShowRiskScore: noShowCalc.score,
      noShowRiskLevel: noShowCalc.level,
      estimatedWaitMinutes: bookingDoctor.currentDelayMinutes || 0,
      meetLink: isTelehealth ? generateMeetLink(newAptId) : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveAppointment(newAppointment, {
      id: currentUser.id,
      name: currentUser.name,
      role: currentUser.role,
    });

    addNotification({
      userId: currentUser.id,
      title: 'Appointment Booked Successfully',
      message: `Confirmed with ${bookingDoctor.name} on ${selectedDate} at ${selectedSlot.time}. Token: ${token}`,
      channel: 'IN_APP',
      type: 'BOOKING',
    });

    setBookingSuccessApt(newAppointment);
    setReason('');
    setSelectedSlot(null);
  };

  const handleCancelAppointment = (aptId: string) => {
    const apt = allAppointments.find((a) => a.id === aptId);
    if (!apt) return;

    const transition = validateAppointmentTransition(apt.status, 'CANCELLED');
    if (!transition.valid) {
      alert(transition.reason);
      return;
    }

    if (confirm(`Are you sure you want to cancel your appointment with ${apt.doctorName}?`)) {
      saveAppointment(
        {
          ...apt,
          status: 'CANCELLED',
          cancelledAt: new Date().toISOString(),
          cancellationReason: 'Cancelled by patient via portal',
        },
        { id: currentUser.id, name: currentUser.name, role: currentUser.role }
      );
    }
  };

  const getDeptIcon = (iconName: string) => {
    switch (iconName) {
      case 'Heart': return <Heart className="w-5 h-5 text-rose-500" />;
      case 'Brain': return <Brain className="w-5 h-5 text-purple-500" />;
      case 'Bone': return <Bone className="w-5 h-5 text-amber-500" />;
      case 'Baby': return <Baby className="w-5 h-5 text-sky-500" />;
      case 'Sparkles': return <Sparkles className="w-5 h-5 text-pink-500" />;
      case 'Stethoscope': return <Stethoscope className="w-5 h-5 text-teal-500" />;
      case 'Activity': return <Activity className="w-5 h-5 text-indigo-500" />;
      default: return <Building className="w-5 h-5 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Patient Welcome & Navigation Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Patient OPD Portal • {currentHospital.name}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
            Welcome back, {currentUser.name}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Book appointments, track real-time queue tokens, and view clinical e-prescriptions.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
              activeTab === 'OVERVIEW'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Live OPD Tracker
          </button>
          <button
            onClick={() => {
              setActiveTab('BOOK');
              setBookingSuccessApt(null);
            }}
            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
              activeTab === 'BOOK'
                ? 'bg-white text-teal-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Book Appointment
          </button>
          <button
            onClick={() => setActiveTab('MY_APPOINTMENTS')}
            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
              activeTab === 'MY_APPOINTMENTS'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            My Appointments ({myAppointments.length})
          </button>
          <button
            onClick={() => setActiveTab('OPD_QUEUES')}
            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
              activeTab === 'OPD_QUEUES'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Clinic Queues
          </button>
        </div>
      </div>

      {/* TAB 1: OVERVIEW & ACTIVE QUEUE TRACKER */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          {/* Active Appointment Hero Banner */}
          {activeAppointment ? (
            <div className="relative overflow-hidden bg-linear-to-br from-slate-900 via-teal-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
              <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>

              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-bold tracking-wide uppercase border border-teal-500/30">
                    <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping"></span>
                    Live Consultation Token Today
                  </div>

                  <div className="flex items-baseline gap-4 mt-3">
                    <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-white">
                      Token {activeAppointment.tokenNumber}
                    </h2>
                    <span className="text-sm font-semibold px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {activeAppointment.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-slate-300 text-xs sm:text-sm mt-3">
                    <span className="flex items-center gap-1.5 font-medium">
                      <User className="w-4 h-4 text-teal-400" />
                      {activeAppointment.doctorName}
                    </span>
                    <span className="flex items-center gap-1.5 font-medium">
                      <Building className="w-4 h-4 text-teal-400" />
                      {activeAppointment.departmentName} (Room {activeDoctor?.roomNumber || '101'})
                    </span>
                    <span className="flex items-center gap-1.5 font-medium">
                      <Clock className="w-4 h-4 text-teal-400" />
                      Scheduled: {activeAppointment.startTime} - {activeAppointment.endTime}
                    </span>
                  </div>
                </div>

                {/* Queue Metrics Card */}
                <div className="grid grid-cols-3 gap-3 bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-center min-w-[280px]">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Now Calling
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-amber-400 mt-0.5">
                      {inConsultationApt ? inConsultationApt.tokenNumber : 'None'}
                    </div>
                    <div className="text-[10px] text-slate-300 mt-0.5">In Room</div>
                  </div>
                  <div className="border-x border-white/10 px-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Patients Ahead
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-teal-300 mt-0.5">
                      {patientsAhead}
                    </div>
                    <div className="text-[10px] text-slate-300 mt-0.5">In Waiting</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Est. Wait
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-0.5">
                      ~{waitCalculation.estimatedMinutes}m
                    </div>
                    <div className="text-[10px] text-slate-300 mt-0.5">Confidence: High</div>
                  </div>
                </div>
              </div>

              {/* Progress Bar & Google Workspace Sync */}
              <div className="relative z-10 mt-6 pt-6 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="text-xs text-slate-300 flex items-center gap-2">
                  <Hourglass className="w-4 h-4 text-teal-400 animate-spin" />
                  <span>
                    Status:{' '}
                    {patientsAhead === 0
                      ? 'You are next! Please be seated right outside Room ' + (activeDoctor?.roomNumber || '101')
                      : `Approximately ${waitCalculation.estimatedMinutes} minutes remaining. Watch the overhead display.`}
                  </span>
                </div>

                {/* Integration Links */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Google Calendar Link */}
                  <a
                    href={createGoogleCalendarUrl(activeAppointment)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition"
                  >
                    <CalendarPlus className="w-3.5 h-3.5" />
                    Google Calendar
                  </a>

                  {/* ICS Download */}
                  <button
                    onClick={() => downloadIcsFile(activeAppointment)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition"
                    title="Download iCal file"
                  >
                    <Download className="w-3.5 h-3.5" />
                    .ICS
                  </button>

                  {/* Google Meet Link */}
                  {activeAppointment.meetLink && (
                    <a
                      href={activeAppointment.meetLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold shadow-xs transition"
                    >
                      <Video className="w-3.5 h-3.5" />
                      Join Google Meet
                    </a>
                  )}

                  {/* Gmail Confirmation */}
                  <a
                    href={createGmailComposeUrl(activeAppointment)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Email Slip
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-linear-to-r from-teal-50 to-emerald-50 border border-teal-200/80 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-md">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">No appointments scheduled for today</h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Need a consultation? Book an available OPD slot or consult with our AI scheduling assistant.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setActiveTab('BOOK')}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition"
                >
                  Book OPD Slot
                </button>
                <button
                  onClick={onOpenAiAssistant}
                  className="px-3.5 py-2 rounded-xl bg-white border border-teal-300 text-teal-800 text-xs font-bold hover:bg-teal-50 transition flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                  Ask AI
                </button>
              </div>
            </div>
          )}

          {/* Quick Specialties Directory */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Medical Specialties & Departments</h3>
                <p className="text-xs text-slate-500">Select a specialty to view doctors and book instant slots.</p>
              </div>
              <button
                onClick={() => setActiveTab('BOOK')}
                className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1"
              >
                View all <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {departments.map((dept) => {
                const docCount = doctors.filter((d) => d.departmentId === dept.id).length;
                return (
                  <button
                    key={dept.id}
                    onClick={() => {
                      setSelectedDeptId(dept.id);
                      setActiveTab('BOOK');
                    }}
                    className="p-4 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/30 transition text-left group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-50 group-hover:bg-white flex items-center justify-center border border-slate-100 shadow-xs">
                      {getDeptIcon(dept.icon)}
                    </div>
                    <div className="font-bold text-sm text-slate-900 mt-2.5 group-hover:text-teal-700">
                      {dept.name}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {docCount} {docCount === 1 ? 'Doctor' : 'Doctors'} • {dept.floor}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Top Doctors Available Today */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 mb-1">Doctors On Duty Today</h3>
            <p className="text-xs text-slate-500 mb-4">Real-time availability and verified OPD consultation schedules.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {doctors.slice(0, 6).map((doc) => {
                const dept = departments.find((d) => d.id === doc.departmentId);
                return (
                  <div
                    key={doc.id}
                    className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition flex flex-col justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={doc.avatarUrl || 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=256'}
                        alt={doc.name}
                        className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-900 truncate">{doc.name}</div>
                        <div className="text-xs text-teal-700 font-medium truncate">{dept?.name}</div>
                        <div className="text-[11px] text-slate-500 truncate">{doc.qualifications}</div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-900">${doc.consultationFee}</span>
                        <span className="text-slate-400 text-[10px]"> / consult</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          Room {doc.roomNumber}
                        </span>
                        <button
                          onClick={() => handleStartBookingWithDoctor(doc.id, doc.departmentId)}
                          className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition"
                        >
                          Book Slot
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BOOKING WIZARD */}
      {activeTab === 'BOOK' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          {bookingSuccessApt ? (
            <div className="text-center py-8 max-w-lg mx-auto space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black text-slate-900">Appointment Confirmed!</h2>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-left space-y-2 text-xs">
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500">Token Number:</span>
                  <span className="font-bold text-teal-700 text-base">{bookingSuccessApt.tokenNumber}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500">Doctor:</span>
                  <span className="font-bold text-slate-800">{bookingSuccessApt.doctorName}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500">Department:</span>
                  <span className="font-semibold text-slate-800">{bookingSuccessApt.departmentName}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500">Date & Time:</span>
                  <span className="font-semibold text-slate-800">
                    {bookingSuccessApt.appointmentDate} at {bookingSuccessApt.startTime} - {bookingSuccessApt.endTime}
                  </span>
                </div>
                {bookingSuccessApt.meetLink && (
                  <div className="flex justify-between pb-1">
                    <span className="text-slate-500">Telehealth Video:</span>
                    <a
                      href={bookingSuccessApt.meetLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-teal-600 font-bold hover:underline"
                    >
                      Open Google Meet Link
                    </a>
                  </div>
                )}
              </div>

              {/* Workspace Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <a
                  href={createGoogleCalendarUrl(bookingSuccessApt)}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <CalendarPlus className="w-3.5 h-3.5" />
                  Add to Google Calendar
                </a>
                <button
                  onClick={() => downloadIcsFile(bookingSuccessApt)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download .ICS
                </button>
                <button
                  onClick={() => {
                    setBookingSuccessApt(null);
                    setActiveTab('OVERVIEW');
                  }}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold"
                >
                  Go to Live Queue Tracker
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleConfirmBooking} className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Book Outpatient Consultation</h2>
                <p className="text-xs text-slate-500">
                  Select department, doctor, and an AI-recommended slot with minimal waiting time.
                </p>
              </div>

              {/* Step 1: Department Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  1. Select Clinical Specialty
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {departments.map((dept) => (
                    <button
                      type="button"
                      key={dept.id}
                      onClick={() => {
                        setSelectedDeptId(dept.id);
                        const firstDoc = doctors.find((d) => d.departmentId === dept.id);
                        if (firstDoc) setSelectedDocId(firstDoc.id);
                        setSelectedSlot(null);
                      }}
                      className={`p-3 rounded-xl border text-left text-xs font-semibold transition flex items-center gap-2.5 ${
                        selectedDeptId === dept.id
                          ? 'border-teal-600 bg-teal-50/50 text-teal-900 shadow-xs'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="shrink-0">{getDeptIcon(dept.icon)}</div>
                      <div className="truncate">{dept.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 2: Doctor Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  2. Select Doctor
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {deptDoctors.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => {
                        setSelectedDocId(doc.id);
                        setSelectedSlot(null);
                      }}
                      className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                        (selectedDocId === doc.id || (!selectedDocId && doc.id === deptDoctors[0]?.id))
                          ? 'border-teal-600 bg-teal-50/40 ring-1 ring-teal-500 shadow-xs'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <img
                        src={doc.avatarUrl || 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=256'}
                        alt={doc.name}
                        className="w-10 h-10 rounded-xl object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-900 truncate">{doc.name}</div>
                        <div className="text-[11px] text-slate-500 truncate">{doc.specialization}</div>
                        <div className="text-[10px] text-teal-700 font-semibold mt-0.5">
                          Room {doc.roomNumber} • ${doc.consultationFee} • Avg {doc.avgConsultationMinutes}m
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Step 3: Date & Slots */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    3. Appointment Date
                  </label>
                  <input
                    type="date"
                    min={todayStr}
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setSelectedSlot(null);
                    }}
                    className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Working days: Mon - Fri (09:00 - 17:00). Lunch break 13:00 - 14:00.
                  </p>
                </div>

                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      4. Available Time Slots
                    </label>
                    <span className="text-[11px] text-teal-600 font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      AI Recommended Badges
                    </span>
                  </div>

                  {availableSlots.length === 0 ? (
                    <div className="p-6 text-center rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                      No available slots on this day. The doctor may be off-duty or fully booked. Please select another date.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
                      {availableSlots.map((slot) => {
                        const isSelected = selectedSlot?.time === slot.time;
                        return (
                          <button
                            type="button"
                            key={slot.time}
                            disabled={!slot.available}
                            onClick={() => setSelectedSlot(slot)}
                            className={`p-2 rounded-xl text-center text-xs transition relative ${
                              !slot.available
                                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed line-through'
                                : isSelected
                                ? 'bg-teal-600 text-white font-bold shadow-md'
                                : 'bg-slate-50 border border-slate-200 text-slate-800 hover:border-teal-500 hover:bg-white'
                            }`}
                          >
                            <div className="font-semibold">{slot.time}</div>
                            {slot.recommended && slot.available && (
                              <span className="absolute -top-1.5 -right-1 text-[8px] font-extrabold uppercase px-1 rounded-sm bg-amber-400 text-slate-950">
                                Best
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Step 4: Reason & Priority */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Reason for Visit / Primary Symptoms
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Routine blood pressure follow-up, palpitations, skin rash"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Consultation Type & Modality
                  </label>
                  <div className="flex items-center gap-3 mt-1.5">
                    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="priority"
                        checked={bookingPriority === 'NORMAL'}
                        onChange={() => setBookingPriority('NORMAL')}
                        className="text-teal-600 focus:ring-teal-500"
                      />
                      New Consultation
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="priority"
                        checked={bookingPriority === 'FOLLOW_UP'}
                        onChange={() => setBookingPriority('FOLLOW_UP')}
                        className="text-teal-600 focus:ring-teal-500"
                      />
                      Routine Follow-Up
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer ml-auto">
                      <input
                        type="checkbox"
                        checked={isTelehealth}
                        onChange={(e) => setIsTelehealth(e.target.checked)}
                        className="rounded text-teal-600 focus:ring-teal-500"
                      />
                      <Video className="w-3.5 h-3.5 text-teal-600" />
                      Google Meet
                    </label>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <div className="text-xs text-slate-500">
                  {selectedSlot ? (
                    <span className="font-semibold text-teal-700">
                      Selected Slot: {selectedDate} at {selectedSlot.time} ({bookingDoctor?.name})
                    </span>
                  ) : (
                    'Please select a slot to proceed'
                  )}
                </div>
                <button
                  type="submit"
                  disabled={!selectedSlot}
                  className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-teal-600/20 transition flex items-center gap-2"
                >
                  <span>Confirm & Generate Token</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* TAB 3: MY APPOINTMENTS & E-PRESCRIPTIONS */}
      {activeTab === 'MY_APPOINTMENTS' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">My Consultation History</h2>
              <p className="text-xs text-slate-500">Upcoming appointments and past clinical prescriptions.</p>
            </div>
            <button
              onClick={() => setActiveTab('BOOK')}
              className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition"
            >
              + Book New
            </button>
          </div>

          {myAppointments.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">No appointment history found.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {myAppointments.map((apt) => (
                <div key={apt.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200">
                        Token {apt.tokenNumber}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                          apt.status === 'COMPLETED'
                            ? 'bg-slate-100 text-slate-700'
                            : apt.status === 'CANCELLED'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {apt.status}
                      </span>
                      <span className="text-xs text-slate-400">• {apt.departmentName}</span>
                    </div>
                    <div className="text-sm font-bold text-slate-900">{apt.doctorName}</div>
                    <p className="text-xs text-slate-600">Reason: {apt.reason}</p>
                    <div className="text-[11px] text-slate-400 flex items-center gap-3">
                      <span>Date: {apt.appointmentDate} ({apt.startTime} - {apt.endTime})</span>
                      {apt.meetLink && (
                        <a
                          href={apt.meetLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-teal-600 font-semibold hover:underline flex items-center gap-1"
                        >
                          <Video className="w-3 h-3" /> Meet
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* View Prescription if completed */}
                    {apt.consultation && (
                      <button
                        onClick={() => setViewingPrescription(apt)}
                        className="px-3 py-1.5 rounded-lg border border-teal-300 text-teal-700 text-xs font-bold hover:bg-teal-50 transition flex items-center gap-1.5"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        View Rx Slip
                      </button>
                    )}

                    {/* Google Calendar Link */}
                    {apt.status === 'CONFIRMED' && (
                      <a
                        href={createGoogleCalendarUrl(apt)}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                        title="Add to Google Calendar"
                      >
                        <CalendarPlus className="w-3.5 h-3.5" />
                      </a>
                    )}

                    {/* Cancel button */}
                    {['CONFIRMED', 'REQUESTED'].includes(apt.status) && (
                      <button
                        onClick={() => handleCancelAppointment(apt.id)}
                        className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 text-xs font-semibold hover:bg-rose-50 transition"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ALL CLINIC QUEUES */}
      {activeTab === 'OPD_QUEUES' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Hospital OPD Waiting Room Queues</h2>
            <p className="text-xs text-slate-500">Live queue counts and current calling tokens across all clinical suites.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {doctors.map((doc) => {
              const dept = departments.find((d) => d.id === doc.departmentId);
              const docApts = allAppointments.filter(
                (a) => a.doctorId === doc.id && a.appointmentDate === todayStr
              );
              const activeCalling = docApts.find((a) => a.status === 'IN_CONSULTATION');
              const waiting = docApts.filter((a) => a.status === 'WAITING' || a.status === 'CHECKED_IN');

              return (
                <div key={doc.id} className="p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-sm text-slate-900">{doc.name}</div>
                      <div className="text-xs text-teal-700 font-medium">{dept?.name} • Room {doc.roomNumber}</div>
                    </div>
                    {doc.currentDelayMinutes > 0 ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                        Delayed +{doc.currentDelayMinutes}m
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        On Schedule
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center bg-slate-50 rounded-lg p-2 text-xs">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Calling Now</div>
                      <div className="text-base font-black text-amber-600 mt-0.5">
                        {activeCalling ? activeCalling.tokenNumber : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Waiting Count</div>
                      <div className="text-base font-black text-slate-800 mt-0.5">{waiting.length}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Prescription Modal */}
      {viewingPrescription && viewingPrescription.consultation && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-teal-700">
                  MEDFLOW AI • Official OPD e-Prescription
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  Consultation Slip ({viewingPrescription.tokenNumber})
                </h3>
              </div>
              <button
                onClick={() => setViewingPrescription(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl">
              <div>
                <span className="text-slate-500">Patient: </span>
                <span className="font-bold text-slate-800">{viewingPrescription.patientName}</span>
              </div>
              <div>
                <span className="text-slate-500">Doctor: </span>
                <span className="font-bold text-slate-800">{viewingPrescription.doctorName}</span>
              </div>
              <div>
                <span className="text-slate-500">Date: </span>
                <span className="font-semibold text-slate-800">{viewingPrescription.appointmentDate}</span>
              </div>
              <div>
                <span className="text-slate-500">Department: </span>
                <span className="font-semibold text-slate-800">{viewingPrescription.departmentName}</span>
              </div>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Clinical Diagnosis
              </div>
              <p className="text-xs text-slate-800 font-semibold bg-teal-50/50 p-2.5 rounded-lg border border-teal-200/50">
                {viewingPrescription.consultation.diagnosis}
              </p>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Doctor Notes & Advice
              </div>
              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-lg">
                {viewingPrescription.consultation.clinicalNotes}
              </p>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Prescribed Medications
              </div>
              <div className="space-y-2">
                {viewingPrescription.consultation.prescriptions.map((rx, idx) => (
                  <div key={idx} className="p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                    <div className="flex justify-between font-bold text-slate-900">
                      <span>{rx.medicine} ({rx.dosage})</span>
                      <span className="text-teal-700 font-semibold">{rx.duration}</span>
                    </div>
                    <div className="text-slate-600">Frequency: {rx.frequency}</div>
                    {rx.instructions && (
                      <div className="text-[11px] text-slate-400 italic">Instructions: {rx.instructions}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition"
              >
                Print Prescription
              </button>
              <button
                onClick={() => setViewingPrescription(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
