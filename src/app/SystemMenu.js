/**
 * SystemMenu — shared system menu overlay.
 *
 * init(callbacks)   — bind events once; { onSwitchChar, onLogout }
 * open(fromGame)    — show overlay; hides "Switch Character" when fromGame=false
 * close()
 */

import UIManager from "../ui/UIManager.js";

const SystemMenu = {
  _cb:    null,
  _bound: false,

  init(callbacks) {
    this._cb = callbacks;
    if (!this._bound) {
      this._bindEvents();
      this._bound = true;
    }
  },

  open(fromGame = false) {
    document.getElementById("menu-switch-char").style.display = fromGame ? "" : "none";
    UIManager.showOverlay("system-menu-overlay");
  },

  close() {
    UIManager.hideOverlay("system-menu-overlay");
  },

  _bindEvents() {
    document.getElementById("menu-close").addEventListener("click", () => this.close());

    document.getElementById("system-menu-overlay").addEventListener("click", e => {
      if (e.target === e.currentTarget) this.close();
    });

    document.getElementById("confirm-overlay").addEventListener("click", e => {
      if (e.target === e.currentTarget) UIManager.hideOverlay("confirm-overlay");
    });

    document.getElementById("menu-switch-char").addEventListener("click", () => {
      this.close();
      this._cb?.onSwitchChar?.();
    });

    document.getElementById("menu-logout").addEventListener("click", () => {
      this.close();
      this._cb?.onLogout?.();
    });
  },
};

export default SystemMenu;
