# FairShift: finals plan (Top 13 → Top 3)

## What changed

The online round was scored by an AI evaluator on six criteria:

- code quality
- security
- efficiency
- testing
- accessibility
- problem alignment

FairShift scored **97.15** there and ranked **#1**.

The finals are reviewed by a **human panel**. It will open the repo cold, run it, and read it.

| The panel checks                          | Where FairShift stood before the finals                                                               |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Code runs without errors from fresh setup | `npm ci && npm run dev` works with no env vars. No Docker path, no Node version pin, no health check. |
| Clean, readable, well-structured code     | Three layers, strict TS. But errors were plain strings, sorted by `message.includes(...)` matching.   |
| Clear README                              | Long, written for the AI rubric. A first-time reader has to scroll to find "how do I run it".         |
| `.env.example`                            | Present, but the variables were not validated at startup.                                             |
| Error handling and input validation       | zod on every action. But no `error.tsx`, `not-found.tsx` or `loading.tsx` anywhere.                   |
| Live demo                                 | Vercel, running the PWA commit. Not yet running the offline-first commit.                             |
| Screenshots / demo video                  | Screenshots yes, video no.                                                                            |

Submission format, from the org repo: put everything in `students/<RegisterNumber>-<Name>/`, on a branch of the same name, then open a pull request. The folder holds:

- `README.md`
- `src/` (full project)
- `prompts.md`
- `screenshots/`

## Phases and exit criteria

### P1: Typed errors, env validation, error pages

- `src/shared/errors.ts`: `AppError` with a closed `code` union and a `permanent` flag. Services throw codes, not prose. Actions map codes to UI states without string matching.
- `src/server/env.ts`: zod-validated server env. It fails fast in production with one readable message, and keeps a zero-config local dev setup.
- `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`, plus worker and admin `loading.tsx` / `error.tsx`. All of them use the existing tokens and are translated.
- `app/api/health/route.ts`: liveness, the data backend in use, and whether AI is configured. No secrets in the output.
- Fix stale comments ("Vertex AI", "8-second timeout").
- **Exit:** `grep -r "message.includes\|m.includes" src app` returns nothing. Every route segment has an error boundary.

### P2: "Ask FairShift", a grounded assistant (standout feature; now named Urima)

- **Worker (`/w/ask`):**
  - Ask in English, Hindi or Tamil, by voice or text: "why is my pay lower this week?", "how many hours did I work?", "what happens to my hazard report?", "am I owed overtime?"
  - Gemini **function calling** over read-only tools. Each tool is bound to the session worker on the server: week hours, payslip, fatigue, my hazards, labour-rights facts.
  - The model never sees an id it could change, and it never computes a number. Every number comes from a tested rule engine, and the UI shows which tool supplied it ("From: your payslip").
- **Supervisor (`/admin/ask`):**
  - Questions like "who is at risk of quitting at Skyline?" or "which hazards are overdue?"
  - Tools are scoped to `allowedOrgIds`.
- **Without a key, or if Gemini fails:** a deterministic intent router answers from the same tools, so the feature never breaks in the demo.
- **Guardrails:**
  - max input length
  - per-user rate limit
  - tool allowlist
  - max 3 tool rounds
  - a timeout
  - prompt-injection text in the question cannot reach another worker's data, because the tools have no id parameter
- **Exit:** unit tests for the tool scoping, the fallback router, the guardrails and the Gemini loop (with a mocked client).

### P3: Testing depth

- Run node-only tests in a `node` environment and only component tests in `jsdom` (Vitest projects). The suite gets faster.
- Widen coverage from `src/server/domain` to `src/server/**`, `src/shared/**` and `src/lib/**`, with enforced thresholds.
- New tests: errors, env, health route, assistant, rate limiter, session tamper cases.
- **Exit:** `npm run verify` is green, and the coverage numbers in the README are measured, not estimated.

### P4: Security hardening

- Nonce-based CSP from `proxy.ts` (no `'unsafe-inline'` for scripts), if Cache Components allows it. Otherwise document why.
- `SECURITY.md` (threat model plus reporting), Dependabot, CodeQL, and `npm audit --omit=dev` in CI.
- **Exit:** CI runs all of the above.

### P5: Fresh-setup DX

- `.nvmrc` and `engines`.
- `npm run verify` (format, types, lint, tests, build).
- Multi-stage `Dockerfile` (standalone) and `docker-compose.yml` with MongoDB.
- README rewritten for a first-time human reader:
  1. What it does
  2. 60-second quick start
  3. Demo logins
  4. Tech stack
  5. Env table
  6. Architecture
  7. Tests
  8. Security
  9. Screenshots and video
  10. Live link

### P6: Submission package

- `students/<RegisterNumber>-<Name>/` containing `README.md`, `prompts.md`, `screenshots/`, and `src/` (the full project, so `cd src && npm ci && npm run dev` works).
- A branch named the same, then a pull request titled `Submission – <RegisterNumber> – <Name>`.
- No `.env*` (only `.env.example`), no `node_modules`, `.next` or coverage.
- This needs the register number and name from Shaurya before pushing.

