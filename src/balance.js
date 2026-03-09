/**
 * balance.js — All numeric constants for game tuning.
 * Tweak these values to adjust difficulty curve without touching game logic.
 */
export const BALANCE = {
  // ── Hero ────────────────────────────────────────────────────
  BASE_HP:           100,
  HP_PER_VIT:        10,
  BASE_DAMAGE:       5,
  DAMAGE_PER_STR:    2,

  // ── Combat ──────────────────────────────────────────────────
  COMBAT_TICK_MS:    500,    // how often the foreground loop fires
  BOSS_HP_MULTIPLIER: 8,     // boss HP = normal enemy HP * this

  // ── Enemy Scaling (enemy stats scale per floor) ──────────────
  ENEMY_BASE_HP:     20,
  ENEMY_HP_EXPONENT: 1.15,   // hp = BASE * floor^EXPONENT
  ENEMY_BASE_REWARD_GOLD: 5,
  ENEMY_BASE_REWARD_EXP:  10,
  ENEMY_REWARD_EXPONENT:  1.1,

  // ── Items ────────────────────────────────────────────────────
  ITEM_BASE_POWER:   3,
  ITEM_SCALE_EXP:    1.12,   // item power = BASE * floor^EXPONENT
  DROP_CHANCE:       0.35,   // probability of item drop per kill
  RARITY_WEIGHTS: {          // relative weights — higher = more common
    common:    60,
    uncommon:  25,
    rare:      10,
    epic:       4,
    legendary:  1,
  },

  // ── EXP / Leveling ──────────────────────────────────────────
  EXP_BASE:          100,
  EXP_EXPONENT:      1.2,    // expToNext(lvl) = BASE * lvl^EXPONENT

  /** Returns EXP required to reach the next level. */
  expToNext(level) {
    return Math.floor(this.EXP_BASE * Math.pow(level, this.EXP_EXPONENT));
  },

  /** Returns enemy max HP for a given floor. */
  enemyHp(floor) {
    return Math.floor(this.ENEMY_BASE_HP * Math.pow(floor, this.ENEMY_HP_EXPONENT));
  },

  /** Returns gold reward for a kill on the given floor. */
  goldReward(floor) {
    return Math.floor(this.ENEMY_BASE_REWARD_GOLD * Math.pow(floor, this.ENEMY_REWARD_EXPONENT));
  },

  /** Returns EXP reward for a kill on the given floor. */
  expReward(floor) {
    return Math.floor(this.ENEMY_BASE_REWARD_EXP * Math.pow(floor, this.ENEMY_REWARD_EXPONENT));
  },
};
