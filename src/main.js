/**
 * main.js — Bootstrap
 *
 * Auth flow:
 *   Splash → (boot) → session found? → Char Select
 *                   → no session    → Auth Choice → (Sign In | Create Account) → Char Select
 *
 * "session" is our own session object (not a Firebase user):
 *   Named:  { type:"account", username, userKey, displayName }
 */

import FirebaseService   from "./managers/FirebaseService.js";
import CharacterManager  from "./managers/CharacterManager.js";
import InventoryManager  from "./managers/InventoryManager.js";
import LevelManager      from "./engine/LevelManager.js";
import OfflineManager    from "./engine/OfflineManager.js";
import UIManager         from "./ui/UIManager.js";
import HUD               from "./ui/HUD.js";
import BattleView        from "./ui/BattleView.js";
import InventoryView     from "./ui/InventoryView.js";
import EquipView         from "./ui/EquipView.js";
import { BALANCE }       from "./balance.js";
import { getEnemyForFloor } from "./data/enemies.js";
import { RARITY_COLORS } from "./data/items.js";

// ── Shared state ───────────────────────────────────────────────
let session     = null;   // our custom session object
let gameState   = null;
let characterId = null;
let combat = { enemy: null, interval: null, enemyInterval: null, regenInterval: null };

// Inspect overlay state
let inspectState = null; // { item, invIndex, isEquipped, slot }

// ══════════════════════════════════════════════════════════════
// BOOTSTRAP
// ══════════════════════════════════════════════════════════════
UIManager.bindTabs();
BattleView.init();

FirebaseService.boot().then(({ session: saved }) => {
  if (saved) {
    session = saved;
    showCharSelect();
  } else {
    UIManager.showScreen("auth");
  }
}).catch(err => {
  const splashBtn = document.getElementById("btn-start");
  splashBtn.disabled    = false;
  splashBtn.textContent = "Connection failed — tap to retry";
  splashBtn.addEventListener("click", () => location.reload(), { once: true });
  console.error("Boot failed:", err);
});

// ══════════════════════════════════════════════════════════════
// AUTH CHOICE SCREEN
// ══════════════════════════════════════════════════════════════
document.getElementById("btn-auth-signin").addEventListener("click", () => {
  document.getElementById("signin-username").value  = "";
  document.getElementById("signin-password").value  = "";
  document.getElementById("signin-error").textContent = "";
  const btn = document.getElementById("btn-signin-submit");
  btn.disabled = false; btn.textContent = "Sign In";
  UIManager.showScreen("sign-in");
});

document.getElementById("btn-auth-create").addEventListener("click", () => {
  document.getElementById("create-username").value  = "";
  document.getElementById("create-password").value  = "";
  document.getElementById("create-error").textContent = "";
  const btn = document.getElementById("btn-create-submit");
  btn.disabled = false; btn.textContent = "Create Account";
  UIManager.showScreen("create-account");
});

// ══════════════════════════════════════════════════════════════
// SIGN IN SCREEN
// ══════════════════════════════════════════════════════════════
document.getElementById("btn-signin-back").addEventListener("click", () => {
  UIManager.showScreen("auth");
});

document.getElementById("btn-signin-submit").addEventListener("click", async () => {
  const username = document.getElementById("signin-username").value.trim();
  const password = document.getElementById("signin-password").value;
  const errorEl  = document.getElementById("signin-error");
  const btn      = document.getElementById("btn-signin-submit");

  errorEl.textContent = "";
  if (!username || !password) { errorEl.textContent = "Please fill in all fields."; return; }

  btn.disabled    = true;
  btn.textContent = "Signing in...";
  try {
    session = await FirebaseService.signInWithCredentials(username, password);
    showCharSelect();
  } catch (e) {
    errorEl.textContent = e.message ?? "Sign in failed. Try again.";
    btn.disabled    = false;
    btn.textContent = "Sign In";
  }
});

