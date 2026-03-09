import { BALANCE }        from "../balance.js";
import InventoryManager  from "../managers/InventoryManager.js";
import { generateItem }  from "../data/items.js";

/** Calculates and applies offline gains based on time away. */
const OfflineManager = {
  /**
   * @param {object} gameState  - live game state (mutated in place)
   * @param {number} lastSaveMs - epoch ms of last save (from Firestore timestamp)
   * @returns {{ gold, exp, kills, items, inventoryFull, deltaMs, diedOffline, floor }}
   */
  applyOfflineGains(gameState, lastSaveMs) {
    const now     = Date.now();
    const deltaMs = Math.max(0, now - lastSaveMs);
    const floor   = gameState.progress.currentFloor;

    // ── Offline death check ───────────────────────────────────────
    // Average hero damage (base + all equipment bonuses via totalStat)
    const totalStr   = InventoryManager.totalStat(gameState, "str");
    const weapDmg    = gameState.equipment?.weapon?.statBonus?.damage ?? 0;
    const avgHeroDmg = BALANCE.BASE_DAMAGE + totalStr * BALANCE.DAMAGE_PER_STR + weapDmg;

    // Average enemy damage per attack tick
    const avgEnemyDmg =
      BALANCE.ENEMY_BASE_DAMAGE * Math.pow(floor, BALANCE.ENEMY_DAMAGE_EXP);

    // ms for hero to kill one enemy / ms for enemy to kill hero
    const msToKillEnemy = (BALANCE.enemyHp(floor) / Math.max(1, avgHeroDmg)) * BALANCE.COMBAT_TICK_MS;
    const msToHeroDeath = (Math.max(1, gameState.stats.currentHp) / avgEnemyDmg) * BALANCE.ENEMY_ATTACK_TICK_MS;

    let effectiveFloor = floor;
    let diedOffline    = false;

    if (msToHeroDeath < msToKillEnemy) {
      // Hero would have died — retreat one floor, respawn at full HP on that floor
      diedOffline = true;
      effectiveFloor = Math.max(1, floor - 1);
      gameState.progress.currentFloor = effectiveFloor;
      gameState.progress.bossReady    = false;
      gameState._killCount            = 0;
    }

    // Restore HP (hero respawned and kept fighting)
    gameState.stats.currentHp = gameState.stats.maxHp;

    // ── Compute gains on the (possibly decremented) floor ─────────
    const kills = Math.floor(deltaMs / BALANCE.COMBAT_TICK_MS);
    const gold  = kills * BALANCE.goldReward(effectiveFloor);
    const exp   = kills * BALANCE.expReward(effectiveFloor);

    gameState.currencies.gold += gold;
    gameState.profile.exp     += exp;

    // Advance kill count and check for boss unlock
    const prevCount        = gameState._killCount ?? 0;
    gameState._killCount   = prevCount + kills;
    const crossedThreshold = Math.floor(gameState._killCount / 10) > Math.floor(prevCount / 10);
    if (crossedThreshold && !gameState.progress.bossReady) {
      gameState.progress.bossReady = true;
    }

    // ── Offline item drops ────────────────────────────────────────
    const availableSlots = InventoryManager.MAX_INVENTORY - gameState.inventory.length;
    const inventoryFull  = availableSlots <= 0;
    const items = [];

    if (!inventoryFull) {
      const expected  = kills * BALANCE.DROP_CHANCE;
      const dropCount = Math.min(
        availableSlots,
        Math.floor(expected) + (Math.random() < (expected % 1) ? 1 : 0)
      );
      for (let i = 0; i < dropCount; i++) {
        const item = generateItem(effectiveFloor);
        gameState.inventory.push(item);
        items.push(item);
      }
    }

    return { gold, exp, kills, items, inventoryFull, deltaMs, diedOffline, floor: effectiveFloor };
  },
};

export default OfflineManager;
