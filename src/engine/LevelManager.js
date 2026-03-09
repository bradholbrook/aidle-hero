import { BALANCE } from "../balance.js";

/** Handles EXP thresholds and level-up stat bonuses. */
const LevelManager = {
  STAT_BONUS_PER_LEVEL: { str: 1, dex: 0, vit: 1 },
  STAT_POINTS_PER_LEVEL: 2,

  /**
   * Checks if the character has enough EXP to level up (repeatedly).
   * Mutates gameState.profile and gameState.stats in place.
   * @returns {number} levels gained
   */
  checkLevelUp(gameState) {
    let levelsGained = 0;
    const p = gameState.profile;
    const s = gameState.stats;

    while (p.exp >= p.expToNext) {
      p.exp       -= p.expToNext;
      p.level     += 1;
      p.expToNext  = BALANCE.expToNext(p.level);
      p.statPoints = (p.statPoints ?? 0) + this.STAT_POINTS_PER_LEVEL;

      // Auto stat bonuses per level (base stats only; caller must recalcStats for HP)
      for (const [stat, bonus] of Object.entries(this.STAT_BONUS_PER_LEVEL)) {
        if (bonus) s[stat] = (s[stat] ?? 0) + bonus;
      }

      levelsGained++;
    }
    return levelsGained;
  },
};

export default LevelManager;
