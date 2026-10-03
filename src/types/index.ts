export type UserRole = 'PATIENT' | 'DOCTOR' | 'RECEPTIONIST' | 'HOSPITAL_ADMIN' | 'SUPER_ADMIN';

export type AppointmentStatus =
  | 'REQUESTED'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'WAITING'
  | 'IN_CONSULTATION'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'RESCHEDULED'
  | 'MISSED';

export type QueuePriority = 'NORMAL' | 'FOLLOW_UP' | 'WALK_IN' | 'EMERGENCY';

export type DoctorStatus = 'AVAILABLE' | 'IN_CONSULTATION' | 'ON_BREAK' | 'ON_LEAVE' | 'DELAYED';

export type BookingSource = 'ONLINE' | 'WALK_IN' | 'AI_ASSISTANT' | 'RECEPTION';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  hospitalId: string;
  avatarUrl?: string;
  patientId?: string;
  doctorId?: string;
}

export interface Hospital {
  id: string;
  name: string;
  code: string;
  tagline: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  active: boolean;
  departments: string[];
}

export interface Department {
  id: string;
  hospitalId: string;
  name: string;
  code: string; // e.g., 'CARD', 'NEUR', 'ORTH', 'GEN'
  icon: string;
  description: string;
  floor: string;
  roomNumbers: string[];
}

export interface DoctorSchedule {
  workingDays: number[]; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  startTime: string; // '09:00'
  endTime: string; // '17:00'
  breakStart: string; // '13:00'
  breakEnd: string; // '14:00'
  slotDurationMinutes: number; // 15, 20, 30
  maxDailyAppointments: number;
}

export interface Doctor {
  id: string;
  hospitalId: string;
  departmentId: string;
  name: string;
  title: string;
  qualifications: string;
  specialization: string;
  roomNumber: string;
  consultationFee: number;
  avgConsultationMinutes: number;
  experienceYears: number;
  rating: number;
  currentDelayMinutes: number;
  status: DoctorStatus;
  schedule: DoctorSchedule;
  leaves: string[]; // ['2026-10-15']
  avatarUrl?: string;
}

export interface PrescriptionItem {
  id: string;
  medicine: string;
  dosage: string;
  frequency: string; // e.g., '1-0-1 after meals'
  duration: string; // e.g., '5 days'
  instructions?: string;
}

export interface Consultation {
  id: string;
  appointmentId: string;
  doctorId: string;
  patientId: string;
  chiefComplaint: string;
  diagnosis: string;
  clinicalNotes: string;
  prescriptions: PrescriptionItem[];
  followUpDate?: string;
  completedAt: string;
}

export interface Appointment {
  id: string;
  hospitalId: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  patientAge?: number;
  patientGender?: 'MALE' | 'FEMALE' | 'OTHER';
  doctorId: string;
  doctorName: string;
  departmentId: string;
  departmentName: string;
  appointmentDate: string; // 'YYYY-MM-DD'
  startTime: string; // '10:00'
  endTime: string; // '10:30'
  status: AppointmentStatus;
  reason: string;
  tokenNumber: string; // e.g., 'C-024'
  priority: QueuePriority;
  bookingSource: BookingSource;
  noShowRiskScore: number; // 0 - 100 (%)
  noShowRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  estimatedWaitMinutes: number;
  checkedInAt?: string;
  consultationStartedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  rescheduledFromId?: string;
  meetLink?: string;
  consultation?: Consultation;
  createdAt: string;
  updatedAt: string;
}

export interface QueueEntry {
  id: string;
  hospitalId: string;
  departmentId: string;
  doctorId: string;
  appointmentId: string;
  tokenNumber: string;
  patientName: string;
  patientPhone: string;
  position: number;
  estimatedWaitMinutes: number;
  priority: QueuePriority;
  status: 'WAITING' | 'CALLED' | 'IN_CONSULTATION' | 'COMPLETED' | 'MISSED';
  checkedInAt: string;
  calledAt?: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  channel: 'IN_APP' | 'SMS' | 'GMAIL' | 'CALENDAR';
  type: 'BOOKING' | 'REMINDER' | 'DELAY' | 'QUEUE_ALERT' | 'CANCEL';
  timestamp: string;
  read: boolean;
  link?: string;
}

export interface AuditLog {
  id: string;
  hospitalId: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  resource: string;
  resourceId: string;
  oldValue?: string;
  newValue?: string;
  details: string;
  timestamp: string;
  ipAddress: string;
}

export interface TimeSlot {
  time: string; // '09:00'
  endTime: string; // '09:30'
  available: boolean;
  reasonUnavailable?: string;
  smartScore?: number; // 0 - 100 for recommendation
  recommended?: boolean;
  estimatedWaitMinutes?: number;
}
