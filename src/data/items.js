import { BALANCE } from "../balance.js";
import { WEAPON_COORDS } from "./sprites.js";

export const RARITY_COLORS = {
  common:    "#888",
  uncommon:  "#4ade80",
  rare:      "#60a5fa",
  epic:      "#a78bfa",
  legendary: "#c8a84b",
};

const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];

const TYPE_DEFS = {
  weapon: {
    icon: "⚔️",
    names: ["Sword", "Axe", "Dagger", "Spear", "Hammer", "Staff"],
    // stat: weight fraction of total budget
    stats: { damage: 0.65, str: 0.35 },
  },
  armor: {
    icon: "🛡️",
    names: ["Chestplate", "Mail", "Robe", "Vest", "Plate", "Cuirass"],
    stats: { vit: 0.45, maxHp: 0.55 },
  },
  accessory: {
    icon: "💍",
    names: ["Ring", "Amulet", "Charm", "Pendant", "Talisman"],
    stats: { str: 0.35, dex: 0.35, vit: 0.30 },
  },
};

const TYPES = Object.keys(TYPE_DEFS);

function rollRarity() {
  const w     = BALANCE.RARITY_WEIGHTS;
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  let r       = Math.random() * total;
  for (const rar of RARITIES) {
    r -= w[rar];
    if (r <= 0) return rar;
  }
  return "common";
}

export function generateItem(floor) {
  const type   = TYPES[Math.floor(Math.random() * TYPES.length)];
  const rarity = rollRarity();
  const def    = TYPE_DEFS[type];
  const mult   = BALANCE.RARITY_STAT_MULT[rarity];
  const scale  = Math.pow(floor, BALANCE.ITEM_SCALE_EXP);
  const lo     = BALANCE.ITEM_STAT_BASE_LOW;
  const hi     = BALANCE.ITEM_STAT_BASE_HIGH;

  const statBonus = {};
  for (const [stat, weight] of Object.entries(def.stats)) {
    const base = (lo + Math.random() * (hi - lo)) * weight;
    statBonus[stat] = Math.max(1, Math.round(base * mult * scale));
  }

  const name = def.names[Math.floor(Math.random() * def.names.length)];

  const item = {
    id:        `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    rarity,
    name:      `${capitalize(rarity)} ${name}`,
    icon:      def.icon,
    floor,
    statBonus,
    goldValue: BALANCE.itemSellValue(rarity, floor),
  };

  if (type === "weapon") {
    const coords = _pickWeaponSprite(name, rarity);
    if (coords) item.spriteCoords = coords;
  }

  return item;
}

function capitalize(s) { return s[0].toUpperCase() + s.slice(1); }

/** Returns a random sprite coord [row, col] for the given weapon name + rarity, or undefined. */
function _pickWeaponSprite(weaponName, rarity) {
  const key = weaponName.toLowerCase();
  const prefix = `${key}-${rarity}-`;
  const matches = Object.entries(WEAPON_COORDS)
    .filter(([k]) => k.startsWith(prefix))
    .map(([, v]) => v);
  if (!matches.length) return undefined;
  return matches[Math.floor(Math.random() * matches.length)];
}
