/** Updates the persistent top stats bar. */
const HUD = {
  update(gameState) {
    const p = gameState.profile;
    const s = gameState.stats;
    const c = gameState.currencies;
    const pr = gameState.progress;

    document.getElementById("hud-level").textContent = `LVL ${p.level}`;
    document.getElementById("hud-name").textContent  = p.name;
    document.getElementById("hud-gold").textContent  = `💰 ${c.gold.toLocaleString()}`;
    document.getElementById("hud-floor").textContent = `Floor ${pr.currentFloor}`;

    const hpPct = Math.max(0, (s.currentHp / s.maxHp) * 100);
    document.getElementById("hp-bar-fill").style.width = `${hpPct}%`;
    document.getElementById("hp-label").textContent    = `${s.currentHp}/${s.maxHp}`;
  },
};

export default HUD;
