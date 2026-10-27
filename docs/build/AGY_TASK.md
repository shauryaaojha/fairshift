# Task: Build FairShift end to end (PromptWars 2026 × SRM ACM, SDG 8)

> **RESUME NOTE (run 2):** A previous run stopped early, during P0. It hit a model quota limit.
>
> **State it left behind:**
>
> - `package.json`, `next.config.ts`, `app/layout.tsx`, `app/globals.css`, `app/page.tsx`, `proxy.ts`, `src/shared/types.ts`, `src/shared/schemas.ts`, `tests/setup.ts`, `vitest.config.ts` and `docs/BUILD_PROGRESS.md` exist.
> - **`node_modules` is empty.** The npm install never finished.
>
> **What to do:**
>
> 1. Read `docs/BUILD_PROGRESS.md` and the existing files, and keep what is good.
> 2. **Fix `package.json` to current versions** before installing:
>    - `zod@^4`, `@google/genai@^2`, `vitest@^5`, `@vitest/coverage-v8@^5`, `@vitejs/plugin-react@^6`, `jsdom@^30`, `typescript@^5` (keep TS 5 for Next compatibility).
>    - Replace the non-existent `@tailwindcss/turbopack` with **`@tailwindcss/postcss`** + a `postcss.config.mjs`.
>    - Use the latest `gsap`, `next-transition-router`, `firebase-admin` and `qrcode`.
> 3. Run **one** `npm install` (the network is slow; give it time, and do not start parallel installs).
> 4. Continue from P0.

You are working in **C:/Users/shaur/Documents/promptwars**. This folder is the repo root. Build the app **at the root** (`package.json` at the root, not in a subfolder). The folder currently contains only `docs/`.

You are the lead engineer. **Use your subagents / parallel agents to split the work** (see section 6). You integrate and verify their output. Every decision below is already MADE. Do not re-open it. Where something is truly unspecified, choose the option that scores best on the six AI-evaluator criteria (section 1), and note it in `docs/BUILD_PROGRESS.md`.

---

## 0. Read these first (in this order)

1. `docs/FairShift Problem Statement (SDG 8).pdf`: the challenge (worker + admin UIs, 3+ features, 2+ sectors, judging rubric).
2. `docs/PromptWars 2026 Submission Guide.pdf`: hard rules (Cloud Run only, 1 branch, repo < 10 MB, the 6 AI-evaluation parameters).
3. `docs/fairshift-plan.md`: architecture, stack, domain rules, features, phases. **This is the spec.**
4. `docs/design-system.md`: **the design contract.** Tokens, fonts, layout, the `<Stamp>` signature component, the motion rules, the animation map and the ban list. Follow it exactly.
5. `docs/promptwars-winners-research.md` sections 0, 4 and 5: what scored 97/100 before (tests, a11y, security, deterministic engine + LLM on top, demo mode).
6. Animation references (read their code for technique, **do not copy their folders, images or fonts**). They are at `C:/Users/shaur/Documents/Animations/components/`. These are the entries from `design-system.md` §7:
   - `Page Transitions/12`
   - `Hero Animations/22`
   - `Grid Animations/1`
   - `Grid Animations/9`
   - `Text Animations/12`
   - `SVG Animations/5`
   - `Navigation Menus/5`
   - `Hover Effects/19`
   - `Sliders/3`
7. Next.js 16 changed APIs (for example, `middleware` is now `proxy.ts`). After installing, read the docs bundled in `node_modules/next/dist/docs/` for anything you are unsure about (App Router, route handlers, `proxy`, `next/font`, `output: "standalone"`, `experimental.viewTransition`). Do not rely on memory for Next 16 APIs.

---

## 1. How the result is scored (optimise for this)

**AI evaluator** (6 params): Code Quality, Security, Efficiency, Testing, Accessibility, Problem Alignment.

**Jury:** Real-world impact, SDG 8 relevance, Inclusivity & ease of use (regional languages, low literacy, basic phones), Technical implementation (clean code, security, working dual interfaces), Feasibility & scalability (2+ industries).

