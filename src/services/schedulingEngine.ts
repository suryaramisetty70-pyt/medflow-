import {
  Appointment,
  AppointmentStatus,
  Doctor,
  QueuePriority,
  TimeSlot,
} from '../types';

// Converts 'HH:MM' string to total minutes from midnight
export function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

// Converts total minutes from midnight to 'HH:MM'
export function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Check if two time intervals overlap: [startA, endA) and [startB, endB)
export function intervalsOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const sA = timeToMinutes(startA);
  const eA = timeToMinutes(endA);
  const sB = timeToMinutes(startB);
  const eB = timeToMinutes(endB);

  return Math.max(sA, sB) < Math.min(eA, eB);
}

// Double booking protection: Detect conflict with existing active appointments
export function hasTimeConflict(
  doctorId: string,
  appointmentDate: string,
  startTime: string,
  endTime: string,
  existingAppointments: Appointment[],
  excludeAppointmentId?: string
): boolean {
  const activeStatuses: AppointmentStatus[] = [
    'CONFIRMED',
    'CHECKED_IN',
    'WAITING',
    'IN_CONSULTATION',
  ];

  return existingAppointments.some((apt) => {
    if (apt.id === excludeAppointmentId) return false;
    if (apt.doctorId !== doctorId) return false;
    if (apt.appointmentDate !== appointmentDate) return false;
    if (!activeStatuses.includes(apt.status)) return false;

    return intervalsOverlap(startTime, endTime, apt.startTime, apt.endTime);
  });
}

// State Machine Rules
const VALID_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  REQUESTED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['CHECKED_IN', 'RESCHEDULED', 'CANCELLED', 'MISSED'],
  CHECKED_IN: ['WAITING', 'CANCELLED', 'MISSED'],
  WAITING: ['IN_CONSULTATION', 'MISSED', 'CANCELLED'],
  IN_CONSULTATION: ['COMPLETED', 'MISSED'],
  COMPLETED: [], // Terminal state
  CANCELLED: [], // Terminal state
  RESCHEDULED: [], // Terminal state
  MISSED: [], // Terminal state
};

export function validateAppointmentTransition(
  currentStatus: AppointmentStatus,
  targetStatus: AppointmentStatus
): { valid: boolean; reason?: string } {
  if (currentStatus === targetStatus) {
    return { valid: true };
  }

  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(targetStatus)) {
    return {
      valid: false,
      reason: `Invalid status transition from "${currentStatus}" to "${targetStatus}". Medical state machine forbids this flow.`,
    };
  }

  return { valid: true };
}

// Generates token number based on department code and daily count
export function generateTokenNumber(
  departmentCode: string,
  todayAppointmentsCount: number
): string {
  const codePrefix = departmentCode.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'OPD';
  const seqNumber = todayAppointmentsCount + 1;
  return `${codePrefix}-${seqNumber.toString().padStart(3, '0')}`;
}

// Slot generator with breaks, leaves, and conflicts
export function generateAvailableSlots(
  doctor: Doctor,
  dateStr: string,
  existingAppointments: Appointment[]
): TimeSlot[] {
  const targetDate = new Date(`${dateStr}T12:00:00Z`);
  const dayOfWeek = targetDate.getUTCDay(); // 0 = Sun, 1 = Mon ...

  // Check if doctor works on this day
  if (!doctor.schedule.workingDays.includes(dayOfWeek)) {
    return [];
  }

  // Check if doctor is on leave
  if (doctor.leaves && doctor.leaves.includes(dateStr)) {
    return [];
  }

  const startMin = timeToMinutes(doctor.schedule.startTime);
  const endMin = timeToMinutes(doctor.schedule.endTime);
  const breakStartMin = timeToMinutes(doctor.schedule.breakStart);
  const breakEndMin = timeToMinutes(doctor.schedule.breakEnd);
  const duration = doctor.schedule.slotDurationMinutes || 15;

  const slots: TimeSlot[] = [];

  for (let current = startMin; current + duration <= endMin; current += duration) {
    const slotEnd = current + duration;
    const timeStr = minutesToTime(current);
    const endTimeStr = minutesToTime(slotEnd);

    // Check if slot falls in lunch/break hours
    const isBreak = Math.max(current, breakStartMin) < Math.min(slotEnd, breakEndMin);
    if (isBreak) {
      continue;
    }

    // Check conflict
    const isBooked = hasTimeConflict(
      doctor.id,
      dateStr,
      timeStr,
      endTimeStr,
      existingAppointments
    );

    // Smart recommendation scoring
    // Criteria: slots slightly mid-morning (10:00-11:30) or early afternoon have best flow
    let smartScore = 75;
    if (current >= 600 && current <= 690) smartScore += 18; // 10:00 AM - 11:30 AM
    if (current >= 870 && current <= 930) smartScore += 12; // 2:30 PM - 3:30 PM

    // Add expected wait time based on doctor delay
    const estimatedWait = Math.max(0, doctor.currentDelayMinutes);

    slots.push({
      time: timeStr,
      endTime: endTimeStr,
      available: !isBooked,
      reasonUnavailable: isBooked ? 'Slot already reserved' : undefined,
      smartScore,
      recommended: !isBooked && smartScore >= 88,
      estimatedWaitMinutes: estimatedWait,
    });
  }

  return slots;
}

