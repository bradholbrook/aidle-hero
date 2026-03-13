import InventoryManager from "../managers/InventoryManager.js";
import { weaponSpriteStyle } from "../data/sprites.js";

const InventoryView = {
  _gameState: null,
  _onAction:  null,  // callback("inspect" | "auto-sold", item|gold, invIndex?)
  _bound:     false,

  init(gameState, onAction) {
    this._gameState = gameState;
    this._onAction  = onAction;
    if (!this._bound) {
      this._bindAutoSell();
      this._bound = true;
    }
    this.render();
  },

  /** Call when loading a new character. */
  refresh(gameState) {
    this._gameState = gameState;
    this.render();
  },

  render() {
    if (!this._gameState) return;
    const gs   = this._gameState;
    const grid = document.getElementById("inventory-grid");
    if (!grid) return;
    grid.innerHTML = "";

    const countEl = document.getElementById("bag-count");
    if (countEl) countEl.textContent = `${gs.inventory.length}/${InventoryManager.MAX_INVENTORY}`;

    for (let i = 0; i < InventoryManager.MAX_INVENTORY; i++) {
      const slot = document.createElement("div");
      slot.className    = "inv-slot";
      slot.dataset.index = i;
      const item = gs.inventory[i];
      if (item) {
        if (item.spriteCoords) {
          const [row, col] = item.spriteCoords;
          const sprite = document.createElement("div");
          sprite.className = "item-sprite";
          const styles = weaponSpriteStyle(row, col, 2);
          Object.assign(sprite.style, styles);
          slot.appendChild(sprite);
        } else {
          slot.textContent = item.icon ?? "📦";
        }
        slot.classList.add(`rarity-${item.rarity}`);
        slot.title = item.name;
        const idx = i;
        slot.addEventListener("click", () => this._onAction?.("inspect", item, idx));
      }
      grid.appendChild(slot);
    }
  },

  _bindAutoSell() {
    const btn = document.getElementById("btn-auto-sell");
    if (!btn) return;
    btn.addEventListener("click", () => {
      if (!this._gameState) return;
      const threshold = document.getElementById("sell-rarity-select")?.value ?? "common";
      const gold = InventoryManager.autoSell(this._gameState, threshold);
      this.render();
      this._onAction?.("auto-sold", gold);
    });
  },
};

export default InventoryView;
