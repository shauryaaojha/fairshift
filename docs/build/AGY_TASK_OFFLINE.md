# Task: offline-first worker app. Actions work with no network and sync when it returns

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

## Subagent A: Server: accept offline-captured actions safely

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

## Subagent B: Client outbox + sync + UI

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

## Subagent C: Service worker: last-seen worker pages offline

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

## Lead: definition of done (all must pass)

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
