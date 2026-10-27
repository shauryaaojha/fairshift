# FairShift: Architecture, Build Phases & UI Plan

_Status: architecture, DB and UI DECIDED; GCP setup and team/time still open. As of 2026-10-27._

Sources: `docs/FairShift Problem Statement (SDG 8).pdf`, `docs/PromptWars 2026 Submission Guide.pdf`, `docs/promptwars-winners-research.md`. The design contract is in **`docs/design-system.md`**.

---

## 1. What we are scored on

There are two scorers, and the plan has to satisfy both of them.

| Scorer                                                        | Criteria                                                                                                           | What it means for us                                                                                                                               |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AI evaluator** (leaderboard, max 2 attempts, latest counts) | Code Quality, Security, Efficiency, Testing, Accessibility, Problem Alignment                                      | Clean layered code, zero keys in the repo, small bundle, high test coverage, WCAG contrast + keyboard navigation, every PS requirement visibly met |
| **Jury** (problem-statement rubric)                           | Real-World Impact, SDG 8 relevance, Inclusivity & Ease of Use, Technical Implementation, Feasibility & Scalability | Works for low-literacy workers on basic phones in regional languages, 2 working UIs, 2+ sectors                                                    |

**Hard submission rules:** public repo with the URL ending in `.git`, 1 branch, under 10 MB, deployed on **Google Cloud Run only** (Vercel and Netlify are rejected), plus a LinkedIn post.

**Problem-statement must-haves:** 3+ working features, 2 UIs (worker + employer/admin), 2+ industry use cases.

---

## 2. Can Cloud Run run full Next.js? Do we need workers?

**Yes, Cloud Run runs full Next.js.** Cloud Run runs any container that listens on `$PORT`. With Next.js `output: "standalone"` in a Docker image, everything works:

- SSR and React Server Components
- Route Handlers (`app/api/*`)
- Server Actions and middleware
- Streaming / SSE

Nothing is lost compared with Vercel.

**Background workers are the one thing to be careful with.** A Cloud Run _service_ throttles CPU when no request is in flight, so `setInterval` or a long-running in-process queue is unreliable. Google's answers:

| Need                                                                 | Cloud Run answer                                                  |
| -------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Periodic job (escalate unacknowledged hazards, nightly fatigue scan) | **Cloud Scheduler** calls `POST /api/cron/...` with an OIDC token |
| One-off async task (send alert, translate report)                    | **Cloud Tasks** or Pub/Sub push to an endpoint                    |
| Batch run                                                            | **Cloud Run Jobs**                                                |
| Always-on worker                                                     | Service with "CPU always allocated" (costs money)                 |

**Our case needs no workers.** Escalation, fatigue flags and quit-risk are computed **on read** from timestamps. For example, a hazard with no acknowledgement after its SLA is shown as escalated whenever anyone loads it. This is deterministic, testable and free. Cloud Scheduler is an optional extra for push alerts.

### Option A: Next.js full-stack, one container (RECOMMENDED)

```
Browser ──> Cloud Run: Next.js 16 (standalone)
              ├─ app/(worker)/*   RSC pages, tiny client JS
              ├─ app/(admin)/*    dashboard pages
              ├─ app/api/*        Route Handlers = thin HTTP layer
              └─ src/server/      the "backend":
                   domain/        pure rules (pay, OT, fatigue, risk, SLA, anonymity) ← unit tested
                   services/      use-cases (checkIn, reportHazard, ...)
                   repos/         Firestore adapter + in-memory adapter (tests/local)
                   ai/            Gemini via Vertex AI (no API key) + deterministic fallbacks
         ──> Firestore    ──> Vertex AI Gemini (service-account auth)
```

- **Pros:**
  - One URL, one deploy, no CORS, one cold start.
  - RSC sends very little JS to low-end phones, which helps Efficiency and Inclusivity.
  - It is our default stack, so it is the fastest to build.
- **Cons:** the API sits inside Next.js. We fix that with a strict `src/server` layer that has no Next imports in `domain/`, so the evaluator still sees a clean backend.

### Option B: Next.js frontend + separate backend (Express/Fastify or FastAPI), 2 Cloud Run services

