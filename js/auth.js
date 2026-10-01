/* =====================================================================
   AUTHENTICATION LOGIC
   Register / login / logout. Passwords are never stored as plain text -
   they are hashed (SHA-256) before saving.
   NOTE: this is a front-end only demo. Real apps must do auth on a server.
   ===================================================================== */

const Auth = (() => {
  const USERNAME_RULE = /^[a-zA-Z0-9_]{3,20}$/;
  const MIN_PASSWORD = 6;

  async function hash(text) {
    // Web Crypto API (available on https, localhost and file://)
    if (window.crypto && crypto.subtle) {
      const bytes = new TextEncoder().encode(text);
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
    }
    // Fallback simple hash if Web Crypto is unavailable
    let h = 0;
    for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
    return "fb" + (h >>> 0).toString(16);
  }

  function findUser(username) {
    const name = username.toLowerCase();
    return Storage.getUsers().find(u => u.username.toLowerCase() === name);
  }

  return {
    /* Returns { ok: true } or { ok: false, error: "message" } */
    async register(username, password, confirm) {
      username = username.trim();

      if (!username || !password || !confirm) return { ok: false, error: "Please fill in all fields." };
      if (!USERNAME_RULE.test(username)) return { ok: false, error: "Username must be 3-20 letters, numbers or _ (no spaces)." };
      if (password.length < MIN_PASSWORD) return { ok: false, error: `Password must be at least ${MIN_PASSWORD} characters.` };
      if (password !== confirm) return { ok: false, error: "Passwords do not match." };
      if (findUser(username)) return { ok: false, error: "That username is already taken." };

      const users = Storage.getUsers();
      users.push({ username, passwordHash: await hash(password), createdAt: new Date().toISOString() });
      if (!Storage.saveUsers(users)) return { ok: false, error: "Could not save account (storage full or blocked)." };

      Storage.setSession(username);
      return { ok: true, username };
    },

    async login(username, password) {
      username = username.trim();
      if (!username || !password) return { ok: false, error: "Please enter your username and password." };

      const user = findUser(username);
      // Same message for both cases so we don't reveal which usernames exist
      if (!user || user.passwordHash !== await hash(password)) {
        return { ok: false, error: "Incorrect username or password." };
      }
      Storage.setSession(user.username);
      return { ok: true, username: user.username };
    },

    logout() {
      Storage.clearSession();
    },

    /* The logged-in user, or null (also handles a deleted/unknown user) */
    currentUser() {
      const name = Storage.getSession();
      if (!name) return null;
      const user = findUser(name);
      if (!user) { Storage.clearSession(); return null; }
      return user.username;
    }
  };
})();
