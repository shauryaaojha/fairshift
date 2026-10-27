# FairShift: What We Are Building

_PromptWars 2026 × SRM ACM Student Chapter · Theme: UN SDG 8, Decent Work and Economic Growth · As of 2026-10-27_

## Solution statement

**FairShift is a phone-first workforce platform that gives shift workers a clear record of their hours, pay and safety in their own language, and gives employers an early warning of overwork, hazards and attrition, across construction sites, college campuses and other employee-intensive workplaces.**

A worker checks in by scanning a QR code at the site gate. They see exactly how their pay was calculated, overtime included. They can report a hazard by speaking in Hindi or Tamil, and give honest feedback without being identified. The employer sees the same data as a live dashboard: who is on site, who is overworked, which hazards are past their deadline, and which teams are likely to lose people.

---

## The problem

Large workforces in construction, colleges, hospitals and factories still run on paper registers, spreadsheets and WhatsApp groups. The problem statement names four worker pain points and three employer blind spots.

| Who      | Pain point                | What it looks like today                                                              |
| -------- | ------------------------- | ------------------------------------------------------------------------------------- |
| Worker   | Opaque pay                | No clear salary breakdown, and overtime hours that go uncounted                       |
| Worker   | Fear of identification    | Complaints and honest feedback are not raised for fear of retaliation                 |
| Worker   | Unreported safety risks   | Hazards are ignored until someone is injured                                          |
| Worker   | Lost career history       | Skills and experience are not recorded, so a worker starts from zero at every new job |
| Employer | Zero workforce visibility | No view of who is overworked or unhappy                                               |
| Employer | High attrition risk       | No way to spot who is likely to quit early                                            |
| Employer | Delayed escalation        | Problems reach management only after they become severe                               |

The users add three more constraints:

- They mostly speak regional languages.
- Many have limited literacy.
- Most own basic, low-end smartphones.

---

## Who it is for

| User                                                                      | Interface                                                         | What they get                                                                                                         |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Shift worker** (mason, helper, housekeeper, security guard, ward staff) | Worker app `/w`: mobile-first, voice-led, English / हिंदी / தமிழ் | Proof of hours, a payslip they can understand, a safe way to report danger and give feedback, a portable skill record |
| **Supervisor / HR / site manager**                                        | Admin console `/admin`: desktop-first dashboard                   | Live attendance, a hazard queue with deadlines, fatigue flags, anonymous feedback trends, quit-risk list with reasons |

---

## What FairShift does

The problem statement asks for at least three working features. FairShift covers all eight example features, with the skill passport as a stretch goal.

| #   | Feature                      | Worker side                                                                                                         | Employer side                                                                                     | Pain point solved                    |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 1   | **Shift tracking**           | Scan the site's QR code with the phone camera, or check in by GPS. Overtime is counted automatically                | Live on-site count per site; a kiosk page shows the rotating QR code                              | Uncounted overtime                   |
| 2   | **Clear payslips**           | Line-by-line payslip in the worker's language, read aloud on request, with a plain-words explanation of each amount | Payroll preview per site                                                                          | Opaque pay                           |
| 3   | **Safety reporting**         | Speak or type a hazard report, optionally anonymous, and follow its status                                          | Hazard queue with response deadlines by severity; missed deadlines escalate automatically         | Unreported risks, delayed escalation |
| 4   | **Honest feedback**          | Four questions on a face scale plus an optional comment, fully anonymous                                            | Team-level trends, shown only when at least 3 people have answered                                | Fear of identification               |
| 5   | **Skill passport** (stretch) | A record of training and experience with a shareable verification link                                              | Add verified training records                                                                     | Lost career history                  |
| 6   | **Fatigue alerts**           | A warning when hours or rest breaks cross safe limits                                                               | Fatigue list per site                                                                             | Overwork                             |
| 7   | **Admin dashboard**          | —                                                                                                                   | Attendance trend, open hazards, feedback heatmap, quit-risk table with the top reasons per person | Zero visibility, attrition           |
| 8   | **Voice and local language** | Every screen can be read aloud; voice input for reports; English, Hindi and Tamil                                   | Local-language reports summarised in English                                                      | Language and literacy barriers       |

---

## How it works

### Rules come from code, not from AI

Every number a worker or employer sees is calculated by tested, rule-based code. The defaults follow Indian labour law and can be changed per organisation.

