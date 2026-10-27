# FairShift Design System

_As of 2026-10-27. This is the contract for every page, component and animation. Every agent (Claude, agy, codex) and every teammate builds from this file and does not invent new tokens. In P0 it is copied to `DESIGN.md` at the repo root, so coding agents pick it up automatically._

---

## 1. Research summary: why AI UIs look like slop, and what that means for us

### 1.1 First-order tells (what a model produces when given no direction)

Sources: [925studios](https://www.925studios.co/blog/ai-slop-design-tells), [developersdigest: 16 patterns](https://www.developersdigest.tech/blog/ai-design-slop-and-how-to-spot-it), [avoid-ai-design](https://github.com/funboy322/avoid-ai-design), [vibecodekit](https://vibecodekit.dev/ai-slop-design).

- **Typography:** Inter or Roboto everywhere, and a centered hero headline in a generic sans.
- **Colour:** an indigo-to-purple gradient, gradient-filled headline text (`bg-clip-text`), and lavender "VibeCode purple" accents.
- **Layout:**
  - Hero → subhead → two buttons → **three icon cards in a row** → stats banner → pricing → CTA.
  - A pill badge above the H1.
- **Components:**
  - `rounded-2xl + shadow-lg + backdrop-blur` on everything, and glassy navbars.
  - An icon inside a rounded square.
  - Coloured 3–4 px left or top borders on cards, and cards nested inside cards.
- **Theme:** permanent dark mode with grey body text that fails contrast, plus neon glows and purple orbs.
- **Motion:**
  - The same fade-up on every section.
  - Bounce easing.
  - **Count-up stat numbers.**
  - No `prefers-reduced-motion` support.
- **Icons and copy:**
  - The worn Lucide set, a ✨ sparkle icon standing for "AI", and emoji icons in navigation.
  - Copy like "Elevate / Seamless / Powerful" and "Get Started →".

### 1.2 Second-order tells: the "tasteful" defaults, including the Claude look

When a model is told "not Inter, not purple", it converges on a second cluster. **Claude-built UIs are especially recognisable here.** Sources: [avoid-ai-design](https://github.com/funboy322/avoid-ai-design), [Claude Code UI slop](https://productivetechtalk.com/2026/04/16/claude-code-ui-slop-is-killing-your-frontend-taste/), [frontend-design plugin notes](https://thomas-wiegold.com/blog/claude-code-frontend-design-plugin/), [Claude Design without the slop](https://www.theadpharm.com/insights/claude-design-without-the-ai-slop-look).

- **Fonts:** **Space Grotesk, Geist, Instrument Serif, Fraunces**, and the serif-italic accent word inside a sans headline. Plus Jakarta Sans, DM Sans and Manrope sit in the same "safe modern" bucket.
- **Palettes:**
  - **Cream + terracotta** (the "Claude look")
  - Near-black + one acid-green
  - Near-black + one vermilion
  - Emerald as a fallback accent
  - Untouched shadcn tokens
- **Decoration:**
  - Decorative `01 / 02 / 03` numbering.
  - Tracked all-caps mono labels ("template chrome").
  - "A · B · C" meta strings.
  - Fake macOS window dots.
  - "Broadsheet cosplay" (editorial hairlines with no reason).
  - One accented word per headline.

### 1.3 The fix the sources agree on

1. **Derive the direction from the product's own materials, artifacts and vernacular**, not from "modern SaaS".
2. **Write the ban list down** (section 9) and run a scan before every submission.
3. **Lock tokens in one file (this one)** so no page drifts.
4. **Test every choice:** "Would I make the same choice for any other app?" If yes, it is a default. Change it.

### 1.4 Designing for low-literacy workers (who FairShift is actually for)

Sources: [Medhi et al., Microsoft Research India](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/ToCHI2711_Medhi.pdf), [Islam et al. 2023 systematic review](https://journals.sagepub.com/doi/10.1177/21582440231172741), [Chaudry, low-literacy mobile UI](https://course.ccs.neu.edu/is4300f13/ssl/chaudry.pdf), [FormBharo voice agent, rural India](https://arxiv.org/pdf/2608.06027).

- **Text-only interfaces were unusable for first-time low-literacy users in India.** Graphical cues + voice annotations + local language performed far better.
- **Icons alone are not enough.** An icon is best understood **with a short text label**. We always pair icon + one word + voice.
- **Loop voice prompts in simple, slow vernacular**, and keep visual cues **consistent** across screens (same colour = same meaning everywhere).
- **Shallow navigation:** we keep it to **2 levels** (home tiles → task), far under the 5-level research ceiling.
- **Avoid text entry:** use a PIN pad, big choice buttons, voice input and an emoji scale.
- **Human in the loop:** a supervisor can file a report for a worker who cannot use the phone.

---

## 2. Design direction: "Muster Roll"

**Idea:** today these workers live inside **paper muster rolls (attendance registers), punch cards, carbon-copy payslips, rubber stamps and hi-vis safety signage**, as the PS says ("paper registers, spreadsheets, WhatsApp"). FairShift is the _honest_ version of that paperwork. So the UI borrows that world:

- **Register grid** → the base layout grid and the page-transition pattern.
- **Rubber stamp** → the **signature detail.** Every confirmed action is _stamped_: CHECKED IN 08:02, PAID, RECEIVED, RESOLVED. This is the one memorable moment of the app.
- **Ballpoint-blue ink** → the action colour (the blue of an Indian ballpoint pen on a register).
- **Hi-vis orange** → only danger and hazards, as on site signage.
- **Punch-clock time** → times, IDs and money set in a monospaced face with tabular figures, like a time card.

Why this is not "broadsheet cosplay": every borrowed element maps to a real artifact the worker already uses, and there are no decorative hairlines.

**Light theme only, by decision:** workers use phones outdoors in sunlight on construction sites. Dark mode is not shipped by reflex.

---

## 3. Colour tokens

Six roles. Each colour has exactly one job. Contrast ratios are computed against the WCAG 2.x formula.

| Token         | Hex       | Role                                                                             | Contrast                                                                                  |
| ------------- | --------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `--paper`     | `#F2F3EE` | App background (cool register paper, **not cream**)                              | —                                                                                         |
| `--card`      | `#FFFFFF` | Raised surfaces (payslip, form sheets)                                           | —                                                                                         |
| `--graphite`  | `#1C1D1A` | Body text, icons, outlines                                                       | 15.19 on paper                                                                            |
| `--muted`     | `#575A53` | Secondary text, captions                                                         | 6.29 on paper                                                                             |
| `--ink`       | `#1F3FB5` | **Primary action**, links, selected state, the stamp ink for "done"              | 7.73 on paper; white on ink 8.62                                                          |
| `--ink-deep`  | `#162D85` | Pressed/hover state of ink                                                       | 10.77 on paper                                                                            |
| `--hivis`     | `#FF5A1F` | **Danger only**: hazard buttons, fatigue warnings                                | graphite on hivis **5.43**. Never white on hivis (3.12), never hivis text on paper (2.80) |
| `--cleared`   | `#1D7340` | Paid / resolved / safe                                                           | 5.26 on paper; white on cleared 5.87                                                      |
| `--escalated` | `#B42318` | SLA missed / escalated / critical                                                | 5.90 on paper; white on escalated 6.57                                                    |
| `--rule`      | `#D5D7CE` | Register lines, dividers (decorative only, never the sole boundary of a control) | 1.30                                                                                      |

**Rules:**

- **Colour is never the only cue.** Every status pairs colour + icon + word (+ stamp shape).
- **Hi-vis shapes always get a 2 px graphite outline,** because hivis on paper (2.80) fails the 3:1 non-text contrast rule.
- No gradients anywhere except one: the **ink bleed** inside the stamp (a radial opacity texture, not a colour gradient).
- Shadows: one elevation only, `0 1px 0 var(--rule), 0 6px 16px -10px rgb(28 29 26 / .25)`, used for raised paper. No glows.

---

## 4. Typography

### 4.1 Families

| Use                             | Family                                                                                                                                 | Why                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Everything (UI, headings, body) | **Anek** by [Ek Type, Mumbai](https://github.com/EkType/Anek): `Anek Latin`, `Anek Devanagari`, `Anek Tamil` (+ `Anek Telugu` stretch) | One multi-script variable family designed **for Indian scripts** ([Google Design case study](https://design.google/library/anek-multiscript)). Latin, Hindi and Tamil share the same skeleton, so switching language does not change the app's voice. It has a **width axis** (condensed → wide) as well as weight: we set headings in wide/semi-bold and dense admin tables in condensed. It is not in any AI-default list. |
| Times, IDs, money, codes        | **Martian Mono** (verify on Google Fonts in P0; fallback **Spline Sans Mono**)                                                         | Punch-clock / time-card feel with tabular figures. It avoids JetBrains Mono, IBM Plex Mono and Geist Mono, which are all AI-default monos.                                                                                                                                                                                                                                                                                   |

**Banned:** Inter, Roboto, Arial/system-ui as a design choice, Space Grotesk, Geist, Instrument Serif, Fraunces, Plus Jakarta Sans, DM Sans, Manrope, Poppins, any serif italic accent word.

### 4.2 Loading (performance)

- Use `next/font/google` (self-hosted at build time, no external request at runtime, `display: swap`).
- **Only load the script for the active locale:** `Anek Latin` always, plus `Anek Devanagari` _or_ `Anek Tamil`, picked by the `lang` segment. Never ship all scripts to a low-end phone.
- Use the variable font (a single file covers weight + width axes) and preload only the Latin subset.

### 4.3 Scale (mobile base 17 px, because workers read in sunlight)

| Token     | Size / line-height | Weight · width | Use                                                          |
| --------- | ------------------ | -------------- | ------------------------------------------------------------ |
| `display` | 40 / 44            | 700 · 112      | Big stamped numbers (net pay, hours)                         |
| `h1`      | 28 / 34            | 650 · 108      | Screen title                                                 |
| `h2`      | 22 / 28            | 600 · 100      | Section                                                      |
| `body`    | 17 / 26            | 450 · 100      | Body                                                         |
| `label`   | 15 / 20            | 550 · 100      | Tile labels, buttons                                         |
| `small`   | 14 / 20            | 450 · 100      | Captions (never smaller)                                     |
| `mono`    | 15 / 20            | 500            | Times, IDs, ₹ amounts (`font-variant-numeric: tabular-nums`) |

**Indic rules:**

- Devanagari and Tamil need taller line-height. Use `:lang(hi), :lang(ta) { line-height: 1.6 }` for body, and **never clip with `overflow:hidden` on a single line** (matras and Tamil vowel signs get cut).
- Expect labels to be ~30% longer in Tamil. Tiles wrap to 2 lines and never truncate with an ellipsis.
- **No letter-spacing on Indic text** (it breaks conjuncts), and no all-caps styling at all (Indic has no case, and all-caps Latin is a slop tell).

---

## 5. Layout & components

### 5.1 Worker app (mobile-first, 360 px is the design width)

- **Language gate:** three huge buttons in native script (English · हिंदी · தமிழ்), each with a speaker icon that speaks the language name.
- **PIN pad:** a 3×4 grid of 64 px keys, digits in mono, with a haptic `navigator.vibrate(10)` where supported.
- **Home = the register page:**
  - At the top, a **today strip** with the date, shift status and a large **CHECK IN** stamp button.
  - Below it, a **2-column grid of 6 tiles**: Check-in, My Pay, Report Danger (hivis), Feedback, My Hours, Skills.
  - A tile is a flat card with a big custom line icon + one word.
  - These are _not_ "three icon cards": it is a 2×3 grid of equal tasks, which is the product's real structure.
- **Every screen:**
  - A top bar with back, the title and a 🔊 read-aloud button (`speechSynthesis`, locale voice, rate 0.9).
  - The primary action is **one full-width button at the bottom** (thumb zone), 56 px tall.
- Targets ≥ 48 px, spacing on a 4 px scale (`4, 8, 12, 16, 24, 32, 48`).
- **Radii by purpose:** paper/cards 6 px, buttons 10 px, PIN keys 14 px, stamps 4 px (rubber). Not `rounded-2xl` everywhere.

### 5.2 Admin console (desktop-first, responsive down to tablet and phone)

- **Left rail** (desktop) with text labels + custom icons: Overview · Attendance · Safety · Feedback · Workforce risk · Sites. It collapses to the **sliding-stairs menu** on mobile (section 7).
- **Sector switcher** at the top: a segmented control `Construction · Skyline Towers` / `College · Campus Facilities`. It drives every widget, so the 2+ sectors are visible live.
- **Overview layout**, which follows the content and is not a stats banner:
  - Row 1: **one sentence of state** in large type ("43 of 51 on site · 2 hazards escalated · 5 workers over 48 h"). Each number links to its rows.
  - Row 2: attendance chart (14 days, hand-built SVG, no chart lib) + the escalated hazard queue.
  - Row 3: the quit-risk table with reasons, and the feedback heatmap (team × question, cells hidden when k < 3).
- **Tables are first-class:** condensed Anek, mono numbers, row height 44 px, sticky header, and **status stamps** in cells.

### 5.3 Signature component: `<Stamp>`

- A rectangular rubber-stamp mark: 2.5 px double border, ink-texture fill at 8%, rotated −4° to +3° (deterministic from the record id, so it never jitters), and text in Anek Wide 700.
- **Variants:** `ink` (checked in, received), `cleared` (paid, resolved), `escalated` (escalated), `hivis` (hazard logged).
- **Used for:** check-in/out confirmation, payslip "PAID", hazard status, feedback "RECEIVED (anonymous)".
- **Accessibility:** it is a real text element (`role="status"`) with an `aria-live` announcement. It is not an image.

### 5.4 Icons

**Custom line icons, drawn for the domain:**

| Icon          | Meaning             |
| ------------- | ------------------- |
| Hard hat      | Construction sector |
| Broom/bucket  | Campus housekeeping |
| Rupee note    | Pay                 |
| Cone          | Danger              |
| Speech + lock | Anonymous feedback  |
| Clock card    | Hours               |
| Badge         | Skills              |

- They use a 24-px grid, a 2-px stroke and rounded joins, and are inlined as SVG React components (zero icon library).
- **No Lucide, no emoji in the UI, and no ✨ for AI.** AI output is marked with the words "Explained by AI · check with supervisor".

### 5.5 Copy voice

- Plain, concrete and second person, in short sentences ≤ 12 words.
- Buttons name the action: "Check in at Skyline Towers", "Send danger report", "Hear my payslip". Never "Get started", "Submit" or "→".
- Numbers are always real data from the engine. No count-up animation.

---

## 6. Motion principles

1. **Motion explains state, it does not decorate.** Every animation answers one question: where did I go, did it work, or what changed?
2. **Budget:**
   - Worker app: ≤ 400 ms, transform/opacity only, and **zero animation libraries** (CSS + the native View Transitions API).
   - Admin + landing: GSAP allowed (all plugins, including SplitText/DrawSVG/Flip, are now free under the standard `gsap` package; see [GSAP plugin docs mirror](https://mcpservers.org/agent-skills/greensock/gsap-plugins)). It is loaded only on those routes.
3. **Two easings for the whole app, taken from `Hero Animations/22`:** `hop = cubic-bezier(0.9, 0, 0.1, 1)` for reveals and `glide = cubic-bezier(0.8, 0, 0.2, 1)` for movement. No bounce and no elastic.
4. **`prefers-reduced-motion: reduce`** turns everything into instant state changes. The stamp just appears.
5. **Indic text is never split by characters.** SplitText `type: "chars"` breaks Devanagari conjuncts and Tamil vowel signs. Use `type: "lines"` (or `"words"`) with `mask: "lines"` only.
6. **No Lenis/smooth-scroll on the worker app** (it hurts low-end phones and scroll accessibility). It can optionally be used on the landing page only.

---

## 7. Animation map: from `~/Documents/Animations` to FairShift moments

Each pick is re-skinned to the Muster Roll tokens. Paths are relative to `C:\Users\shaur\Documents\Animations\components\`.

| #   | Product moment                                  | Source component                                                                                             | Technique to reuse                                                             | How we adapt it                                                                                                                                                                                                                                                   | Route / budget                                                         |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | **Login → workspace** (once per session)        | `Page Transitions/12` (block-reveal, Next 16 + `next-transition-router` + GSAP)                              | Grid of blocks fading in/out with a random stagger                             | Blocks become **register cells** (`--rule` borders, paper fill) that fill in, then clear to reveal the workspace. 60 px → 48 px cells, total ≤ 700 ms                                                                                                             | Admin + landing (GSAP). Worker app uses a CSS version of the same grid |
| 2   | **Landing page intro** (public `/` role picker) | `Hero Animations/22` (Steelworks reveal: preloader bar + SplitText line masks + CustomEase "hop"/"glide")    | Preloader bar scaleX → clip-path overlay → lines rise from a mask              | The preloader bar becomes a **shift-progress bar** (06:00 → 18:00). The H1 "Fair pay. Safe sites. A voice that counts." rises by **lines**. No stock images: two real UI screenshots slide in                                                                     | `/` only                                                               |
| 3   | **Check-in confirmation** (signature)           | Custom, using `hop` ease from `Hero Animations/22`                                                           | Scale 1.35 → 1, rotate to its resting angle, opacity 0 → 1, a 2-frame ink blur | `<Stamp variant="ink">CHECKED IN 08:02</Stamp>` lands on the today strip + vibration 15 ms + a spoken confirmation                                                                                                                                                | Worker, CSS keyframes, 320 ms                                          |
| 4   | **Home tile → task screen**                     | `Grid Animations/1` (Grid Layout Transition) + `Grid Animations/9` (Make Way)                                | The clicked tile expands into the next view; the others make way               | Use the **native View Transitions API** (`view-transition-name` per tile, Next `experimental.viewTransition`, [docs](https://nextjs.org/docs/app/guides/view-transitions)). The tile morphs into the screen header, so a low-literacy user _sees_ where they went | Worker, 0 KB JS, falls back to an instant change                       |
| 5   | **Payslip reveal**                              | `Text Animations/12` (AnimatedHeader, SplitText + `@gsap/react`), technique only                             | Lines rise from a mask with a stagger                                          | Payslip rows rise line by line (CSS `@keyframes` with a stagger via `--i`). Net pay is then **stamped PAID**, and **DrawSVG-style underline** from `SVG Animations/5` is drawn under the total with CSS `stroke-dashoffset`                                       | Worker, CSS only                                                       |
| 6   | **Hazard status timeline**                      | `SVG Animations/5` (on-scroll path animations)                                                               | Path drawing                                                                   | A vertical register line draws from _Reported → Acknowledged → Resolved_. An escalated node pulses once (not looping) in `--escalated`                                                                                                                            | Worker + admin, CSS `stroke-dashoffset`                                |
| 7   | **Admin mobile menu**                           | `Navigation Menus/5` (Sliding Stairs: 5 bars grow with a staggered height, links flip in from `rotateX(90)`) | Stairs open/close in reverse order                                             | Bars in `--graphite`. Links in Anek Wide. The hover marquee of images is **removed** (noise)                                                                                                                                                                      | Admin < 1024 px, GSAP core                                             |
| 8   | **Admin KPI sentence hover**                    | `Hover Effects/19` (magnetic cards)                                                                          | Magnetic pull toward the cursor                                                | Only on the 3 linked numbers in the state sentence, ≤ 6 px pull, pointer: fine devices only                                                                                                                                                                       | Admin desktop                                                          |
| 9   | **Section headings in admin**                   | `Text Animations/12`                                                                                         | SplitText lines + `@gsap/react` `useGSAP`                                      | Headings rise by **lines** on first view only. Never chars, so Hindi/Tamil admin labels stay intact                                                                                                                                                               | Admin                                                                  |
| 10  | **Skill passport cards** (stretch)              | `Sliders/3` (Stacked Cards, GSAP + CustomEase)                                                               | Swipeable stacked cards                                                        | Each card is one training/experience record. Drop the Unsplash images; use the issuing site + stamp "VERIFIED"                                                                                                                                                    | Worker, lazy-loaded GSAP only on this route                            |

**Rejected on purpose:** everything in `3D Animation`, `Webgl & ThreeJS Effects`, `Mouse Effects` and `Physics Effects`. These are WebGL/canvas/cursor effects that kill a 2 GB-RAM phone, do nothing on touch screens, and read as "agency portfolio", not "worker tool". `Background Animations` (ambient motion) is a slop tell. `Text Animations/18` (gooey) and `Hover Effects/9` (gooey text) do not fit Indic scripts.

**Install list (P0):** `gsap`, `@gsap/react`, `next-transition-router`. Everything else is CSS/native. GSAP is imported only inside `app/(admin)` and `app/page.tsx` (route-level code splitting).

---

## 8. Performance & accessibility budgets (both are scored)

| Budget                                  | Worker routes                    | Admin routes           |
| --------------------------------------- | -------------------------------- | ---------------------- |
| JS (gzip, first load)                   | **≤ 120 KB**                     | ≤ 220 KB               |
| LCP on a Moto G Power / Slow 4G profile | ≤ 2.5 s                          | ≤ 3 s                  |
| Fonts                                   | Latin + 1 Indic script, variable | Latin + 1 Indic script |
| Lighthouse (Perf / A11y / BP / SEO)     | ≥ 95 / 100 / 100 / 100           | ≥ 90 / 100 / 100 / 100 |
| axe violations                          | 0                                | 0                      |

Accessibility requirements:

- Visible focus ring: 3 px `--ink` outline with a 2 px offset.
- Skip link, and `lang` set on `<html>` per locale.
- All controls are reachable by keyboard. The PIN pad also accepts physical keys.
- `aria-live` is used for stamps and status changes.
- Text reflows at 200% zoom, and nothing is hidden behind hover on touch devices.

---

## 9. Ban list + slop gate (run before every submission attempt)

**Never ship any of these:**

- **Type:**
  - Inter, Roboto, Space Grotesk, Geist, Instrument Serif, Fraunces, Plus Jakarta Sans, DM Sans, Manrope, Poppins.
  - A serif italic accent word, or one coloured word in a headline.
- **Colour:**
  - Purple/indigo anything, gradients (except the stamp ink texture) and gradient text.
  - Cream + terracotta, black + acid green, black + vermilion, emerald as a default accent, and untouched shadcn tokens.
- **Layout:**
  - A centered hero with a pill badge, or the hero → 3 cards → stats → CTA template.
  - Stat banners, decorative 01/02/03 numbering and four-column footers.
- **Components:**
  - `rounded-2xl` / `shadow-lg` / `backdrop-blur` by default, or glass navbars.
  - Icon-in-rounded-square, coloured left-border cards, cards in cards and fake window dots.
- **Motion:**
  - The same fade-up on every section, bounce/elastic easing and count-up numbers.
  - Ambient background animation, or ignoring reduced-motion.
- **Icons/copy:**
  - Lucide, emoji in the UI, ✨ for AI.
  - "Elevate", "Seamless", "Powerful", "Unlock", "Get started", "→" on every CTA.
  - Tracked all-caps labels.

**Slop gate (P5 checklist):**

- [ ] `grep -rniE "Inter|Space_Grotesk|Geist|Instrument|Fraunces|from-purple|from-indigo|bg-clip-text|rounded-2xl|backdrop-blur|lucide|uppercase tracking" app src`. Every hit is fixed, or justified in a comment.
- [ ] Each screen passes the test "would I make the same choice for any other app?"
- [ ] The stamp is the only signature flourish, and it appears only on real confirmations.
- [ ] Screens are checked in Hindi and Tamil at 360 px: no clipped matras, no ellipsis, no char-split animations.
- [ ] Reduced-motion check: all content is reachable and correct with motion off.
