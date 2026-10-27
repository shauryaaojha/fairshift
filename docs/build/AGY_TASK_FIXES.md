# Task: four targeted bug fixes in FairShift (use parallel subagents, one per fix)

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

## Fix 1: PII scrubbing misses first names and Hindi/Tamil names

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

## Fix 2: feedback heatmap mixes weeks

- **Files:** `src/server/services/adminService.ts` (only the `getFeedbackHeatmap` method).
- **Problem:** the heatmap groups by team across all weeks and labels it with the first item's `isoWeek`. A team can reach the k = 3 anonymity threshold by mixing weeks.
- **Fix:**
  - Group by `(team, isoWeek)` and show only the **most recent ISO week** that has data for each team (using `aggregateFeedback`, so k ≥ 3 is enforced per team-week).
  - Keep the method signature and return type identical.
- **Tests:** add `tests/server/feedbackHeatmap.test.ts` that exercises the grouping logic. If the logic is hard to test through the class, extract a small pure helper in the same file and test that.

## Fix 3: scanning the gate QR while logged out loses the code

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

## Fix 4: changing severity can silently de-escalate a hazard

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

## Definition of done (run and report the real output)

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
