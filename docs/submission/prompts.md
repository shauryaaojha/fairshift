# Key prompts

FairShift was built from two kinds of prompts:

1. **What I typed.** Short prompts, often in Hinglish, quoted as typed with an English gloss. Each is followed by what it changed in the app.
2. **Build briefs for the coding agent.** Long, precise briefs written from those prompts and given to the Antigravity agent (`agy`), which split each one across parallel subagents. All five are reproduced in full in [section 8](#8-build-briefs-given-to-the-antigravity-agent) (also in [`docs/build/`](../build/)).

## 1. Start: gather the context

> "this is the working folder for our todays hackathon, i have added 2 docs, read them. now research about everything about prompt wars by google, and gather the context, of what we are going to build"

**What it changed:** the two documents became the spec. The problem statement asked for:

- a worker interface and an employer interface
- at least 3 working features
- at least 2 sectors

The submission guide listed the six criteria the AI evaluator scores: code quality, security, efficiency, testing, accessibility and problem alignment. Every later prompt was measured against these.

## 2. Decide the architecture and the UI first

> "pehle plan kar, mujhe architectural decision le, and build phases ka decision le, ui ka le. then we would build it. google cloud run pe kya deploy ho skta, full nextjs with workers ho sakte hai, ya hum better backend banaye"
> _(plan first: decide the architecture, the build phases and the UI, then build; can a full Next.js app run on Cloud Run, or do we need a separate backend?)_

**What it changed:** one Next.js 16 app with Server Actions instead of a separate API. Pure rule engines behind a repository interface. Build phases in `docs/fairshift-plan.md`.

> "research about ai slop ui design, and how to make it better ... use the animation folder to build the UI ... animations fonts ye sab ache se use hona chaiye ... abhi dont build, just create docs to build"
> _(research what makes AI-generated UI look generic and how to avoid it; use our animation references; fonts and motion must be done well; write the design docs, don't build yet)_

**What it changed:** the "honest muster roll" design system in `DESIGN.md` and `docs/design-system.md`: rubber stamps, a register grid, Anek type for Indic scripts, a ban list of generic AI-UI patterns, and no animation library on worker phones.

## 3. Build with agents in parallel

> "/agy ko build krne ka poora kaam dede ... usko boldena ki subagents se kaam karwa le"
> _(give the whole build to the Antigravity agent and tell it to split the work across subagents)_

**What it changed:** the spec became a build brief with file ownership per agent (`docs/build/AGY_TASK.md`, `OWNERSHIP.md`; see 8.1 and 8.2), so parallel agents never edited the same files.

> "nice, merge everything, check for bugs and errors and do testing and complete the project"

**What it changed:** an integration and security pass that fixed:

- cross-org access
- leaked PIN hashes
- a rate-limit IP spoof
- overtime counted per ISO week (it had shown 88 h of overtime)

## 4. Improve from the evaluator's feedback

> "bhai hum 2nd aaye hai. aur better karo"
> _(we came 2nd; make it better)_

**What it changed:** the per-criterion scores showed Code Quality at 89. A brief for `agy` (8.4) raised only that criterion, without changing behaviour: remove the duplicate REST layer, add strict lint rules and Prettier, and split services from views. Attempt 2 scored **97.15** and ranked **#1**.

## 5. Make it real for the worker

> "aur aisa app bana do, ki agar offline bhi hojaye laboru, tab bhi kaam hojaye, and jaise hi net aaye, sab server pe chala jae"
> _(make it work even when the labourer goes offline, and send everything to the server as soon as the network is back)_

**What it changed:** an IndexedDB outbox, built from the offline brief (8.5):

- Queued actions keep their original capture time.
- The server checks that time: at most 24 h old, at most 2 minutes of clock skew.
- The QR code is verified at the capture time.
- Client ids make replays idempotent.

> "app ki pwa bana de, logo bana de ... and mobile mei add to homescreen ka button bhi dede"
> _(make it a PWA with a logo and an add-to-home-screen button)_

**What it changed:** an installable PWA with a manifest, a service worker and an install button.

> "ai chatbot kaha hai app mei??"
> _(where is the AI chatbot in the app?)_

**What it changed:** "Ask FairShift", since renamed Urima. It is deliberately not a free-form chatbot: it is grounded in tools that cannot read anyone else's data (see "Urima" in the README).

## 6. Finals: production-ready for a human panel

> "first of all gather some context about evaluation from previous chats. do some more research and create a better version of this app. i wanna win and standout. write the best code, with the best test, security, efficiency all those stuff."

**What it changed** (`docs/finals-plan.md`, P1 to P6):

- **Typed errors:** `AppError` codes replaced string matching, and internals no longer reach the browser.
- **Validation:** a zod-validated environment and tighter input schemas.
- **Error pages:** boundaries, a 404 page, loading states and `/api/health`.
- **Urima:** an assistant for workers and supervisors, with Gemini function calling, a rule-based fallback in three languages, a circuit breaker and a briefing cache.
- **Efficiency:** the supervisor overview went from about three full data loads per request to one.
- **Bug fixes:**
  - The offline banner was server-rendered on every worker page.
  - Offline check-out replays lost their original time.
  - The fresh-clone build needed a secret.
- **Testing:** coverage widened from the rule engines to all server code, with the jsdom and node projects split.
- **Delivery:** `SECURITY.md`, Docker, CodeQL, Dependabot and a rewritten README.

## 7. Finals: code quality, protection for the worker, and the interface

> "they would still use the ai to score us. so based on the 6 fields, have you touched 100% in all? maybe? our lowest was the code quality."

**What it changed:**

- The console views were split into smaller modules.
- Repositories got full types.
- One shared severity scale is used everywhere.
- Record ids became UUIDs.

**Worker-protection features** were added in the same phase (`docs/finals-plan.md`, P7 to P10):

- Workers can raise a pay question. It closes only when both sides agree, and there is a deadline for the employer to answer.
- Overtime rules are versioned, with a legal floor of 2×.
- A "wages paid" record is checked against the payslip.
- Each shift is sealed with a signed receipt that anyone can verify.
- When the employer misses the deadline, the worker gets a printable letter to the labour office in English, Hindi or Tamil. It cites the Code on Wages and lists the shifts with their receipt codes.

> "review all the app screenshot and think if our UI is best or not? i think we need an upgrade"

**What it changed** (P11):

- **Worker app:**
  - A bottom tab bar.
  - A home screen built around today's shift: a ticket with a live clock, a "waiting for you" list and a 7-day muster strip.
- **Console:**
  - Opens with a "Needs action" list.
  - The navigation rail is grouped.
  - Pay is split into tabs.
- **Landing:** real product screenshots.
- **Fixes:**
  - A hydration error.
  - Phone-number boxes that wrapped at 390 px.

> "also we have to make a video of our project. so you make a reel or our project"

**What it changed:** a short demo video of the worker app in Hindi and Tamil and of the supervisor console, captured from the running app.

> "vercel pe sab live krde, single commit ... and logically soch ke"
> _(make everything live on Vercel, in a single commit, and think it through)_

**What it changed:** the release was checked, committed and deployed. The worker screens now stream into a skeleton, so moving between them never blocks on the server.

## 8. Build briefs given to the Antigravity agent

These are the complete prompts given to the Antigravity agent (`agy`), in the order they were given. Each one is copied in full from [`docs/build/`](../build/); only the heading levels are shifted down to fit this page.

Every brief names the files each subagent owns, lists hard rules (no installs, commits, deploys or secrets) and ends with a definition of done the agent had to run and report.

### 8.1 Build FairShift end to end: [`AGY_TASK.md`](../build/AGY_TASK.md)

_Given first, on 27 Oct; this is the second run, after the first stopped on a quota limit._

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

#### 0. Read these first (in this order)

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

#### 1. How the result is scored (optimise for this)

**AI evaluator** (6 params): Code Quality, Security, Efficiency, Testing, Accessibility, Problem Alignment.

**Jury:** Real-world impact, SDG 8 relevance, Inclusivity & ease of use (regional languages, low literacy, basic phones), Technical implementation (clean code, security, working dual interfaces), Feasibility & scalability (2+ industries).

**Concretely:**

- Every number shown comes from pure, unit-tested domain functions, never from the LLM.
- The app works fully with **no cloud credentials** (in-memory data + deterministic AI fallbacks).
- No secret, key or credential anywhere in the repo.
- Every PS requirement is visibly met and named in the README.

---

#### 2. Fixed stack (do not change)

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

#### 3. Folder layout (use this)

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

#### 4. What to build

The details are in `fairshift-plan.md` §3–§4 and `design-system.md`. Required:

##### 4.1 Domain engines (pure functions + exhaustive tests, ≥ 90% coverage on `src/server/domain`)

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

##### 4.2 Seed data (deterministic, labelled "Demo data" in the UI footer)

- **Org 1, Construction:** "Skyline Towers site, Chennai". ~30 workers (masons, helpers, electricians), with daily-wage and monthly pay.
- **Org 2, College:** "Campus Facilities" (housekeeping, security, maintenance). ~20 staff.
- 21 days of shifts generated with a seeded PRNG so that real fatigue cases, OT and quit-risk cases appear.
- Hazards in every status (one escalated), feedback with groups both above and below k = 3, and skill records.
- **Demo logins:** one worker per sector + one admin per org. Show them on the login pages in a "Demo accounts" box (they are demo-only and not secrets).

##### 4.3 Worker app (`/w`, mobile-first at 360 px)

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

##### 4.4 Admin console (`/admin`, desktop-first, responsive)

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

##### 4.5 Landing `/`

- A Steelworks-style intro (`Hero Animations/22` technique): the shift-progress bar preloader, then the H1 rises by lines.
- Two big role choices: "I am a worker" → `/w`, "I manage a team" → `/admin`.
- A short "Works across construction sites and college campuses" strip.
- No stock images.

##### 4.6 Docs and repo hygiene

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

#### 5. Hard DON'Ts

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

#### 6. Use subagents: suggested split

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

#### 7. Progress file (important: your quota may run out)

Keep **`docs/BUILD_PROGRESS.md`** updated after every phase and every subagent merge:

- What is done.
- What is in progress.
- What is left.
- Commands and their results.
- Any decision you made.

If you sense you are running low on budget, **write the progress file first**, so the orchestrator can resume.

---

#### 8. Definition of done (run these and report the real output)

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

---

### 8.2 Parallel ownership between three agents: [`OWNERSHIP.md`](../build/OWNERSHIP.md)

_Given to agy and two Claude agents working in the same tree at the same time._

Three agents work in the same working tree at the same time. **Only edit files you own.** If you need something from a file you do not own, read it and code against it. Do not edit it.

| Owner                 | Owns (write access)                                                                                                                                                                                                                                                                                                                                | Scope                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **agy** (Gemini)      | `src/server/{domain,repos,seed,services,auth,ai}/**`, `src/shared/**`, `app/api/**`, `proxy.ts`, `app/layout.tsx`, `app/globals.css`, root config (`package.json`, `next.config.ts`, `tsconfig.json`, `vitest.config.*`, `eslint.config.mjs`, `postcss.config.mjs`), `tests/domain/**`, `tests/server/**`                                          | **P2 only** (backend). After P2: stop, update `docs/BUILD_PROGRESS.md`, and do **not** start P3/P4/P5 |
| **Claude W** (Sonnet) | `app/w/**`, `src/components/ui/**`, `src/components/worker/**`, `src/components/icons/**`, `src/i18n/**`, `src/server/services/workerUi.ts`, `tests/components/worker/**`, `tests/components/ui/**`, `tests/i18n/**`                                                                                                                               | **P3**: worker app                                                                                    |
| **Claude A** (Sonnet) | `app/admin/**`, `app/page.tsx`, `app/passport/**`, `src/components/admin/**`, `src/components/motion/**`, `src/components/landing/**`, `src/server/services/adminUi.ts`, `tests/components/admin/**`, `Dockerfile`, `.dockerignore`, `.github/**`, `README.md`, `DESIGN.md`, `.env.example`, `docs/industry-use-cases.md`, `docs/linkedin-post.md` | **P4 + P5**: admin console, landing, infra and docs                                                   |

**Rules for everyone:**

- **npm:**
  - **No `npm install`.** If a package is missing, report it.
  - The orchestrator installs packages, one install at a time.
- **Git:** no git commits, branches or worktrees.
- **Cloud:** no deploys, no `gcloud`.
- **Secrets:** none, anywhere.
- **Data access from UI:** pages use **Server Components + Server Actions** that call `src/server/services/*`.
  - If a needed read or composition does not exist yet, write it in **your own** `workerUi.ts` / `adminUi.ts`, built on `src/server/repos` + `src/server/domain`.
  - Do not add new `app/api` routes from UI agents.
- **Global styles:** Claude W and Claude A do not edit `app/globals.css` or `app/layout.tsx`.
  - If a token is missing, add component-level CSS in your own folder.
  - Note the missing token in your final report.
- **Shared UI primitives:** Claude W builds `src/components/ui/*` (`Stamp`, `Button`, `ReadAloud`, `PinPad`, `Tile`) **first**.
  - Claude A imports them and does not fork them.
  - Until they exist, Claude A builds the admin-specific parts that don't need them.

---

### 8.3 Four targeted bug fixes: [`AGY_TASK_FIXES.md`](../build/AGY_TASK_FIXES.md)

_One subagent per fix._

You are working in **C:/Users/shaur/Documents/promptwars**. FairShift is a finished Next.js 16 (App Router, Cache Components, React 19, TypeScript strict) app. Run **4 subagents in parallel, one per fix below.** Each fix touches different files.

**Change only the files named in each fix** (plus new test files). The orchestrator is editing `src/server/repos/**` and deploying, so do **not** touch:

- `src/server/repos/**`
- `package.json` / `package-lock.json`
- `next.config.ts`
- `.env*`
- anything under `docs/`

**Hard rules:**

- No `npm install`.
- No git commits, branches, worktrees or pushes.
- No deploys.
- No secrets.
- Do not reformat files you did not need to change.

#### Fix 1: PII scrubbing misses first names and Hindi/Tamil names

- **Files:** `src/server/domain/anonymity.ts`, `tests/domain/anonymity.test.ts`.
- **Problem:** `scrubPii` only matches full roster names using `\b…\b`. `\b` does not work for Devanagari or Tamil, so Hindi/Tamil comments are never name-scrubbed. A first name alone ("Ramesh shouts at us") also passes through.
- **Fix:**
  - Also scrub each name token of 3 or more characters.
  - Use Unicode-aware boundaries: `new RegExp('(?<![\\p{L}\\p{M}\\p{N}])' + escaped + '(?![\\p{L}\\p{M}\\p{N}])', 'giu')`.
  - Extend the phone regex to also match Devanagari (०-९) and Tamil (௦-௯) digits.
  - Keep the same replacement tokens the function already uses.
- **Tests:**
  - The first name alone is scrubbed.
  - A Devanagari name (e.g. roster `रमेश कुमार` in the comment `रमेश हमें डांटता है`) is scrubbed.
  - A Tamil name is scrubbed.
  - A Devanagari-digit phone number is scrubbed.
  - A word that merely contains a name inside it (e.g. "Rameshwaram") is NOT scrubbed.

#### Fix 2: feedback heatmap mixes weeks

- **Files:** `src/server/services/adminService.ts` (only the `getFeedbackHeatmap` method).
- **Problem:** the heatmap groups by team across all weeks and labels it with the first item's `isoWeek`. A team can reach the k = 3 anonymity threshold by mixing weeks.
- **Fix:**
  - Group by `(team, isoWeek)` and show only the **most recent ISO week** that has data for each team (using `aggregateFeedback`, so k ≥ 3 is enforced per team-week).
  - Keep the method signature and return type identical.
- **Tests:** add `tests/server/feedbackHeatmap.test.ts` that exercises the grouping logic. If the logic is hard to test through the class, extract a small pure helper in the same file and test that.

#### Fix 3: scanning the gate QR while logged out loses the code

- **Files:** `proxy.ts`, `app/w/actions.ts` (only `loginAction`'s signature/return if needed), `src/components/worker/LoginForm.tsx`, `app/w/login/page.tsx`.
- **Problem:**
  - A phone camera opens `/w/checkin?site=…&code=…`.
  - If the worker is not logged in, `proxy.ts` redirects to `/w/login` with no return path.
  - After login, `LoginForm` goes to `/w`, so the 60-second check-in code is lost.
- **Fix:**
  - The proxy redirect to `/w/login` adds `?next=<original path + query, URL-encoded>`.
  - The login page passes `next` to `LoginForm`.
  - After a successful login, go to `next` **only if** it starts with `/w/` and does not start with `//`. Otherwise go to `/w`. This prevents an open redirect.
  - The language-gate step must keep the `next` value (check how `setLanguageAction` already handles a `next` field and reuse it).
- **Tests:** a unit test for the `next` validation helper (put the helper in `src/server/services/workerUi.ts` and the test in `tests/components/worker/workerUi.test.ts`).

#### Fix 4: changing severity can silently de-escalate a hazard

- **Files:** `src/server/services/adminUi.ts` (only `confirmHazardSeverity`), `tests/components/admin/adminUi.test.ts`.
- **Problem:** the SLA clock is `reportedAt + SLA(severity)`. Changing a critical hazard to low turns an escalated hazard back to "reported".
- **Fix:**
  - If the hazard's current live status is `escalated`, the admin may raise the severity but **not lower it**. In that case, throw an Error with message `Cannot lower the severity of an escalated hazard`.
  - Lowering is still allowed for non-escalated hazards.
  - The status computation lives in `src/server/domain/hazardSla.ts` (`computeHazardStatus`) and in `src/server/repos/hazardStatus.ts`. Read them, do not edit them.
- **Tests:**
  - Lowering an escalated hazard throws.
  - Raising an escalated hazard works.
  - Lowering a non-escalated hazard works.

#### Definition of done (run and report the real output)

```bash
npx tsc --noEmit
npx eslint . --max-warnings 0
DATA_BACKEND=memory npx vitest run --no-file-parallelism
```

All three must pass.

**End with a concise summary:**

- Files changed per fix.
- The exact results of the three commands (test counts).
- Anything you were unsure about.

---

### 8.4 Raise Code Quality without regressing anything: [`AGY_TASK_ROUND2.md`](../build/AGY_TASK_ROUND2.md)

_After the first AI evaluation (96.94, Code Quality 89)._

You are working in **C:/Users/shaur/Documents/promptwars**. FairShift is a finished Next.js 16 app:

- App Router with Cache Components, React 19, TypeScript strict, Tailwind v4.
- Vercel + MongoDB Atlas, or a seeded in-memory store when `MONGODB_URI` is unset.
- Gemini API with rule-based fallbacks.

An AI evaluator scored it **96.94/100**:

| Criterion                   | Score  | Impact                 |
| --------------------------- | ------ | ---------------------- |
| **Code Quality**            | **89** | HIGH, the one to raise |
| Security                    | 98     | medium                 |
| Efficiency                  | 100    | medium                 |
| Testing                     | 100    | low                    |
| Accessibility               | 99     | low                    |
| Problem Statement Alignment | 100    | high                   |

The next attempt **replaces** this score. So:

- **Do not add features.**
- **Do not change behaviour, numbers or UI looks.**
- **Do not touch performance-sensitive code paths** beyond what is listed.

The goal is cleaner, more consistent, more maintainable code, and fixing the small known security and accessibility gaps.

**Use 4 parallel subagents.** Each owns the listed files; do not edit another subagent's files. The lead integrates and runs the final checks.

**Hard rules:**

- **npm and git:** no `npm install` (Prettier is already installed), no git commits/branches/worktrees/push.
- **Deploy and secrets:** no deploys, no secrets, never touch `.env*`.
- **Design:** follow `docs/design-system.md` (tokens, §9 ban list). Never split Hindi/Tamil text by characters.
- **Next 16 APIs:** check `node_modules/next/dist/docs/` before relying on memory.

---

#### Subagent A: Remove the duplicate REST layer and dead code (lead does this FIRST, then starts the others)

The UI never calls `app/api/**`. There are no `fetch('/api…')` calls; every screen uses Server Components + Server Actions. The 19 route handlers duplicate the server actions, which doubles the code and the attack surface.

1. Verify with grep that nothing in `app/` (outside `app/api`), `src/components/` or `src/` calls `/api/`.
2. Delete the whole `app/api/` directory.
3. Update `proxy.ts`:
   - Drop the `/api` branches.
   - Keep `/w` and `/admin` protection, and the `?next=` return path for `/w`.
4. Remove now-unused exports:
   - `requireSession` and `resolveOrgScope` in `src/server/auth/guard.ts`, if no longer used. Keep `allowedOrgIds` and `canAccessOrg`.
   - `adminService.getKioskData` and `getAllSites`, if unused.
   - `src/components/ui/index.ts`, if nothing imports it.
   - Any other export with zero importers (check with grep).
5. Delete the tests that only exercised deleted code. Keep every test of the remaining code.

---

#### Subagent B: Consistent formatting and lint rules

**Owns:** `.prettierrc.json`, `.prettierignore`, `eslint.config.mjs`, `package.json` (scripts only), `.github/workflows/ci.yml`, plus the mechanical formatting of every file.

1. Add `.prettierrc.json`: `{ "singleQuote": true, "semi": true, "trailingComma": "all", "printWidth": 100 }`. Today the code mixes single quotes (46 files) and double quotes (68 files).
2. Add `.prettierignore`: `.next`, `node_modules`, `coverage`, `package-lock.json`, `docs/screenshots`.
3. Add scripts `"format": "prettier --write ."` and `"format:check": "prettier --check ."`, and run `format:check` in CI.
4. Tighten `eslint.config.mjs` with:
   - `eqeqeq`
   - `prefer-const`
   - `no-var`
   - `curly: ["error", "multi-line"]`
   - `no-console: ["error", { allow: ["warn", "error", "info"] }]`
   - `@typescript-eslint/consistent-type-imports`
   - `@typescript-eslint/no-explicit-any: "error"`
5. **Run Prettier LAST, after subagents A, C and D have finished,** so it formats their final files. Then run `npx eslint . --fix` and fix any remaining violations by hand.

---

#### Subagent C: Readability pass on the server layer

**Owns:** `src/server/**` (except files A deletes), `src/shared/**`.

1. **Naming:** the split between `adminService.ts` (class with use-cases) and `adminUi.ts` (view compositions for pages) is confusing, and the same goes for `workerService.ts` / `workerUi.ts`.
   - Rename `adminUi.ts` → `adminViews.ts` and `workerUi.ts` → `workerViews.ts`.
   - Update every import, including the tests and `app/**`.
   - Add a 3-line module doc at the top of each of the four files explaining the split: services = use-cases and rules, views = shaping data for a page.
2. **Remove decorative banner comments.** These are the `// ====…` header blocks (29 files). Replace each with at most a one-line module comment where it adds information.
3. **Remove emoji from log messages:**
   - `src/server/ai/gemini.ts` has `⚠️`, and other files may have `⚡`.
   - Use the consistent prefix style `[FairShift AI]`, `[FairShift Data]`, `[FairShift Auth]`.
4. **Magic numbers:** pull repeated literals into named constants in the module that owns them, e.g. `7 * 24 * 60 * 60 * 1000` (repeated in several services, so use a `WEEK_MS` in `src/server/domain/time.ts`), the 16 h stale-shift limit, the 60 s QR window. Do not change any value.
5. **Split `src/server/seed/seed.ts`** (556 lines) into `seed/orgs.ts`, `seed/people.ts`, `seed/shifts.ts`, `seed/records.ts` (hazards, feedback, skills) and a small `seed/index.ts` that exposes the same `generateSeedData()`.
   - Keep the output **identical**, including PRNG call order.
   - Add a test that snapshots counts and a few fixed fields before and after: org/site/worker/admin ids, number of shifts and hazards for a fixed `Date.now` mock.
6. **Behaviour:** do not change any behaviour. All existing tests must still pass unchanged, except for import paths.

---

#### Subagent D: Small Security and Accessibility gaps

**Owns:** `next.config.ts` (headers only), `src/components/admin/**`, `app/admin/**` (page markup only), `tests/components/admin/**`.

##### Security

- Add the headers `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Resource-Policy: same-origin`, and set `X-XSS-Protection: 0`.
- Keep `'unsafe-inline'`: Next needs it without nonces.

##### Accessibility: the 4 real axe-core findings from production

1. **`color-contrast` (serious):** the feedback heatmap cells (`td[data-cell="managerRespect"]` and siblings) fail 4.5:1. Use text and background token pairs that pass, and keep the printed values.
2. **`link-in-text-block` (serious):** the links in the overview's state sentence are distinguished only by colour. Keep an always-visible underline of at least 2 px.
3. **`scrollable-region-focusable` (serious):** `.table-wrap` on `/admin/risk` and `/admin/attendance` scrolls but can't be focused. Add `tabIndex={0}`, `role="region"` and an `aria-label` (the caption), plus a visible focus style.
4. **`heading-order` (moderate) on `/admin/safety`:** the hazard cards use `h3` directly under `h1`. Fix the hierarchy.

##### Tests

Add tests in `tests/components/admin/` for items 1–3.

---

#### Lead: final checks (all must pass), then report

```bash
npx prettier --check .
npx tsc --noEmit
npx eslint . --max-warnings 0
DATA_BACKEND=memory npx vitest run --no-file-parallelism --coverage
DATA_BACKEND=memory npx next build
```

**End with a concise summary:**

- For each subagent: files changed and deleted.
- The exact output of the five commands (test count, coverage %, route count).
- Anything you skipped and why.

---

### 8.5 Offline-first worker app: [`AGY_TASK_OFFLINE.md`](../build/AGY_TASK_OFFLINE.md)

_The offline prompt in section 4, turned into a brief._

You are working in **C:/Users/shaur/Documents/promptwars**. FairShift is a Next.js 16 app:

- App Router with Cache Components, React 19, TypeScript strict, Tailwind v4.
- Vercel + MongoDB Atlas, with a seeded in-memory store when `MONGODB_URI` is unset.
- The worker app `/w/*` uses Server Components and Server Actions (`app/w/actions.ts`).
- A PWA service worker already exists (`public/sw.js`), with an offline fallback page `public/offline.html`.

**Goal:** a construction worker with no signal can still:

- check in and check out
- report a hazard
- give feedback
- view the pages they last saw

Everything they did offline is sent to the server **automatically as soon as the network returns**, with the **original time** it happened.

**Read first:**

- `app/w/actions.ts`
- `src/server/services/workerService.ts`, `src/server/services/workerViews.ts`
- `src/server/domain/qrCode.ts`, `src/server/domain/time.ts`
- `src/shared/types.ts`, `src/shared/schemas.ts`
- `src/components/worker/{CheckinPanel,HazardForm,FeedbackForm}.tsx`
- `app/w/layout.tsx`, `app/w/page.tsx`
- `public/sw.js`
- `src/i18n/{en,hi,ta}.ts`
- `docs/design-system.md` (tokens, `<Stamp>`, §9 ban list)
- Next 16 docs in `node_modules/next/dist/docs/`

**Hard rules:**

- **npm and git:** no `npm install`, no git commits/branches/push.
- **Deploy and secrets:** no deploys, never touch `.env*`, no secrets.
- **Behaviour:** do not change payslip/overtime rules. Keep existing behaviour identical when online.
- **Design:** follow the design ban list. All new UI strings go in en, hi and ta, with real translations.

**Use 3 parallel subagents with these file boundaries. The lead integrates.**

---

#### Subagent A: Server: accept offline-captured actions safely

**Owns:**

- `src/server/services/workerService.ts`
- `src/server/domain/qrCode.ts` (add a function only)
- `src/server/domain/offline.ts` (new)
- `src/shared/types.ts`, `src/shared/schemas.ts`
- `app/w/actions.ts`
- `tests/server/offline*.test.ts`, `tests/domain/offline.test.ts`

1. **`src/server/domain/offline.ts`** (pure, with tests):
   - `validateCapturedAt(capturedAtIso, nowMs)`.
   - It accepts only when the time is ≤ now + 2 min (clock skew) and ≥ now − 24 h.
   - Otherwise it returns a reason (`'future' | 'too_old' | 'invalid'`).
   - Export the constants `MAX_OFFLINE_AGE_MS` and `MAX_CLOCK_SKEW_MS`.
2. **`qrCode.ts`:** add a function that verifies a site code **at a given timestamp** (same ±1 window rules as today, but relative to that time instead of now). Keep the existing function and behaviour.
3. **Optional `capturedAt` and `clientId`:**
   - Add both (ISO string, and a UUID string) to the inputs of `workerService.checkIn`, `checkOut`, `reportHazard` and `submitFeedback`, and to their zod schemas and server actions.
   - **When `capturedAt` is present:**
     - Validate it with `validateCapturedAt`, and reject it permanently if invalid.
     - **check-in:** verify the QR code at `capturedAt` (or the geofence, from the stored lat/lng), and set `shift.checkIn = capturedAt`.
     - **check-out:** set `checkOut = capturedAt`. It must be after `checkIn`.
     - **hazard:** set `reportedAt = capturedAt`, so the SLA clock is fair.
     - **feedback:** compute `isoWeek` from `capturedAt`.
   - **Idempotency:**
     - Store `clientId` on `Shift`, `HazardReport` and `FeedbackSubmission` (optional field).
     - If a record with the same `clientId` already exists (search the worker's shifts and the site's hazards and feedback through the existing repo list methods; no repo interface changes), return the existing record as success. A replayed sync must never create duplicates.
     - Feedback must stay anonymous: `clientId` is a random UUID, never derived from the worker.
4. **Return values:** server actions must return a typed result that tells the client whether a failure is **permanent** (validation, invalid code, stale) or **retryable**. A thrown network error on the client counts as retryable.
5. **Tests:**
   - The capturedAt rules.
   - A QR code valid at the capture time but expired now is accepted.
   - A forged future time is rejected.
   - A replay with the same `clientId` returns the same record (once for each kind).
   - Shift and hazard times equal `capturedAt`.

#### Subagent B: Client outbox + sync + UI

**Owns:**

- `src/lib/offline/outbox.ts` (new)
- `src/lib/offline/sync.ts` (new)
- `src/components/worker/OfflineSync.tsx` (new)
- `src/components/worker/{CheckinPanel,HazardForm,FeedbackForm}.tsx`
- any check-out button component
- `app/w/layout.tsx`
- `src/i18n/{en,hi,ta}.ts` (add keys)
- `tests/components/worker/offline*.test.tsx`, `tests/offline/*.test.ts`

1. **`outbox.ts`:**
   - A small storage interface `OutboxStore { put, list, remove }`, with an **IndexedDB implementation (no dependency)** and an **in-memory implementation** for tests.
   - Item: `{ id: clientId (crypto.randomUUID()), workerId, kind: 'checkin'|'checkout'|'hazard'|'feedback', payload, capturedAt, attempts }`.
2. **`sync.ts`:**
   - `flushOutbox(store, workerId, handlers)` replays items for **this worker only**, oldest `capturedAt` first, one at a time.
   - On success, or on a permanent failure: remove the item. A permanent failure is also reported, so the UI can tell the worker it was rejected.
   - On a retryable failure: keep the item, increment `attempts`, and stop the loop.
   - Guard against two flushes running at once.
3. **Forms:**
   - If `navigator.onLine === false`, or the server action call throws (network failure), enqueue the action with `capturedAt = new Date().toISOString()` and a new `clientId`.
   - Show the `<Stamp>` with a new "SAVED OFFLINE" text (variant `ink`, `announce`) plus the line "Will send when you're back online".
   - Check-in from a scanned QR keeps the code. GPS check-in keeps the lat/lng.
   - Voice input needs the network in Chrome: when offline, hide the mic and keep the text box.
4. **`OfflineSync`** (client, mounted in `app/w/layout.tsx` with the signed-in worker id passed from the server):
   - Flushes on mount, on the `online` event and on `visibilitychange` to visible.
   - Shows a slim `aria-live="polite"` banner:
     - offline: "You are offline. Showing what you saw last time." plus "N saved, will send when online"
     - while syncing: "Sending…"
     - after sending: "All sent". Auto-hides after 4 s.
     - rejected: "1 entry could not be sent: <reason>"
   - Use tokens only (paper, graphite, ink, hivis with a graphite outline), and ≥ 48 px targets.
5. **Logout:**
   - Clear the cached worker pages (`caches.delete('fairshift-pages')`) **before** the logout action runs. Wrap the existing logout form in a small client component.
   - Keep the outbox: items are bound to their worker and only sync for that worker.
6. **Tests:**
   - Sync ordering.
   - Success removal.
   - Permanent removal and reporting.
   - Retryable retention and stop.
   - The worker-mismatch skip.
   - No concurrent flushes.
   - A component test: a form enqueues when offline and shows the SAVED OFFLINE stamp.

#### Subagent C: Service worker: last-seen worker pages offline

**Owns:** `public/sw.js`, `public/offline.html`, `README.md` (an "Offline mode" section plus Assumptions bullets), `docs/user-flow-and-architecture.md` (one small offline sequence diagram).

1. **Navigations under `/w`:** network-first.
   - Store successful (200) HTML responses in a separate cache `fairshift-pages`.
   - When offline, serve the cached page for that URL. Otherwise serve the cached `/w` home, otherwise `offline.html`.
   - Never cache `/w/login`, `/admin/*` or any non-GET request.
2. **Static assets:** keep cache-first for `/_next/static/` and `/icons/`.
3. **Cache name:** bump it to `fairshift-v2`, and delete old caches on activate, but **not** `fairshift-pages`.
4. **Docs:**
   - **README:** how offline works, what is cached, the 24-hour limit, that the original time is kept, idempotent sync, and logout clearing.
   - **Diagram:** a Mermaid sequence: offline check-in → outbox → online → replay → server verifies the code at the capture time → shift saved.

---

#### Lead: definition of done (all must pass)

```bash
npx prettier --write . && npx prettier --check .
npx tsc --noEmit
npx eslint . --max-warnings 0
DATA_BACKEND=memory npx vitest run --no-file-parallelism
DATA_BACKEND=memory npx next build
```

**End with a concise summary:**

- Files changed per subagent.
- The exact command results (test counts).
- Anything skipped or unsure.