// Wait-time estimation
export function calculateWaitTime(
  doctor: Doctor,
  patientsAhead: number,
  priority: QueuePriority = 'NORMAL'
): { estimatedMinutes: number; confidence: 'HIGH' | 'MEDIUM' | 'LOW'; varianceMinutes: number } {
  if (priority === 'EMERGENCY') {
    return { estimatedMinutes: 0, confidence: 'HIGH', varianceMinutes: 0 };
  }

  const avgMinutes = doctor.avgConsultationMinutes || 15;
  const currentDelay = Math.max(0, doctor.currentDelayMinutes || 0);

  // Mathematical formulation:
  // Wait = (patientsAhead * avgDuration) + currentDelay
  let baseWait = patientsAhead * avgMinutes + currentDelay;

  if (priority === 'FOLLOW_UP') {
    baseWait = Math.max(5, baseWait - 5);
  }

  const variance = Math.round(avgMinutes * 0.3 * Math.sqrt(Math.max(1, patientsAhead)));
  const confidence = patientsAhead <= 3 ? 'HIGH' : patientsAhead <= 7 ? 'MEDIUM' : 'LOW';

  return {
    estimatedMinutes: Math.max(0, Math.round(baseWait)),
    confidence,
    varianceMinutes: variance,
  };
}

// Calibrated No-Show Risk Predictor
export function calculateNoShowRisk(params: {
  leadTimeDays: number;
  pastNoShows: number;
  pastTotalAppointments: number;
  bookingSource: string;
  dayOfWeek: number;
  timeSlotMinutes: number;
  isConfirmed: boolean;
}): { score: number; level: 'LOW' | 'MEDIUM' | 'HIGH'; factors: string[] } {
  const {
    leadTimeDays,
    pastNoShows,
    pastTotalAppointments,
    bookingSource,
    dayOfWeek,
    timeSlotMinutes,
    isConfirmed,
  } = params;

  let risk = 12; // Baseline hospital no-show rate ~12%
  const factors: string[] = [];

  // Lead time factor
  if (leadTimeDays > 14) {
    risk += 22;
    factors.push('High booking lead time (>14 days)');
  } else if (leadTimeDays > 5) {
    risk += 10;
    factors.push('Moderate booking lead time (5-14 days)');
  } else if (leadTimeDays === 0) {
    risk -= 8;
    factors.push('Same-day booking (high immediate intent)');
  }

  // Patient history factor
  if (pastTotalAppointments > 0) {
    const historicalRate = (pastNoShows / pastTotalAppointments) * 100;
    if (historicalRate > 40) {
      risk += 30;
      factors.push('High historical no-show track record');
    } else if (historicalRate === 0 && pastTotalAppointments >= 3) {
      risk -= 10;
      factors.push('Consistent historical attendance');
    }
  }

  // Day of week (Mondays and Fridays often see schedule clashes)
  if (dayOfWeek === 1 || dayOfWeek === 5) {
    risk += 5;
    factors.push('Peak rescheduling weekday (Monday/Friday)');
  }

  // Time of day
  if (timeSlotMinutes < 540) { // before 9 AM
    risk += 8;
    factors.push('Early morning slot');
  } else if (timeSlotMinutes > 960) { // after 4 PM
    risk += 6;
  }

  // Booking source
  if (bookingSource === 'WALK_IN') {
    risk = 2; // Walk-in is physically present
    factors.push('Physical walk-in check-in');
  }

  // Confirmation
  if (isConfirmed) {
    risk -= 8;
    factors.push('Patient confirmed attendance');
  }

  const finalScore = Math.min(95, Math.max(2, Math.round(risk)));
  const level: 'LOW' | 'MEDIUM' | 'HIGH' =
    finalScore < 25 ? 'LOW' : finalScore < 55 ? 'MEDIUM' : 'HIGH';

  return {
    score: finalScore,
    level,
    factors,
  };
}