**Concretely:**

- Every number shown comes from pure, unit-tested domain functions, never from the LLM.
- The app works fully with **no cloud credentials** (in-memory data + deterministic AI fallbacks).
- No secret, key or credential anywhere in the repo.
- Every PS requirement is visibly met and named in the README.

---

## 2. Fixed stack (do not change)

- **Framework:** Next.js 16 (latest), React 19, TypeScript `strict`, App Router, `output: "standalone"`. Node 22. npm.
- **Styling:** Tailwind CSS v4, with design tokens from `design-system.md` §3–4 as CSS variables in `app/globals.css`.
- **Fonts:** via `next/font/google`:
  - `Anek_Latin`, `Anek_Devanagari`, `Anek_Tamil` (variable). **Load the Indic script only for the active locale.**
  - `Martian_Mono` for times, IDs and money. If `Martian_Mono` is not available in `next/font/google`, use `Spline_Sans_Mono`.
- **Data:** a repository interface with two adapters, chosen by `DATA_BACKEND=memory|firestore` (default `memory`):
  - `memory`: seeded on boot.
  - `firestore`: uses `firebase-admin` with **Application Default Credentials only** (no key file, no JSON in the repo).
- **AI:** `@google/genai` with `vertexai: true`, `project = GOOGLE_CLOUD_PROJECT`, `location = GOOGLE_CLOUD_LOCATION` (default `asia-south1`), and model from `GEMINI_MODEL` (default `gemini-2.5-flash`; keep it env-configurable).
  - If `GOOGLE_CLOUD_PROJECT` is unset or a call fails or times out (8 s), use the **deterministic fallback**. The UI must still work.
  - Label AI text "Explained by AI · check with your supervisor".
- **Validation and security:**
  - `zod` on every route handler input.
  - Security headers + CSP in `next.config` headers.
  - Rate limiting (simple in-memory token bucket) on login and report endpoints.
  - Role guard in one place.
- **Auth:**
  - Worker: phone + 4-digit PIN. Admin: email + password.
  - Both hashed with Node `crypto.scrypt`.
  - Session = HMAC-SHA256-signed token in an `httpOnly; Secure; SameSite=Lax` cookie, secret from `SESSION_SECRET`. In dev only, generate a random secret at boot and log a warning.
- **Animation:**
  - Worker routes: CSS + native View Transitions only (no animation library).
  - Admin + landing routes: `gsap` + `@gsap/react` + `next-transition-router`, imported only there.
- **Tests:** Vitest + `@vitest/coverage-v8`, `@testing-library/react` + jsdom for components.
- **CI:** `.github/workflows/ci.yml` runs `npm ci`, typecheck, lint, test with coverage, and build.
- **Deploy artefacts:** a multi-stage `Dockerfile` (node:22-alpine, standalone output, non-root user, listens on `$PORT`, default 8080) and `.dockerignore`.

---

## 3. Folder layout (use this)

```
app/
  layout.tsx  globals.css  page.tsx            # landing / role picker (Hero 22-style intro)
  w/  login/ page.tsx                          # worker app (mobile-first)
      page.tsx (home tiles)  checkin/  pay/  hazard/ (+ [id]/)  feedback/  hours/  skills/
  admin/ login/  page.tsx (overview)  attendance/  safety/  feedback/  risk/  sites/ (+ [id]/kiosk/)
  passport/[token]/page.tsx                    # public skill-passport verify page
  api/  auth/…  worker/…  admin/…  checkin/…  cron/escalate/route.ts (OIDC-ready, optional)
proxy.ts                                       # route protection (Next 16)
src/
  server/
    domain/   overtime.ts payslip.ts fatigue.ts quitRisk.ts hazardSla.ts anonymity.ts geofence.ts qrCode.ts skills.ts  (PURE, no Next/IO imports)
    services/ use-cases calling domain + repos
    repos/    types.ts memory.ts firestore.ts index.ts
    seed/     seed.ts (deterministic PRNG)
    ai/       gemini.ts + fallbacks.ts
    auth/     session.ts password.ts guard.ts rateLimit.ts
  shared/     types.ts zod schemas
  i18n/       en.ts hi.ts ta.ts index.ts
  components/ ui/ (Stamp, Button, PinPad, Tile, ReadAloud, …) worker/ admin/ icons/ (custom inline SVG icons)
tests/ (or colocated *.test.ts)
DESIGN.md (copy of docs/design-system.md)   README.md   .env.example   Dockerfile   .dockerignore   .gitignore
```

