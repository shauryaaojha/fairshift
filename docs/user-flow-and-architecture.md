# FairShift: Users, User Flow and Architecture

FairShift has two front doors: a phone app for **shift workers** (`/w`) and a console for **supervisors** (`/admin`). Both read and write the same records, so every action a worker takes appears in the supervisor's queue, and every supervisor action shows up on the worker's phone.

## 1. Who the users are

| Persona                        | Example from the demo data                                                  | Device and context                              | What they need                                                           |
| ------------------------------ | --------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| **Shift worker, construction** | Ramesh Kumar, mason, Skyline Towers, Chennai. Speaks Hindi, daily wage ₹750 | Basic Android phone, outdoors, limited literacy | Proof of hours, a payslip he can understand, a safe way to report danger |
| **Shift worker, campus**       | Murugan Swaminathan, housekeeping, Campus Facilities. Speaks Tamil          | Shared or low-end phone, shift rotas            | Same, plus night-shift fatigue protection                                |
| **Site supervisor**            | Site Ops Lead, Skyline Towers                                               | Desktop or tablet in the site office            | Who is on site, which hazards are overdue, who is overworked             |
| **Regional HR lead**           | Kavya Raman, manages both sites                                             | Laptop                                          | One view across construction **and** campus (sector switcher)            |

## 2. How a user arrives

```mermaid
flowchart LR
    Gate["Site gate kiosk<br/>rotating QR, new code every 60 s"] -->|phone camera scan| Scan["/w/checkin?site=…&code=…"]
    Link["Shared link or home-screen icon"] --> Login
    Scan -->|not signed in| Login["/w/login<br/>language: English · हिंदी · தமிழ்<br/>phone + 4-digit PIN"]
    Login -->|returns to the scanned code| Checkin["Check-in confirmed<br/>stamp + voice + vibration"]
    Scan -->|already signed in| Checkin
    Landing["fairshift-brown.vercel.app"] -->|I work on a shift| Login
    Landing -->|I manage a team| AdminLogin["/admin/login<br/>email + password"]
```

The QR is scanned with the phone's **own camera app**, so there is nothing to install. If the worker is signed out, the scanned code is carried through login (`?next=`) and the check-in still completes.

## 3. Worker flow

```mermaid
flowchart TD
    Home["Home<br/>today strip + 6 tiles<br/>(icon + one word + read-aloud)"]
    Home --> CI["Check in / out<br/>QR or GPS geofence"]
    Home --> Pay["My pay<br/>line-by-line payslip, PAID stamp<br/>Hear my payslip · Why this amount?"]
    Home --> Haz["Report danger<br/>category tiles + speak in your language<br/>optional anonymous"]
    Home --> Fb["Feedback<br/>4 face scales, anonymous"]
    Home --> Hrs["My hours<br/>7-day shifts, overtime, fatigue warnings"]
    Home --> Sk["Skills<br/>passport + shareable verify link"]
    CI --> Rules{{"Rule engines<br/>overtime 8 h/day, 48 h/week, 2×<br/>fatigue limits"}}
    Rules --> Pay
    Rules --> Hrs
    Haz --> Track["Report status timeline<br/>Reported → Acknowledged → Resolved"]
    Sk --> Verify["/passport/token<br/>public, first name only"]
```

## 4. Supervisor flow

```mermaid
flowchart TD
    Ov["Overview<br/>one-sentence state: on site · escalated · fatigued<br/>14-day attendance · quit-risk with reasons · heatmap"]
    Ov --> Saf["Safety queue<br/>SLA timers, auto-escalation<br/>English summary of Hindi/Tamil reports<br/>confirm AI-suggested severity"]
    Ov --> Risk["Workforce risk<br/>0–100 score + top 3 reasons"]
    Ov --> Att["Attendance<br/>shift table + filters"]
    Ov --> FbH["Feedback heatmap<br/>team × question, hidden below 3 answers"]
    Ov --> Sites["Sites → gate kiosk QR"]
    Saf -->|Acknowledge / Resolve| Done["Worker sees the new status"]
    Switch["Sector switcher<br/>Construction ↔ College<br/>(only orgs this admin may access)"] --- Ov
```

## 5. The closed loop: one hazard, end to end