- **Pros:** the backend is visibly separate, and each side can be scaled independently.
- **Cons:**
  - Two deploys and two cold starts.
  - CORS and auth cookies across origins.
  - Only one URL can be submitted.
  - More code in the same time window.
- Worth it only for a real product with a mobile app or other API clients. That is not the case in a hackathon.

### Option C: Vite React SPA + Express in one container

- **Pros:** the lightest server, and a simple mental model.
- **Cons:** the whole UI ships as client JS, which is worse on 2 GB-RAM phones. There is no SSR for first paint on 3G.

**Recommendation: Option A.** Option B's separation adds no points for either scorer, and costs time.

---

## 3. Stack decisions

| Layer         | Recommended                                                                                                                       | Why                                                                                                                                                         | Alternative                              |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Framework     | Next.js 16 (App Router, TS strict), `output: standalone`                                                                          | SSR/RSC for low-end phones, single container                                                                                                                | —                                        |
| Styling       | Tailwind v4 + CSS variables tokens                                                                                                | fast to build, tiny CSS output                                                                                                                              | plain CSS                                |
| DB            | **Firestore** (Native mode, `asia-south1`), **DECIDED**                                                                           | serverless, matches the Google stack, free tier (1 GiB, 50k reads/day), no connection pooling issues on Cloud Run, auth via the service account (no secret) | —                                        |
| Animation     | CSS + native View Transitions on worker routes; `gsap` + `@gsap/react` + `next-transition-router` on admin/landing only           | see `docs/design-system.md` §6–7                                                                                                                            | —                                        |
| Local/test DB | In-memory repo with the same interface + seed data                                                                                | tests run without cloud; demo works offline                                                                                                                 | —                                        |
| AI            | **Gemini via Vertex AI** with `@google/genai` (`vertexai: true`), auth by the Cloud Run service account                           | **no API key exists anywhere**, which maxes Security                                                                                                        | AI Studio API key in Secret Manager      |
| Voice         | Web Speech API (speech-to-text in `hi-IN`, `ta-IN`, `te-IN`, `en-IN`) + `speechSynthesis` for read-aloud                          | free, no upload, works in Chrome on Android                                                                                                                 | Gemini audio transcription as a fallback |
| Auth          | Worker: phone + 4-digit PIN (scrypt-hashed) on a big numeric keypad. Admin: email + password. HMAC-signed httpOnly session cookie | low literacy friendly, no SMS cost                                                                                                                          | Firebase Auth phone OTP (SMS costs)      |
| Validation    | zod on every API input                                                                                                            | Security + Code Quality                                                                                                                                     | —                                        |
| Security      | CSP/security headers, rate limit on auth + report endpoints, role checks in one guard                                             | Security                                                                                                                                                    | —                                        |
| Tests         | Vitest (domain + services + route handlers), Testing Library for key components, Playwright smoke (optional)                      | Testing                                                                                                                                                     | —                                        |
| CI            | GitHub Actions: typecheck, lint, test with coverage, build                                                                        | Code Quality / Testing proof                                                                                                                                | —                                        |
| Deploy        | `gcloud run deploy --source .` (Cloud Build from the Dockerfile), region `asia-south1` (Mumbai)                                   | closest to users                                                                                                                                            | —                                        |

**Pure-function domain engine:** every number comes from tested code, never from the LLM (the EcoPilot pattern).

| Engine     | Rule (defaults, editable per organisation)                                                                                                                           |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overtime   | Beyond **8 h/day or 48 h/week** paid at **2x** the ordinary rate (OSH Code 2020, in force 21 Nov 2025)                                                               |
| Payslip    | Gross = base + OT + allowances. PF 12% of basic (wage ceiling INR 15,000). ESI 0.75% if gross ≤ INR 21,000. Net, with each line explained                            |
| Fatigue    | > 48 h in a rolling 7 days, shift > 10 h, rest gap < 10 h between shifts, 7+ consecutive days without a weekly rest                                                  |
| Quit risk  | Explainable 0–100 score: OT load, fatigue flags, attendance drop, unresolved complaints of the worker, team feedback trend. Shows its top 3 reasons                  |
| Hazard SLA | Critical: ack in 1 h, High: 4 h, Medium: 24 h, Low: 72 h. Missed SLA means auto-escalated to the next level (computed on read)                                       |
| Anonymity  | Feedback stored without worker id (org + site + team + ISO week only). Aggregates hidden below **k = 3** responses. Free text is scrubbed of phone numbers and names |
| Geofence   | Haversine distance to the site ≤ its radius, or a valid rotating QR code                                                                                             |