---

## 4. What to build

The details are in `fairshift-plan.md` §3–§4 and `design-system.md`. Required:

### 4.1 Domain engines (pure functions + exhaustive tests, ≥ 90% coverage on `src/server/domain`)

Defaults are per-org policy and overridable:

- **Overtime:** 8 h/day and 48 h/week limits. Overtime is paid at 2× the ordinary rate (OSH Code 2020, in force 21 Nov 2025).
- **Payslip:**
  - Gross = base + OT + allowances.
  - PF = 12% of basic, with the wage ceiling at ₹15,000.
  - ESI = 0.75% if gross ≤ ₹21,000.
  - Net, with every line carrying an explanation key (i18n).
- **Fatigue flags:**
  - More than 48 h in a rolling 7 days.
  - A shift longer than 10 h.
  - A rest gap shorter than 10 h.
  - 7 or more consecutive days without a rest day.
- **Quit risk:** a 0–100 score from OT load, fatigue flags, attendance drop, the worker's unresolved complaints and the team feedback trend. It returns its **top 3 reasons**.
- **Hazard SLA:** Critical 1 h, High 4 h, Medium 24 h, Low 72 h. A missed acknowledgement means **escalated, computed on read**.
- **Anonymity:**
  - Feedback is stored without a worker id (org + site + team + ISO week only).
  - Aggregates are hidden when fewer than **k = 3** responses exist.
  - Free text is PII-scrubbed (phone numbers, emails, worker names from the roster).
- **Geofence:** Haversine distance to the site must be within its radius.
- **Rotating QR check-in code:** a TOTP-like 6-digit code per site, rotating every 60 s, accepted with ±1 window. The secret comes from env/seed, never the client.

### 4.2 Seed data (deterministic, labelled "Demo data" in the UI footer)

- **Org 1, Construction:** "Skyline Towers site, Chennai". ~30 workers (masons, helpers, electricians), with daily-wage and monthly pay.
- **Org 2, College:** "Campus Facilities" (housekeeping, security, maintenance). ~20 staff.
- 21 days of shifts generated with a seeded PRNG so that real fatigue cases, OT and quit-risk cases appear.
- Hazards in every status (one escalated), feedback with groups both above and below k = 3, and skill records.
- **Demo logins:** one worker per sector + one admin per org. Show them on the login pages in a "Demo accounts" box (they are demo-only and not secrets).

### 4.3 Worker app (`/w`, mobile-first at 360 px)

1. **Language gate:** English · हिंदी · தமிழ், in native script, with spoken names. The choice is stored in a cookie; set `<html lang>`. **All UI strings live in `src/i18n`.** Write real Hindi and Tamil translations, not placeholders.
2. **Login:** a big numeric PIN pad that also accepts physical keys.
3. **Home:**
   - A today strip with a big CHECK IN stamp button and fatigue warning cards.
   - A 2×3 tile grid (Check-in, My Pay, Report Danger, Feedback, My Hours, Skills), each tile with a custom icon + one word.
   - Tile → screen uses View Transitions.
4. **Check-in/out:**
   - Scanning the site QR with the phone's native camera opens `/w/checkin?site=…&code=…`. No scanner library.
   - Or use GPS geofence.
   - Success shows the `<Stamp>` "CHECKED IN 08:02" (CSS animation, `hop` easing, 320 ms) + `navigator.vibrate` + a spoken confirmation.
