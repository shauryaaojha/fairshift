# PromptWars: Winners & Top Projects on GitHub

_As of 2026-10-27_

## Overview

Only two PromptWars winning projects have public GitHub repos: **EcoPilot** (1st prize, NMIET, 23 Oct 2026) and **Project OrbitMentor** (winner, Parul University, 5 Sep 2026). There are 100+ PromptWars repos on GitHub, but almost all of them are participation submissions with no result attached.

PromptWars is a "Build with AI" vibe-coding hackathon run by Google for Developers and Hack2Skill. Teams build with Google Antigravity or Google AI Studio under a time limit. It runs in two formats:

- **PromptWars Virtual:** national online challenges, for example Challenge 2 (Election Guide), Challenge 3 (Carbon Footprint) and Challenge 4 (Smart Stadium Ops). They are scored on a leaderboard with 16,000 to 17,500+ participants.
- **In-person and campus editions:** one-day events at Google offices and colleges (Gurugram, Bengaluru, Hyderabad, Parul University, NMIET and others). An AI-scored leaderboard round is followed by a live pitch to judges.

**Method:** GitHub repo and code search (`gh search`) for "promptwars", "winner", "1st prize", "rank" and "runner-up", followed by a web search for event results. Every repo listed here was opened and its README checked.

## 0. Our event: ACM SRMIST PromptWars rules

These rules are from `docs/PromptWars 2026 Submission Guide.pdf` (ACM Student Chapter SRMIST x Hack2Skill x Google for Developers). Where they conflict with anything below, **they win.**

**Three deliverables**, submitted on the Hack2Skill Innovator Dashboard using your registered hackathon email:

| Field            | What to submit                                                               | Hard rules                                                                                                           |
| ---------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1. GitHub        | Public repo URL **ending in `.git`** (`https://github.com/user/project.git`) | Public. **Exactly 1 branch.** **Under 10 MB** (no datasets or videos)                                                |
| 2. Deployed link | Live **Google Cloud Run** URL                                                | **Vercel and Netlify links are rejected.** AI Studio, Vertex AI, Firebase and Antigravity are allowed while building |
| 3. LinkedIn post | Public post link                                                             | Structure: the problem, then your build and tools, then how the solution fits the problem                            |

**AI evaluation: 6 parameters** (the same 6 that EcoPilot was scored on):

| #   | Parameter         | What the evaluator checks                        |
| --- | ----------------- | ------------------------------------------------ |
| 1   | Code Quality      | Clean, readable, well-organised structure        |
| 2   | Security          | Zero exposed keys or credentials                 |
| 3   | Efficiency        | Sensible resource usage, no bloat                |
| 4   | Testing           | Features verified with unit tests                |
| 5   | Accessibility     | Readable contrast, keyboard navigation           |
| 6   | Problem Alignment | Directly solves the assigned challenge statement |

**Max 2 submission attempts, and the latest score counts.** The leaderboard is real-time. A second attempt scoring 60 replaces a first attempt scoring 90. Resubmit only if you are sure the new version scores higher.

After submitting, check that the dashboard shows it as recorded.

## 1. Confirmed winners with public repos

Both projects below won first place at an in-person PromptWars edition, and both have a live demo.

