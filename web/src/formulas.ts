export interface FormulaVersion {
  patch: string;
  label: string;
  description: string;
  hpPerStr: number;
  armorPerAgi: number;
  baseHp: number;
  baseMana: number;
  manaPerInt: number;
  primaryDmgMultiplier: number;
  universalDmgPerAttr: number | null;
  strGivesHpRegen: boolean;
  strGivesMagicRes: boolean;
  agiGivesMovespeed: boolean;
  intGivesSpellAmp: boolean;
}

// Formula versions ordered by patch. Each entry applies from that patch onward until the next entry.
export const FORMULA_VERSIONS: FormulaVersion[] = [
  {
    patch: "7.00",
    label: "7.00 — Talents Update",
    description: "STR: 20 HP, 0.7% HP regen. AGI: 1/7 armor, 1 AS. INT: 12 mana, spell amp. Primary attr: +1 dmg/point.",
    hpPerStr: 20,
    armorPerAgi: 1 / 7,
    baseHp: 200,
    baseMana: 75,
    manaPerInt: 12,
    primaryDmgMultiplier: 1,
    universalDmgPerAttr: null,
    strGivesHpRegen: true,
    strGivesMagicRes: true,
    agiGivesMovespeed: true,
    intGivesSpellAmp: true,
  },
  {
    patch: "7.13",
    label: "7.13 — Attribute Rebalance",
    description: "STR: 18 HP (22.5 for STR heroes). Primary attr: +25% bonus to its stat type. Removed status resistance from STR.",
    hpPerStr: 18,
    armorPerAgi: 1 / 7,
    baseHp: 200,
    baseMana: 75,
    manaPerInt: 12,
    primaryDmgMultiplier: 1,
    universalDmgPerAttr: null,
    strGivesHpRegen: true,
    strGivesMagicRes: true,
    agiGivesMovespeed: true,
    intGivesSpellAmp: true,
  },
  {
    patch: "7.21",
    label: "7.21 — HP per STR Increased",
    description: "HP per STR: 18 → 20.",
    hpPerStr: 20,
    armorPerAgi: 1 / 7,
    baseHp: 200,
    baseMana: 75,
    manaPerInt: 12,
    primaryDmgMultiplier: 1,
    universalDmgPerAttr: null,
    strGivesHpRegen: true,
    strGivesMagicRes: true,
    agiGivesMovespeed: true,
    intGivesSpellAmp: true,
  },
  {
    patch: "7.23",
    label: "7.23 — Outlanders Update",
    description: "Major rework. Base HP changed. Attribute stat button removed.",
    hpPerStr: 22,
    armorPerAgi: 1 / 6,
    baseHp: 200,
    baseMana: 75,
    manaPerInt: 12,
    primaryDmgMultiplier: 1,
    universalDmgPerAttr: null,
    strGivesHpRegen: true,
    strGivesMagicRes: false,
    agiGivesMovespeed: false,
    intGivesSpellAmp: true,
  },
  {
    patch: "7.26",
    label: "7.26 — Attribute Bonuses Removed",
    description: "Attributes no longer provide Magic Resist (STR), Spell Amp (INT), or Movement Speed (AGI).",
    hpPerStr: 22,
    armorPerAgi: 1 / 6,
    baseHp: 200,
    baseMana: 75,
    manaPerInt: 12,
    primaryDmgMultiplier: 1,
    universalDmgPerAttr: null,
    strGivesHpRegen: true,
    strGivesMagicRes: false,
    agiGivesMovespeed: false,
    intGivesSpellAmp: false,
  },
  {
    patch: "7.27",
    label: "7.27 — Armor per AGI Adjusted",
    description: "Armor per AGI: 0.16 → 1/6 (~0.167).",
    hpPerStr: 22,
    armorPerAgi: 1 / 6,
    baseHp: 200,
    baseMana: 75,
    manaPerInt: 12,
    primaryDmgMultiplier: 1,
    universalDmgPerAttr: null,
    strGivesHpRegen: true,
    strGivesMagicRes: false,
    agiGivesMovespeed: false,
    intGivesSpellAmp: false,
  },
  {
    patch: "7.33",
    label: "7.33 — Universal Heroes",
    description: "New attribute type: Universal. These heroes get 0.6 damage per point of ALL attributes instead of 1.0 from primary.",
    hpPerStr: 22,
    armorPerAgi: 1 / 6,
    baseHp: 120,
    baseMana: 75,
    manaPerInt: 12,
    primaryDmgMultiplier: 1,
    universalDmgPerAttr: 0.6,
    strGivesHpRegen: true,
    strGivesMagicRes: false,
    agiGivesMovespeed: false,
    intGivesSpellAmp: false,
  },
  {
    patch: "7.33c",
    label: "7.33c — Universal Damage Buff",
    description: "Universal heroes damage per attribute: 0.6 → 0.7.",
    hpPerStr: 22,
    armorPerAgi: 1 / 6,
    baseHp: 120,
    baseMana: 75,
    manaPerInt: 12,
    primaryDmgMultiplier: 1,
    universalDmgPerAttr: 0.7,
    strGivesHpRegen: true,
    strGivesMagicRes: false,
    agiGivesMovespeed: false,
    intGivesSpellAmp: false,
  },
  {
    patch: "7.38",
    label: "7.38 — Universal Damage Nerf",
    description: "Universal heroes damage per attribute: 0.7 → 0.45.",
    hpPerStr: 22,
    armorPerAgi: 1 / 6,
    baseHp: 120,
    baseMana: 75,
    manaPerInt: 12,
    primaryDmgMultiplier: 1,
    universalDmgPerAttr: 0.45,
    strGivesHpRegen: true,
    strGivesMagicRes: false,
    agiGivesMovespeed: false,
    intGivesSpellAmp: false,
  },
];