5. **My Pay:**
   - The current period payslip from the engine: rows reveal line by line (CSS), then the net is stamped PAID.
   - "Hear my payslip" (speechSynthesis in the locale).
   - "Why this amount?", which shows the AI explanation with a deterministic fallback.
6. **Report Danger:**
   - Voice (Web Speech API `SpeechRecognition` with the locale `hi-IN`/`ta-IN`/`en-IN`; hide the mic if unsupported) or text.
   - Pick a category with big icon buttons, an optional anonymous toggle, and submit.
   - Status page shows a timeline (Reported → Acknowledged → Resolved) drawn with an SVG `stroke-dashoffset`.
7. **Feedback:** 4 questions on a big face scale (manager respect, safety, pay fairness, workload) + an optional voice/text comment. It is clearly marked anonymous and stamped RECEIVED.
8. **My Hours:** the week's shifts and OT, with fatigue flags explained in plain words.
9. **Skills (stretch, do it last):** a skill passport list + a shareable verify link to `/passport/[token]`.

On every screen:

- A read-aloud 🔊 button (custom icon, not emoji) in the top bar.
- One full-width primary action at the bottom.
- Targets ≥ 48 px.
- Respect `prefers-reduced-motion`.

### 4.4 Admin console (`/admin`, desktop-first, responsive)

- **Sector switcher** (Construction ↔ College) at the top, driving every view.
- **Overview:**
  - A one-sentence state line ("43 of 51 on site · 2 hazards escalated · 5 over 48 h"), with each number linking to its rows. Magnetic hover on desktop, per `Hover Effects/19`.
  - A hand-built SVG 14-day attendance chart (no chart library).
  - An escalated hazard queue.
  - A quit-risk table with reasons.
  - A feedback heatmap (team × question; a cell is hidden when k < 3).
  - An "AI summary of this week" with a fallback.
- **Safety:** a queue with SLA timers, Acknowledge / Resolve actions, the English AI summary of local-language reports, and a severity suggestion that the admin confirms.
- **Attendance, Feedback and Risk** pages, each with a table + filters.
- **Sites:** a list + a **kiosk page** showing the rotating QR (generate the SVG server-side with the `qrcode` package) for the site gate.
- **Navigation:** a left rail on desktop; the **Sliding Stairs** menu (`Navigation Menus/5` technique, GSAP) under 1024 px.
- **Transitions:** login → workspace uses the **register-cell block transition** (`Page Transitions/12` technique, re-skinned to Muster Roll tokens). Section headings rise by **lines** (SplitText `type: "lines"` only; **never chars**, because chars break Hindi/Tamil).

### 4.5 Landing `/`

- A Steelworks-style intro (`Hero Animations/22` technique): the shift-progress bar preloader, then the H1 rises by lines.
- Two big role choices: "I am a worker" → `/w`, "I manage a team" → `/admin`.
- A short "Works across construction sites and college campuses" strip.
- No stock images.

### 4.6 Docs and repo hygiene

- **`README.md`:**
  - What it is and how each PS requirement is met (with a table).
  - Architecture diagram (ASCII).
  - Local run (`npm i && npm run dev`, no credentials needed).
  - Env vars.
  - Tests.
  - Cloud Run deploy commands (`gcloud run deploy fairshift --source . --region asia-south1 ...` with env vars and the service account roles `roles/datastore.user` and `roles/aiplatform.user`).
  - Badges with **real** numbers from your test run only.
- **`docs/industry-use-cases.md`:** construction, college and hospital (how the same model maps to each).
- **`docs/linkedin-post.md`:** a draft in the structure problem → build & tools → solution fit.
- **`.env.example`** with every variable and no values for secrets.
- **`.gitignore`:** node_modules, .next, coverage, .env*, except `.env.example`.
- **The repo must stay < 10 MB.** No binaries, videos or copied demo images.

---

## 5. Hard DON'Ts