// ══════════════════════════════════════════════════════════════
// CREATE ACCOUNT SCREEN
// ══════════════════════════════════════════════════════════════
document.getElementById("btn-create-back").addEventListener("click", () => {
  UIManager.showScreen("auth");
});

document.getElementById("btn-create-submit").addEventListener("click", async () => {
  const username = document.getElementById("create-username").value.trim();
  const password = document.getElementById("create-password").value;
  const errorEl  = document.getElementById("create-error");
  const btn      = document.getElementById("btn-create-submit");

  errorEl.textContent = "";
  if (!username || !password) { errorEl.textContent = "Please fill in all fields."; return; }

  btn.disabled    = true;
  btn.textContent = "Creating account...";
  try {
    session = await FirebaseService.createAccount(username, password);
    showCharSelect();
  } catch (e) {
    errorEl.textContent = e.message ?? "Could not create account. Try again.";
    btn.disabled    = false;
    btn.textContent = "Create Account";
  }
});

// ══════════════════════════════════════════════════════════════
// CHARACTER SELECT SCREEN
// ══════════════════════════════════════════════════════════════
async function showCharSelect() {
  stopCombat();
  gameState    = null;
  characterId  = null;
  inspectState = null;
  UIManager.hideOverlay("inspect-overlay");

  UIManager.showScreen("char-select");
  document.getElementById("char-select-user").textContent = session.displayName;

  await renderCharList();
}

async function renderCharList() {
  const listEl = document.getElementById("char-list");
  listEl.innerHTML = '<p style="color:var(--text-dim);text-align:center">Loading...</p>';

  const characters = await FirebaseService.listCharacters(session.userKey);

  if (characters.length === 0) {
    listEl.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:20px 0">No heroes yet. Create one!</p>';
    return;
  }

  listEl.innerHTML = "";
  characters.forEach(char => {
    const card = document.createElement("div");
    card.className = "char-card";
    card.innerHTML = `
      <div class="char-card-icon">⚔️</div>
      <div class="char-card-info">
        <div class="char-card-name">${escapeHtml(char.profile?.name ?? "Unknown")}</div>
        <div class="char-card-meta">
          ${capitalize(char.profile?.class ?? "?")} · Lv${char.profile?.level ?? 1} · Floor ${char.progress?.currentFloor ?? 1}
        </div>
      </div>
      <div class="char-card-actions">
        <button class="btn-play">Play</button>
        <button class="btn-delete">🗑</button>
      </div>
    `;

    card.querySelector(".btn-play").addEventListener("click", () => {
      characterId = char.id;
      gameState   = char;
      startGame();
    });

    card.querySelector(".btn-delete").addEventListener("click", e => {
      e.stopPropagation();
      UIManager.confirm(
        `Delete "${char.profile?.name}"? This cannot be undone.`,
        async () => {
          await FirebaseService.deleteCharacter(session.userKey, char.id, char.profile?.name);
          renderCharList();
        }
      );
    });

    listEl.appendChild(card);
  });
}

document.getElementById("btn-new-char").addEventListener("click", () => {
  document.getElementById("hero-name").value       = "";
  document.getElementById("char-create-error").textContent = "";
  const btn = document.getElementById("btn-create-char");
  btn.disabled    = false;
  btn.textContent = "Begin Adventure";
  UIManager.showScreen("char-create");
});

// ══════════════════════════════════════════════════════════════
// CHARACTER CREATE SCREEN
// ══════════════════════════════════════════════════════════════
document.getElementById("btn-char-create-back").addEventListener("click", () => {
  UIManager.showScreen("char-select");
});

