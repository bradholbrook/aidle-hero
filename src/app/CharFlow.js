/**
 * CharFlow — character select and character create screens.
 *
 * init(session, callbacks)   — update session ref, bind events once;
 *                              callbacks: { onCharSelected(gameState, charId), onBack() }
 * show()                     — render char list and show char-select screen
 */

import FirebaseService  from "../managers/FirebaseService.js";
import CharacterManager from "../managers/CharacterManager.js";
import UIManager        from "../ui/UIManager.js";
import SystemMenu       from "./SystemMenu.js";

const CharFlow = {
  _session: null,
  _cb:      null,
  _bound:   false,

  /**
   * callbacks: { onCharSelected(gameState, charId), onLogout(), onDeleteAccount() }
   */
  init(session, callbacks) {
    this._session = session;
    this._cb      = callbacks;
    if (!this._bound) {
      this._bindEvents();
      this._bound = true;
    }
  },

  show() {
    // Re-init SystemMenu with char-select–appropriate callbacks each time we land here.
    // (GameSession.start overwrites these with full in-game callbacks when a char is loaded.)
    SystemMenu.init({
      onLogout:        () => this._cb?.onLogout?.(),
      onDeleteAccount: () => this._cb?.onDeleteAccount?.(),
    });
    UIManager.showScreen("char-select");
    document.getElementById("char-select-user").textContent = this._session.displayName;
    this._renderList();
  },

  // ── Internals ───────────────────────────────────────────────

  async _renderList() {
    const listEl = document.getElementById("char-list");
    listEl.innerHTML = '<p style="color:var(--text-dim);text-align:center">Loading...</p>';

    const characters = await FirebaseService.listCharacters(this._session.userKey);

    if (characters.length === 0) {
      listEl.innerHTML =
        '<p style="color:var(--text-dim);text-align:center;padding:20px 0">No heroes yet. Create one!</p>';
      return;
    }

    listEl.innerHTML = "";
    characters.forEach(char => {
      const card = document.createElement("div");
      card.className = "char-card";
      card.innerHTML = `
        <div class="char-card-icon">⚔️</div>
        <div class="char-card-info">
          <div class="char-card-name">${_esc(char.profile?.name ?? "Unknown")}</div>
          <div class="char-card-meta">
            ${_cap(char.profile?.class ?? "?")} · Lv${char.profile?.level ?? 1} · Floor ${char.progress?.currentFloor ?? 1}
          </div>
        </div>
        <div class="char-card-actions">
          <button class="btn-play">Play</button>
          <button class="btn-delete">🗑</button>
        </div>
      `;

      card.querySelector(".btn-play").addEventListener("click", () => {
        this._cb?.onCharSelected?.(char, char.id);
      });

      card.querySelector(".btn-delete").addEventListener("click", e => {
        e.stopPropagation();
        UIManager.confirm(
          `Delete "${char.profile?.name}"? This cannot be undone.`,
          async () => {
            try {
              await FirebaseService.deleteCharacter(
                this._session.userKey, char.id, char.profile?.name,
              );
              this._renderList();
            } catch (err) {
              const listEl = document.getElementById("char-list");
              listEl.insertAdjacentHTML(
                "afterbegin",
                `<p style="color:var(--danger);padding:8px 0">Delete failed: ${err.message ?? "check Firestore rules"}</p>`,
              );
            }
          },
        );
      });

      listEl.appendChild(card);
    });
  },

  _bindEvents() {
    // Early system menu (no "switch char" option)
    document.querySelector(".btn-menu-early").addEventListener("click", () => {
      SystemMenu.open(false);
    });

    // New character button
    document.getElementById("btn-new-char").addEventListener("click", () => {
      document.getElementById("hero-name").value              = "";
      document.getElementById("char-create-error").textContent = "";
      const btn = document.getElementById("btn-create-char");
      btn.disabled    = false;
      btn.textContent = "Begin Adventure";
      UIManager.showScreen("char-create");
    });

    // Back from char create
    document.getElementById("btn-char-create-back").addEventListener("click", () => {
      UIManager.showScreen("char-select");
    });

    // Create character submit
    document.getElementById("btn-create-char").addEventListener("click", async () => {
      const name    = document.getElementById("hero-name").value.trim();
      const errorEl = document.getElementById("char-create-error");
      const btn     = document.getElementById("btn-create-char");

      errorEl.textContent = "";
      if (!name) {
        document.getElementById("hero-name").focus();
        return;
      }
      if (!/^[a-zA-Z0-9 -]{3,20}$/.test(name)) {
        errorEl.textContent = "3–20 characters. Letters, numbers, spaces, and dashes only.";
        return;
      }

      btn.disabled    = true;
      btn.textContent = "Creating...";

      try {
        const charId    = `char_${Date.now()}`;
        await FirebaseService.reserveCharName(name, this._session.userKey, charId);
        const gameState = CharacterManager.createCharacter(name, "barbarian");
        await FirebaseService.saveCharacter(this._session.userKey, charId, gameState);
        this._cb?.onCharSelected?.(gameState, charId);
      } catch (e) {
        errorEl.textContent = e.message ?? "Failed to create character. Try again.";
        btn.disabled    = false;
        btn.textContent = "Begin Adventure";
        console.error(e);
      }
    });
  },
};

function _esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function _cap(str) {
  return str ? str[0].toUpperCase() + str.slice(1) : str;
}

export default CharFlow;
