/** Manages the battle tab UI. */

const BattleView = {
  _logEl: null,

  init() {
    this._logEl = document.getElementById("battle-log");
  },

  /** Call when loading a character to wipe previous session's state. */
  reset() {
    this._logEl.innerHTML = '<p class="log-entry">Awaiting battle...</p>';
    document.getElementById("enemy-name").textContent = "";
    const enemyBar = document.getElementById("enemy-hp-bar");
    if (enemyBar) { enemyBar.value = 100; enemyBar.max = 100; }
    document.getElementById("enemy-hp-label").textContent = "";
    const heroBar = document.getElementById("battle-hero-hp-bar");
    if (heroBar) { heroBar.value = 100; heroBar.max = 100; }
    document.getElementById("battle-hero-hp-label").textContent = "";
    this.setBossReady(false);
    this._setHeroAnim(null);
  },

  setEnemy(name, hp, maxHp) {
    document.getElementById("enemy-name").textContent = name;
    this.setEnemyHp(hp, maxHp);
    this._setHeroAnim('run');
  },

  setEnemyHp(hp, maxHp) {
    const bar = document.getElementById("enemy-hp-bar");
    if (bar) { bar.value = Math.max(0, Math.round(hp)); bar.max = maxHp; }
    document.getElementById("enemy-hp-label").textContent = `${Math.max(0, hp)}/${maxHp}`;
  },

  setHeroHp(hp, maxHp) {
    const bar = document.getElementById("battle-hero-hp-bar");
    if (bar) { bar.value = Math.max(0, Math.round(hp)); bar.max = maxHp; }
    document.getElementById("battle-hero-hp-label").textContent = `${Math.max(0, hp)}/${maxHp}`;
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

  // ── Hero sprite animation ─────────────────────────────────

  _setHeroAnim(name) {
    const sprite = document.getElementById("hero-sprite");
    if (!sprite) return;
    sprite.classList.remove('anim-idle', 'anim-run');
    if (name) sprite.classList.add(`anim-${name}`);
  },
};

export default BattleView;
