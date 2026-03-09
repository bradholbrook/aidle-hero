import { BALANCE } from "../balance.js";

/** Calculates and applies offline gains based on time away. */
const OfflineManager = {
  /**
   * @param {object} gameState     - live game state (mutated in place)
   * @param {number} lastSaveMs    - epoch ms of last save (from Firestore timestamp)
   * @returns {{ gold, exp, kills }} - summary of offline gains
   */
  applyOfflineGains(gameState, lastSaveMs) {
    const now       = Date.now();
    const deltaMs   = Math.max(0, now - lastSaveMs);
    const kills     = Math.floor(deltaMs / BALANCE.COMBAT_TICK_MS);
    const floor     = gameState.progress.currentFloor;

    const gold = kills * BALANCE.goldReward(floor);
    const exp  = kills * BALANCE.expReward(floor);

    gameState.currencies.gold += gold;
    gameState.profile.exp     += exp;

    // Advance kill count and check for boss unlock
    const prevCount = gameState._killCount ?? 0;
    gameState._killCount = prevCount + kills;
    const crossedThreshold = Math.floor(gameState._killCount / 10) > Math.floor(prevCount / 10);
    if (crossedThreshold && !gameState.progress.bossReady) {
      gameState.progress.bossReady = true;
    }

    // Level-ups from offline gains are handled by LevelManager on load.
    return { gold, exp, kills, deltaMs };
  },
};

export default OfflineManager;
