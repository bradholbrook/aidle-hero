/**
 * Enemy definitions.
 * Each entry covers a floor range. The engine picks the matching entry for the current floor.
 *
 * hpMult:        multiplier on BALANCE.enemyHp(floor)
 * hpVariance:    ±fraction randomised at spawn  (e.g. 0.2 = ±20%)
 * damageMult:    multiplier on base enemy damage formula
 * attackSpeedMs: ms between enemy attacks (overrides BALANCE.ENEMY_ATTACK_TICK_MS)
 */
export const ENEMIES = [
  { minFloor: 1,  maxFloor: 5,   id: "slime",    name: "Slime",       icon: "🟢",
    hpMult: 0.8, hpVariance: 0.15, damageMult: 0.8,  attackSpeedMs: 1200 },
  { minFloor: 6,  maxFloor: 15,  id: "goblin",   name: "Goblin",      icon: "👺",
    hpMult: 1.0, hpVariance: 0.20, damageMult: 1.0,  attackSpeedMs: 800  },
  { minFloor: 16, maxFloor: 30,  id: "orc",      name: "Orc Warrior", icon: "👹",
    hpMult: 1.3, hpVariance: 0.25, damageMult: 1.2,  attackSpeedMs: 1100 },
  { minFloor: 31, maxFloor: 999, id: "skeleton", name: "Skeleton",    icon: "💀",
    hpMult: 1.1, hpVariance: 0.20, damageMult: 1.1,  attackSpeedMs: 950  },
];

/** Returns the enemy definition for a given floor. */
export function getEnemyForFloor(floor) {
  return ENEMIES.find(e => floor >= e.minFloor && floor <= e.maxFloor) ?? ENEMIES[ENEMIES.length - 1];
}
