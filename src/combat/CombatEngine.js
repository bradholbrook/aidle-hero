/**
 * CombatEngine — state machine for all combat.
 *
 * States: IDLE → FIGHTING → BOSS → IDLE (via stop)
 *
 * Caller flow:
 *   engine.start(gameState, callbacks)       — begin normal combat
 *   engine.fightBoss(gameState, callbacks)   — begin boss fight
 *   engine.nextEnemy()                       — called by caller after handling onEnemyKilled
 *   engine.stop()                            — end all combat
 *
 * Callbacks (all optional):
 *   onEnemySpawned(enemy, label)
 *   onHeroAttack(dmg, enemy)
 *   onEnemyAttack(dmg, enemy)
 *   onHeroHpUpdate(hp, maxHp)
 *   onEnemyHpUpdate(hp, maxHp)
 *   onEnemyKilled(enemy)       — caller must call nextEnemy() after handling
 *   onBossDefeated(enemy)
 *   onPlayerDied(fromBoss)
 */

import { BALANCE }          from "../balance.js";
import InventoryManager     from "../managers/InventoryManager.js";
import { getEnemyForFloor } from "../data/enemies.js";

const CombatEngine = {
  state: "IDLE",  // "IDLE" | "FIGHTING" | "BOSS"
  enemy: null,

  _gs:  null,
  _cb:  null,
  _intervals: { hero: null, enemy: null, regen: null },

  // ── Public API ──────────────────────────────────────────────

  start(gameState, callbacks) {
    this.stop();
    this._gs    = gameState;
    this._cb    = callbacks;
    this.state  = "FIGHTING";
    this._spawnEnemy(false);
    this._startIntervals();
  },

  fightBoss(gameState, callbacks) {
    this.stop();
    this._gs    = gameState;
    this._cb    = callbacks;
    this.state  = "BOSS";
    this._spawnEnemy(true);
    this._startIntervals();
  },

  /** Spawn the next normal enemy after a kill. Keeps hero/regen intervals running. */
  nextEnemy() {
    this._spawnEnemy(false);
    // Restart enemy attack interval with new enemy's attack speed.
    clearInterval(this._intervals.enemy);
    this._intervals.enemy = setInterval(
      () => this._enemyTick(),
      this.enemy.attackSpeedMs,
    );
  },

  stop() {
    clearInterval(this._intervals.hero);
    clearInterval(this._intervals.enemy);
    clearInterval(this._intervals.regen);
    this._intervals = { hero: null, enemy: null, regen: null };
    this.enemy      = null;
    this.state      = "IDLE";
  },

  // ── Helpers exposed for OfflineManager ──────────────────────

  /** Average hero damage with no variance — for offline simulation. */
  avgHeroDamage(gameState) {
    const totalStr = InventoryManager.totalStat(gameState, "str");
    const weapDmg  = gameState.equipment?.weapon?.statBonus?.damage ?? 0;
    return BALANCE.BASE_DAMAGE + totalStr * BALANCE.DAMAGE_PER_STR + weapDmg;
  },

  /** Average enemy damage for a floor with no variance — for offline simulation. */
  avgEnemyDamage(floor) {
    const def = getEnemyForFloor(floor);
    return BALANCE.ENEMY_BASE_DAMAGE
      * Math.pow(floor, BALANCE.ENEMY_DAMAGE_EXP)
      * (def.damageMult ?? 1);
  },

  /** Average enemy HP for a floor (hpMult applied, no variance) — for offline simulation. */
  avgEnemyHp(floor) {
    const def = getEnemyForFloor(floor);
    return BALANCE.enemyHp(floor) * (def.hpMult ?? 1);
  },

  // ── Internals ───────────────────────────────────────────────

  _spawnEnemy(isBoss) {
    const floor   = this._gs.progress.currentFloor;
    const def     = getEnemyForFloor(floor);
    const baseHp  = BALANCE.enemyHp(floor)
      * (def.hpMult ?? 1)
      * (isBoss ? BALANCE.BOSS_HP_MULTIPLIER : 1);
    const variance = def.hpVariance ?? 0.2;
    const hp = Math.max(1, Math.round(
      baseHp * (1 - variance + Math.random() * variance * 2),
    ));

    this.enemy = {
      name:          def.name,
      icon:          def.icon,
      floor,
      isBoss,
      hp,
      maxHp:         hp,
      damageMult:    (def.damageMult ?? 1) * (isBoss ? 1.5 : 1),
      attackSpeedMs: def.attackSpeedMs ?? BALANCE.ENEMY_ATTACK_TICK_MS,
    };

    const label = isBoss
      ? `👑 ${def.name} (BOSS)`
      : `${def.icon} ${def.name}`;
    this._cb?.onEnemySpawned?.(this.enemy, label);
  },

  _startIntervals() {
    this._intervals.hero  = setInterval(() => this._heroTick(),  BALANCE.COMBAT_TICK_MS);
    this._intervals.enemy = setInterval(() => this._enemyTick(), this.enemy.attackSpeedMs);
    this._intervals.regen = setInterval(() => this._regenTick(), BALANCE.HP_REGEN_TICK_MS);
  },

  _heroTick() {
    if (!this.enemy || !this._gs) return;
    const dmg     = this._heroDamage();
    this.enemy.hp -= dmg;
    this._cb?.onHeroAttack?.(dmg, this.enemy);
    this._cb?.onEnemyHpUpdate?.(this.enemy.hp, this.enemy.maxHp);

    if (this.enemy.hp <= 0) {
      const killed = this.enemy;
      this.enemy   = null;
      if (this.state === "BOSS") {
        this.stop();
        this._cb?.onBossDefeated?.(killed);
      } else {
        this._cb?.onEnemyKilled?.(killed);
        // Caller must call nextEnemy() after processing the kill.
      }
    }
  },

  _enemyTick() {
    if (!this.enemy || !this._gs) return;
    const dmg = this._enemyDamage();
    this._gs.stats.currentHp = Math.max(0, this._gs.stats.currentHp - dmg);
    this._cb?.onEnemyAttack?.(dmg, this.enemy);
    this._cb?.onHeroHpUpdate?.(this._gs.stats.currentHp, this._gs.stats.maxHp);

    if (this._gs.stats.currentHp <= 0) {
      const wasBoss = this.state === "BOSS";
      this.stop();
      this._cb?.onPlayerDied?.(wasBoss);
    }
  },

  _regenTick() {
    if (!this._gs) return;
    if (this._gs.stats.currentHp >= this._gs.stats.maxHp) return;
    const regen = Math.max(1, Math.round(this._gs.stats.maxHp * BALANCE.HP_REGEN_PCT));
    this._gs.stats.currentHp = Math.min(
      this._gs.stats.maxHp,
      this._gs.stats.currentHp + regen,
    );
    this._cb?.onHeroHpUpdate?.(this._gs.stats.currentHp, this._gs.stats.maxHp);
  },

  _heroDamage() {
    const totalStr = InventoryManager.totalStat(this._gs, "str");
    const weapDmg  = this._gs.equipment?.weapon?.statBonus?.damage ?? 0;
    const base     = BALANCE.BASE_DAMAGE + totalStr * BALANCE.DAMAGE_PER_STR + weapDmg;
    const v        = BALANCE.HERO_DAMAGE_VARIANCE;
    return Math.max(1, Math.round(base * (1 - v + Math.random() * v * 2)));
  },

  _enemyDamage() {
    const floor = this._gs.progress.currentFloor;
    const avg   = BALANCE.ENEMY_BASE_DAMAGE
      * Math.pow(floor, BALANCE.ENEMY_DAMAGE_EXP)
      * (this.enemy.damageMult ?? 1);
    return Math.max(1, Math.round(avg * (0.8 + Math.random() * 0.4)));
  },
};

export default CombatEngine;