document.getElementById("btn-create-char").addEventListener("click", async () => {
  const name    = document.getElementById("hero-name").value.trim();
  const errorEl = document.getElementById("char-create-error");
  const btn     = document.getElementById("btn-create-char");

  errorEl.textContent = "";
  if (!name) { document.getElementById("hero-name").focus(); return; }
  if (!/^[a-zA-Z0-9 -]{3,20}$/.test(name)) {
    errorEl.textContent = "3–20 characters. Letters, numbers, spaces, and dashes only.";
    return;
  }

  btn.disabled    = true;
  btn.textContent = "Creating...";

  try {
    characterId = `char_${Date.now()}`;
    await FirebaseService.reserveCharName(name, session.userKey, characterId);
    gameState = CharacterManager.createCharacter(name, "barbarian");
    await FirebaseService.saveCharacter(session.userKey, characterId, gameState);
    startGame();
  } catch (e) {
    errorEl.textContent = e.message ?? "Failed to create character. Try again.";
    btn.disabled    = false;
    btn.textContent = "Begin Adventure";
    console.error(e);
  }
});

// ══════════════════════════════════════════════════════════════
// SYSTEM MENU
// ══════════════════════════════════════════════════════════════
function openSystemMenu(fromGame = false) {
  document.getElementById("menu-switch-char").style.display = fromGame ? "" : "none";
  UIManager.showOverlay("system-menu-overlay");
}

document.getElementById("btn-system-menu").addEventListener("click", () => {
  openSystemMenu(true);
});

document.querySelector(".btn-menu-early").addEventListener("click", () => {
  openSystemMenu(false);
});

document.getElementById("menu-close").addEventListener("click", () => {
  UIManager.hideOverlay("system-menu-overlay");
});

document.getElementById("menu-switch-char").addEventListener("click", async () => {
  UIManager.hideOverlay("system-menu-overlay");
  stopCombat();
  await saveGame();
  showCharSelect();
});

document.getElementById("menu-logout").addEventListener("click", async () => {
  UIManager.hideOverlay("system-menu-overlay");
  UIManager.hideOverlay("inspect-overlay");
  stopCombat();
  await saveGame();
  FirebaseService.signOut();
  session      = null;
  gameState    = null;
  characterId  = null;
  inspectState = null;
  UIManager.showScreen("auth");
});

document.getElementById("system-menu-overlay").addEventListener("click", e => {
  if (e.target === e.currentTarget) UIManager.hideOverlay("system-menu-overlay");
});
document.getElementById("confirm-overlay").addEventListener("click", e => {
  if (e.target === e.currentTarget) UIManager.hideOverlay("confirm-overlay");
});

// ══════════════════════════════════════════════════════════════
// ITEM INSPECT OVERLAY
// ══════════════════════════════════════════════════════════════
function openInspect(item, invIndex, isEquipped, slot) {
  inspectState = { item, invIndex, isEquipped, slot };

  document.getElementById("inspect-icon").textContent = item.icon;
  const nameEl = document.getElementById("inspect-name");
  nameEl.textContent  = item.name;
  nameEl.style.color  = RARITY_COLORS[item.rarity] ?? "#888";
  document.getElementById("inspect-meta").textContent =
    `${capitalize(item.type)} · Floor ${item.floor} · ${capitalize(item.rarity)}`;

  // Stats with comparison vs currently equipped item
  const statsEl       = document.getElementById("inspect-stats");
  statsEl.innerHTML   = "";
  const currentEquipped = isEquipped ? null : gameState.equipment[item.type];

  const STAT_LABELS = { damage: "Damage", str: "Strength", dex: "Dexterity",
                        vit: "Vitality", maxHp: "Bonus HP" };

  for (const [stat, val] of Object.entries(item.statBonus)) {
    const row = document.createElement("div");
    row.className = "inspect-stat-row";
    const eqVal = currentEquipped?.statBonus?.[stat] ?? 0;
    const diff  = val - eqVal;
    let diffHtml = "";
    if (currentEquipped !== null && !isEquipped) {
      const cls = diff > 0 ? "diff-up" : diff < 0 ? "diff-down" : "diff-same";
      const sign = diff > 0 ? "+" : "";
      diffHtml = `<span class="inspect-stat-diff ${cls}">${sign}${diff}</span>`;
    }
    row.innerHTML = `
      <span class="inspect-stat-name">${STAT_LABELS[stat] ?? stat}</span>
      <span class="inspect-stat-val">${val}${diffHtml}</span>
    `;
    statsEl.appendChild(row);
  }

  const primaryBtn = document.getElementById("btn-inspect-primary");
  const sellBtn    = document.getElementById("btn-inspect-sell");

  if (isEquipped) {
    primaryBtn.textContent  = "Unequip";
    sellBtn.style.display   = "none";
  } else {
    primaryBtn.textContent  = "Equip";
    sellBtn.style.display   = "";
    sellBtn.textContent     = `Sell for ${item.goldValue}g`;
  }

  UIManager.showOverlay("inspect-overlay");
}

