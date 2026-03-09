/**
 * Enemy definitions.
 * Each entry covers a floor range. The engine picks the matching entry for the current floor.
 * Phase 3: expand with more enemy types per range.
 */
export const ENEMIES = [
  { minFloor: 1,  maxFloor: 5,   id: "slime",    name: "Slime",      icon: "🟢", desc: "A wobbly green slime." },
  { minFloor: 6,  maxFloor: 15,  id: "goblin",   name: "Goblin",     icon: "👺", desc: "Small but scrappy." },
  { minFloor: 16, maxFloor: 30,  id: "orc",      name: "Orc Warrior",icon: "👹", desc: "Heavy-hitting brute." },
  { minFloor: 31, maxFloor: 999, id: "skeleton", name: "Skeleton",   icon: "💀", desc: "Risen from the dead." },
];

/** Returns the enemy definition for a given floor. */
export function getEnemyForFloor(floor) {
  return ENEMIES.find(e => floor >= e.minFloor && floor <= e.maxFloor) ?? ENEMIES[ENEMIES.length - 1];
}
