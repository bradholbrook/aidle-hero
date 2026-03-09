/**
 * main.js — Bootstrap
 *
 * Auth flow:
 *   Splash → (boot) → session found? → Char Select
 *                   → no session    → Auth Choice → (Sign In | Create Account | Guest) → Char Select
 *
 * "currentUser" is our own session object (not a Firebase user):
 *   Named:  { type:"account", username, userKey, displayName }
 *   Guest:  { type:"guest",   uid,      userKey, displayName }
 */

import FirebaseService   from "./managers/FirebaseService.js";
import CharacterManager  from "./managers/CharacterManager.js";
import LevelManager      from "./engine/LevelManager.js";
import OfflineManager    from "./engine/OfflineManager.js";
import UIManager         from "./ui/UIManager.js";
import HUD               from "./ui/HUD.js";
import BattleView        from "./ui/BattleView.js";
import InventoryView     from "./ui/InventoryView.js";
import { BALANCE }       from "./balance.js";
import { getEnemyForFloor } from "./data/enemies.js";

// ── Shared state ───────────────────────────────────────────────
let session     = null;   // our custom session object
let gameState   = null;
let characterId = null;
let combat = { enemy: null, interval: null };

// ══════════════════════════════════════════════════════════════
// BOOTSTRAP
// ══════════════════════════════════════════════════════════════
UIManager.bindTabs();
BattleView.init();

FirebaseService.boot().then(({ session: saved }) => {
  if (saved) {
    // Returning user with a saved session — skip auth screens
    session = saved;
    showCharSelect();
  } else {
    UIManager.showScreen("auth");
  }
}).catch(err => {
  // Leave splash visible with an error message
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
  gameState   = null;
  characterId = null;

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
    // Reserve name globally (throws if taken)
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

// ⚙️ on char-select screen
document.querySelector(".btn-menu-early").addEventListener("click", () => {
  openSystemMenu(false);
});

document.getElementById("menu-close").addEventListener("click", () => {
  UIManager.hideOverlay("system-menu-overlay");
});

document.getElementById("menu-switch-char").addEventListener("click", () => {
  UIManager.hideOverlay("system-menu-overlay");
  showCharSelect();
});

document.getElementById("menu-logout").addEventListener("click", async () => {
  UIManager.hideOverlay("system-menu-overlay");
  stopCombat();
  await saveGame();
  FirebaseService.signOut();
  session     = null;
  gameState   = null;
  characterId = null;
  UIManager.showScreen("auth");
});

document.getElementById("system-menu-overlay").addEventListener("click", e => {
  if (e.target === e.currentTarget) UIManager.hideOverlay("system-menu-overlay");
});
document.getElementById("confirm-overlay").addEventListener("click", e => {
  if (e.target === e.currentTarget) UIManager.hideOverlay("confirm-overlay");
});

// ══════════════════════════════════════════════════════════════
// GAME START
// ══════════════════════════════════════════════════════════════
function startGame() {
  const lastSaveMs = gameState.lastSaveTime?.toMillis?.();
  let gains = null;
  if (lastSaveMs) {
    gains = OfflineManager.applyOfflineGains(gameState, lastSaveMs);
    LevelManager.checkLevelUp(gameState);
  }

  UIManager.showScreen("main");
  UIManager.showTab("battle");
  BattleView.reset();
  HUD.update(gameState);
  InventoryView.init(gameState);

  spawnEnemy();
  startCombatLoop();
  setupBossButton();

  if (lastSaveMs && gains && gains.kills > 0) {
    const mins = Math.round(gains.deltaMs / 60_000);
    BattleView.log(`💤 Away for ${mins}m — earned ${gains.gold}g + ${gains.exp}xp (${gains.kills} kills)`, "reward");
  }

  setInterval(saveGame, 30_000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveGame();
  });
  window.addEventListener("pagehide", saveGame);
}

// ══════════════════════════════════════════════════════════════
// COMBAT
// ══════════════════════════════════════════════════════════════
function heroDamage() {
  const s = gameState.stats;
  const weaponBonus = gameState.equipment?.weapon?.damage ?? 0;
  return BALANCE.BASE_DAMAGE + s.str * BALANCE.DAMAGE_PER_STR + weaponBonus;
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
  combat.interval = setInterval(combatTick, BALANCE.COMBAT_TICK_MS);
}

function stopCombat() {
  clearInterval(combat.interval);
  combat.interval = null;
  combat.enemy    = null;
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

  const levelsGained = LevelManager.checkLevelUp(gameState);
  if (levelsGained > 0) {
    BattleView.log(`⬆️ Level up! Now level ${gameState.profile.level}`, "boss");
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
  combat.enemy = null;

  const floor  = gameState.progress.currentFloor;
  const def    = getEnemyForFloor(floor);
  const maxHp  = BALANCE.enemyHp(floor) * BALANCE.BOSS_HP_MULTIPLIER;
  let   bossHp = maxHp;

  gameState.progress.bossReady = false;
  BattleView.setBossReady(false);
  BattleView.log(`⚔️ BOSS FIGHT — ${def.icon} ${def.name} (BOSS) appears!`, "boss");
  BattleView.setEnemy(`👑 ${def.name} (BOSS)`, maxHp, maxHp);

  const bossInterval = setInterval(() => {
    const dmg = heroDamage();
    bossHp -= dmg;
    BattleView.setEnemyHp(bossHp, maxHp);
    BattleView.log(`You deal ${dmg} to boss`, "dmg");
    if (bossHp <= 0) {
      clearInterval(bossInterval);
      onBossDefeated(floor, def);
    }
  }, 200);
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

  LevelManager.checkLevelUp(gameState);
  HUD.update(gameState);
  BattleView.log(`🏆 ${def.icon} Boss defeated! Floor ${floor} cleared! +${gold}g +${exp}xp`, "boss");
  BattleView.log(`➡️ Advancing to Floor ${gameState.progress.currentFloor}`, "boss");

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
function clearFormErrors() {
  ["signin-error", "create-error", "char-create-error"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = "";
  });
}

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