document.getElementById("btn-inspect-primary").addEventListener("click", () => {
  if (!inspectState || !gameState) return;
  const { item, invIndex, isEquipped, slot } = inspectState;
  if (isEquipped) {
    if (gameState.inventory.length >= InventoryManager.MAX_INVENTORY) {
      // Show inline error; don't close overlay
      const metaEl = document.getElementById("inspect-meta");
      metaEl.textContent = "⚠️ Bag is full — sell something first";
      metaEl.style.color  = "var(--danger)";
      return;
    }
    InventoryManager.unequipItem(gameState, slot);
  } else {
    InventoryManager.equipItem(gameState, item, invIndex);
  }
  UIManager.hideOverlay("inspect-overlay");
  inspectState = null;
  EquipView.render();
  InventoryView.render();
  HUD.update(gameState);
  saveGame();
});

document.getElementById("btn-inspect-sell").addEventListener("click", () => {
  if (!inspectState || !gameState || inspectState.isEquipped) return;
  const gold = InventoryManager.sellItem(gameState, inspectState.invIndex);
  UIManager.hideOverlay("inspect-overlay");
  inspectState = null;
  InventoryView.render();
  HUD.update(gameState);
  BattleView.log(`💰 Sold for ${gold}g`, "reward");
});

document.getElementById("btn-inspect-close").addEventListener("click", () => {
  UIManager.hideOverlay("inspect-overlay");
  inspectState = null;
});

document.getElementById("inspect-overlay").addEventListener("click", e => {
  if (e.target === e.currentTarget) {
    UIManager.hideOverlay("inspect-overlay");
    inspectState = null;
  }
});

// ══════════════════════════════════════════════════════════════
// GAME START
// ══════════════════════════════════════════════════════════════
function startGame() {
  const lastSaveMs = gameState.lastSaveTime?.toMillis?.();
  let gains = null;
  if (lastSaveMs) {
    gains = OfflineManager.applyOfflineGains(gameState, lastSaveMs);
    applyLevelUps(); // OfflineManager already restores HP; recalcStats still needed for equipment
  }

  UIManager.showScreen("main");
  UIManager.showTab("battle");
  BattleView.reset();
  HUD.update(gameState);
  BattleView.setHeroHp(gameState.stats.currentHp, gameState.stats.maxHp);
  InventoryView.init(gameState, handleBagAction);
  EquipView.init(gameState, handleEquipAction);

  spawnEnemy();
  startCombatLoop();
  setupBossButton();

  if (lastSaveMs && gains) {
    if (gains.diedOffline) {
      BattleView.log(
        `💀 You fell in battle while away and retreated to Floor ${gains.floor}`,
        "boss"
      );
    }
    if (gains.kills > 0) {
      const mins = Math.round(gains.deltaMs / 60_000);
      BattleView.log(
        `💤 Away for ${mins}m — earned ${gains.gold}g + ${gains.exp}xp (${gains.kills} kills)`,
        "reward"
      );
      if (gains.inventoryFull) {
        BattleView.log("🎒 Bag was full — no items collected while away", "");
      } else if (gains.items.length > 0) {
        const tally = gains.items.reduce((acc, item) => {
          acc[item.rarity] = (acc[item.rarity] ?? 0) + 1;
          return acc;
        }, {});
        const summary = Object.entries(tally)
          .map(([r, n]) => `${n} ${r}`)
          .join(", ");
        BattleView.log(`🎒 Found ${gains.items.length} item(s) while away: ${summary}`, "reward");
      }
    }
  }

  setInterval(saveGame, 30_000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveGame();
  });
  window.addEventListener("pagehide", saveGame);
}