**Where Gemini is used**, always with a deterministic fallback when AI is off or fails:

1. Explain the payslip in plain words in the worker's language.
2. Turn a voice/text hazard report in a local language into an English summary + suggested category and severity. The admin confirms it.
3. Summarise the week's anonymous feedback themes for the admin. It is only run on groups with k ≥ 3.

---

## 4. Feature scope

The PS asks for 3+ features. We commit to 7 and keep 1 as a stretch goal.

| #   | Feature (PS example)                               | Worker UI                                                                                                      | Admin UI                                                    | Phase |
| --- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----- |
| 1   | Shift tracking: QR / location check-in, auto OT    | Check in/out with one big button; scan the site QR with the phone's own camera (no scanner library) or use GPS | Site kiosk page shows a rotating QR; live on-site count     | 2     |
| 2   | Clear payslips in the native language              | Payslip with icons + numbers + read-aloud button, "why this amount?"                                           | Payroll preview per site                                    | 2     |
| 3   | Safety reporting by voice/text with status         | Tap the mic, speak in your language, optional anonymous; track status                                          | Hazard queue with SLA timers, ack/resolve, auto-escalation  | 2–3   |
| 4   | Honest anonymous feedback                          | 4 emoji-scale questions + optional voice/text comment                                                          | Team heatmap (k ≥ 3), AI theme summary                      | 2–3   |
| 6   | Fatigue alerts                                     | Warning card ("you worked 56 h this week, rest is due")                                                        | Fatigue list per site                                       | 2–3   |
| 7   | Admin dashboard: attendance, complaints, quit risk | —                                                                                                              | KPIs, 14-day attendance trend, quit-risk table with reasons | 3     |
| 8   | Voice & local languages, low-end phones            | EN / हिंदी / தமிழ் (+ తెలుగు stretch), read-aloud on every screen                                              | Admin reads translated reports                              | 2–4   |
| 5   | Skill passport (stretch)                           | Training/experience record + a shareable verify link                                                           | Add a training record                                       | 4     |

**Two sectors:** _Construction_ (Skyline Towers site, daily-wage shift workers) and _College campus_ (housekeeping, security and maintenance staff). The same data model is used, with a sector-specific vocabulary and hazard categories. A third sector (Hospital) only needs to be added as seed data, which shows that the design scales.

---

## 5. UI decisions

### Worker app (mobile-first, built for low literacy and low-end phones)

- **First screen:** a language picker in native script (English · हिंदी · தமிழ்) with large buttons, then a numeric PIN pad.
- **Home:** 6 large icon tiles (Check-in, My Pay, Report Danger, Feedback, My Hours, Skills). Each tile has an icon + one word + a colour. The colour is never the only cue.
- **Every screen has a speaker button** that reads it aloud in the chosen language. The primary action is one big bottom button.
- **Accessibility:** 48 px+ touch targets, ≥ 4.5:1 contrast, visible focus ring, works at 360 px width and 200% zoom.
- **Performance:** the target is < 120 KB JS on worker pages, with no chart or icon libraries (inline SVG icons). It should feel fast on 3G and 2 GB-RAM Android phones.

### Admin dashboard (desktop-first, responsive)

- Left nav: Overview · Attendance · Safety · Feedback · Workforce Risk · Sites (QR kiosk).
- **Overview:**
  - A KPI row: on-site now, open hazards (escalated in red), fatigue flags, high quit risk.
  - A hand-drawn SVG chart of the 14-day attendance trend.
  - An "AI insight of the week" card.
- **A sector/site switcher** at the top (Construction ↔ College) shows the 2+ sectors live.
- Every number links to its rows. Quit-risk rows show their reasons ("62 h last week, 2 unresolved complaints").

### Visual identity: DECIDED, "Muster Roll"

The full contract is in **`docs/design-system.md`**. In short:

