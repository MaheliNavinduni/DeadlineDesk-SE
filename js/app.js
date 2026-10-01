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

/* Assignment list comes in the next step */
function render() {}

/* =====================================================================
   START
   ===================================================================== */
const existing = Auth.currentUser();
existing ? showApp(existing) : showAuth();
