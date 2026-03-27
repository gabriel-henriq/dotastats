export interface StatDef {
  id: string;
  label: string;
  short: string;
  file: string;
  lowerIsBetter?: boolean;
  heroKey: string;
  group?: string;
}

export const STATS: StatDef[] = [
  // Combat
  { id: "movespeed", label: "Movement Speed", short: "MS", file: "timeline_movespeed.json", heroKey: "movementSpeed", group: "combat" },
  { id: "aap", label: "Attack Animation", short: "AAP", file: "timeline_aap.json", lowerIsBetter: true, heroKey: "attackAnimationPoint", group: "combat" },
  { id: "armor", label: "Base Armor", short: "ARM", file: "timeline_armor.json", heroKey: "armorPhysical", group: "combat" },
  { id: "attack_range", label: "Attack Range", short: "RNG", file: "timeline_attack_range.json", heroKey: "attackRange", group: "combat" },
  { id: "bat", label: "Base Attack Time", short: "BAT", file: "timeline_bat.json", lowerIsBetter: true, heroKey: "attackRate", group: "combat" },
  { id: "turn_rate", label: "Turn Rate", short: "TR", file: "timeline_turn_rate.json", heroKey: "movementTurnRate", group: "combat" },
  { id: "projectile_speed", label: "Projectile Speed", short: "PS", file: "timeline_projectile_speed.json", heroKey: "projectileSpeed", group: "combat" },
  { id: "base_damage", label: "Base Damage", short: "DMG", file: "timeline_base_damage.json", heroKey: "baseDamage", group: "combat" },
  { id: "health_regen", label: "Health Regen", short: "HRG", file: "timeline_health_regen.json", heroKey: "healthRegen", group: "combat" },
  // Attributes
  { id: "base_str", label: "Base Strength", short: "STR", file: "timeline_base_str.json", heroKey: "baseStrength", group: "attributes" },
  { id: "base_agi", label: "Base Agility", short: "AGI", file: "timeline_base_agi.json", heroKey: "baseAgility", group: "attributes" },
  { id: "base_int", label: "Base Intelligence", short: "INT", file: "timeline_base_int.json", heroKey: "baseIntelligence", group: "attributes" },
  { id: "str_gain", label: "Strength Gain", short: "S/L", file: "timeline_str_gain.json", heroKey: "strengthGain", group: "attributes" },
  { id: "agi_gain", label: "Agility Gain", short: "A/L", file: "timeline_agi_gain.json", heroKey: "agilityGain", group: "attributes" },
  { id: "int_gain", label: "Intelligence Gain", short: "I/L", file: "timeline_int_gain.json", heroKey: "intelligenceGain", group: "attributes" },
];
