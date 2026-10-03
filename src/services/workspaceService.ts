import { Appointment } from '../types';

// 1. Google Calendar Integration
export function createGoogleCalendarUrl(appointment: Appointment): string {
  const title = encodeURIComponent(`Medical Appointment: ${appointment.doctorName} (${appointment.departmentName})`);
  const details = encodeURIComponent(
    `MEDFLOW AI Appointment Confirmation\n` +
    `Patient: ${appointment.patientName}\n` +
    `Doctor: ${appointment.doctorName}\n` +
    `Department: ${appointment.departmentName}\n` +
    `Token: ${appointment.tokenNumber}\n` +
    `Reason: ${appointment.reason}\n` +
    (appointment.meetLink ? `Telehealth Video Link: ${appointment.meetLink}\n` : '') +
    `Hospital: Central Healthcare OPD`
  );
  const location = encodeURIComponent(`${appointment.departmentName} OPD, Room 101, Central Hospital`);

  // Format date and time: YYYYMMDDTHHMMSSZ
  const dateFormatted = appointment.appointmentDate.replace(/-/g, '');
  const startTimeFormatted = appointment.startTime.replace(/:/g, '') + '00';
  const endTimeFormatted = appointment.endTime.replace(/:/g, '') + '00';

  const dates = `${dateFormatted}T${startTimeFormatted}/${dateFormatted}T${endTimeFormatted}`;

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}&dates=${dates}`;
}

export function downloadIcsFile(appointment: Appointment): void {
  const startClean = appointment.appointmentDate.replace(/-/g, '') + 'T' + appointment.startTime.replace(/:/g, '') + '00';
  const endClean = appointment.appointmentDate.replace(/-/g, '') + 'T' + appointment.endTime.replace(/:/g, '') + '00';

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MEDFLOW AI//Hospital Appointment System//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:medflow-${appointment.id}@medflow-health.org`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    `DTSTART:${startClean}`,
    `DTEND:${endClean}`,
    `SUMMARY:Medical Appointment with ${appointment.doctorName}`,
    `DESCRIPTION:Token: ${appointment.tokenNumber}\\nDepartment: ${appointment.departmentName}\\nReason: ${appointment.reason}`,
    `LOCATION:${appointment.departmentName} OPD, Room 101`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `appointment-${appointment.tokenNumber}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// 2. Google Sheets / CSV Export
export function exportAppointmentsToCsv(appointments: Appointment[], hospitalName: string): void {
  const headers = [
    'Token',
    'Patient Name',
    'Phone',
    'Department',
    'Doctor',
    'Date',
    'Start Time',
    'End Time',
    'Status',
    'Priority',
    'Booking Source',
    'No-Show Risk',
    'Wait Time (Min)',
    'Reason',
  ];

  const rows = appointments.map((apt) => [
    `"${apt.tokenNumber}"`,
    `"${apt.patientName}"`,
    `"${apt.patientPhone}"`,
    `"${apt.departmentName}"`,
    `"${apt.doctorName}"`,
    `"${apt.appointmentDate}"`,
    `"${apt.startTime}"`,
    `"${apt.endTime}"`,
    `"${apt.status}"`,
    `"${apt.priority}"`,
    `"${apt.bookingSource}"`,
    `"${apt.noShowRiskScore}% (${apt.noShowRiskLevel})"`,
    `"${apt.estimatedWaitMinutes}"`,
    `"${(apt.reason || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute(
    'download',
    `medflow_opd_manifest_${new Date().toISOString().split('T')[0]}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// 3. Gmail Dispatch Link
export function createGmailComposeUrl(appointment: Appointment): string {
  const subject = encodeURIComponent(`MedFlow AI: Appointment Confirmation Token ${appointment.tokenNumber}`);
  const body = encodeURIComponent(
    `Dear ${appointment.patientName},\n\n` +
    `Your appointment has been confirmed at MEDFLOW General Hospital.\n\n` +
    `• Token Number: ${appointment.tokenNumber}\n` +
    `• Doctor: ${appointment.doctorName}\n` +
    `• Department: ${appointment.departmentName}\n` +
    `• Date: ${appointment.appointmentDate}\n` +
    `• Scheduled Time: ${appointment.startTime} - ${appointment.endTime}\n` +
    `• Estimated Wait Time: ~${appointment.estimatedWaitMinutes} mins\n\n` +
    (appointment.meetLink ? `Virtual Telehealth Link: ${appointment.meetLink}\n\n` : '') +
    `Please arrive 15 minutes before your time to complete your physical check-in at the OPD desk.\n\n` +
    `Warm regards,\nMEDFLOW Hospital Clinical Team`
  );

  return `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`;
}

// 4. Google Meet Telehealth Link
export function generateMeetLink(appointmentId: string): string {
  const cleanId = appointmentId.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 10);
  return `https://meet.google.com/med-${cleanId.slice(0, 3)}-${cleanId.slice(3, 7)}`;
}

// 5. Google Tasks reminder link
export function createGoogleTaskReminderText(appointment: Appointment): string {
  return `Doctor Consultation: ${appointment.doctorName} (${appointment.tokenNumber}) on ${appointment.appointmentDate} at ${appointment.startTime}`;
}
