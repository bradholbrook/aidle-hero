/**
 * GameSession — orchestrates an active play session after a character is loaded.
 *
 * start(session, charId, gameState, { onSwitchChar, onLogout })
 * save()
 * stop()
 */

import CombatEngine    from "../combat/CombatEngine.js";
import InspectView     from "../ui/InspectView.js";
import SystemMenu      from "./SystemMenu.js";
import InventoryManager from "../managers/InventoryManager.js";
import LevelManager    from "../engine/LevelManager.js";
import OfflineManager  from "../engine/OfflineManager.js";
import FirebaseService from "../managers/FirebaseService.js";
import UIManager       from "../ui/UIManager.js";
import HUD             from "../ui/HUD.js";
import BattleView      from "../ui/BattleView.js";
import InventoryView   from "../ui/InventoryView.js";
import EquipView       from "../ui/EquipView.js";
import { BALANCE }     from "../balance.js";

let _session        = null;
let _charId         = null;
let _gs             = null;
let _saveIntervalId = null;
let _globalsBound   = false;

const GameSession = {

  start(session, charId, gameState, { onSwitchChar, onLogout }) {
    _session = session;
    _charId  = charId;
    _gs      = gameState;

    // ── Offline gains ────────────────────────────────────────
    const lastSaveMs = _tsToMs(gameState.lastSaveTime)
      ?? (typeof gameState.lastSaveMs === "number" ? gameState.lastSaveMs : null);
    console.log("[offline] lastSaveTime raw:", gameState.lastSaveTime);
    console.log("[offline] lastSaveMs:", lastSaveMs, "now:", Date.now(), "delta:", lastSaveMs ? Date.now() - lastSaveMs : null);
    let gains = null;
    if (lastSaveMs) {
      gains = OfflineManager.applyOfflineGains(gameState, lastSaveMs);
      console.log("[offline] gains:", gains);
      _applyLevelUps();
    }

    // ── UI setup ─────────────────────────────────────────────
    UIManager.showScreen("main");
    UIManager.showTab("battle");
    BattleView.reset();
    HUD.update(gameState);
    BattleView.setHeroHp(gameState.stats.currentHp, gameState.stats.maxHp);
    InventoryView.init(gameState, _handleBagAction);
    EquipView.init(gameState, _handleEquipAction);

    // ── InspectView ──────────────────────────────────────────
    InspectView.init({
      onEquipped() {
        EquipView.render();
        InventoryView.render();
        HUD.update(_gs);
        GameSession.save();
      },
      onUnequipped() {
        EquipView.render();
        InventoryView.render();
        HUD.update(_gs);
        GameSession.save();
      },
      onSold(gold) {
        InventoryView.render();
        HUD.update(_gs);
        BattleView.log(`Sold for ${gold}g`, "reward");
      },
    });
    InspectView.setGameState(gameState);

    // ── System menu ──────────────────────────────────────────
    SystemMenu.init({
      onSwitchChar: async () => {
        CombatEngine.stop();
        await GameSession.save();
        onSwitchChar();
      },
      onLogout: async () => {
        InspectView.close();
        CombatEngine.stop();
        await GameSession.save();
        onLogout();
      },
    });

    // Replace btn-system-menu to drop any stale listeners from previous session.
    const oldMenuBtn = document.getElementById("btn-system-menu");
    const newMenuBtn = oldMenuBtn.cloneNode(true);
    oldMenuBtn.replaceWith(newMenuBtn);
    newMenuBtn.addEventListener("click", () => SystemMenu.open(true));

    // Replace btn-boss similarly.
    const oldBossBtn = document.getElementById("btn-boss");
    const newBossBtn = oldBossBtn.cloneNode(true);
    oldBossBtn.replaceWith(newBossBtn);
    newBossBtn.addEventListener("click", () => {
      if (_gs?.progress.bossReady) _fightBoss();
    });

    // ── Global save listeners (bind once per page load) ──────
    if (!_globalsBound) {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") GameSession.save();
      });
      window.addEventListener("pagehide", () => GameSession.save());
      _globalsBound = true;
    }

    // ── Autosave ─────────────────────────────────────────────
    if (_saveIntervalId) clearInterval(_saveIntervalId);
    _saveIntervalId = setInterval(() => GameSession.save(), 30_000);

    // ── Start combat (deferred if offline gains to show) ─────
    // Show modal if away > 1 min, regardless of whether kills > 0.
    const showModal = lastSaveMs && gains && (gains.deltaMs > 60_000 || gains.diedOffline);
    console.log("[offline] showModal:", showModal, "deltaMs:", gains?.deltaMs);
    if (showModal) {
      _showOfflineModal(gains, () => _startCombat());
    } else {
      _startCombat();
    }
  },

  async save() {
    if (!_session || !_charId || !_gs) return;
    try {
      await FirebaseService.saveCharacter(_session.userKey, _charId, _gs);
    } catch (e) {
      console.warn("Save failed:", e);
    }
  },

  stop() {
    InspectView.close();
    CombatEngine.stop();
    if (_saveIntervalId) {
      clearInterval(_saveIntervalId);
      _saveIntervalId = null;
    }
    _session = null;
    _charId  = null;
    _gs      = null;
  },
};

