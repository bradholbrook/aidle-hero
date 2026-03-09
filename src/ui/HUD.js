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
  },
};

export default HUD;
