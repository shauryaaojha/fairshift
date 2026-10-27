A mason on a Chennai site works 11 hours. His payslip says 8. Nobody can tell him why.

That gap is what SDG 8, decent work, is about. Millions of shift workers on construction sites, college campuses and hospital wards still run on paper registers and WhatsApp groups. They can't see how their pay is worked out. They stay quiet about safety problems, because speaking up can cost them the job. Their employers only find out who was overworked or unhappy when that person quits, or gets hurt.

At PromptWars 2026 (ACM SRMIST × Hack2Skill × Google for Developers) I built FairShift, a phone-first platform with two sides.

For the worker:

- Check in by scanning a QR code at the site gate
- A payslip that shows every line, overtime included, and reads itself aloud
- Report a hazard by speaking in Hindi or Tamil, anonymously if they want
- Give honest feedback that can never be traced back to them
- A skill passport they carry to the next job

For the supervisor:

- Who is on site right now
- Hazards ranked by deadline, escalating on their own if nobody responds
- Fatigue flags, and a quit-risk list that always shows its top three reasons

How it's built:

- Next.js 16 and TypeScript on Vercel, with MongoDB Atlas for data
- Google Gemini explains payslips in plain words and turns a spoken Hindi or Tamil report into an English summary for the supervisor. A human confirms the severity, and every AI feature still works without AI
- Pay, overtime (8 h/day, 48 h/week, double rate under the OSH Code), fatigue limits and hazard deadlines are tested code, not model guesses. 129 automated tests back them
- Designed for the people who'll actually use it: big buttons, voice on every screen, English, Hindi and Tamil, and a bright high-contrast look that stays readable in sunlight on a cheap phone

How it fits the problem: every pain point in the brief has a feature. Opaque pay gets a line-by-line payslip. Fear of being identified gets feedback stored with no worker id, and team results stay hidden until at least 3 people have answered. Ignored hazards get a queue with deadlines. Lost career history gets the skill passport. And the employer's blind spots become one live dashboard.

It runs on two sectors from one data model, construction and college campuses, and a hospital fits the same model.

Try it: https://fairshift-brown.vercel.app
Code: https://github.com/shauryaaojha/fairshift

Thanks to @ACM SRMIST Student Chapter, @Hack2Skill and @Google for Developers for PromptWars.

#promptwars #acmsrmist #hack2skills #googlefordevelopers
