export interface StatDef {
  id: string;
  label: string;
  short: string;
  file: string;
  lowerIsBetter?: boolean;
  heroKey: string;
}

export const STATS: StatDef[] = [
  { id: "movespeed", label: "Movement Speed", short: "MS", file: "timeline_movespeed.json", heroKey: "movementSpeed" },
  { id: "aap", label: "Attack Animation", short: "AAP", file: "timeline_aap.json", lowerIsBetter: true, heroKey: "attackAnimationPoint" },
  { id: "armor", label: "Base Armor", short: "ARM", file: "timeline_armor.json", heroKey: "armorPhysical" },
  { id: "attack_range", label: "Attack Range", short: "RNG", file: "timeline_attack_range.json", heroKey: "attackRange" },
  { id: "bat", label: "Base Attack Time", short: "BAT", file: "timeline_bat.json", lowerIsBetter: true, heroKey: "attackRate" },
  { id: "turn_rate", label: "Turn Rate", short: "TR", file: "timeline_turn_rate.json", heroKey: "movementTurnRate" },
  { id: "projectile_speed", label: "Projectile Speed", short: "PS", file: "timeline_projectile_speed.json", heroKey: "projectileSpeed" },
];