```mermaid
sequenceDiagram
    actor W as Worker (Hindi)
    participant App as FairShift (Vercel)
    participant AI as Gemini API
    participant DB as MongoDB Atlas
    actor S as Supervisor
    W->>App: Speaks "तीसरी मंज़िल पर रेलिंग टूटी है", picks Fall risk, High
    App->>AI: Summarise in English + suggest severity (8–12 s timeout)
    AI-->>App: "Broken railing on 3rd floor", high
    Note over App: Falls back to a rule-based summary if AI is slow or off
    App->>DB: Store report (no reporter id if anonymous)
    App-->>W: LOGGED stamp + status timeline
    S->>App: Opens safety queue
    App->>DB: Load reports, compute SLA on read (High = 4 h)
    App-->>S: Report with timer, English summary, suggested severity
    alt Not acknowledged within the SLA
        App-->>S: Shown as ESCALATED (no cron job needed)
    end
    S->>App: Confirm severity, Acknowledge, Resolve
    App->>DB: Update status
    App-->>W: Timeline shows Resolved
```

## 6. Offline check-in and automatic sync

When a worker has poor or no cellular reception at the gate, check-in and other critical actions run entirely offline. Actions are queued in IndexedDB and replayed to the server with their original timestamp as soon as connectivity returns:

```mermaid
sequenceDiagram
    actor W as Worker (offline)
    participant UI as Phone UI (Worker App)
    participant IDB as IndexedDB Outbox
    participant App as FairShift Server Action
    participant DB as MongoDB Atlas

    W->>UI: Captures QR check-in (no connection)
    UI->>IDB: Save in IndexedDB outbox (capturedAt, clientId)
    UI-->>W: Shows "SAVED OFFLINE" stamp ("Will send when online")
    Note over UI,IDB: Worker proceeds to site; action stays local
    Note over UI: Network returns (online event / visibility change)
    UI->>App: flushOutbox replays check-in (code, capturedAt, clientId)
    App->>App: validateCapturedAt (<= 24h, clock skew <= 2m)
    App->>App: verifyRotatingCodeAt(code, siteSecret, capturedAt)
    App->>DB: Shift created with checkIn = capturedAt (idempotent clientId)
    App-->>UI: Replay accepted (success)
    UI->>IDB: Outbox item removed
    UI-->>W: Banner shows "All sent" (auto-hides after 4 s)
```

## 7. Architecture

```mermaid
flowchart TB
    subgraph Client["Browser"]
        Phone["Worker phone<br/>Server-rendered pages, tiny client JS<br/>Web Speech API: speak + read aloud"]
        Desk["Supervisor desktop<br/>GSAP motion on admin routes only"]
    end
    subgraph Vercel["Vercel: Next.js 16 App Router"]
        Proxy["proxy.ts<br/>session check, role gate, ?next= return path"]
        Pages["Server Components + Server Actions<br/>zod validation · rate limits · org scoping"]
        Services["services/<br/>use-cases: check-in, report, payslip, risk"]
        Views["views/<br/>shape data for each page"]
        Domain["domain/ (pure, unit-tested)<br/>overtime · payslip · fatigue · quit-risk<br/>hazard SLA · anonymity · geofence · QR · IST time"]
        Repos["repos/<br/>one interface, two adapters"]
        AIL["ai/<br/>Gemini client + rule-based fallbacks"]
    end
    Mongo[("MongoDB Atlas<br/>MONGODB_URI env var")]
    Memory[("Seeded in-memory store<br/>local dev, tests,<br/>fallback if Mongo is unreachable")]
    Gemini["Google Gemini API<br/>GEMINI_API_KEY env var"]

    Phone --> Proxy
    Desk --> Proxy
    Proxy --> Pages
    Pages --> Services
    Pages --> Views
    Views --> Services
    Services --> Domain
    Services --> Repos
    Services --> AIL
    Repos --> Mongo
    Repos -.-> Memory
    AIL --> Gemini
```

**Dependency rule:** dependencies point one way only, `pages → services/views → domain + repos`. The `domain/` folder imports nothing from Next.js, the database or the network, so every number on screen comes from a pure function with tests. Gemini only **explains** results. It never decides pay, overtime, risk or deadlines.

**Secrets:** the MongoDB connection string, the Gemini key and the session secret exist only as Vercel environment variables. QR keys and passport tokens are derived from the session secret with HMAC, so the repo contains no secret.