- **Git:**
  - Do **not** create git branches or worktrees that remain at the end.
  - Do **not** `git commit` or `git push`. The orchestrator commits.
  - The final state is the `main` working tree only.
- **Deploy:** do **not** run `gcloud`, deploy anything, or create cloud resources.
- **Secrets:** do **not** write any real secret, API key, service-account JSON or `.env` file with values.
- **Design ban list:** do **not** use anything on the ban list in `design-system.md` §9. In particular:
  - Fonts: Inter, Roboto, Space Grotesk, Geist, Instrument Serif, Fraunces, Plus Jakarta Sans, DM Sans, Manrope, Poppins.
  - Colour: purple/indigo, gradients, cream + terracotta.
  - Components: `rounded-2xl` / `shadow-lg` / `backdrop-blur` by default, glass navbars.
  - Icons: lucide or any icon library, emoji in the UI.
  - Motion: count-up numbers, bounce easing.
  - Layout: the hero + 3 cards + stats template.
  - Copy: tracked all-caps labels.
- **Animation libraries:** do **not** use WebGL/three.js/canvas/cursor effects, Lenis on worker routes, or any animation library on worker routes.
- **Indic text:** do **not** split Indic text by characters in any animation.
- **No fake data shown as real.** Seed data is labelled "Demo data". No count-up animations.
- **No browsers:** do **not** install Playwright or run browsers or screenshots. Unit/component tests are enough.

---

## 6. Use subagents: suggested split

Run these in parallel where possible. Each subagent owns its directories, to avoid conflicts. You (the lead) do P0 first, then fan out, then integrate.

| Agent                    | Owns                                                                                                                                         | Delivers                                                                                                      |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Lead (you)               | root config, `app/layout.tsx`, `globals.css`, `proxy.ts`, integration                                                                        | P0 scaffold, tokens, fonts, final wiring, verification                                                        |
| A: Domain                | `src/server/domain/**` + tests                                                                                                               | All engines in §4.1, ≥ 90% coverage                                                                           |
| B: Data/Services/Auth/AI | `src/server/{repos,seed,services,auth,ai}/**`, `app/api/**` + tests                                                                          | Repos (memory + firestore), seed, services, route handlers with zod, sessions, rate limit, Gemini + fallbacks |
| C: Worker UI             | `app/w/**`, `src/components/{ui,worker,icons}/**`, `src/i18n/**` + component tests                                                           | §4.3, including translations, Stamp, PinPad, ReadAloud, voice input                                           |
| D: Admin UI + Landing    | `app/admin/**`, `app/page.tsx`, `app/passport/**`, `src/components/admin/**`                                                                 | §4.4, §4.5, GSAP animations                                                                                   |
| E: Infra/Docs            | `Dockerfile`, `.dockerignore`, `.github/**`, `README.md`, `DESIGN.md`, `docs/industry-use-cases.md`, `docs/linkedin-post.md`, `.env.example` | §4.6                                                                                                          |

Agree the shared types (`src/shared/types.ts`) and the repo interface **before** fanning out, so that C and D can code against them.

---

## 7. Progress file (important: your quota may run out)

Keep **`docs/BUILD_PROGRESS.md`** updated after every phase and every subagent merge:

- What is done.
- What is in progress.
- What is left.
- Commands and their results.
- Any decision you made.

If you sense you are running low on budget, **write the progress file first**, so the orchestrator can resume.

---

## 8. Definition of done (run these and report the real output)

```bash
npm run typecheck   # tsc --noEmit, 0 errors
npm run lint        # 0 errors
npm test -- --coverage   # all pass; domain coverage ≥ 90%
npm run build       # Next standalone build succeeds
```

Also check `du -sh` without `node_modules` and `.next`: it must be under 10 MB.

**Finish with a concise summary:**

- Files and areas written.
- The exact results of the 4 commands above (pass/fail counts, coverage %).
- Which features are complete or partial.
- Anything stubbed or unsure.
- Where you deviated from the docs and why.
