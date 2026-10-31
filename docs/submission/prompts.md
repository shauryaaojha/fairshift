# Key prompts

These are the prompts that shaped FairShift, in the order they were given. They are quoted as typed (some in Hinglish, with an English gloss), then condensed into what each one changed in the app. The full build briefs written from them are in [`docs/build/`](../build/).

## 1. Research before building

> "search the entire github for promptwars, and jo bhi team agar win ki ho, ya best project ho"
> _(find every PromptWars team that won, or the best projects)_

**What it changed:** before any code, we studied how earlier winners were scored. That produced the six-criteria map in `docs/promptwars-winners-research.md`: code quality, security, efficiency, testing, accessibility and problem alignment.

> "docs mei pdf daala hai wo bhi dekh le"
> _(also read the PDFs in docs)_

**What it changed:** the problem statement and the submission guide became the spec, covering worker and admin UIs, 3+ features and 2+ sectors.

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

**What it changed:** the spec was turned into a build brief with file ownership per agent (`docs/build/AGY_TASK.md`, `OWNERSHIP.md`), so parallel agents never edited the same files.

> "nice, merge everything, check for bugs and errors and do testing and complete the project"

**What it changed:** an integration and security pass that fixed:

- cross-org access
- leaked PIN hashes
- a rate-limit IP spoof
- overtime counted per ISO week (it had shown 88 h of overtime)

## 4. Improve from the evaluator's feedback

> "bhai hum 2nd aaye hai. aur better karo"
> _(we came 2nd; make it better)_

**What it changed:** the per-criterion scores showed Code Quality at 89. `docs/build/AGY_TASK_ROUND2.md` was written to raise only that criterion, without changing behaviour: remove the duplicate REST layer, add strict lint rules and Prettier, and split services from views. Attempt 2 scored **97.15** and ranked **#1**.

## 5. Make it real for the worker

> "aur aisa app bana do, ki agar offline bhi hojaye laboru, tab bhi kaam hojaye, and jaise hi net aaye, sab server pe chala jae"
> _(make it work even when the labourer goes offline, and send everything to the server as soon as the network is back)_

**What it changed:** an IndexedDB outbox. Queued actions keep their original capture time, the server checks it (24 h maximum age, 2-minute clock skew), the QR code is verified at the capture time, and client ids make replays idempotent (`docs/build/AGY_TASK_OFFLINE.md`).

> "app ki pwa bana de, logo bana de ... and mobile mei add to homescreen ka button bhi dede"
> _(make it a PWA with a logo and an add-to-home-screen button)_

**What it changed:** an installable PWA with a manifest, a service worker and an install button.

> "ai chatbot kaha hai app mei??"
> _(where is the AI chatbot in the app?)_

**What it changed:** "Ask FairShift" (since renamed Urima). It was deliberately not a free-form chatbot: it is grounded in tools that cannot read anyone else's data (see "Urima" in the README).

## 6. Finals: production-ready for a human panel

> "first of all gather some context about evaluation from previous chats. do some more research and create a better version of this app. i wanna win and standout. write the best code, with the best test, security, efficiency all those stuff."

**What it changed** (`docs/finals-plan.md`):

- **Typed errors:** `AppError` codes replaced string matching, and internals no longer reach the browser.
- **Validation:** a zod-validated environment and tighter input schemas.
- **Error pages:** boundaries, a 404 page, loading states and `/api/health`.
- **Urima (then "Ask FairShift"):** for workers and supervisors, with Gemini function calling, a rule-based fallback in three languages, a circuit breaker and a briefing cache.
- **Efficiency:** the supervisor overview went from about three full data loads per request to one.
- **Bug fixes:**
  - The offline banner was server-rendered on every worker page.
  - Offline check-out replays lost their original time.
  - The fresh-clone build needed a secret.
- **Testing:** coverage widened from the rule engines to all server code (361 tests, 93% statements), with the jsdom and node projects split.
- **Delivery:** `SECURITY.md`, Docker, CodeQL, Dependabot and a rewritten README.
