import {
  Hospital,
  Department,
  Doctor,
  User,
  Appointment,
  Notification,
  AuditLog,
  AppointmentStatus,
  UserRole,
} from '../types';
import {
  INITIAL_HOSPITALS,
  INITIAL_DEPARTMENTS,
  INITIAL_DOCTORS,
  DEMO_USERS,
  INITIAL_NOTIFICATIONS,
  INITIAL_AUDIT_LOGS,
  generateSeedAppointments,
} from './seedData';

const STORAGE_KEYS = {
  HOSPITALS: 'medflow_hospitals_v1',
  DEPARTMENTS: 'medflow_departments_v1',
  DOCTORS: 'medflow_doctors_v1',
  APPOINTMENTS: 'medflow_appointments_v1',
  NOTIFICATIONS: 'medflow_notifications_v1',
  AUDIT_LOGS: 'medflow_audit_logs_v1',
  CURRENT_USER: 'medflow_current_user_v1',
  ACTIVE_HOSPITAL_ID: 'medflow_active_hospital_id_v1',
  AUDIO_ENABLED: 'medflow_audio_enabled_v1',
};

// Event listener hub for multi-component reactivity
type StorageListener = () => void;
const listeners: Set<StorageListener> = new Set();

export function subscribeToStorage(callback: StorageListener): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function notifyListeners() {
  listeners.forEach((cb) => {
    try {
      cb();
    } catch (e) {
      console.error('Storage listener error:', e);
    }
  });
}