// ── Level-up helper (recalcStats + full heal, since LevelManager only touches base stats) ──
function applyLevelUps() {
  const gained = LevelManager.checkLevelUp(gameState);
  if (gained > 0) {
    InventoryManager.recalcStats(gameState); // accounts for equipped armor HP bonus
    gameState.stats.currentHp = gameState.stats.maxHp;
  }
  return gained;
}

// ── Callbacks for child views ──────────────────────────────────
function handleBagAction(type, itemOrGold, invIndex) {
  if (type === "inspect") {
    openInspect(itemOrGold, invIndex, false, null);
  } else if (type === "auto-sold") {
    HUD.update(gameState);
    if (itemOrGold > 0) BattleView.log(`💰 Sold commons for ${itemOrGold}g`, "reward");
  }
}

function handleEquipAction(type, item, slot) {
  if (type === "inspect-equipped") {
    openInspect(item, null, true, slot);
  } else if (type === "stats-applied") {
    HUD.update(gameState);
    saveGame();
  }
}

// ══════════════════════════════════════════════════════════════
// COMBAT
// ══════════════════════════════════════════════════════════════

/** Randomised hero damage for one attack. */
function heroDamage() {
  const totalStr = InventoryManager.totalStat(gameState, "str");
  const weapDmg  = gameState.equipment?.weapon?.statBonus?.damage ?? 0;
  const base     = BALANCE.BASE_DAMAGE + totalStr * BALANCE.DAMAGE_PER_STR + weapDmg;
  const v        = BALANCE.HERO_DAMAGE_VARIANCE;
  return Math.max(1, Math.round(base * (1 - v + Math.random() * v * 2)));
}

function spawnEnemy() {
  const floor  = gameState.progress.currentFloor;
  const def    = getEnemyForFloor(floor);
  const maxHp  = BALANCE.enemyHp(floor);
  combat.enemy = { ...def, hp: maxHp, maxHp };
  BattleView.setEnemy(`${def.icon} ${def.name}`, maxHp, maxHp);
  BattleView.setBossReady(gameState.progress.bossReady);
}

function startCombatLoop() {
  clearInterval(combat.interval);
  clearInterval(combat.enemyInterval);
  clearInterval(combat.regenInterval);

  // Hero attacks
  combat.interval = setInterval(combatTick, BALANCE.COMBAT_TICK_MS);

  // Enemy attacks
  combat.enemyInterval = setInterval(() => {
    if (!combat.enemy || !gameState) return;
    const dmg = BALANCE.enemyDamage(gameState.progress.currentFloor);
    gameState.stats.currentHp = Math.max(0, gameState.stats.currentHp - dmg);
    BattleView.log(
      `${combat.enemy.icon} ${combat.enemy.name} hits you for ${dmg}`,
      "enemy-dmg"
    );
    HUD.update(gameState);
    BattleView.setHeroHp(gameState.stats.currentHp, gameState.stats.maxHp);
    if (gameState.stats.currentHp <= 0) onPlayerDeath();
  }, BALANCE.ENEMY_ATTACK_TICK_MS);

  // Health regen
  combat.regenInterval = setInterval(() => {
    if (!gameState) return;
    if (gameState.stats.currentHp >= gameState.stats.maxHp) return;
    const regen = Math.max(1, Math.round(gameState.stats.maxHp * BALANCE.HP_REGEN_PCT));
    gameState.stats.currentHp = Math.min(gameState.stats.maxHp, gameState.stats.currentHp + regen);
    HUD.update(gameState);
    BattleView.setHeroHp(gameState.stats.currentHp, gameState.stats.maxHp);
  }, BALANCE.HP_REGEN_TICK_MS);
}

