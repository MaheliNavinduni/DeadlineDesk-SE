# DueSoon – Assignment Deadline Tracker

ICT 2223 – 105-Minute Software Engineering Challenge

**How to run:** open `index.html` in Chrome / Edge. No install, no server, no database.

---

## Phase 1 – Define the Problem

| Question | Answer |
|---|---|
| Who is the user? | University students taking several modules at once. |
| What is the problem? | They forget assignment deadlines because deadlines are scattered across LMS pages, chats and emails. |
| What is our solution? | A small web app where a student logs in, records each assignment and instantly sees what is due next. |
| The ONE most important thing | Show the student their **upcoming deadlines, soonest first**. |

**Problem statement:**
> Our users are **university students**. They have difficulty with **remembering assignment deadlines across many subjects**. Our application will help them **record every assignment in one place and see what is due next, so nothing is missed**.

---

## Phase 2 – Kill Your Features

| MUST HAVE | NICE TO HAVE | DELETE |
|---|---|---|
| Login / register | Search by title or subject | Email / SMS reminders |
| Add assignment (title, subject, deadline, priority) | "Due in next 7 days" panel | Real database / backend server |
| Edit / delete assignment | Stats cards (total, pending, done, overdue) | File uploads for submissions |
| View upcoming deadlines (sorted) | Subject auto-suggest | Sharing with classmates |
| Mark as completed | Animations & hover effects | Calendar sync (Google Calendar) |

**MVP (if only 30 minutes were left):** Add an assignment → see it in a list sorted by deadline → mark it done. Everything else is extra.

---

## Phase 3 – Design

Full design with diagrams (architecture, user flow, sequence, data model, wireframe): **[docs/DESIGN.md](docs/DESIGN.md)**

### Architecture

```
USER  →  USER INTERFACE  →  APPLICATION LOGIC  →  DATA STORAGE
         index.html          js/app.js             js/storage.js
         css/styles.css      js/auth.js            (browser localStorage)
```

| File | Responsibility |
|---|---|
| `index.html` | Page structure: login view, dashboard, edit & delete pop-ups, SVG icons |
| `css/styles.css` | Purple colour palette, layout, animations, responsive (mobile) design |
| `js/storage.js` | **Only** file that reads/writes data. Safe JSON parsing, data validation |
| `js/auth.js` | Register, login, logout, password hashing (SHA-256) |
| `js/app.js` | Validation, add / edit / delete / complete, filtering, sorting, rendering |

### Where data is stored

No database is used. Data is saved in the browser's **localStorage** as JSON:

| Key | Contents |
|---|---|
| `dl_users` | List of users `{ username, passwordHash, createdAt }` |
| `dl_session` | Username of the logged-in user (stays logged in after refresh) |
| `dl_assignments_<username>` | That user's assignments – each user only sees their own |

Assignment record:
```json
{ "id": "lx3k9a7f2c", "title": "Report 1", "subject": "Networking",
  "deadline": "2026-10-05", "priority": "high",
  "completed": false, "createdAt": "...", "completedAt": null }
```

### Main user flow

```
Open app → Register / Login → Dashboard
   → Add assignment → validated → saved to localStorage → list re-renders (soonest first)
   → Edit / Delete (with confirmation) → saved → list re-renders
   → Tick "complete" → moves to Completed tab → stats update
   → Logout
```

### What happens on the main action ("Add assignment")
1. User fills in title, subject, deadline, priority and clicks **Add**.
2. `app.js` cleans the text (trims spaces) and **validates** it.
3. If invalid → red message + the wrong field shakes. Nothing is saved.
4. If valid → a new record with a unique id is added and `storage.js` saves it.
5. The list, stats and "next 7 days" panel are re-drawn and a toast confirms it.

