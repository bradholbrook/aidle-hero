/**
 * InspectView — item inspect overlay.
 *
 * init(callbacks)           — bind events once; { onEquipped, onUnequipped, onSold(gold) }
 * setGameState(gameState)   — update gameState reference (call before open)
 * open(item, invIndex, isEquipped, slot)
 * close()
 */

import InventoryManager  from "../managers/InventoryManager.js";
import UIManager         from "./UIManager.js";
import { RARITY_COLORS } from "../data/items.js";
import { weaponSpriteStyle } from "../data/sprites.js";

const STAT_LABELS = {
  damage: "Damage",
  str:    "Strength",
  dex:    "Dexterity",
  vit:    "Vitality",
  maxHp:  "Bonus HP",
};

const InspectView = {
  _state: null,  // { item, invIndex, isEquipped, slot }
  _gs:    null,
  _cb:    null,
  _bound: false,

  init(callbacks) {
    this._cb = callbacks;
    if (!this._bound) {
      this._bindEvents();
      this._bound = true;
    }
  },

  setGameState(gameState) {
    this._gs = gameState;
  },

  open(item, invIndex, isEquipped, slot) {
    this._state = { item, invIndex, isEquipped, slot };

    const iconEl = document.getElementById("inspect-icon");
    iconEl.innerHTML = "";
    if (item.spriteCoords) {
      const [row, col] = item.spriteCoords;
      const sprite = document.createElement("div");
      sprite.className = "item-sprite";
      Object.assign(sprite.style, weaponSpriteStyle(row, col, 2));
      iconEl.appendChild(sprite);
    } else {
      iconEl.textContent = item.icon;
    }
    const nameEl = document.getElementById("inspect-name");
    nameEl.textContent = item.name;
    nameEl.style.color = RARITY_COLORS[item.rarity] ?? "#888";

    const metaEl = document.getElementById("inspect-meta");
    metaEl.textContent = `${_cap(item.type)} · Floor ${item.floor} · ${_cap(item.rarity)}`;
    metaEl.style.color = "";

    // Stat rows with comparison vs currently equipped item in same slot
    const statsEl        = document.getElementById("inspect-stats");
    statsEl.innerHTML    = "";
    const currentEquipped = isEquipped ? null : this._gs.equipment[item.type];

    for (const [stat, val] of Object.entries(item.statBonus)) {
      const row = document.createElement("div");
      row.className = "inspect-stat-row";
      const eqVal = currentEquipped?.statBonus?.[stat] ?? 0;
      const diff  = val - eqVal;
      let diffHtml = "";
      if (currentEquipped !== null && !isEquipped) {
        const cls  = diff > 0 ? "diff-up" : diff < 0 ? "diff-down" : "diff-same";
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
      primaryBtn.textContent = "Unequip";
      sellBtn.style.display  = "none";
    } else {
      primaryBtn.textContent = "Equip";
      sellBtn.style.display  = "";
      sellBtn.textContent    = `Sell for ${item.goldValue}g`;
    }

    UIManager.showOverlay("inspect-overlay");
  },

  close() {
    UIManager.hideOverlay("inspect-overlay");
    this._state = null;
  },

  _bindEvents() {
    document.getElementById("btn-inspect-primary").addEventListener("click", () => {
      if (!this._state || !this._gs) return;
      const { item, invIndex, isEquipped, slot } = this._state;

      if (isEquipped) {
        if (this._gs.inventory.length >= InventoryManager.MAX_INVENTORY) {
          const metaEl = document.getElementById("inspect-meta");
          metaEl.textContent = "Bag is full — sell something first";
          metaEl.style.color = "var(--danger)";
          return;
        }
        InventoryManager.unequipItem(this._gs, slot);
        this.close();
        this._cb?.onUnequipped?.();
      } else {
        InventoryManager.equipItem(this._gs, item, invIndex);
        this.close();
        this._cb?.onEquipped?.();
      }
    });

    document.getElementById("btn-inspect-sell").addEventListener("click", () => {
      if (!this._state || !this._gs || this._state.isEquipped) return;
      const gold = InventoryManager.sellItem(this._gs, this._state.invIndex);
      this.close();
      this._cb?.onSold?.(gold);
    });

    document.getElementById("btn-inspect-close").addEventListener("click", () => {
      this.close();
    });

    document.getElementById("inspect-overlay").addEventListener("click", e => {
      if (e.target === e.currentTarget) this.close();
    });
  },
};

function _cap(str) {
  return str ? str[0].toUpperCase() + str.slice(1) : str;
}

export default InspectView;
