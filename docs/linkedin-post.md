# LinkedIn post draft

_Structure required by the submission guide: the problem, then the build and tools, then how the solution fits the problem. Replace the bracketed parts before posting. Add the live Cloud Run URL and the repo URL._

---

A mason on a Chennai site works 11 hours. His payslip says 8. Nobody can tell him why.

That is the gap behind SDG 8, decent work. Millions of shift workers in construction, colleges and hospitals still live on paper registers and WhatsApp groups. They cannot see how their pay is worked out. They stay quiet about safety problems because speaking up can cost them the job. Their employers can't see who is overworked or about to leave until it is too late.

For PromptWars 2026 I built **FairShift**, a phone-first platform with two sides.

**What the worker gets:** check in by scanning a QR code at the gate, a payslip that shows every line including overtime, a hazard report you can speak in Hindi or Tamil, anonymous feedback, and a skill record you can share.

**What the supervisor gets:** a live console with who is on site, hazards ranked by deadline, fatigue flags, and a quit-risk list that always shows its top reasons.

How it is built:
- Next.js 16 and TypeScript, deployed on Google Cloud Run
- Firestore for data, with an in-memory mode that runs with no credentials
- Gemini on Vertex AI to explain payslips in plain words and to turn a spoken hazard report into an English summary. A supervisor confirms the severity, and every AI feature has a rule-based fallback
- Pay, overtime, fatigue limits, hazard deadlines and anonymity are plain tested code, not AI guesses
- A design made for the people using it: large targets, voice read-aloud, three languages, light high-contrast screens for use in sunlight

Why it fits the problem: each pain point in the brief has a feature. Opaque pay gets a line-by-line payslip. Fear of identification gets feedback with no worker id, hidden for any group under 3. Unreported risks get a queue with deadlines that escalates on its own. Lost career history gets a skill passport. For employers, the blind spots become a dashboard.

It works on two sectors today, construction and college campuses, from one data model. Hospitals fit the same model.

Repo: [GitHub URL ending in .git]
Live demo: [Cloud Run URL]

#PromptWars #SDG8 #GoogleCloud #Gemini #BuildWithAI