- **Direction:** the honest version of the worker's paperwork (attendance register, punch card, carbon-copy payslip, rubber stamp, hi-vis signage).
- **Palette:** register paper `#F2F3EE`, graphite `#1C1D1A`, ballpoint ink `#1F3FB5` (action), hi-vis `#FF5A1F` (danger only), cleared `#1D7340`, escalated `#B42318`. All text pairs are ≥ 4.5:1.
- **Type:** **Anek** (Ek Type, multi-script: Latin + Devanagari + Tamil, weight + width axes) + **Martian Mono** for times and money. The Inter/Space Grotesk/Geist/Instrument Serif/Fraunces/Plus Jakarta set is banned.
- **Signature:** the `<Stamp>` component on every real confirmation (CHECKED IN 08:02, PAID, RESOLVED).
- **Motion:** 10 moments mapped to components in `~/Documents/Animations`. The worker app uses zero animation libraries; the admin/landing use GSAP. Indic text is never char-split.

---

## 6. Build phases (time-boxed, with exit criteria)

| Phase                            | Scope                                                                                                                                                                                                                                                                                                                                   | Exit criteria                                                                                                        |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **P0: Scaffold + deploy early**  | Next.js 16 + TS strict + Tailwind (tokens from `design-system.md` §3–4 as CSS variables), Anek + Martian Mono via `next/font`, `DESIGN.md` at the repo root, folder layout, Dockerfile (standalone), `.gitignore`/`.dockerignore`, CI workflow, README skeleton, GCP project + Firestore + Vertex AI enabled, first `gcloud run deploy` | A live Cloud Run URL serves the landing page in Muster Roll tokens; the repo is 1 branch and < 1 MB                  |
| **P1: Domain + data**            | `src/server/domain/*` engines, repo interface, in-memory + Firestore adapters, seed data for 2 sectors, services                                                                                                                                                                                                                        | Vitest ≥ 90% coverage on `domain/`, all rules from section 3 covered                                                 |
| **P2: Worker UI + APIs**         | Auth (PIN), i18n (en/hi/ta), check-in (QR/GPS), payslip, hazard voice report, feedback, fatigue card, read-aloud, `<Stamp>`, custom icon set, animations #3–#6 (CSS + View Transitions)                                                                                                                                                 | The full worker flow works on a 360 px phone with no AI key; JS ≤ 120 KB                                             |
| **P3: Admin UI + APIs**          | State sentence + attendance trend, hazard queue with SLA, feedback heatmap (k ≥ 3), quit-risk table, site QR kiosk, sector switcher, landing page, animations #1, #2, #7–#9 (GSAP)                                                                                                                                                      | Both UIs work end to end across 2 sectors                                                                            |
| **P4: AI layer + stretch**       | Vertex Gemini: payslip explainer, hazard summarise/translate/classify, feedback themes; fallbacks; skill passport                                                                                                                                                                                                                       | AI on and off both work; no key in the repo                                                                          |
| **P5: Score hardening + submit** | axe/Lighthouse pass, CSP + rate limits, tests for API routes, **slop gate** (`design-system.md` §9), Hindi/Tamil 360 px check, README with real badges, `docs/industry-use-cases.md`, LinkedIn post draft, final deploy                                                                                                                 | Lighthouse budgets met (`design-system.md` §8), 0 axe violations, `npm audit` clean, slop gate clean → **attempt 1** |

Attempt 2 is used only if the attempt-1 feedback points at fixable items that will clearly raise the score.

---

## 7. Open questions (**DECIDE**)

1. ~~Architecture~~ **DECIDED: Option A, Next.js full-stack in one container.**
2. ~~DB~~ **DECIDED: Firestore** (Native mode, `asia-south1`). The server uses the Firebase Admin SDK with Application Default Credentials (the Cloud Run service account), so there is no connection string or key anywhere. The in-memory adapter stays for tests and local use.
3. ~~Visual identity~~ **DECIDED: "Muster Roll" direction**, with full spec in `docs/design-system.md` (tokens, Anek multi-script type, stamp signature, animation map from `~/Documents/Animations`, ban list).
4. GCP: is there a project with billing enabled, and who runs `gcloud auth login`? (`gcloud` is not installed on this laptop yet.)
5. How long is the hacking window, and is it solo or a team? (This decides whether phases are split per person.)
