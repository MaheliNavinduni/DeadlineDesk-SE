/* =====================================================================
   DATA STORAGE LAYER
   All reading/writing of data happens here. The rest of the app never
   touches localStorage directly, so the storage could later be swapped
   for a real database/API by changing only this file.

   Keys used in localStorage:
     dl_users                 -> [{ username, passwordHash, createdAt }]
     dl_session               -> "username" of the logged-in user
     dl_assignments_<user>    -> [{ id, title, subject, deadline, priority,
                                    completed, createdAt, completedAt }]
   ===================================================================== */

const Storage = (() => {
  const USERS_KEY = "dl_users";
  const SESSION_KEY = "dl_session";
  const PRIORITIES = ["low", "medium", "high"];

  /* Read JSON safely - corrupted or missing data never crashes the app */
  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      const value = JSON.parse(raw);
      return value ?? fallback;
    } catch (err) {
      console.warn(`Could not read "${key}", using default.`, err);
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error(`Could not save "${key}".`, err);
      return false;
    }
  }

  /* Only keep records that have the shape we expect */
  function isValidAssignment(a) {
    return a && typeof a === "object" &&
      typeof a.id === "string" &&
      typeof a.title === "string" &&
      typeof a.subject === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(a.deadline) &&
      PRIORITIES.includes(a.priority) &&
      typeof a.completed === "boolean";
  }

  function assignmentsKey(username) {
    return `dl_assignments_${username.toLowerCase()}`;
  }

  return {
    PRIORITIES,

    /* ---------- Users ---------- */
    getUsers() {
      const users = read(USERS_KEY, []);
      return Array.isArray(users) ? users : [];
    },
    saveUsers(users) {
      return write(USERS_KEY, users);
    },

    /* ---------- Session ---------- */
    getSession() {
      const user = read(SESSION_KEY, null);
      return typeof user === "string" ? user : null;
    },
    setSession(username) {
      return write(SESSION_KEY, username);
    },
    clearSession() {
      localStorage.removeItem(SESSION_KEY);
    },

    /* ---------- Assignments (per user) ---------- */
    getAssignments(username) {
      const list = read(assignmentsKey(username), []);
      return Array.isArray(list) ? list.filter(isValidAssignment) : [];
    },
    saveAssignments(username, list) {
      return write(assignmentsKey(username), list);
    },

    /* Unique id without needing a database */
    newId() {
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }
  };
})();
