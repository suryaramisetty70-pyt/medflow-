# MEDFLOW AI

### AI-Powered Hospital Appointment, Scheduling & OPD Queue Management Platform

MEDFLOW AI is a production-grade, enterprise healthcare platform designed to streamline outpatient department (OPD) queueing, prevent doctor double-booking, predict patient wait times and no-show risks, and provide real-time role-based operational dashboards for hospitals.

---

## 🌟 Core Features & Modules

### 1. Multi-Tenant Hospital Architecture & Role-Based Access Control (RBAC)
- **Multi-Hospital Support**: Isolated hospital environments (e.g. *MEDFLOW General Hospital - Central*, *MEDFLOW Memorial Specialty Clinic*, *St. Jude Integrated Medical Center*).
- **Five Dedicated Clinical Portals**:
  - **Patient Portal**: Instant slot discovery, AI-recommended slots, live queue token tracker with countdown, e-prescriptions, and one-click Google Calendar & Google Meet integrations.
  - **Doctor OPD Console**: Current patient examination timer, clinical diagnosis and e-prescription builder, live waiting queue, audible chime & Gemini TTS token caller, and doctor delay broadcaster.
  - **Receptionist Control Desk**: Fast physical walk-in registration, 1-click token check-in, doctor schedule & delay visibility, queue priority override (NORMAL, FOLLOW_UP, WALK_IN, EMERGENCY), and Google Sheets / CSV manifest export.
  - **Hospital Administrator**: Operational analytics with interactive charts, doctor schedule & slot duration editor (15m, 20m, 30m, 45m), and immutable security audit trail.
  - **Super Administrator**: Multi-hospital fleet governance, telemetry, and platform security oversight.

### 2. High-Integrity Scheduling Engine
- **Double-Booking Protection**: Time interval overlap validation `[startTime, endTime)` prevents scheduling conflicts at the database & engine level.
- **State Machine Rules**: Strict medical transitions enforce:
  `REQUESTED` → `CONFIRMED` → `CHECKED_IN` → `WAITING` → `IN_CONSULTATION` → `COMPLETED`.
  Disallows illegal state rollbacks (e.g., `COMPLETED` → `CHECKED_IN`).
- **Dynamic Slot Generator**: Auto-computes available slots per doctor taking into account lunch breaks, working days, and leave dates.

### 3. Real-Time OPD Queue & Token System
- **Department Tokens**: Sequential token formatting (`C-024` for Cardiology, `NE-012` for Neurology, `GM-014` for General Medicine, `ORTH-003` for Orthopedics).
- **Overhead TV Display Mode (OPD Kiosk)**: Fullscreen waiting room TV display with bold calling token, doctor name, room number, next tokens in queue, and audio announcements.
- **Audible Medical Chimes & Gemini TTS**:
  - Web Audio API dual-tone hospital chime (D5 587Hz → A5 880Hz).
  - Gemini 3.8 Flash TTS (`gemini-3.8-flash-tts`) voice token caller with Web Speech API browser fallback.

### 4. AI & Machine Learning Operational Intelligence
- **Wait-Time Estimation Engine**: Real-time formula `(Patients Ahead × Avg Duration) + Doctor Delay + Variance Margin` with confidence scoring.
- **Calibrated No-Show Risk Predictor**: Evaluates booking lead time, past cancellation rate, day of week, and confirmation status (Low, Medium, High risk %).
- **Smart Slot Recommendations**: Ranks slots based on doctor efficiency and minimal patient wait time.
- **AI Administrative Assistant**: Natural language assistant using `gemini-3.8-flash` with strict non-diagnostic clinical boundaries and interactive action execution.

### 5. Google Workspace Integrations
- **Google Calendar**: Direct event creation links and `.ics` iCalendar download.
- **Google Meet**: Instant telehealth virtual consultation link generation.
- **Google Sheets**: One-click CSV export of daily OPD manifests.
- **Gmail**: Pre-formatted patient email slip generation.

---

## 🛠️ Technology Stack
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Motion, Lucide Icons.
- **Backend / API**: Node.js, Express middleware, `@google/genai` TypeScript SDK.
- **AI Models**:
  - `gemini-3.8-flash` (Administrative Scheduling & Intent Parsing)
  - `gemini-3.8-flash-tts` (Text-to-Speech Token Announcement)
- **Audio Synthesis**: Web Audio API oscillator synthesis + Web Speech API fallback.
