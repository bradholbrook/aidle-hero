import { BALANCE } from "../balance.js";
import { generateItem } from "../data/items.js";

const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary"];

const InventoryManager = {
  MAX_INVENTORY: 50,

  /** Returns a random item drop for the floor, or null if no drop. */
  rollDrop(floor) {
    if (Math.random() > BALANCE.DROP_CHANCE) return null;
    return generateItem(floor);
  },

  /**
   * Adds an item to the inventory.
   * Returns false if inventory is full.
   */
  addToInventory(gameState, item) {
    if (gameState.inventory.length >= this.MAX_INVENTORY) return false;
    gameState.inventory.push(item);
    return true;
  },

  /**
   * Equips item from inventory at invIndex.
   * Previously equipped item in that slot (if any) is moved back to inventory.
   * Calls recalcStats.
   */
  equipItem(gameState, item, invIndex) {
    const slot = item.type; // "weapon" | "armor" | "accessory"
    const old  = gameState.equipment[slot];
    gameState.inventory.splice(invIndex, 1);
    if (old) gameState.inventory.splice(invIndex, 0, old);
    gameState.equipment[slot] = item;
    this.recalcStats(gameState);
  },

  /**
   * Unequips item from slotName, moves it back to inventory.
   * No-op if inventory is full.
   */
  unequipItem(gameState, slotName) {
    const item = gameState.equipment[slotName];
    if (!item) return;
    if (gameState.inventory.length >= this.MAX_INVENTORY) return;
    gameState.inventory.push(item);
    gameState.equipment[slotName] = null;
    this.recalcStats(gameState);
  },

  /**
   * Sells a single item from inventory at invIndex.
   * Returns gold earned.
   */
  sellItem(gameState, invIndex) {
    const [item] = gameState.inventory.splice(invIndex, 1);
    if (!item) return 0;
    gameState.currencies.gold += item.goldValue;
    return item.goldValue;
  },

  /**
   * Sells all items at or below threshold rarity, then sorts remaining best-first.
   * Returns total gold earned.
   */
  autoSell(gameState, threshold = "common") {
    const maxIdx = RARITY_ORDER.indexOf(threshold);
    let gold = 0;
    gameState.inventory = gameState.inventory.filter(item => {
      if (RARITY_ORDER.indexOf(item.rarity) <= maxIdx) {
        gold += item.goldValue;
        return false;
      }
      return true;
    });
    gameState.inventory.sort((a, b) =>
      RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity)
    );
    gameState.currencies.gold += gold;
    return gold;
  },

  /**
   * Recalculates maxHp based on base vit + equipment bonuses.
   * Preserves currentHp proportionally (clamped to new maxHp).
   * Note: gameState.stats.str/dex/vit are BASE values (no equipment).
   */
  recalcStats(gameState) {
    const s = gameState.stats;
    let eqVit = 0, eqMaxHp = 0;
    for (const item of Object.values(gameState.equipment)) {
      if (!item) continue;
      eqVit   += item.statBonus.vit   ?? 0;
      eqMaxHp += item.statBonus.maxHp ?? 0;
    }
    const oldMax  = s.maxHp || 1;
    const newMax  = BALANCE.BASE_HP + (s.vit + eqVit) * BALANCE.HP_PER_VIT + eqMaxHp;
    const hpRatio = s.currentHp / oldMax;
    s.maxHp     = newMax;
    s.currentHp = Math.min(Math.round(hpRatio * newMax), newMax);
  },

  /**
   * Returns the total effective value of a stat (base + all equipment bonuses).
   */
  totalStat(gameState, stat) {
    let total = gameState.stats[stat] ?? 0;
    for (const item of Object.values(gameState.equipment)) {
      if (item) total += item.statBonus[stat] ?? 0;
    }
    return total;
  },
};

export default InventoryManager;
