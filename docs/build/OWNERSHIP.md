# Parallel build ownership (from 2026-10-27, 11:30)

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