| Project                                                                                                                                                                | Event                                                              | Result                                                                                                  | Built with                                                                                    | Repo                                                                                | Demo                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **EcoPilot**: a Gemini agent that turns a plain-words description of your week into a measurable CO2-reduction plan                                                    | PromptWars x VYOM Club, NMIET, 23 Oct 2026 (Sustainability domain) | **1st Prize, INR 10,000.** Round 1 (AI code review): 97.27/100, ranked 2nd. Round 2 (pitch + viva): 1st | Gemini API, Firebase, Cloud Run ready                                                         | [chinmaymeshram1-wq/promptwar](https://github.com/chinmaymeshram1-wq/promptwar)     | [promptwar-opal.vercel.app](https://promptwar-opal.vercel.app)             |
| **Project OrbitMentor**: a capstone project generator for final-year engineering students, with 3 feasibility tiers, a 16-week roadmap, stack trade-offs and viva prep | PromptWars x Parul University, 5 Sep 2026                          | **Winner** (Dev Sonar)                                                                                  | React 19, TypeScript, Tailwind, Node/Express on Vercel serverless, Gemini via `@google/genai` | [Devsonar19/Project-OrbitMentor](https://github.com/Devsonar19/Project-OrbitMentor) | [project-orbit-mentor.vercel.app](https://project-orbit-mentor.vercel.app) |

**Parul University runner-ups** ([official article](https://www.paruluniversity.ac.in/news-and-awards/promptwars-x-parul-university-inside-a-google-backed-vibe-coding-hackathon/)):

- 1st runner-up: **ProjectPilot**, by Aryan Maurya
- 2nd runner-up: **Meridian**, by Harsh Chavan. It was built and deployed with Google Antigravity in one day.
- Neither runner-up has a repo that can be found on GitHub.
- Dikshant Agarwal topped the live numeric leaderboard but did not make the final top 3. The pitch round decided the result.

## 2. Virtual PromptWars top rankers

| Who                | Claimed result                                     | Projects                                                                                                                                                                                                                                              | Evidence                                                                                                                                      |
| ------------------ | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rishet11**       | Rank 27 of 16,000+ (top 0.2%) in Google PromptWars | [stadiumops-copilot](https://github.com/Rishet11/stadiumops-copilot) ([demo](https://promptwars-drab.vercel.app)), [VoteReady-PromptWars](https://github.com/Rishet11/VoteReady-PromptWars), [carbon-coach](https://github.com/Rishet11/carbon-coach) | Self-claimed on their portfolio site ([Rishet11/mehra-city](https://github.com/Rishet11/mehra-city)). The repo behind the rank is not stated. |
| Unnamed (LinkedIn) | #98 of 17,500+, Hack2Skill Virtual PromptWars 2026 | Not found                                                                                                                                                                                                                                             | Search snippet only                                                                                                                           |
| Unnamed (LinkedIn) | 16th globally, Google Antigravity PromptWars 2026  | Not found                                                                                                                                                                                                                                             | Search snippet only                                                                                                                           |
| Unnamed (LinkedIn) | 2nd Runner-Up, Google PromptWars 2026 Gurugram     | Not found                                                                                                                                                                                                                                             | Search snippet only                                                                                                                           |

**Why stadiumops-copilot is worth studying:** a pure, testable decision engine (`StadiumState -> ranked Recommendation[]`) is the source of truth. The LLM copilot (Groq) only answers questions grounded in that engine's output. The app works end to end with or without an API key.

## 3. Most-starred PromptWars repos (no win proof)

| Repo                                                                                                  | Stars | What it is                                                                                                               |
| ----------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------ |
| [vigneshwaran484/stadium-ops-copilot](https://github.com/vigneshwaran484/stadium-ops-copilot)         | 7     | Challenge 4: RAG-based SOP guidance for stadium volunteers. FastAPI + Gemini + FAISS, multilingual, escalation decisions |
| [mysticalayushi/carboncut](https://github.com/mysticalayushi/carboncut)                               | 3     | Challenge 3                                                                                                              |
| [pavankarthikeyaatchyuta-lab/EcoVerse-AI](https://github.com/pavankarthikeyaatchyuta-lab/EcoVerse-AI) | 3     | Gemini-based climate "behaviour companion" that converts emissions into everyday equivalents                             |
| [shreyanshio/PromptwarsX-1](https://github.com/shreyanshio/PromptwarsX-1)                             | 2     | ProjectSpark: the same capstone-project problem statement as OrbitMentor                                                 |
| [SairajNarayankar/Civicguide](https://github.com/SairajNarayankar/Civicguide)                         | 2     | Challenge 2 election guide, React + Gemini on Cloud Run                                                                  |

**Same name, unrelated:** [Kishalll/PromptWars](https://github.com/Kishalll/PromptWars) (11 stars, a multiplayer prompt-guessing game) and [thinkst/promptwars](https://github.com/thinkst/promptwars) (a CoreWars-style prompt battle). Neither is part of the Google/Hack2Skill hackathon.

## 4. What the winners did right

### EcoPilot's scorecard

The AI evaluator in Round 1 scored six criteria. EcoPilot's README publishes its marks:

| Criterion                   | Score                 |
| --------------------------- | --------------------- |
| Security                    | 100                   |
| Efficiency                  | 100                   |
| Accessibility               | 100                   |
| Problem Statement Alignment | 100                   |
| Testing                     | 98                    |
| Code Quality                | 89 (refactored later) |
| **Total**                   | **97.27 / 100**       |

They proved each criterion with a badge in the README:

- CI on GitHub Actions
- 112 passing tests, 93% coverage
- Lighthouse 100 / 100 / 100 / 100
- 0 axe accessibility violations
- 0 `npm audit` vulnerabilities
- **"Every number comes from audited, tested code, never from the language model."** Gemini plans and explains, but the maths is deterministic.
- A **Demo mode** gives an instant result without an API key, and an **AI agent mode** runs the real Gemini planning.

### OrbitMentor's approach

- Wrote a **full requirements document before any code** (the reason the Parul article gives for the win).
- Picked a problem the judges know first-hand (final-year capstone projects) and covered it end to end: idea, roadmap, stack justification, viva prep.
- Used a **dual-layer fallback engine**, so the app keeps generating when the Gemini quota runs out. The demo cannot die on stage.

### Common pattern

1. Deterministic core + LLM on top (EcoPilot, stadiumops-copilot).
2. The app works without an API key (demo mode or a fallback).
3. Measured quality is shown as proof in the README: tests, coverage, Lighthouse, a11y, audit.
4. The submission is deployed live. The winners used Vercel, but **our event only accepts Cloud Run** (see section 0).
5. The pitch round matters. The leaderboard topper at Parul did not win.

## 5. Playbook for our submission

- [ ] Read the problem statement twice and map every feature to a line in it (Problem Statement Alignment).
- [ ] Write a short `docs/requirements.md` before coding.
- [ ] Keep calculations and decisions in pure, tested functions. Use Gemini only for planning, explaining and chat.
- [ ] Add a demo/offline mode and a fallback when the API quota or key fails.
- [ ] Tests with 90%+ coverage, plus CI on GitHub Actions.
- [ ] Accessibility: semantic HTML, labels, contrast, keyboard navigation. Run axe and Lighthouse and aim for 100.
- [ ] Security: keys in env vars only, input validation and sanitisation, `npm audit` clean.
- [ ] Efficiency: small bundle, caching, no needless LLM calls.
- [ ] Deploy on **Google Cloud Run** (Dockerfile, listen on `$PORT`). Vercel and Netlify links are rejected.
- [ ] Repo: public, **1 branch only** (delete feature branches before submitting), **under 10 MB**, `.gitignore` for `node_modules`, builds and media.
- [ ] Submit the GitHub URL **with `.git` at the end**.
- [ ] README: Cloud Run link, badges with real numbers, architecture, how to run locally.
- [ ] LinkedIn post: problem, then build and tools, then solution fit. Publish it before you submit.
- [ ] **Attempt 1:** submit only after every item above is green. Read the AI feedback, and use **attempt 2** only if the fixes clearly raise the score.
- [ ] Rehearse a 2 to 3 minute pitch with one live flow and be ready for viva questions on the architecture.

Reference playbook repo: [Mrityunjoy240/world-cup-ai-playbook](https://github.com/Mrityunjoy240/world-cup-ai-playbook) (`00_PromptWars_Playbook/Winning_Strategies.md`, `Judging_Criteria.md`).

## 6. Gaps and caveats

- **EcoPilot's 1st prize is self-reported** in its README. No official NMIET results page was found.
- **City winners are not public as text.** Hack2Skill pages show "Winners announced" for Gurugram, Noida, Bengaluru, Mumbai and Hyderabad, but not the names. Results may only exist in photo galleries or LinkedIn posts.
- **Hyderabad edition** (St. Peter's Engineering College) is on 30 Oct 2026, so it has no winners yet.
- **The Virtual leaderboard** is not published publicly, so ranks come from participants' own claims.
- GitHub code search hit its rate limit (10 requests/min) during the research, so a few phrase searches did not finish.

## Sources

- `docs/PromptWars 2026 Submission Guide.pdf` (ACM SRMIST, official rules for our event)
- [EcoPilot repo and README](https://github.com/chinmaymeshram1-wq/promptwar)
- [Project OrbitMentor repo](https://github.com/Devsonar19/Project-OrbitMentor)
- [PromptWars x Parul University article](https://www.paruluniversity.ac.in/news-and-awards/promptwars-x-parul-university-inside-a-google-backed-vibe-coding-hackathon/)
- [Rishet11/stadiumops-copilot](https://github.com/Rishet11/stadiumops-copilot) and [Rishet11/mehra-city](https://github.com/Rishet11/mehra-city)
- [Hack2Skill PromptWars event page](https://hack2skill.com/event/promptwars)
- [PromptWars Community (Hack2Skill)](http://hack2skill.com/pw-community/)
- [PromptWars Hyderabad 2026 on Unstop](https://unstop.com/hackathons/promptwars-hyderabad-2026-ai-prompt-engineering-competition-st-peters-engineering-college-spec-hyderabad-tela-1765597)
- [promptwars.in](https://promptwars.in/)