function stopCombat() {
  clearInterval(combat.interval);
  clearInterval(combat.enemyInterval);
  clearInterval(combat.regenInterval);
  combat.interval      = null;
  combat.enemyInterval = null;
  combat.regenInterval = null;
  combat.enemy         = null;
}

function combatTick() {
  if (!combat.enemy) return;
  const dmg = heroDamage();
  combat.enemy.hp -= dmg;
  BattleView.log(`You hit ${combat.enemy.icon} ${combat.enemy.name} for ${dmg}`, "dmg");
  BattleView.setEnemyHp(combat.enemy.hp, combat.enemy.maxHp);
  if (combat.enemy.hp <= 0) onEnemyKilled();
}

function onEnemyKilled() {
  const floor = gameState.progress.currentFloor;
  const gold  = BALANCE.goldReward(floor);
  const exp   = BALANCE.expReward(floor);

  gameState.currencies.gold += gold;
  gameState.profile.exp     += exp;
  BattleView.log(`${combat.enemy.icon} ${combat.enemy.name} defeated! +${gold}g  +${exp}xp`, "reward");

  const levelsGained = applyLevelUps();
  if (levelsGained > 0) {
    BattleView.log(`⬆️ Level up! Now level ${gameState.profile.level}`, "boss");
    EquipView.render();
  }

  // Item drop
  const dropped = InventoryManager.rollDrop(floor);
  if (dropped) {
    const added = InventoryManager.addToInventory(gameState, dropped);
    if (added) {
      BattleView.log(`🎁 ${dropped.name} dropped!`, `item-drop-${dropped.rarity}`);
      InventoryView.render();
    } else {
      // Inventory full — auto-sell the drop
      gameState.currencies.gold += dropped.goldValue;
      BattleView.log(`💰 Bag full! ${dropped.name} sold for ${dropped.goldValue}g`, "reward");
    }
  }

  gameState._killCount = (gameState._killCount ?? 0) + 1;
  if (!gameState.progress.bossReady && gameState._killCount % 10 === 0) {
    gameState.progress.bossReady = true;
    BattleView.setBossReady(true);
    BattleView.log("🔔 Boss unlocked! Tap 'Fight Boss' when ready.", "boss");
  }

  HUD.update(gameState);
  spawnEnemy();
}

function onPlayerDeath() {
  stopCombat();
  const prevFloor = gameState.progress.currentFloor;
  const newFloor  = Math.max(1, prevFloor - 1);
  gameState.progress.currentFloor = newFloor;
  gameState.progress.bossReady    = false;
  gameState._killCount            = 0;
  gameState.stats.currentHp       = gameState.stats.maxHp;
  HUD.update(gameState);
  BattleView.setHeroHp(gameState.stats.maxHp, gameState.stats.maxHp);
  BattleView.log(`💀 Defeated! Retreating to Floor ${newFloor}`, "boss");
  saveGame();
  spawnEnemy();
  startCombatLoop();
}

// ══════════════════════════════════════════════════════════════
// BOSS
// ══════════════════════════════════════════════════════════════
function setupBossButton() {
  const old = document.getElementById("btn-boss");
  const btn  = old.cloneNode(true);
  old.replaceWith(btn);
  btn.addEventListener("click", () => {
    if (gameState?.progress.bossReady) fightBoss();
  });
}

