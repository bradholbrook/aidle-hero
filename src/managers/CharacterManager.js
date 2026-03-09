import { BALANCE } from "../balance.js";

/** Class definitions — extend this array to add new classes (Phase 6+) */
const CLASS_DEFINITIONS = {
  barbarian: {
    label: "Barbarian",
    icon: "⚔️",
    baseStats: { str: 12, dex: 4, vit: 8 },
    description: "Raw power and brute strength.",
  },
};

const CharacterManager = {
  /**
   * Build a fresh character save object.
   * @param {string} name   - Hero name
   * @param {string} classId - e.g. "barbarian"
   * @returns {object} New character data
   */
  createCharacter(name, classId = "barbarian") {
    const classDef = CLASS_DEFINITIONS[classId];
    const stats    = { ...classDef.baseStats };
    const maxHp    = BALANCE.BASE_HP + stats.vit * BALANCE.HP_PER_VIT;

    return {
      profile: {
        name,
        class:    classId,
        level:    1,
        exp:      0,
        expToNext: BALANCE.expToNext(1),
        statPoints: 0,
      },
      stats: {
        ...stats,
        maxHp,
        currentHp: maxHp,
      },
      progress: {
        currentFloor: 1,
        maxFloor:     1,
        bossReady:    false,
      },
      currencies: { gold: 0 },
      equipment:  { weapon: null, armor: null, accessory: null },
      inventory:  [],
      settings:   { autoSell: "common" },
      // lastSaveTime set by Firestore serverTimestamp on write
    };
  },

  getClassDefinition(classId) {
    return CLASS_DEFINITIONS[classId] ?? null;
  },
};

export default CharacterManager;
