/** Phase 2 stub — renders the inventory grid */
const InventoryView = {
  init(gameState) {
    this._renderSlots(gameState);
  },

  _renderSlots(gameState) {
    const grid = document.getElementById("inventory-grid");
    grid.innerHTML = "";
    const SLOT_COUNT = 20;
    for (let i = 0; i < SLOT_COUNT; i++) {
      const slot = document.createElement("div");
      slot.className = "inv-slot";
      slot.dataset.index = i;
      const item = gameState.inventory[i];
      if (item) {
        slot.textContent = item.icon ?? "📦";
        slot.classList.add(`rarity-${item.rarity}`);
      }
      grid.appendChild(slot);
    }
  },
};

export default InventoryView;