## Status (2026-10-29)

| Phase                             | State   | Notes                                                                                                                                                                     |
| --------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1 Typed errors, env, error pages | Done    | `src/shared/errors.ts`, `src/server/env.ts`, `app/**/error.tsx`, `app/not-found.tsx`, `/api/health`                                                                       |
| P2 Urima (was Ask FairShift)      | Done    | Worker `/w/ask` and supervisor `/admin/ask`; verified live against Gemini                                                                                                 |
| P3 Testing depth                  | Done    | 361 tests; 93% statements and 88% branches across server, shared and lib code                                                                                             |
| P4 Security                       | Done    | `SECURITY.md`, CodeQL, Dependabot, `npm audit` in CI. Nonce CSP is not possible with PPR; see SECURITY.md                                                                 |
| P5 Fresh-setup DX                 | Done    | `.nvmrc`, `engines`, `npm run verify`, Dockerfile, compose, `.gitattributes`, new README. Verified with a clean copy: `npm ci`, tests and build all pass with no env file |
| P6 Submission package             | Waiting | Needs the register number and name, and Shaurya's go-ahead to push and open the PR                                                                                        |

Bugs found and fixed along the way:

- **Offline banner on every worker page.** Node 22 defines `navigator` without `onLine`, so worker pages server-rendered the offline banner.
- **Offline check-out lost its time.** Replays dropped the capture time and client id.
- **Overview loaded data three times.** It also gave the AI briefing a stale escalation count.
- **Build needed a secret.** `next build` failed without `SESSION_SECRET`.
- **Fallback routing missed suggested questions.** The keyword router did not match "How much will I get this month?" or "checked in".
- **Quota errors slowed every request.** The free Gemini tier (5 requests a minute) caused 429s; a circuit breaker and a briefing cache now handle them.

## P7: Worker power (added 2026-10-30)

Each closes a gap between what a worker is owed and what they can prove or enforce:

| Feature                         | What it does                                                                                                                           | Code                                                 |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Two-key hazard closure          | A supervisor's "resolved" waits for the named reporter; "not fixed" reopens it as escalated                                            | `src/server/domain/hazardClosure.ts`                 |
| "Did you get the right amount?" | The worker types what they got in hand and sees the gap against the payslip. Reads Devanagari and Tamil digits, stores nothing         | `src/shared/payCheck.ts`                             |
| Know your rights                | Eight rights cards citing the Code on Wages 2019 (s. 3, 13, 14, 17, 18) checked against the Act's text; tap-to-call national helplines | `src/shared/rights.ts`, `app/w/rights`               |
| Statutory registers             | Monthly attendance (muster roll) and wage register CSV from the payslip engine; formula-injection-safe                                 | `src/server/domain/registers.ts`                     |
| Heat stress                     | NWS heat index from live Open-Meteo weather, NDMA advice for workers, an action banner for the site lead                               | `src/server/domain/heat.ts`, `src/server/weather.ts` |

**Exit:** `npm run verify` passes with 419 tests in 58 files at 94.3% statement coverage.

## P8: Pay disputes, pay rules, shift planning (added 2026-10-31)

The same idea applied to pay disputes and scheduling:

| Feature                  | What it does                                                                                                                                                                        | Code                                                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Pay query (two keys)     | The worker raises short pay, unpaid overtime, a wrong deduction or late pay. The employer answers within 48 h; only the worker's "settled" closes it, "not yet" reopens it for 24 h | `src/server/domain/payQuery.ts`, `app/w/pay/query`, `/admin/pay` |
| Versioned overtime rules | Changes start on a coming Monday, need a reason, are refused below the OSH Code / Code on Wages floor; every week is paid under its own rules                                       | `src/server/domain/payRules.ts`                                  |
| Plan a shift             | Before a supervisor adds a shift: the new fatigue warnings, clashes and overtime cost it would bring                                                                                | `src/server/domain/shiftPlan.ts`, `/admin/plan`                  |
| Anonymity and severity   | Anonymous hazard times kept to the hour; danger words in 3 languages set a severity floor before AI                                                                                 | `src/server/domain/hazardSignals.ts`                             |
| Where to complain        | Employer → SAMADHAN portal → district labour office → free legal aid (NALSA 15100), on the rights page and in the assistant                                                         | `src/shared/rights.ts`                                           |

**Exit:** `npm run verify` passes with 486 tests in 66 files at 95.0% statement coverage (rule engines 100% lines).

**Still open:** axe re-audit including `/w/rights`, `/w/pay/query`, `/admin/pay` and `/admin/plan`; fresh screenshots.

## P9: Wages paid, assistant that fills in reports, one answer per person, site score (added 2026-10-31)