function fightBoss() {
  clearInterval(combat.interval);
  clearInterval(combat.enemyInterval);
  combat.interval      = null;
  combat.enemyInterval = null;
  combat.enemy         = null;

  const floor  = gameState.progress.currentFloor;
  const def    = getEnemyForFloor(floor);
  const maxHp  = BALANCE.enemyHp(floor) * BALANCE.BOSS_HP_MULTIPLIER;
  let   bossHp = maxHp;
  let   bossAlive = true;

  gameState.progress.bossReady = false;
  BattleView.setBossReady(false);
  BattleView.log(`⚔️ BOSS FIGHT — ${def.icon} ${def.name} (BOSS) appears!`, "boss");
  BattleView.setEnemy(`👑 ${def.name} (BOSS)`, maxHp, maxHp);

  let bossHeroInterval, bossEnemyInterval;

  function endBoss() {
    clearInterval(bossHeroInterval);
    clearInterval(bossEnemyInterval);
    bossAlive = false;
  }

  // Hero attacks boss
  bossHeroInterval = setInterval(() => {
    if (!bossAlive) return;
    const dmg = heroDamage();
    bossHp -= dmg;
    BattleView.setEnemyHp(bossHp, maxHp);
    BattleView.log(`You deal ${dmg} to the boss`, "dmg");
    if (bossHp <= 0) {
      endBoss();
      onBossDefeated(floor, def);
    }
  }, BALANCE.COMBAT_TICK_MS);

  // Boss attacks hero (hits harder than regular enemies)
  bossEnemyInterval = setInterval(() => {
    if (!bossAlive || !gameState) return;
    const dmg = Math.round(BALANCE.enemyDamage(floor) * 1.5);
    gameState.stats.currentHp = Math.max(0, gameState.stats.currentHp - dmg);
    BattleView.log(`👑 Boss hits you for ${dmg}!`, "enemy-dmg");
    HUD.update(gameState);
    BattleView.setHeroHp(gameState.stats.currentHp, gameState.stats.maxHp);
    if (gameState.stats.currentHp <= 0) {
      endBoss();
      onPlayerDeathFromBoss(floor);
    }
  }, BALANCE.ENEMY_ATTACK_TICK_MS);
}

function onBossDefeated(floor, def) {
  const gold = BALANCE.goldReward(floor) * 5;
  const exp  = BALANCE.expReward(floor) * 5;

  gameState.currencies.gold       += gold;
  gameState.profile.exp           += exp;
  gameState.progress.currentFloor += 1;
  gameState.progress.maxFloor      = Math.max(gameState.progress.maxFloor, gameState.progress.currentFloor);
  gameState.progress.bossReady     = false;
  gameState._killCount             = 0;

  applyLevelUps();
  HUD.update(gameState);
  EquipView.render();
  BattleView.log(`🏆 ${def.icon} Boss defeated! Floor ${floor} cleared! +${gold}g +${exp}xp`, "boss");
  BattleView.log(`➡️ Advancing to Floor ${gameState.progress.currentFloor}`, "boss");

  saveGame();
  spawnEnemy();
  startCombatLoop();
}

function onPlayerDeathFromBoss(floor) {
  const newFloor = Math.max(1, floor - 1);
  gameState.progress.currentFloor = newFloor;
  gameState.progress.bossReady    = false;
  gameState._killCount            = 0;
  gameState.stats.currentHp       = gameState.stats.maxHp;
  HUD.update(gameState);
  BattleView.setHeroHp(gameState.stats.maxHp, gameState.stats.maxHp);
  BattleView.log(`💀 Defeated by the Boss! Retreating to Floor ${newFloor}`, "boss");
  saveGame();
  spawnEnemy();
  startCombatLoop();
}

// ══════════════════════════════════════════════════════════════
// SAVE
// ══════════════════════════════════════════════════════════════
async function saveGame() {
  if (!session || !characterId || !gameState) return;
  try {
    await FirebaseService.saveCharacter(session.userKey, characterId, gameState);
  } catch (e) {
    console.warn("Save failed:", e);
  }
}

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function capitalize(str) {
  return str ? str[0].toUpperCase() + str.slice(1) : str;
}
