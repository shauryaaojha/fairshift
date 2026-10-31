# Key prompts

FairShift was built from two kinds of prompts:

1. **What I typed.** Short prompts, often in Hinglish, quoted as typed with an English gloss. Each is followed by what it changed in the app.
2. **Build briefs for the coding agent.** Long, precise briefs written from those prompts and given to the Antigravity agent (`agy`), which split each one across parallel subagents. Excerpts are in [section 7](#7-build-briefs-given-to-the-antigravity-agent); the full briefs are in [`docs/build/`](../build/).

## 1. Decide the architecture and the UI first

> "pehle plan kar, mujhe architectural decision le, and build phases ka decision le, ui ka le. then we would build it. google cloud run pe kya deploy ho skta, full nextjs with workers ho sakte hai, ya hum better backend banaye"
> _(plan first: decide the architecture, the build phases and the UI, then build; can a full Next.js app run on Cloud Run, or do we need a separate backend?)_

**What it changed:** one Next.js 16 app with Server Actions instead of a separate API. Pure rule engines behind a repository interface. Build phases in `docs/fairshift-plan.md`.

> "research about ai slop ui design, and how to make it better ... use the animation folder to build the UI ... animations fonts ye sab ache se use hona chaiye ... abhi dont build, just create docs to build"
> _(research what makes AI-generated UI look generic and how to avoid it; use our animation references; fonts and motion must be done well; write the design docs, don't build yet)_

**What it changed:** the "honest muster roll" design system in `DESIGN.md` and `docs/design-system.md`: rubber stamps, a register grid, Anek type for Indic scripts, a ban list of generic AI-UI patterns, and no animation library on worker phones.

## 2. Build with agents in parallel

> "/agy ko build krne ka poora kaam dede ... usko boldena ki subagents se kaam karwa le"
> _(give the whole build to the Antigravity agent and tell it to split the work across subagents)_

**What it changed:** the spec became a build brief with file ownership per agent (`docs/build/AGY_TASK.md`, `OWNERSHIP.md`; see 7.1 and 7.2), so parallel agents never edited the same files.

> "nice, merge everything, check for bugs and errors and do testing and complete the project"

**What it changed:** an integration and security pass that fixed:

- cross-org access
- leaked PIN hashes
- a rate-limit IP spoof
- overtime counted per ISO week (it had shown 88 h of overtime)

## 3. Improve from the evaluator's feedback

> "bhai hum 2nd aaye hai. aur better karo"
> _(we came 2nd; make it better)_

**What it changed:** the per-criterion scores showed Code Quality at 89. A brief for `agy` (7.3) raised only that criterion, without changing behaviour: remove the duplicate REST layer, add strict lint rules and Prettier, and split services from views. Attempt 2 scored **97.15** and ranked **#1**.

## 4. Make it real for the worker

> "aur aisa app bana do, ki agar offline bhi hojaye laboru, tab bhi kaam hojaye, and jaise hi net aaye, sab server pe chala jae"
> _(make it work even when the labourer goes offline, and send everything to the server as soon as the network is back)_

**What it changed:** an IndexedDB outbox, built from the offline brief (7.4):

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

## 5. Finals: production-ready for a human panel

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

## 6. Finals: code quality, protection for the worker, and the interface

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

## 7. Build briefs given to the Antigravity agent

Each brief below was given to `agy` as its prompt. Every brief:

- names the files each subagent owns;
- lists hard rules (no installs, commits, deploys or secrets);
- ends with a definition of done that the agent had to run and report.

The quotes are excerpts; the full text is linked.

### 7.1 Build FairShift end to end: [`AGY_TASK.md`](../build/AGY_TASK.md)

> You are the lead engineer. **Use your subagents / parallel agents to split the work** (see section 6). You integrate and verify their output. Every decision below is already MADE. Do not re-open it. Where something is truly unspecified, choose the option that scores best on the six AI-evaluator criteria (section 1), and note it in `docs/BUILD_PROGRESS.md`.
>
> **Concretely:**
>
> - Every number shown comes from pure, unit-tested domain functions, never from the LLM.
> - The app works fully with **no cloud credentials** (in-memory data + deterministic AI fallbacks).
> - No secret, key or credential anywhere in the repo.
> - Every PS requirement is visibly met and named in the README.
>
> **No fake data shown as real.** Seed data is labelled "Demo data". No count-up animations.
>
> Agree the shared types (`src/shared/types.ts`) and the repo interface **before** fanning out, so that C and D can code against them.
>
> If you sense you are running low on budget, **write the progress file first**, so the orchestrator can resume.

Sections:

- the fixed stack
- the folder layout
- the domain engines, with at least 90% coverage
- the worker app at 360 px
- the admin console and the landing page
- the design ban list
- a five-subagent split (domain, data/services/auth/AI, worker UI, admin UI, infra/docs)
- the definition of done: typecheck, lint, tests with coverage, build, and a repo under 10 MB

The stack in this brief was Cloud Run, Firestore and Vertex AI. The app later moved to Vercel, MongoDB Atlas and a Gemini API key.

### 7.2 Parallel ownership: [`OWNERSHIP.md`](../build/OWNERSHIP.md)

> Three agents work in the same working tree at the same time. **Only edit files you own.** If you need something from a file you do not own, read it and code against it. Do not edit it.
>
> **Data access from UI:** pages use **Server Components + Server Actions** that call `src/server/services/*`.
>
> **Shared UI primitives:** Claude W builds `src/components/ui/*` (`Stamp`, `Button`, `ReadAloud`, `PinPad`, `Tile`) **first**. Claude A imports them and does not fork them.

### 7.3 Raise Code Quality without regressing anything: [`AGY_TASK_ROUND2.md`](../build/AGY_TASK_ROUND2.md)

> An AI evaluator scored it **96.94/100** [...] The next attempt **replaces** this score. So:
>
> - **Do not add features.**
> - **Do not change behaviour, numbers or UI looks.**
> - **Do not touch performance-sensitive code paths** beyond what is listed.
>
> The goal is cleaner, more consistent, more maintainable code, and fixing the small known security and accessibility gaps.
>
> **Use 4 parallel subagents.** Each owns the listed files; do not edit another subagent's files. The lead integrates and runs the final checks.

The four subagents were:

- **A** removed the duplicate REST layer and dead code.
- **B** set up consistent formatting and lint rules.
- **C** made a readability pass on the server layer.
- **D** closed small security gaps and the four real axe-core findings from production.

### 7.4 Offline-first worker app: [`AGY_TASK_OFFLINE.md`](../build/AGY_TASK_OFFLINE.md)

> **Goal:** a construction worker with no signal can still check in and check out, report a hazard, give feedback, and view the pages they last saw. Everything they did offline is sent to the server **automatically as soon as the network returns**, with the **original time** it happened.
>
> `validateCapturedAt(capturedAtIso, nowMs)`. It accepts only when the time is ≤ now + 2 min (clock skew) and ≥ now − 24 h.
>
> If a record with the same `clientId` already exists [...] return the existing record as success. A replayed sync must never create duplicates. Feedback must stay anonymous: `clientId` is a random UUID, never derived from the worker.

The work was split three ways: server validation, the client outbox and sync UI, and a service worker that serves the last-seen pages offline.

### 7.5 Four targeted bug fixes: [`AGY_TASK_FIXES.md`](../build/AGY_TASK_FIXES.md)

> Run **4 subagents in parallel, one per fix below.** Each fix touches different files. **Change only the files named in each fix** (plus new test files).
>
> **Fix 1: PII scrubbing misses first names and Hindi/Tamil names.** `scrubPii` only matches full roster names using `\b…\b`. `\b` does not work for Devanagari or Tamil, so Hindi/Tamil comments are never name-scrubbed.
>
> **Fix 2: feedback heatmap mixes weeks.** A team can reach the k = 3 anonymity threshold by mixing weeks.

The other two fixes:

- **Fix 3:** scanning the gate QR while logged out lost the 60-second code. Login now returns to the scanned link, and only to `/w/` paths, so it cannot be used as an open redirect.
- **Fix 4:** lowering a hazard's severity could quietly take it out of escalation. An escalated hazard can now be raised but not lowered.

Each fix came with tests. For example, a first name alone is scrubbed but "Rameshwaram" is not, and lowering an escalated hazard is rejected.