// ── Offline modal ─────────────────────────────────────────────────

function _showOfflineModal(gains, onContinue) {
  const totalMins = Math.round(gains.deltaMs / 60_000);
  const hours     = Math.floor(totalMins / 60);
  const mins      = totalMins % 60;
  const timeStr   = hours > 0
    ? `${hours}h ${mins}m`
    : `${mins} minute${mins !== 1 ? "s" : ""}`;

  document.getElementById("offline-time").textContent = `Away for ${timeStr}`;

  const body = document.getElementById("offline-body");
  body.innerHTML = "";

  const row = (label, value) => {
    const el = document.createElement("div");
    el.className = "offline-row";
    el.innerHTML = `<span>${label}</span><span class="offline-row-value">${value}</span>`;
    body.appendChild(el);
  };

  if (gains.diedOffline) {
    const warn = document.createElement("div");
    warn.className = "offline-row-warn";
    warn.textContent = `⚰ Fell while away — retreated to Floor ${gains.floor}`;
    body.appendChild(warn);
  }

  row("Kills", gains.kills.toLocaleString());
  row("Gold", `+${gains.gold.toLocaleString()}g`);
  row("EXP", `+${gains.exp.toLocaleString()}`);

  if (gains.items.length > 0) {
    const tally   = gains.items.reduce((acc, i) => { acc[i.rarity] = (acc[i.rarity] ?? 0) + 1; return acc; }, {});
    const summary = Object.entries(tally).map(([r, n]) => `${n} ${r}`).join(", ");
    row("Items found", summary);
  } else if (gains.inventoryFull) {
    const warn = document.createElement("div");
    warn.className = "offline-row-warn";
    warn.textContent = "Bag was full — no items collected";
    body.appendChild(warn);
  } else {
    row("Items found", "none");
  }

  UIManager.showOverlay("offline-overlay");

  const btn = document.getElementById("btn-offline-continue");
  const fresh = btn.cloneNode(true);
  btn.replaceWith(fresh);
  fresh.addEventListener("click", () => {
    UIManager.hideOverlay("offline-overlay");
    onContinue();
  }, { once: true });
}

// ── Combat setup ─────────────────────────────────────────────────

function _startCombat() {
  CombatEngine.start(_gs, _makeCombatCallbacks());
}

function _fightBoss() {
  _gs.progress.bossReady = false;
  BattleView.setBossReady(false);
  CombatEngine.fightBoss(_gs, _makeCombatCallbacks());
}

function _makeCombatCallbacks() {
  return {
    onEnemySpawned(enemy, label) {
      BattleView.setEnemy(label, enemy.hp, enemy.maxHp);
      BattleView.setBossReady(_gs.progress.bossReady);
      if (enemy.isBoss) {
        BattleView.log(`BOSS FIGHT — ${label} appears!`, "boss");
      }
    },
    onHeroAttack(dmg, enemy) {
      BattleView.log(`You hit ${enemy.icon} ${enemy.name} for ${dmg}`, "dmg");
    },
    onEnemyAttack(dmg, enemy) {
      const label = enemy.isBoss ? `👑 Boss` : `${enemy.icon} ${enemy.name}`;
      BattleView.log(`${label} hits you for ${dmg}`, "enemy-dmg");
    },
    onHeroHpUpdate(hp, maxHp) {
      HUD.update(_gs);
      BattleView.setHeroHp(hp, maxHp);
    },
    onEnemyHpUpdate(hp, maxHp) {
      BattleView.setEnemyHp(hp, maxHp);
    },
    onEnemyKilled(enemy) {
      _onEnemyKilled(enemy);
    },
    onBossDefeated(enemy) {
      _onBossDefeated(enemy);
    },
    onPlayerDied(fromBoss) {
      _onPlayerDied(fromBoss);
    },
  };
}

// ── Kill / death handlers ─────────────────────────────────────────