function getStored<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Error reading ${key} from storage:`, e);
    return defaultValue;
  }
}

function setStored<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    notifyListeners();
  } catch (e) {
    console.error(`Error writing ${key} to storage:`, e);
  }
}

// Initial bootstrap
export function initStorage(): void {
  if (!localStorage.getItem(STORAGE_KEYS.HOSPITALS)) {
    localStorage.setItem(STORAGE_KEYS.HOSPITALS, JSON.stringify(INITIAL_HOSPITALS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.DEPARTMENTS)) {
    localStorage.setItem(STORAGE_KEYS.DEPARTMENTS, JSON.stringify(INITIAL_DEPARTMENTS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.DOCTORS)) {
    localStorage.setItem(STORAGE_KEYS.DOCTORS, JSON.stringify(INITIAL_DOCTORS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.APPOINTMENTS)) {
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(generateSeedAppointments()));
  }
  if (!localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)) {
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(INITIAL_NOTIFICATIONS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS)) {
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(INITIAL_AUDIT_LOGS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.CURRENT_USER)) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(DEMO_USERS.PATIENT));
  }
  if (!localStorage.getItem(STORAGE_KEYS.ACTIVE_HOSPITAL_ID)) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_HOSPITAL_ID, JSON.stringify('hosp-1'));
  }
  if (localStorage.getItem(STORAGE_KEYS.AUDIO_ENABLED) === null) {
    localStorage.setItem(STORAGE_KEYS.AUDIO_ENABLED, JSON.stringify(true));
  }
}

// Hospitals
export function getHospitals(): Hospital[] {
  return getStored<Hospital[]>(STORAGE_KEYS.HOSPITALS, INITIAL_HOSPITALS);
}

export function getActiveHospitalId(): string {
  return getStored<string>(STORAGE_KEYS.ACTIVE_HOSPITAL_ID, 'hosp-1');
}

export function setActiveHospitalId(hospitalId: string): void {
  setStored(STORAGE_KEYS.ACTIVE_HOSPITAL_ID, hospitalId);
}

// Departments
export function getDepartments(hospitalId?: string): Department[] {
  const depts = getStored<Department[]>(STORAGE_KEYS.DEPARTMENTS, INITIAL_DEPARTMENTS);
  if (!hospitalId) return depts;
  return depts.filter((d) => d.hospitalId === hospitalId);
}

// Doctors
export function getDoctors(hospitalId?: string, departmentId?: string): Doctor[] {
  let docs = getStored<Doctor[]>(STORAGE_KEYS.DOCTORS, INITIAL_DOCTORS);
  if (hospitalId) {
    docs = docs.filter((d) => d.hospitalId === hospitalId);
  }
  if (departmentId) {
    docs = docs.filter((d) => d.departmentId === departmentId);
  }
  return docs;
}

export function getDoctor(id: string): Doctor | undefined {
  const docs = getDoctors();
  return docs.find((d) => d.id === id);
}

export function updateDoctor(doctor: Doctor, actor?: { id: string; name: string; role: UserRole }): void {
  const docs = getDoctors();
  const index = docs.findIndex((d) => d.id === doctor.id);
  if (index >= 0) {
    const old = docs[index];
    docs[index] = doctor;
    setStored(STORAGE_KEYS.DOCTORS, docs);

    if (actor && old.currentDelayMinutes !== doctor.currentDelayMinutes) {
      logAudit({
        hospitalId: doctor.hospitalId,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'UPDATE_DOCTOR_DELAY',
        resource: 'DOCTOR',
        resourceId: doctor.id,
        oldValue: `${old.currentDelayMinutes} min`,
        newValue: `${doctor.currentDelayMinutes} min`,
        details: `${doctor.name} delay updated to ${doctor.currentDelayMinutes} minutes.`,
      });
    }
  }
}

// Appointments
export function getAppointments(filters?: {
  hospitalId?: string;
  patientId?: string;
  doctorId?: string;
  departmentId?: string;
  date?: string;
  status?: AppointmentStatus;
}): Appointment[] {
  let list = getStored<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, []);
  if (!filters) return list;

  if (filters.hospitalId) list = list.filter((a) => a.hospitalId === filters.hospitalId);
  if (filters.patientId) list = list.filter((a) => a.patientId === filters.patientId);
  if (filters.doctorId) list = list.filter((a) => a.doctorId === filters.doctorId);
  if (filters.departmentId) list = list.filter((a) => a.departmentId === filters.departmentId);
  if (filters.date) list = list.filter((a) => a.appointmentDate === filters.date);
  if (filters.status) list = list.filter((a) => a.status === filters.status);

  return list;
}

export function getAppointment(id: string): Appointment | undefined {
  const list = getAppointments();
  return list.find((a) => a.id === id);
}

export function saveAppointment(appointment: Appointment, actor?: { id: string; name: string; role: UserRole }): void {
  const list = getAppointments();
  const index = list.findIndex((a) => a.id === appointment.id);

  if (index >= 0) {
    const old = list[index];
    list[index] = { ...appointment, updatedAt: new Date().toISOString() };
    setStored(STORAGE_KEYS.APPOINTMENTS, list);

    if (actor && old.status !== appointment.status) {
      logAudit({
        hospitalId: appointment.hospitalId,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'APPOINTMENT_STATUS_CHANGE',
        resource: 'APPOINTMENT',
        resourceId: appointment.id,
        oldValue: old.status,
        newValue: appointment.status,
        details: `Appointment status transitioned from ${old.status} to ${appointment.status}.`,
      });
    }
  } else {
    list.unshift({ ...appointment, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    setStored(STORAGE_KEYS.APPOINTMENTS, list);

    if (actor) {
      logAudit({
        hospitalId: appointment.hospitalId,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'CREATE_APPOINTMENT',
        resource: 'APPOINTMENT',
        resourceId: appointment.id,
        newValue: appointment.status,
        details: `Appointment booked for ${appointment.patientName} with ${appointment.doctorName}. Token: ${appointment.tokenNumber}.`,
      });
    }
  }
}

// Notifications
export function getNotifications(userId?: string): Notification[] {
  const notifs = getStored<Notification[]>(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
  if (!userId) return notifs;
  return notifs.filter((n) => n.userId === userId || n.userId === 'ALL');
}

export function addNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): Notification {
  const notifs = getNotifications();
  const item: Notification = {
    ...notification,
    id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    read: false,
  };
  notifs.unshift(item);
  setStored(STORAGE_KEYS.NOTIFICATIONS, notifs);
  return item;
}

export function markNotificationRead(id: string): void {
  const notifs = getNotifications();
  const target = notifs.find((n) => n.id === id);
  if (target) {
    target.read = true;
    setStored(STORAGE_KEYS.NOTIFICATIONS, notifs);
  }
}

// Audit Logs
export function getAuditLogs(hospitalId?: string): AuditLog[] {
  const logs = getStored<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
  if (!hospitalId) return logs;
  return logs.filter((l) => l.hospitalId === hospitalId);
}

export function logAudit(entry: Omit<AuditLog, 'id' | 'timestamp' | 'ipAddress'>): void {
  const logs = getAuditLogs();
  const item: AuditLog = {
    ...entry,
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    ipAddress: '192.168.1.100',
  };
  logs.unshift(item);
  setStored(STORAGE_KEYS.AUDIT_LOGS, logs.slice(0, 500)); // Cap to 500 logs
}

// Auth / Role State
export function getCurrentUser(): User {
  return getStored<User>(STORAGE_KEYS.CURRENT_USER, DEMO_USERS.PATIENT);
}

export function setCurrentUser(user: User): void {
  setStored(STORAGE_KEYS.CURRENT_USER, user);
}

export function switchRole(role: UserRole): User {
  const user = DEMO_USERS[role] || DEMO_USERS.PATIENT;
  setCurrentUser(user);
  return user;
}

// Audio settings
export function isAudioEnabled(): boolean {
  return getStored<boolean>(STORAGE_KEYS.AUDIO_ENABLED, true);
}

export function setAudioEnabled(enabled: boolean): void {
  setStored(STORAGE_KEYS.AUDIO_ENABLED, enabled);
}

// Factory reset
export function resetDatabase(): void {
  localStorage.setItem(STORAGE_KEYS.HOSPITALS, JSON.stringify(INITIAL_HOSPITALS));
  localStorage.setItem(STORAGE_KEYS.DEPARTMENTS, JSON.stringify(INITIAL_DEPARTMENTS));
  localStorage.setItem(STORAGE_KEYS.DOCTORS, JSON.stringify(INITIAL_DOCTORS));
  localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(generateSeedAppointments()));
  localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(INITIAL_NOTIFICATIONS));
  localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(INITIAL_AUDIT_LOGS));
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(DEMO_USERS.PATIENT));
  localStorage.setItem(STORAGE_KEYS.ACTIVE_HOSPITAL_ID, JSON.stringify('hosp-1'));
  localStorage.setItem(STORAGE_KEYS.AUDIO_ENABLED, JSON.stringify(true));
  notifyListeners();
}
