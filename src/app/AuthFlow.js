/**
 * AuthFlow — sign-in and create-account screens.
 *
 * init(callbacks)   — bind events once; { onSignedIn(session) }
 * show()            — show auth choice screen
 */

import FirebaseService from "../managers/FirebaseService.js";
import UIManager       from "../ui/UIManager.js";

const AuthFlow = {
  _cb:    null,
  _bound: false,

  init(callbacks) {
    this._cb = callbacks;
    if (!this._bound) {
      this._bindEvents();
      this._bound = true;
    }
  },

  show() {
    UIManager.showScreen("auth");
  },

  _bindEvents() {
    // ── Auth choice ──────────────────────────────────────────
    document.getElementById("btn-auth-signin").addEventListener("click", () => {
      document.getElementById("signin-username").value    = "";
      document.getElementById("signin-password").value    = "";
      document.getElementById("signin-error").textContent = "";
      const btn = document.getElementById("btn-signin-submit");
      btn.disabled    = false;
      btn.textContent = "Sign In";
      UIManager.showScreen("sign-in");
    });

    document.getElementById("btn-auth-create").addEventListener("click", () => {
      document.getElementById("create-username").value    = "";
      document.getElementById("create-password").value    = "";
      document.getElementById("create-error").textContent = "";
      const btn = document.getElementById("btn-create-submit");
      btn.disabled    = false;
      btn.textContent = "Create Account";
      UIManager.showScreen("create-account");
    });

    // ── Sign In ──────────────────────────────────────────────
    document.getElementById("btn-signin-back").addEventListener("click", () => {
      UIManager.showScreen("auth");
    });

    document.getElementById("btn-signin-submit").addEventListener("click", async () => {
      const username = document.getElementById("signin-username").value.trim();
      const password = document.getElementById("signin-password").value;
      const errorEl  = document.getElementById("signin-error");
      const btn      = document.getElementById("btn-signin-submit");

      errorEl.textContent = "";
      if (!username || !password) {
        errorEl.textContent = "Please fill in all fields.";
        return;
      }

      btn.disabled    = true;
      btn.textContent = "Signing in...";
      try {
        const session = await FirebaseService.signInWithCredentials(username, password);
        this._cb?.onSignedIn?.(session);
      } catch (e) {
        errorEl.textContent = e.message ?? "Sign in failed. Try again.";
        btn.disabled    = false;
        btn.textContent = "Sign In";
      }
    });

    // ── Create Account ───────────────────────────────────────
    document.getElementById("btn-create-back").addEventListener("click", () => {
      UIManager.showScreen("auth");
    });

    document.getElementById("btn-create-submit").addEventListener("click", async () => {
      const username = document.getElementById("create-username").value.trim();
      const password = document.getElementById("create-password").value;
      const errorEl  = document.getElementById("create-error");
      const btn      = document.getElementById("btn-create-submit");

      errorEl.textContent = "";
      if (!username || !password) {
        errorEl.textContent = "Please fill in all fields.";
        return;
      }

      btn.disabled    = true;
      btn.textContent = "Creating account...";
      try {
        const session = await FirebaseService.createAccount(username, password);
        this._cb?.onSignedIn?.(session);
      } catch (e) {
        errorEl.textContent = e.message ?? "Could not create account. Try again.";
        btn.disabled    = false;
        btn.textContent = "Create Account";
      }
    });
  },
};

export default AuthFlow;
