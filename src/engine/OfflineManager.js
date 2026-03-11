import { BALANCE }        from "../balance.js";
import InventoryManager  from "../managers/InventoryManager.js";
import CombatEngine      from "../combat/CombatEngine.js";
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
    const MAX_OFFLINE_MS = 24 * 60 * 60 * 1000; // 24-hour cap (before ÷3 divisor)
    const deltaMs = Math.min(MAX_OFFLINE_MS, Math.max(0, now - lastSaveMs));
    const floor   = gameState.progress.currentFloor;

    // ── Offline death check ───────────────────────────────────────
    const avgHeroDmg  = CombatEngine.avgHeroDamage(gameState);
    const avgEnemyDmg = CombatEngine.avgEnemyDamage(floor);

    // ms for hero to kill one enemy vs ms for enemy to kill the hero
    const avgEnemyHp    = CombatEngine.avgEnemyHp(floor);
    const attacksToKill = Math.max(1, Math.ceil(avgEnemyHp / Math.max(1, avgHeroDmg)));
    const msToKillEnemy = attacksToKill * BALANCE.COMBAT_TICK_MS;
    const msToHeroDeath = (Math.max(1, gameState.stats.currentHp) / avgEnemyDmg)
      * BALANCE.ENEMY_ATTACK_TICK_MS;

    let effectiveFloor = floor;
    let diedOffline    = false;

    if (msToHeroDeath < msToKillEnemy) {
      diedOffline                     = true;
      effectiveFloor                  = Math.max(1, floor - 1);
      gameState.progress.currentFloor = effectiveFloor;
      gameState.progress.bossReady    = false;
      gameState._killCount            = 0;
    }

    // Restore HP (hero respawned and kept grinding)
    gameState.stats.currentHp = gameState.stats.maxHp;

    // ── Compute gains at 3× slower offline rate ───────────────────
    const avgEnemyHpEff       = CombatEngine.avgEnemyHp(effectiveFloor);
    const avgHeroDmgEff       = CombatEngine.avgHeroDamage(gameState);
    const attacksPerKill      = Math.max(1, Math.ceil(avgEnemyHpEff / Math.max(1, avgHeroDmgEff)));
    const msPerKillOffline    = attacksPerKill * BALANCE.COMBAT_TICK_MS * BALANCE.OFFLINE_RATE_DIVISOR;
    const kills               = Math.floor(deltaMs / msPerKillOffline);

    const gold = kills * BALANCE.goldReward(effectiveFloor);
    const exp  = kills * BALANCE.expReward(effectiveFloor);

    gameState.currencies.gold += gold;
    gameState.profile.exp     += exp;

    // Boss gate (kill count update)
    const prevCount      = gameState._killCount ?? 0;
    gameState._killCount = prevCount + kills;
    const threshold      = BALANCE.bossKillsNeeded(effectiveFloor);
    if (!gameState.progress.bossReady && gameState._killCount >= threshold) {
      gameState.progress.bossReady = true;
    }

    // ── Offline item drops ────────────────────────────────────────
    const availableSlots = InventoryManager.MAX_INVENTORY - gameState.inventory.length;
    const inventoryFull  = availableSlots <= 0;
    const items          = [];

    if (!inventoryFull && kills > 0) {
      const expected  = kills * BALANCE.DROP_CHANCE;
      const dropCount = Math.min(
        availableSlots,
        Math.floor(expected) + (Math.random() < (expected % 1) ? 1 : 0),
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