function _onEnemyKilled(enemy) {
  const floor = _gs.progress.currentFloor;
  const gold  = BALANCE.goldReward(floor);
  const exp   = BALANCE.expReward(floor);

  _gs.currencies.gold += gold;
  _gs.profile.exp     += exp;
  BattleView.log(
    `${enemy.icon} ${enemy.name} defeated! +${gold}g  +${exp}xp`,
    "reward",
  );

  const levelsGained = _applyLevelUps();
  if (levelsGained > 0) {
    BattleView.log(`Level up! Now level ${_gs.profile.level}`, "boss");
    EquipView.render();
  }

  // Item drop
  const dropped = InventoryManager.rollDrop(floor);
  if (dropped) {
    const added = InventoryManager.addToInventory(_gs, dropped);
    if (added) {
      BattleView.log(`${dropped.name} dropped!`, `item-drop-${dropped.rarity}`);
      InventoryView.render();
    } else {
      _gs.currencies.gold += dropped.goldValue;
      BattleView.log(
        `Bag full! ${dropped.name} sold for ${dropped.goldValue}g`,
        "reward",
      );
    }
  }

  // Kill count + boss gate
  _gs._killCount = (_gs._killCount ?? 0) + 1;
  const threshold = BALANCE.bossKillsNeeded(floor);
  if (!_gs.progress.bossReady && _gs._killCount >= threshold) {
    _gs.progress.bossReady = true;
    BattleView.setBossReady(true);
    BattleView.log("Boss unlocked! Tap 'Fight Boss' when ready.", "boss");
  }

  HUD.update(_gs);
  CombatEngine.nextEnemy();
}

function _onBossDefeated(enemy) {
  const floor = _gs.progress.currentFloor;
  const gold  = BALANCE.goldReward(floor) * 2;
  const exp   = BALANCE.expReward(floor) * 2;

  _gs.currencies.gold       += gold;
  _gs.profile.exp           += exp;
  _gs.progress.currentFloor += 1;
  _gs.progress.maxFloor      = Math.max(_gs.progress.maxFloor, _gs.progress.currentFloor);
  _gs.progress.bossReady     = false;
  _gs._killCount             = 0;

  _applyLevelUps();
  HUD.update(_gs);
  EquipView.render();
  BattleView.log(`${enemy.icon} Boss defeated! Floor ${floor} cleared! Advancing...`, "boss");
  BattleView.log(`Floor ${_gs.progress.currentFloor} — +${gold}g +${exp}xp`, "reward");

  GameSession.save();
  _startCombat();
}

function _onPlayerDied(fromBoss) {
  _gs.progress.bossReady = false;
  _gs._killCount         = 0;
  _gs.stats.currentHp    = _gs.stats.maxHp;

  if (fromBoss) {
    // Stay on the same floor — must re-earn the kill count to challenge boss again.
    const floor = _gs.progress.currentFloor;
    HUD.update(_gs);
    BattleView.setHeroHp(_gs.stats.maxHp, _gs.stats.maxHp);
    BattleView.log(`Defeated by the Boss! The floor holds. Earn ${BALANCE.bossKillsNeeded(floor)} kills to challenge again.`, "boss");
  } else {
    // Regular death — retreat one floor.
    const newFloor = Math.max(1, _gs.progress.currentFloor - 1);
    _gs.progress.currentFloor = newFloor;
    HUD.update(_gs);
    BattleView.setHeroHp(_gs.stats.maxHp, _gs.stats.maxHp);
    BattleView.log(`Defeated! Retreating to Floor ${newFloor}.`, "boss");
  }

  GameSession.save();
  _startCombat();
}

// ── Bag / equip callbacks ─────────────────────────────────────────

function _handleBagAction(type, itemOrGold, invIndex) {
  if (type === "inspect") {
    InspectView.open(itemOrGold, invIndex, false, null);
  } else if (type === "auto-sold") {
    HUD.update(_gs);
    if (itemOrGold > 0) BattleView.log(`Sold commons for ${itemOrGold}g`, "reward");
  }
}

function _handleEquipAction(type, item, slot) {
  if (type === "inspect-equipped") {
    InspectView.open(item, null, true, slot);
  } else if (type === "stats-applied") {
    HUD.update(_gs);
    GameSession.save();
  }
}

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Converts a Firestore Timestamp (or plain {seconds,nanoseconds} object) to ms.
 * Returns null if not a recognised timestamp shape.
 */
function _tsToMs(ts) {
  if (!ts) return null;
  if (typeof ts.toMillis === "function") return ts.toMillis();           // Firestore Timestamp class
  if (typeof ts.seconds === "number")   return ts.seconds * 1000;       // plain object fallback
  if (typeof ts === "number")           return ts;                       // already ms
  return null;
}

function _applyLevelUps() {
  const gained = LevelManager.checkLevelUp(_gs);
  if (gained > 0) {
    InventoryManager.recalcStats(_gs);
    _gs.stats.currentHp = _gs.stats.maxHp;
  }
  return gained;
}

export default GameSession;