| Rule             | Default                                                                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overtime         | Work beyond 8 hours a day or 48 hours a week is paid at twice the ordinary rate (Occupational Safety, Health and Working Conditions Code 2020, in force since 21 November 2025) |
| Deductions       | PF at 12% of basic pay (on wages up to ₹15,000); ESI at 0.75% when gross pay is ₹21,000 or less                                                                                 |
| Fatigue          | More than 48 hours in 7 days, a shift longer than 10 hours, less than 10 hours of rest between shifts, or 7 days in a row without a day off                                     |
| Hazard deadlines | Acknowledge within 1 hour (critical), 4 hours (high), 24 hours (medium), 72 hours (low); otherwise escalate                                                                     |
| Anonymity        | Feedback is stored without the worker's identity, results are hidden for groups of fewer than 3, and names and phone numbers are removed from comments                          |
| Quit risk        | A 0–100 score from overtime load, fatigue flags, attendance drop, unresolved complaints and team feedback, always shown with its top 3 reasons                                  |

### AI explains, it does not decide

Google Gemini has three jobs:

- Explain a payslip in simple words in the worker's language.
- Turn a spoken hazard report in Hindi or Tamil into an English summary with a suggested category and severity, which a supervisor confirms.
- Summarise the week's anonymous feedback themes for the employer.

If AI is unavailable, every feature still works with a rule-based fallback. AI text is always labelled "Explained by AI · check with your supervisor".

### Built for the people who will actually use it

Research on low-literacy users in India shows that text-only apps fail first-time users, and that pictures, voice and the local language work much better. FairShift follows that research:

- **Icons and labels:** every action has an icon, a one-word label and voice.
- **Shallow navigation:** two levels at most (home, then the task).
- **Minimal typing:** a numeric PIN pad, big buttons and voice input instead of typing.
- **Visual confirmation:** every confirmed action gets a clear "stamp" ("CHECKED IN 08:02", "PAID", "RESOLVED"), so the worker knows it worked.
- **Readable outdoors:** a light, high-contrast design, because many workers use their phones in sunlight.
- **Light enough for basic phones:** the worker app ships no animation libraries and loads only the fonts for the chosen language.

---

## Works across sectors

The problem statement requires at least two industries. FairShift uses one data model (organisation → site → team → worker → shift) for all of them. Only the vocabulary, hazard categories and seed data change between sectors.

| Sector                                   | Example                      | Typical workers                                         | Sector-specific use                                                       |
| ---------------------------------------- | ---------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Construction** (built and demoed)      | Skyline Towers site, Chennai | Masons, helpers, electricians on daily or monthly wages | Gate QR check-in, daily-wage overtime, scaffolding and electrical hazards |
| **College campus** (built and demoed)    | Campus Facilities            | Housekeeping, security and maintenance staff            | Multi-building check-in, night-shift fatigue, facility hazards            |
| **Hospital** (same model, shown in docs) | Ward support services        | Sanitation and care staff on round-the-clock rotas      | Back-to-back shift alerts, infection and sharps hazards                   |

---

## Why it fits SDG 8

| SDG 8 target                                                                | How FairShift contributes                                                                                                        |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **8.5** Decent work for all, and equal pay for work of equal value          | Every worker sees the same transparent pay rules applied to their own hours, overtime included                                   |
| **8.8** Protect labour rights and safe working environments for all workers | Hazard reports with enforced response deadlines, fatigue limits based on labour law, and a safe anonymous channel for complaints |

---

## Technology

| Layer    | Choice                                                                                     |
| -------- | ------------------------------------------------------------------------------------------ |
| App      | Next.js 16 full-stack (React 19, TypeScript), one container                                |
| Hosting  | Vercel                                                                                     |
| Database | MongoDB Atlas (connection string in a Vercel environment variable, never in the code)      |
| AI       | Google Gemini API, with rule-based fallbacks                                               |
| Voice    | Browser Web Speech API for speech-to-text and read-aloud                                   |
| Quality  | Unit and component tests (Vitest), CI on GitHub Actions, accessibility and security checks |

Detailed documents:

- `docs/fairshift-plan.md`: architecture, rules and build phases.
- `docs/design-system.md`: the full design contract.

---

## One-line pitch

**"FairShift turns the paper register into a fair one: workers see every hour and rupee in their own language and can speak up safely, while employers catch overwork, hazards and attrition before they turn into injuries and resignations."**
