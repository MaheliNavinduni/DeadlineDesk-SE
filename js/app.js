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
   --------------------------------------------------------------------- */
function parseDate(iso) {
  return new Date(iso);
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
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
    el.addEventListener("animationend", () => el.remove());
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
  $("#app-view").classList.add("hidden");
  $("#auth-view").classList.remove("hidden");
  $("#login-username").focus();
}

function showApp(username) {
  state.user = username;
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
$$("[data-auth-tab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    const which = tab.dataset.authTab;
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

/* ---------- 3. VIEW UPCOMING: filters + search ---------- */
function setFilter(filter) {
  state.filter = filter;
  $$("#filter-tabs .tab").forEach((t) => t.classList.toggle("active", t.dataset.filter === filter));
}
$$("#filter-tabs .tab").forEach((tab) => tab.addEventListener("click", () => { setFilter(tab.dataset.filter); render(); }));

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

  return `
    <li class="assignment p-${a.priority} ${a.completed ? "is-done" : ""} ${overdue ? "is-overdue" : ""}"
        data-id="${a.id}" style="animation-delay:${Math.min(index * 40, 400)}ms">
      <div class="a-title">${escapeHTML(a.title)}</div>
      <div><span class="cell-label">Subject</span><span class="a-subject"><svg class="icon"><use href="#i-book"/></svg>${escapeHTML(a.subject)}</span></div>
      <div class="a-deadline"><span class="cell-label">Deadline</span>${formatDate(a.deadline)}<small class="${due.cls}">${due.text}</small></div>
      <div><span class="cell-label">Priority</span><span class="pill ${a.priority}">${capitalise(a.priority)}</span></div>
      <div><span class="cell-label">Status</span>${status}</div>
      <div class="a-actions"></div>
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

/* =====================================================================
   START
   ===================================================================== */
const existing = Auth.currentUser();
existing ? showApp(existing) : showAuth();
