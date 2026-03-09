/** Manages the battle tab UI. */
const BattleView = {
  _logEl: null,

  init() {
    this._logEl = document.getElementById("battle-log");
  },

  /** Call when loading a character to wipe previous session's state. */
  reset() {
    this._logEl.innerHTML = '<p class="log-entry">Awaiting battle...</p>';
    document.getElementById("enemy-name").textContent    = "";
    document.getElementById("enemy-hp-fill").style.width = "100%";
    document.getElementById("enemy-hp-label").textContent = "";
    this.setBossReady(false);
  },

  setEnemy(name, hp, maxHp) {
    document.getElementById("enemy-name").textContent = name;
    this.setEnemyHp(hp, maxHp);
  },

  setEnemyHp(hp, maxHp) {
    const pct = Math.max(0, (hp / maxHp) * 100);
    document.getElementById("enemy-hp-fill").style.width = `${pct}%`;
    document.getElementById("enemy-hp-label").textContent = `${Math.max(0, hp)}/${maxHp}`;
  },

  setBossReady(ready) {
    const btn = document.getElementById("btn-boss");
    btn.disabled = !ready;
    btn.textContent = ready ? "Fight Boss ⚔️" : "Fight Boss 🔒";
  },

  log(message, type = "") {
    const entry = document.createElement("p");
    entry.className = `log-entry ${type}`;
    entry.textContent = message;
    this._logEl.prepend(entry);

    // Trim log to 50 entries
    while (this._logEl.children.length > 50) {
      this._logEl.removeChild(this._logEl.lastChild);
    }
  },
};

export default BattleView;
