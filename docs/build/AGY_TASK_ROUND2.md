# Task: lift FairShift's Code Quality score without regressing anything else

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

## Subagent A: Remove the duplicate REST layer and dead code (lead does this FIRST, then starts the others)

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

## Subagent B: Consistent formatting and lint rules

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

## Subagent C: Readability pass on the server layer

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

## Subagent D: Small Security and Accessibility gaps

**Owns:** `next.config.ts` (headers only), `src/components/admin/**`, `app/admin/**` (page markup only), `tests/components/admin/**`.

### Security

- Add the headers `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Resource-Policy: same-origin`, and set `X-XSS-Protection: 0`.
- Keep `'unsafe-inline'`: Next needs it without nonces.

### Accessibility: the 4 real axe-core findings from production

1. **`color-contrast` (serious):** the feedback heatmap cells (`td[data-cell="managerRespect"]` and siblings) fail 4.5:1. Use text and background token pairs that pass, and keep the printed values.
2. **`link-in-text-block` (serious):** the links in the overview's state sentence are distinguished only by colour. Keep an always-visible underline of at least 2 px.
3. **`scrollable-region-focusable` (serious):** `.table-wrap` on `/admin/risk` and `/admin/attendance` scrolls but can't be focused. Add `tabIndex={0}`, `role="region"` and an `aria-label` (the caption), plus a visible focus style.
4. **`heading-order` (moderate) on `/admin/safety`:** the hazard cards use `h3` directly under `h1`. Fix the hierarchy.

### Tests

Add tests in `tests/components/admin/` for items 1–3.

---

## Lead: final checks (all must pass), then report

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