| Feature                        | What it does                                                                                                                                                                                                           | Code                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Wages by UPI                   | Console shows each worker's payslip with a `upi://pay` QR for that exact amount; the employer records the 12-digit UTR; one payment per worker and month; unpaid after the 7th is overdue                              | `src/server/domain/wagePayment.ts`, `services/adminPay.ts`, `/admin/pay` |
| Honest PAID stamp              | The worker's payslip says DUE until a payment is recorded, then PAID with the date and UTR to show the bank                                                                                                            | `app/w/pay/page.tsx`, `workerViews.loadMyWages`                          |
| Urima fills in, never files    | A described hazard becomes a filled-in report (category, danger-word severity, deadline) that the worker sends; a supervisor complaint opens the anonymous feedback form with the words in it. Rule-based, 3 languages | `src/server/assistant/drafts.ts`, `src/components/worker/AskDraft.tsx`   |
| One feedback answer per person | A keyed hash of worker, team and week is claimed atomically; it is stored apart from the answer and cannot be reversed to a worker, so a team's average counts people, not submissions                                 | `src/server/domain/feedbackBallot.ts`                                    |
| Fair-site score                | One score out of 100 per site, the plain average of five parts, each traceable to a count; a part with nothing to measure is left out                                                                                  | `src/server/domain/siteScore.ts`, `/admin/sites`                         |

**Exit:** `npm run verify` passes with 551 tests in 71 files at 95.2% statement coverage.

**Before redeploying:** workers already in the hosted MongoDB have no `upiId`, so the console shows "No UPI ID on file" for them until it is filled in (or the database is re-seeded).

## P10: Proof a worker can take to the labour office (added 2026-10-31)

| Feature                     | What it does                                                                                                                                                                                                                                                 | Code                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Money in paise              | Pay is summed in whole paise and rounded once, so a payslip, a pay gap and overtime pay never drift by a rupee                                                                                                                                               | `src/shared/money.ts`, `domain/overtime.ts`, `domain/payslip.ts`                  |
| Signed shift receipts       | Each shift is sealed at check-out (HMAC under a key derived from `SESSION_SECRET`); **My hours** shows the receipt code; `/verify/<token>` is public and shows unchanged, changed or deleted                                                                 | `src/server/domain/shiftReceipt.ts`, `services/receipts.ts`, `app/verify/[token]` |
| Letter to the labour office | Opens when the employer misses the deadline or the worker says "not settled". Printable in English, Hindi or Tamil: days, hours, gap, last answer, Code on Wages s.17 / s.14 / s.45, a table of shifts with receipt codes, and a QR to a signed period total | `src/server/domain/labourLetter.ts`, `app/w/pay/query/[id]/letter`                |

**Exit:** `npm run verify` passes with 581 tests in 75 files at 95.2% statement coverage. Checked in a browser: receipt links on My hours, the receipt page, the letter in three languages and in print view, the officer's QR view, a month with no shifts, and a forged token.

**Before redeploying:** shifts already in the hosted MongoDB have no `receipt`, so My hours shows them without a code (re-seed, or run a one-off script that seals closed shifts). Production `SESSION_SECRET` must stay the same from now on, or every receipt reads as not valid.

## P11: Interface pass (added 2026-10-31)

| Area           | What changed                                                                                                                                                                                                           | Code                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Worker home    | Today as a shift ticket (time on site, a bar that turns hi-vis in overtime, the check-in stamp), a "waiting for you" list (letter ready, employer answered, hazard marked fixed, wages late), and a 7-day muster strip | `src/components/worker/HomeBoard.tsx`, `ShiftClock.tsx`, `loadHomeBoard` in `workerViews.ts` |
| Worker tab bar | Home, Hours, Pay, Safety and Urima one tap away; hidden on sign-in and the printable letter. The per-page "go home" buttons are gone                                                                                   | `src/components/worker/WorkerTabs.tsx`                                                       |
| Console        | Overview opens with "Needs action", most urgent first, each row linking to the filtered page; the rail is grouped (Today, People, Money, Setup) with the signed-in supervisor; Pay is split into three tabs            | `src/components/admin/NeedsAction.tsx`, `buildNeedsAction` in `adminRows.ts`, `nav.ts`       |
| Landing        | Screenshots of the console and the Tamil worker app, three points (three languages, works offline, sealed receipts) and the demo accounts                                                                              | `app/page.tsx`, `public/shots/`                                                              |
| Fixes          | Big mono figures (the payslip net) kept their size; the 10-digit phone boxes no longer wrap at 390 px; the attendance chart's SVG title no longer breaks hydration                                                     | `app/globals.css`, `src/components/ui/PinPad.tsx`, `AttendanceChart.tsx`                     |

**Exit:** `npm run verify` passes with 592 tests in 77 files at 95.1% statement coverage. Checked in a browser in Hindi, Tamil and English at 390 px and on desktop; no page errors on any worker or console page.

**Redeploy:** the hosted demo database is re-seeded with this release (backed up first), so receipts are sealed with the production `SESSION_SECRET` and pay queries, wage payments and pay-rule history exist.
