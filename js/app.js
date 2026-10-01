/* =====================================================================
   USER INTERFACE + APPLICATION LOGIC
   Flow:  User -> UI (this file) -> Logic (validate / add / edit / ...)
          -> Data storage (storage.js) -> re-render UI
   ===================================================================== */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const state = {
  user: null,
  assignments: [],
  filter: "upcoming",   // upcoming | all | completed
  search: "",
  deleteId: null
};

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
const MAX_YEARS_AHEAD = 2;

/* ---------------------------------------------------------------------
   Date helpers
   Dates are handled in LOCAL time on purpose. toISOString() gives the UTC
   date, which in Sri Lanka (UTC+5:30) is still "yesterday" between 00:00
   and 05:30, and new Date("2026-10-05") is read as UTC midnight.
   --------------------------------------------------------------------- */
function parseDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function todayISO() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}
function daysUntil(iso) {
  const ms = parseDate(iso) - parseDate(todayISO());
  return Math.round(ms / 86400000);
}
function formatDate(iso) {
  return parseDate(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
function isValidISODate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split("-").map(Number);
  const date = parseDate(iso);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}
function dueText(a) {
  if (a.completed) return { text: "Completed", cls: "done" };
  const n = daysUntil(a.deadline);
  if (n < 0)  return { text: `Overdue by ${-n} day${n === -1 ? "" : "s"}`, cls: "overdue" };
  if (n === 0) return { text: "Due today", cls: "soon" };
  if (n === 1) return { text: "Due tomorrow", cls: "soon" };
  if (n <= 7) return { text: `Due in ${n} days`, cls: "soon" };
  return { text: `Due in ${n} days`, cls: "later" };
}
const isOverdue = (a) => !a.completed && daysUntil(a.deadline) < 0;

/* Prevent HTML injection: user text is always escaped before display */
function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const cleanText = (s) => s.trim().replace(/\s+/g, " ");
const capitalise = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------------------------------------------------------------------
   Toasts
   --------------------------------------------------------------------- */
function toast(message, type = "success") {
  const icon = type === "error" ? "i-alert" : "i-check-circle";
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<svg class="icon"><use href="#${icon}"/></svg><span>${escapeHTML(message)}</span>`;
  $("#toast-wrap").appendChild(el);
  setTimeout(() => {
    el.classList.add("hide");
    setTimeout(() => el.remove(), 300);   // timer, not animationend: works with animations off
  }, 2600);
}

function showError(id, msg, input) {
  $(id).textContent = msg;
  if (input) {
    input.classList.remove("invalid");
    void input.offsetWidth;          // restart shake animation
    input.classList.add("invalid");
    input.focus();
  }
}
function clearErrors(form) {
  form.querySelectorAll(".invalid").forEach((i) => i.classList.remove("invalid"));
  form.querySelector(".form-error").textContent = "";
}

/* =====================================================================
   VIEW SWITCHING (login <-> app)
   ===================================================================== */
function showAuth() {
  state.user = null;
  hidePasswords();
  $("#app-view").classList.add("hidden");
  $("#auth-view").classList.remove("hidden");
  $("#login-username").focus();
}

function showApp(username) {
  state.user = username;
  hidePasswords();
  state.assignments = Storage.getAssignments(username);
  $("#current-user").textContent = username;
  $("#auth-view").classList.add("hidden");
  $("#app-view").classList.remove("hidden");
  $("#add-deadline").min = todayISO();
  render();
}

/* =====================================================================
   AUTH UI
   ===================================================================== */

/* ---------- Show / hide password (customer change request v1.1) ----------
   One eye button is added to every password box, so new password fields
   get it automatically. */
function setPasswordVisible(input, btn, visible) {
  input.type = visible ? "text" : "password";
  const label = visible ? "Hide password" : "Show password";
  btn.innerHTML = `<svg class="icon"><use href="#${visible ? "i-eye-off" : "i-eye"}"/></svg>`;
  btn.title = label;
  btn.setAttribute("aria-label", label);
  btn.setAttribute("aria-pressed", String(visible));
}

/* Never leave a password showing after logout, login or switching tabs */
function hidePasswords() {
  $$(".pw-toggle").forEach((btn) => setPasswordVisible(btn.previousElementSibling, btn, false));
}

$$('input[type="password"]').forEach((input) => {
  const btn = document.createElement("button");
  btn.type = "button";                       // a plain button inside a form would submit it
  btn.className = "pw-toggle";
  input.after(btn);
  input.parentElement.classList.add("has-toggle");
  setPasswordVisible(input, btn, false);
  btn.addEventListener("click", () => {
    setPasswordVisible(input, btn, input.type === "password");
    input.focus();
  });
});

$$("[data-auth-tab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    const which = tab.dataset.authTab;
    hidePasswords();
    $$("[data-auth-tab]").forEach((t) => t.classList.toggle("active", t === tab));
    $("#login-form").classList.toggle("hidden", which !== "login");
    $("#register-form").classList.toggle("hidden", which !== "register");
    clearErrors($("#login-form"));
    clearErrors($("#register-form"));
  });
});

async function handleAuthSubmit(form, action, errorId) {
  const btn = form.querySelector("button[type=submit]");
  if (btn.disabled) return;               // stop double submits
  btn.disabled = true;
  clearErrors(form);
  try {
    const result = await action();
    if (!result.ok) {
      showError(errorId, result.error, form.querySelector("input"));
      return;
    }
    form.reset();
    showApp(result.username);
    toast(`Welcome, ${result.username}!`);
  } finally {
    btn.disabled = false;
  }
}

$("#login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  handleAuthSubmit(e.target,
    () => Auth.login($("#login-username").value, $("#login-password").value),
    "#login-error");
});

$("#register-form").addEventListener("submit", (e) => {
  e.preventDefault();
  handleAuthSubmit(e.target,
    () => Auth.register($("#reg-username").value, $("#reg-password").value, $("#reg-confirm").value),
    "#register-error");
});

$("#logout-btn").addEventListener("click", () => {
  Auth.logout();
  closeModals();
  showAuth();
  toast("You have been logged out.");
});

/* =====================================================================
   ASSIGNMENT LOGIC
   ===================================================================== */

/* Validates form data. Returns null if OK, or { msg, field } */
function validateAssignment(data, original = null) {
  if (!data.title)    return { msg: "Please enter the assignment name.", field: "title" };
  if (!data.subject)  return { msg: "Please enter the subject.", field: "subject" };
  if (!data.deadline) return { msg: "Please choose a deadline.", field: "deadline" };
  if (!isValidISODate(data.deadline)) return { msg: "That deadline is not a valid date.", field: "deadline" };
  if (!Storage.PRIORITIES.includes(data.priority)) return { msg: "Please choose a priority.", field: "priority" };

  // New deadlines can't be in the past (an existing past date may stay unchanged when editing)
  const dateChanged = !original || original.deadline !== data.deadline;
  if (dateChanged && daysUntil(data.deadline) < 0) {
    return { msg: "The deadline cannot be in the past.", field: "deadline" };
  }
  if (daysUntil(data.deadline) > 365 * MAX_YEARS_AHEAD) {
    return { msg: `Deadline must be within ${MAX_YEARS_AHEAD} years.`, field: "deadline" };
  }

  const duplicate = state.assignments.some((a) =>
    a.id !== (original && original.id) &&
    a.title.toLowerCase() === data.title.toLowerCase() &&
    a.subject.toLowerCase() === data.subject.toLowerCase());
  if (duplicate) return { msg: "This assignment already exists for that subject.", field: "title" };

  return null;
}

function persist() {
  if (!Storage.saveAssignments(state.user, state.assignments)) {
    toast("Could not save. Your browser storage may be full or blocked.", "error");
    return false;
  }
  return true;
}

/* ---------- 1. ADD ---------- */
$("#add-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target;
  clearErrors(form);

  const data = {
    title: cleanText($("#add-title").value),
    subject: cleanText($("#add-subject").value),
    deadline: $("#add-deadline").value,
    priority: form.querySelector("input[name=add-priority]:checked")?.value
  };

  const error = validateAssignment(data);
  if (error) {
    const fieldInput = { title: "#add-title", subject: "#add-subject", deadline: "#add-deadline" }[error.field];
    showError("#add-error", error.msg, fieldInput && $(fieldInput));
    return;
  }

  state.assignments.push({
    id: Storage.newId(),
    ...data,
    completed: false,
    createdAt: new Date().toISOString(),
    completedAt: null
  });
  if (!persist()) { state.assignments.pop(); return; }

  form.reset();                                   // resets priority to Medium
  $("#add-title").focus();
  if (state.filter === "completed") setFilter("upcoming");
  render();
  toast(`"${data.title}" added.`);
});

/* ---------- 2. EDIT ---------- */
function openEdit(id) {
  const a = state.assignments.find((x) => x.id === id);
  if (!a) return;
  const form = $("#edit-form");
  clearErrors(form);
  $("#edit-id").value = a.id;
  $("#edit-title").value = a.title;
  $("#edit-subject").value = a.subject;
  $("#edit-deadline").value = a.deadline;
  form.querySelector(`input[name=edit-priority][value=${a.priority}]`).checked = true;
  $("#edit-modal").classList.remove("hidden");
  $("#edit-title").focus();
}

$("#edit-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target;
  clearErrors(form);

  const original = state.assignments.find((x) => x.id === $("#edit-id").value);
  if (!original) { closeModals(); return; }

  const data = {
    title: cleanText($("#edit-title").value),
    subject: cleanText($("#edit-subject").value),
    deadline: $("#edit-deadline").value,
    priority: form.querySelector("input[name=edit-priority]:checked")?.value
  };

  const error = validateAssignment(data, original);
  if (error) {
    const fieldInput = { title: "#edit-title", subject: "#edit-subject", deadline: "#edit-deadline" }[error.field];
    showError("#edit-error", error.msg, fieldInput && $(fieldInput));
    return;
  }

  const backup = { ...original };
  Object.assign(original, data);
  if (!persist()) { Object.assign(original, backup); return; }

  closeModals();
  render();
  toast("Changes saved.");
});

/* ---------- 2b. DELETE (with confirmation) ---------- */
function openDelete(id) {
  const a = state.assignments.find((x) => x.id === id);
  if (!a) return;
  state.deleteId = id;
  $("#delete-name").textContent = a.title;
  $("#delete-modal").classList.remove("hidden");
}

$("#confirm-delete").addEventListener("click", () => {
  const id = state.deleteId;
  const index = state.assignments.findIndex((x) => x.id === id);
  closeModals();
  if (index === -1) return;

  const [removed] = state.assignments.splice(index, 1);
  if (!persist()) { state.assignments.splice(index, 0, removed); return; }

  // Play the slide-out, then re-render. A timer is used instead of "animationend"
  // because that event never fires when animations are turned off.
  const row = document.querySelector(`.assignment[data-id="${id}"]`);
  if (row) row.classList.add("removing");
  setTimeout(() => { render(); toast(`"${removed.title}" deleted.`); }, row ? 300 : 0);
});

/* ---------- 4. MARK AS COMPLETED (toggle) ---------- */
function toggleComplete(id) {
  const a = state.assignments.find((x) => x.id === id);
  if (!a) return;
  a.completed = !a.completed;
  a.completedAt = a.completed ? new Date().toISOString() : null;
  if (!persist()) { a.completed = !a.completed; return; }
  render();
  toast(a.completed ? `"${a.title}" marked as completed.` : `"${a.title}" moved back to pending.`);
}

/* List buttons use one delegated listener */
$("#assignment-list").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = btn.closest(".assignment").dataset.id;
  if (btn.dataset.action === "toggle") toggleComplete(id);
  if (btn.dataset.action === "edit") openEdit(id);
  if (btn.dataset.action === "delete") openDelete(id);
});

/* ---------- Modals ---------- */
function closeModals() {
  $$(".modal-backdrop").forEach((m) => m.classList.add("hidden"));
  state.deleteId = null;
}
$$("[data-close-modal]").forEach((b) => b.addEventListener("click", closeModals));
$$(".modal-backdrop").forEach((m) => m.addEventListener("click", (e) => { if (e.target === m) closeModals(); }));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModals(); });

/* ---------- 3. VIEW UPCOMING: filters + search ---------- */
function setFilter(filter) {
  state.filter = filter;
  $$("#filter-tabs .tab").forEach((t) => t.classList.toggle("active", t.dataset.filter === filter));
}
$$("#filter-tabs .tab").forEach((tab) => tab.addEventListener("click", () => { setFilter(tab.dataset.filter); render(); }));
$("#search").addEventListener("input", (e) => { state.search = e.target.value.trim().toLowerCase(); render(); });

/* Soonest deadline first, then highest priority */
function byDeadline(a, b) {
  return a.deadline.localeCompare(b.deadline) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
}

function visibleAssignments() {
  let list = [...state.assignments];
  if (state.filter === "upcoming") list = list.filter((a) => !a.completed).sort(byDeadline);
  else if (state.filter === "completed") list = list.filter((a) => a.completed).sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""));
  else list.sort((a, b) => (a.completed - b.completed) || byDeadline(a, b));

  if (state.search) {
    list = list.filter((a) => a.title.toLowerCase().includes(state.search) || a.subject.toLowerCase().includes(state.search));
  }
  return list;
}

/* =====================================================================
   RENDERING
   ===================================================================== */
function rowHTML(a, index) {
  const due = dueText(a);
  const overdue = isOverdue(a);
  const status = a.completed
    ? `<span class="status done"><svg class="icon"><use href="#i-check"/></svg>Done</span>`
    : overdue
      ? `<span class="status overdue"><svg class="icon"><use href="#i-alert"/></svg>Overdue</span>`
      : `<span class="status pending"><svg class="icon"><use href="#i-clock"/></svg>Pending</span>`;

  const toggleBtn = a.completed
    ? `<button class="icon-btn" data-action="toggle" title="Mark as pending" aria-label="Mark as pending"><svg class="icon"><use href="#i-undo"/></svg></button>`
    : `<button class="icon-btn done" data-action="toggle" title="Mark as completed" aria-label="Mark as completed"><svg class="icon"><use href="#i-check"/></svg></button>`;

  return `
    <li class="assignment p-${a.priority} ${a.completed ? "is-done" : ""} ${overdue ? "is-overdue" : ""}"
        data-id="${a.id}" style="animation-delay:${Math.min(index * 40, 400)}ms">
      <div class="a-title">${escapeHTML(a.title)}</div>
      <div><span class="cell-label">Subject</span><span class="a-subject"><svg class="icon"><use href="#i-book"/></svg>${escapeHTML(a.subject)}</span></div>
      <div class="a-deadline"><span class="cell-label">Deadline</span>${formatDate(a.deadline)}<small class="${due.cls}">${due.text}</small></div>
      <div><span class="cell-label">Priority</span><span class="pill ${a.priority}">${capitalise(a.priority)}</span></div>
      <div><span class="cell-label">Status</span>${status}</div>
      <div class="a-actions">
        ${toggleBtn}
        <button class="icon-btn" data-action="edit" title="Edit" aria-label="Edit"><svg class="icon"><use href="#i-edit"/></svg></button>
        <button class="icon-btn delete" data-action="delete" title="Delete" aria-label="Delete"><svg class="icon"><use href="#i-trash"/></svg></button>
      </div>
    </li>`;
}

function render() {
  const all = state.assignments;

  // Stats
  $("#stat-total").textContent = all.length;
  $("#stat-pending").textContent = all.filter((a) => !a.completed).length;
  $("#stat-done").textContent = all.filter((a) => a.completed).length;
  $("#stat-overdue").textContent = all.filter(isOverdue).length;

  // Main list
  const list = visibleAssignments();
  $("#assignment-list").innerHTML = list.map(rowHTML).join("");
  const empty = list.length === 0;
  $("#empty-state").classList.toggle("hidden", !empty);
  $(".table-head").classList.toggle("hidden", empty);
  if (empty) {
    $("#empty-text").textContent =
      state.search ? "No assignments match your search." :
      state.filter === "completed" ? "Nothing completed yet. You've got this!" :
      state.filter === "upcoming" && all.length ? "All caught up - no pending assignments." :
      "No assignments yet. Add your first one!";
  }

  // Next 7 days panel
  const soon = all.filter((a) => !a.completed && daysUntil(a.deadline) >= 0 && daysUntil(a.deadline) <= 7).sort(byDeadline);
  $("#upcoming-list").innerHTML = soon.length
    ? soon.map((a) => {
        const n = daysUntil(a.deadline);
        return `<li class="${n <= 1 ? "urgent" : ""}"><strong>${escapeHTML(a.title)}</strong><small>${dueText(a).text.replace("Due ", "")}</small></li>`;
      }).join("")
    : `<li class="none">Nothing due this week.</li>`;

  // Subject suggestions for the inputs
  const subjects = [...new Set(all.map((a) => a.subject))].sort();
  $("#subject-list").innerHTML = subjects.map((s) => `<option value="${escapeHTML(s)}">`).join("");
}

/* Keep multiple open tabs in sync */
window.addEventListener("storage", () => {
  const user = Auth.currentUser();
  if (!user) { if (state.user) showAuth(); return; }
  if (user !== state.user) showApp(user);
  else { state.assignments = Storage.getAssignments(user); render(); }
});

/* =====================================================================
   START
   ===================================================================== */
const existing = Auth.currentUser();
existing ? showApp(existing) : showAuth();
