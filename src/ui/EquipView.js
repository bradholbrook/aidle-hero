import InventoryManager from "../managers/InventoryManager.js";
import { BALANCE }        from "../balance.js";
import { RARITY_COLORS }  from "../data/items.js";
import { weaponSpriteStyle } from "../data/sprites.js";

const EquipView = {
  _gameState: null,
  _onAction:  null,   // callback(type, ...args)
  _pending:   { str: 0, dex: 0, vit: 0 },
  _bound:     false,

  init(gameState, onAction) {
    this._gameState = gameState;
    this._onAction  = onAction;
    this._pending   = { str: 0, dex: 0, vit: 0 };
    if (!this._bound) {
      this._bindStatAlloc();
      this._bindApply();
      this._bound = true;
    }
    this.render();
  },

  /** Call when loading a new character (clears pending state). */
  refresh(gameState) {
    this._gameState = gameState;
    this._pending   = { str: 0, dex: 0, vit: 0 };
    this.render();
  },

  render() {
    if (!this._gameState) return;
    const gs  = this._gameState;
    const s   = gs.stats;
    const eq  = gs.equipment;
    const pts = gs.profile.statPoints ?? 0;
    const pendingTotal = this._pending.str + this._pending.dex + this._pending.vit;

    // HP
    document.getElementById("cs-hp").textContent =
      `${Math.max(0, Math.round(s.currentHp))}/${s.maxHp}`;

    // Damage range
    const totalStr = InventoryManager.totalStat(gs, "str");
    const weapDmg  = eq.weapon?.statBonus?.damage ?? 0;
    const baseDmg  = BALANCE.BASE_DAMAGE + totalStr * BALANCE.DAMAGE_PER_STR + weapDmg;
    const v        = BALANCE.HERO_DAMAGE_VARIANCE;
    document.getElementById("cs-damage").textContent =
      `${Math.max(1, Math.floor(baseDmg * (1 - v)))}–${Math.ceil(baseDmg * (1 + v))}`;

    // Stats (base + equipment, + pending preview)
    const strTotal = InventoryManager.totalStat(gs, "str");
    const dexTotal = InventoryManager.totalStat(gs, "dex");
    const vitTotal = InventoryManager.totalStat(gs, "vit");
    document.getElementById("cs-str").textContent =
      strTotal + (this._pending.str ? ` (+${this._pending.str})` : "");
    document.getElementById("cs-dex").textContent =
      dexTotal + (this._pending.dex ? ` (+${this._pending.dex})` : "");
    document.getElementById("cs-vit").textContent =
      vitTotal + (this._pending.vit ? ` (+${this._pending.vit})` : "");

    // Stat allocation section (only shown when points available)
    const allocSection = document.getElementById("stat-alloc-section");
    const applyBtn     = document.getElementById("btn-apply-stats");
    if (pts > 0) {
      allocSection.style.display = "";
      const remaining = pts - pendingTotal;
      document.getElementById("cs-stat-points").textContent =
        `${remaining} point${remaining !== 1 ? "s" : ""} to spend`;
      applyBtn.disabled = pendingTotal === 0;
      // Enable/disable +/- buttons based on remaining
      document.querySelectorAll("#tab-equip .stat-plus").forEach(btn => {
        btn.disabled = remaining <= 0;
      });
      document.querySelectorAll("#tab-equip .stat-minus").forEach(btn => {
        btn.disabled = this._pending[btn.dataset.stat] <= 0;
      });
    } else {
      allocSection.style.display = "none";
    }

    // Equipment slots
    for (const slot of ["weapon", "armor", "accessory"]) {
      this._renderSlot(slot, eq[slot]);
    }
  },

  _renderSlot(slot, item) {
    const el = document.querySelector(`#tab-equip .equip-slot[data-slot="${slot}"]`);
    if (!el) return;
    if (item) {
      const color = RARITY_COLORS[item.rarity] ?? "#888";
      el.className     = "equip-slot has-item";
      el.style.borderColor = color;

      let iconHtml;
      if (item.spriteCoords) {
        const [row, col] = item.spriteCoords;
        const s = weaponSpriteStyle(row, col, 2);
        iconHtml = `<div class="item-sprite" style="
          background-image:${s.backgroundImage};
          background-position:${s.backgroundPosition};
          background-repeat:${s.backgroundRepeat};
          background-size:${s.backgroundSize};
          width:${s.width};height:${s.height};
          image-rendering:pixelated;display:inline-block;"></div>`;
      } else {
        iconHtml = `<span class="equip-item-icon">${item.icon}</span>`;
      }

      el.innerHTML = `
        ${iconHtml}
        <span class="slot-label" style="color:${color}">${item.name}</span>
      `;
      el.onclick = () => this._onAction?.("inspect-equipped", item, slot);
    } else {
      el.className     = "equip-slot";
      el.style.borderColor = "";
      el.innerHTML = `<span class="slot-label">${slot}</span>`;
      el.onclick = null;
    }
  },

  _bindStatAlloc() {
    document.querySelectorAll("#tab-equip .stat-minus, #tab-equip .stat-plus").forEach(btn => {
      btn.addEventListener("click", () => {
        const stat   = btn.dataset.stat;
        const isPlus = btn.classList.contains("stat-plus");
        const pts    = this._gameState?.profile.statPoints ?? 0;
        const used   = this._pending.str + this._pending.dex + this._pending.vit;
        if (isPlus) {
          if (used < pts) { this._pending[stat]++; this.render(); }
        } else {
          if (this._pending[stat] > 0) { this._pending[stat]--; this.render(); }
        }
      });
    });
  },

  _bindApply() {
    document.getElementById("btn-apply-stats").addEventListener("click", () => {
      const gs = this._gameState;
      if (!gs) return;
      const { str, dex, vit } = this._pending;
      const total = str + dex + vit;
      if (total === 0) return;
      gs.stats.str          += str;
      gs.stats.dex          += dex;
      gs.stats.vit          += vit;
      gs.profile.statPoints -= total;
      this._pending          = { str: 0, dex: 0, vit: 0 };
      InventoryManager.recalcStats(gs);
      this.render();
      this._onAction?.("stats-applied");
    });
  },
};

export default EquipView;
