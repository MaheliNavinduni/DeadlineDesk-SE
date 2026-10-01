# DueSoon – Design

Phase 3 of the 105-Minute Challenge: architecture, components, data storage and user flow.

---

## 1. Architecture (layered)

We split the app into three layers. Each layer only talks to the one below it.

```mermaid
flowchart LR
    U([Student]) --> UI

    subgraph UI["User Interface"]
        H[index.html<br/>views, forms, modals]
        C[css/styles.css<br/>palette, animations]
    end

    subgraph LOGIC["Application Logic"]
        A[js/auth.js<br/>register, login, logout]
        P[js/app.js<br/>validate, add, edit,<br/>delete, complete, sort]
    end

    subgraph DATA["Data Storage"]
        S[js/storage.js<br/>read / write JSON]
        L[(Browser<br/>localStorage)]
    end

    UI --> LOGIC
    A --> S
    P --> S
    S --> L
```

**Why:** the UI never touches `localStorage` directly. To move to a real database later we only rewrite `storage.js`.

---

## 2. Components

| Component | File | Responsibility |
|---|---|---|
| Login / Register view | `index.html`, `app.js` | Tabs, forms, error messages |
| Dashboard | `index.html`, `app.js` | Stats cards, add form, 7-day panel, assignment list |
| Edit modal | `index.html`, `app.js` | Pre-filled form, save changes |
| Delete modal | `index.html`, `app.js` | "Are you sure?" confirmation |
| Toasts | `app.js` | Short success / error messages |
| Validation | `app.js` → `validateAssignment()` | One place for all input rules |
| Auth service | `auth.js` | Hash password (SHA-256), check login, session |
| Storage service | `storage.js` | Safe JSON read/write, drops corrupted records |

---

## 3. Main user flow

```mermaid
flowchart TD
    Start([Open index.html]) --> Logged{Already<br/>logged in?}
    Logged -- No --> Auth[Login / Register]
    Auth -- invalid --> AuthErr[Show error] --> Auth
    Auth -- valid --> Dash
    Logged -- Yes --> Dash[Dashboard<br/>Upcoming deadlines, soonest first]

    Dash --> Add[Add assignment]
    Add --> Valid{Valid?}
    Valid -- No --> AddErr[Show error, shake field] --> Add
    Valid -- Yes --> Save[(Save)] --> Dash

    Dash --> Done[Mark completed / undo] --> Save
    Dash --> Edit[Edit in modal] --> Valid
    Dash --> Del[Delete] --> Confirm{Confirm?}
    Confirm -- Yes --> Save
    Confirm -- No --> Dash

    Dash --> Out[Logout] --> Auth
```

---

## 4. What happens on the main action – "Add assignment"

```mermaid
sequenceDiagram
    actor S as Student
    participant UI as index.html
    participant App as app.js
    participant St as storage.js
    participant LS as localStorage

    S->>UI: Fill title, subject, deadline, priority → Add
    UI->>App: submit event
    App->>App: cleanText() + validateAssignment()
    alt invalid (empty, past date, duplicate...)
        App-->>UI: show error message, shake field
    else valid
        App->>App: create record with unique id
        App->>St: saveAssignments(user, list)
        St->>LS: setItem("dl_assignments_<user>", JSON)
        App->>UI: render() list, stats, 7-day panel
        App-->>S: toast "Report 1 added"
    end
```

---

## 5. Data model (stored as JSON in localStorage)

```mermaid
erDiagram
    USER ||--o{ ASSIGNMENT : owns
    USER {
        string username PK
        string passwordHash
        string createdAt
    }
    ASSIGNMENT {
        string id PK
        string title
        string subject
        string deadline "YYYY-MM-DD"
        string priority "low | medium | high"
        boolean completed
        string createdAt
        string completedAt
    }
```

| localStorage key | Value |
|---|---|
| `dl_users` | array of USER |
| `dl_session` | username of the logged-in user |
| `dl_assignments_<username>` | array of ASSIGNMENT for that user |

---

## 6. Assignment status

```mermaid
stateDiagram-v2
    [*] --> Pending: Add
    Pending --> Overdue: deadline passes
    Pending --> Completed: Mark complete
    Overdue --> Completed: Mark complete
    Completed --> Pending: Undo
    Pending --> [*]: Delete
    Overdue --> [*]: Delete
    Completed --> [*]: Delete
```

"Overdue" is not stored. It is worked out each time from the deadline and today's date, so it is never out of date.

---

## 7. Screen layout (wireframe)

```
+---------------------------------------------------------------+
| [cap] DueSoon                              (user)  [Logout]   |
+---------------------------------------------------------------+
| [Total 4]   [Pending 3]   [Completed 1]   [Overdue 1]         |
+--------------------+------------------------------------------+
| + Add assignment   | [Upcoming] [All] [Completed]  [search..] |
| Assignment [     ] |------------------------------------------|
| Subject    [     ] | Assignment  Subject  Deadline  Pri  Stat |
| Deadline   [date ] | Quiz        Maths    Today     High Pend |
| Priority  L [M] H  | Report 1    Netw.    in 4 days High Pend |
| [ Add assignment ] | Essay       English  -3 days   Med  Over |
|--------------------|               actions: [done][edit][del] |
| Due in next 7 days |                                          |
|  Quiz      today   |                                          |
|  Report 1  4 days  |                                          |
+--------------------+------------------------------------------+
```

On phones the two columns stack, and each assignment becomes a card.

---

## 8. Key engineering decisions

| Decision | Reason |
|---|---|
| No database – use `localStorage` | Fits the 105-minute limit, no setup, works offline |
| Separate storage layer (`storage.js`) | Can swap to a real database without touching the UI |
| One `validateAssignment()` for add **and** edit | Same rules everywhere, one place to change for a change request |
| Data saved per user | Each student only sees their own assignments |
| Passwords hashed (SHA-256) | Never store plain-text passwords, even in a demo |
| Escape all user text before showing it | Stops HTML/script injection |
| Dates handled in local time | Avoids "wrong day" bugs in UTC+5:30 |
| "Overdue" calculated, not stored | Always correct without background jobs |
| Inline SVG icons | Works without internet in the lab |