// Universal heroes (as of 7.33+) — internal names
export const UNIVERSAL_HEROES = new Set([
  "abaddon", "bane", "batrider", "beastmaster", "brewmaster", "broodmother",
  "chen", "rattletrap", "dark_seer", "dark_willow", "dazzle", "enigma",
  "wisp", "lone_druid", "lycan", "marci", "magnataur", "mirana",
  "nyx_assassin", "pangolier", "phoenix", "sand_king", "snapfire", "techies",
  "shredder", "vengefulspirit", "venomancer", "visage", "void_spirit", "windrunner",
]);

export function getFormulaForPatch(patch: string): FormulaVersion {
  let result = FORMULA_VERSIONS[0];
  for (const fv of FORMULA_VERSIONS) {
    if (comparePatch(patch, fv.patch)) break;
    result = fv;
  }
  return result;
}

// Returns true if a < b
function comparePatch(a: string, b: string): boolean {
  const ap = parsePV(a);
  const bp = parsePV(b);
  if (ap[0] !== bp[0]) return ap[0] < bp[0];
  if (ap[1] !== bp[1]) return ap[1] < bp[1];
  return ap[2] < bp[2];
}

function parsePV(v: string): [string, string, string] {
  const parts = v.split(".");
  const major = parts[0];
  let minor = "";
  let suffix = "";
  if (parts.length > 1) {
    const rest = parts[1];
    let i = 0;
    while (i < rest.length && rest[i] >= "0" && rest[i] <= "9") i++;
    minor = rest.slice(0, i).padStart(4, "0");
    suffix = rest.slice(i);
  }
  return [major, minor, suffix];
}

// Get formula change events that fall within a patch list
export function getFormulaEvents(patches: string[]): { index: number; formula: FormulaVersion }[] {
  const events: { index: number; formula: FormulaVersion }[] = [];
  for (const fv of FORMULA_VERSIONS) {
    const idx = patches.indexOf(fv.patch);
    if (idx >= 0) {
      events.push({ index: idx, formula: fv });
    }
  }
  return events;
}
