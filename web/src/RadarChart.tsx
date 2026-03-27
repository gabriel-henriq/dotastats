import { useMemo, useState } from "react";
import { STATS } from "./stats";
import { getFormulaForPatch } from "./formulas";
import type { StatDef } from "./stats";

interface HeroData {
  name: string;
  displayName: string;
  heroId: number;
  icon: string;
  attributePrimary?: string;
  [key: string]: any;
}

interface Props {
  heroes: HeroData[];
  selectedIds: number[];
  onSelectedChange: (ids: number[]) => void;
  currentPatch?: string;
}

interface ColorSet {
  stroke: string;
  fill: string;
  label: string;
  bg: string;
}

const ATTR_COLORS: Record<string, ColorSet[]> = {
  str: [
    { stroke: "#ef4444", fill: "rgba(239,68,68,0.15)", label: "text-red-400", bg: "bg-red-500/10 border-red-500/30" },
    { stroke: "#f87171", fill: "rgba(248,113,113,0.12)", label: "text-red-300", bg: "bg-red-400/10 border-red-400/30" },
  ],
  agi: [
    { stroke: "#22c55e", fill: "rgba(34,197,94,0.15)", label: "text-green-400", bg: "bg-green-500/10 border-green-500/30" },
    { stroke: "#4ade80", fill: "rgba(74,222,128,0.12)", label: "text-green-300", bg: "bg-green-400/10 border-green-400/30" },
  ],
  int: [
    { stroke: "#3b82f6", fill: "rgba(59,130,246,0.15)", label: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/30" },
    { stroke: "#60a5fa", fill: "rgba(96,165,250,0.12)", label: "text-blue-300", bg: "bg-blue-400/10 border-blue-400/30" },
  ],
  all: [
    { stroke: "#a855f7", fill: "rgba(168,85,247,0.15)", label: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/30" },
    { stroke: "#c084fc", fill: "rgba(192,132,252,0.12)", label: "text-purple-300", bg: "bg-purple-400/10 border-purple-400/30" },
  ],
};

function getHeroColor(hero: HeroData, sameAttrIndex: number): ColorSet {
  const attr = hero.attributePrimary || "str";
  const shades = ATTR_COLORS[attr] || ATTR_COLORS.str;
  return shades[sameAttrIndex % shades.length];
}

const ATTR_DOT = { str: "#ef4444", agi: "#22c55e", int: "#3b82f6", all: "#a855f7" };

// Computed stat definitions for level-scaled values
interface ComputedStat {
  id: string;
  label: string;
  short: string;
  lowerIsBetter?: boolean;
  compute: (hero: HeroData, level: number, formula: ReturnType<typeof getFormulaForPatch>) => number;
}

const COMPUTED_STATS: ComputedStat[] = [
  {
    id: "c_hp", label: "HP", short: "HP",
    compute: (h, lvl, f) => f.baseHp + (num(h.baseStrength) + num(h.strengthGain) * (lvl - 1)) * f.hpPerStr,
  },
  {
    id: "c_mana", label: "Mana", short: "MP",
    compute: (h, lvl, f) => f.baseMana + (num(h.baseIntelligence) + num(h.intelligenceGain) * (lvl - 1)) * f.manaPerInt,
  },
  {
    id: "c_armor", label: "Armor", short: "AR",
    compute: (h, lvl, f) => num(h.armorPhysical) + (num(h.baseAgility) + num(h.agilityGain) * (lvl - 1)) * f.armorPerAgi,
  },
  {
    id: "c_damage", label: "Damage", short: "DMG",
    compute: (h, lvl, f) => {
      const baseDmg = (num(h.attackDamageMin) + num(h.attackDamageMax)) / 2;
      const str = num(h.baseStrength) + num(h.strengthGain) * (lvl - 1);
      const agi = num(h.baseAgility) + num(h.agilityGain) * (lvl - 1);
      const int = num(h.baseIntelligence) + num(h.intelligenceGain) * (lvl - 1);
      const attr = h.attributePrimary;
      if (attr === "all" && f.universalDmgPerAttr !== null) {
        return baseDmg + (str + agi + int) * f.universalDmgPerAttr;
      }
      const primary = attr === "str" ? str : attr === "agi" ? agi : int;
      return baseDmg + primary * f.primaryDmgMultiplier;
    },
  },
];

function num(v: any): number { return Number(v) || 0; }

const MAX_HEROES = 4;

const RAW_AXES = STATS.filter((s) => s.heroKey !== "projectileSpeed");

const DEFAULT_AXES = new Set(["c_hp", "c_armor", "c_damage", "movementSpeed", "attackRange", "attackRate"]);

const CX = 300;
const CY = 270;
const RADIUS = 210;

type AxisDef = { id: string; label: string; short: string; lowerIsBetter?: boolean; heroKey?: string; computed?: ComputedStat };

export function RadarChart({ heroes, selectedIds, onSelectedChange, currentPatch }: Props) {
  const [search, setSearch] = useState("");
  const [enabledAxes, setEnabledAxes] = useState<Set<string>>(DEFAULT_AXES);
  const [level, setLevel] = useState(1);

  const formula = useMemo(() => getFormulaForPatch(currentPatch || "7.41"), [currentPatch]);

  // Build axis definitions
  const allAxes: AxisDef[] = useMemo(() => {
    const computed: AxisDef[] = COMPUTED_STATS.map((c) => ({ id: c.id, label: c.label, short: c.short, lowerIsBetter: c.lowerIsBetter, computed: c }));
    const raw: AxisDef[] = RAW_AXES.map((s) => ({ id: s.id, label: s.label, short: s.short, lowerIsBetter: s.lowerIsBetter, heroKey: s.heroKey }));
    return [...computed, ...raw];
  }, []);

  const activeAxes = useMemo(() => allAxes.filter((a) => enabledAxes.has(a.id)), [allAxes, enabledAxes]);

  const toggleAxis = (id: string) => {
    setEnabledAxes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size <= 3) return prev;
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Get value for a hero on an axis
  const getVal = (hero: HeroData, axis: AxisDef): number => {
    if (axis.computed) return axis.computed.compute(hero, level, formula);
    return num(hero[axis.heroKey!]);
  };

  const [hoveredVertex, setHoveredVertex] = useState<{
    heroId: number;
    statIdx: number;
    x: number;
    y: number;
    value: number;
    statLabel: string;
    color: string;
  } | null>(null);

  const ranges = useMemo(() => {
    const r: Record<string, { min: number; max: number }> = {};
    for (const axis of activeAxes) {
      const vals = heroes.map((h) => getVal(h, axis));
      r[axis.id] = { min: Math.min(...vals), max: Math.max(...vals) };
    }
    return r;
  }, [heroes, activeAxes, level, formula]);

  const normalize = (axis: AxisDef, val: number) => {
    const range = ranges[axis.id];
    if (!range) return 0.5;
    const { min, max } = range;
    if (max === min) return 0.5;
    let norm = (val - min) / (max - min);
    if (axis.lowerIsBetter) norm = 1 - norm;
    return norm * 0.8 + 0.15;
  };

  const [focusedId, setFocusedId] = useState<number | null>(null);

  const selectedHeroes = selectedIds
    .map((id) => heroes.find((h) => h.heroId === id))
    .filter((h): h is HeroData => h != null);

  // Build color map: track per-attribute index for shade variation
  const heroColorMap = useMemo(() => {
    const map = new Map<number, ColorSet>();
    const attrCount: Record<string, number> = {};
    for (const id of selectedIds) {
      const hero = heroes.find((h) => h.heroId === id);
      if (!hero) continue;
      const attr = hero.attributePrimary || "str";
      const idx = attrCount[attr] || 0;
      attrCount[attr] = idx + 1;
      map.set(id, getHeroColor(hero, idx));
    }
    return map;
  }, [selectedIds, heroes]);

  const getColor = (heroId: number) => heroColorMap.get(heroId) || ATTR_COLORS.str[0];

  const toggleHero = (id: number) => {
    if (selectedIds.includes(id)) {
      if (focusedId === id) setFocusedId(null);
      onSelectedChange(selectedIds.filter((i) => i !== id));
    } else if (selectedIds.length < MAX_HEROES) {
      onSelectedChange([...selectedIds, id]);
    }
  };

  const searchLower = search.toLowerCase();
  const filteredHeroes = searchLower
    ? heroes.filter((h) => h.displayName.toLowerCase().includes(searchLower))
    : heroes;

  const statCount = activeAxes.length;

  const getPoint = (statIdx: number, value: number) => {
    const angle = (2 * Math.PI * statIdx) / statCount - Math.PI / 2;
    const r = value * RADIUS;
    return { x: CX + Math.cos(angle) * r, y: CY + Math.sin(angle) * r };
  };

  const buildPath = (hero: HeroData) => {
    return activeAxes.map((axis, i) => {
      const val = getVal(hero, axis);
      const p = getPoint(i, normalize(axis, val));
      return (i === 0 ? "M " : "L ") + `${p.x} ${p.y}`;
    }).join(" ") + " Z";
  };

  return (
    <div className="flex h-full gap-0">
      {/* Left panel */}
      <div className="w-48 shrink-0 flex flex-col border-r border-gray-800/50 pr-3 overflow-y-auto custom-scroll">
        {/* Search */}
        <div className="mb-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search hero..."
            className="w-full bg-gray-800 text-gray-200 text-xs rounded-md px-3 py-1.5 border border-gray-700 outline-none focus:border-blue-500"
          />
        </div>
        <div className="text-[10px] text-gray-500 mb-1 px-1">
          Click to add (max {MAX_HEROES})
        </div>
        <div className="flex-1 overflow-y-auto space-y-0.5 min-h-0 custom-scroll">
          {filteredHeroes.map((hero) => {
            const isSelected = selectedIds.includes(hero.heroId);
            const color = isSelected ? getColor(hero.heroId) : null;
            const attrDot = ATTR_DOT[(hero.attributePrimary as keyof typeof ATTR_DOT) || "str"];
            return (
              <button
                key={hero.heroId}
                onClick={() => toggleHero(hero.heroId)}
                className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors ${
                  isSelected
                    ? "bg-gray-700/50 border border-gray-600"
                    : "hover:bg-gray-800/50 border border-transparent"
                } ${!isSelected && selectedIds.length >= MAX_HEROES ? "opacity-30" : ""}`}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: attrDot }} />
                <img
                  src={`${import.meta.env.BASE_URL}icons/${hero.icon}`}
                  alt=""
                  className="w-5 h-5 rounded-sm"
                />
                <span className="text-gray-300 truncate flex-1 text-left">
                  {hero.displayName}
                </span>
                {isSelected && color && (
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color.stroke }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Level slider */}
        <div className="mt-3 pt-3 border-t border-gray-800/50">
          <div className="flex items-center justify-between mb-1 px-1">
            <span className="text-[10px] text-gray-500">Level</span>
            <span className="text-[11px] font-mono font-bold text-gray-200">{level}</span>
          </div>
          <input
            type="range"
            min={1}
            max={30}
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
            className="w-full h-1 cursor-pointer accent-blue-500"
          />
        </div>

        {/* Axis toggles */}
        <div className="mt-3 pt-3 border-t border-gray-800/50">
          <div className="text-[10px] text-gray-500 mb-1 px-1">
            Computed
          </div>
          <div className="space-y-0.5 mb-2">
            {allAxes.filter((a) => a.computed).map((a) => (
              <button
                key={a.id}
                onClick={() => toggleAxis(a.id)}
                className={`w-full flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] transition-colors ${
                  enabledAxes.has(a.id) ? "text-amber-300 bg-amber-900/20" : "text-gray-600 hover:text-gray-400"
                }`}
              >
                <span className={`w-2 h-2 rounded-sm shrink-0 ${enabledAxes.has(a.id) ? "bg-amber-500" : "bg-gray-700"}`} />
                {a.label}
              </button>
            ))}
          </div>
          <div className="text-[10px] text-gray-500 mb-1 px-1">
            Raw Stats
          </div>
          <div className="space-y-0.5">
            {allAxes.filter((a) => !a.computed).map((a) => (
              <button
                key={a.id}
                onClick={() => toggleAxis(a.id)}
                className={`w-full flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] transition-colors ${
                  enabledAxes.has(a.id) ? "text-gray-200 bg-gray-700/40" : "text-gray-600 hover:text-gray-400"
                }`}
              >
                <span className={`w-2 h-2 rounded-sm shrink-0 ${enabledAxes.has(a.id) ? "bg-blue-500" : "bg-gray-700"}`} />
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Radar */}
      <div className="flex-1 flex items-center justify-start min-w-0 relative pl-4 pr-2">
        {/* Formula cards — one per hero */}
        {selectedHeroes.length > 0 && (
          <div className="absolute top-2 right-2 z-10 flex flex-col gap-2 max-h-[calc(100%-16px)] overflow-y-auto custom-scroll">
            {/* Legend — once */}
            <div className="bg-[#0a1219]/95 rounded-lg px-3 py-1.5 border border-gray-700/50 flex items-center gap-3">
              <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Formulas</span>
              <span className="text-[10px] text-amber-400/70 font-mono">{formula.label.split("—")[0].trim()}</span>
              <span className="text-[10px] text-gray-600">Lv <span className="text-gray-300 font-bold">{level}</span></span>
              <div className="flex gap-3 ml-auto text-[9px] text-gray-600">
                <span><span className="text-gray-400">gray</span> base</span>
                <span><span className="text-white font-bold">white</span> attr</span>
                <span><span className="text-amber-400">gold</span> formula</span>
              </div>
            </div>
            {selectedHeroes.map((fh) => {
              const color = getColor(fh.heroId);
              const fStr = Math.round(num(fh.baseStrength) + num(fh.strengthGain) * (level - 1));
              const fAgi = Math.round(num(fh.baseAgility) + num(fh.agilityGain) * (level - 1));
              const fInt = Math.round(num(fh.baseIntelligence) + num(fh.intelligenceGain) * (level - 1));
              const fAttr = fh.attributePrimary || "str";
              const isUni = fAttr === "all" && formula.universalDmgPerAttr !== null;
              const primaryVal = fAttr === "str" ? fStr : fAttr === "agi" ? fAgi : fInt;
              const baseDmg = Math.round((num(fh.attackDamageMin) + num(fh.attackDamageMax)) / 2);

              type Row = { dot: string; label: string; base: string; attrIcon: "str" | "agi" | "int"; attrVal: string; mul: string; result: number };
              const rows: Row[] = [
                { dot: "bg-green-600", label: "HP", base: String(formula.baseHp), attrIcon: "str", attrVal: String(fStr), mul: String(formula.hpPerStr), result: formula.baseHp + fStr * formula.hpPerStr },
                { dot: "bg-blue-600", label: "Mana", base: String(formula.baseMana), attrIcon: "int", attrVal: String(fInt), mul: String(formula.manaPerInt), result: formula.baseMana + fInt * formula.manaPerInt },
                { dot: "bg-yellow-600", label: "Armor", base: fmtVal(num(fh.armorPhysical)), attrIcon: "agi", attrVal: String(fAgi), mul: fmtVal(formula.armorPerAgi), result: num(fh.armorPhysical) + fAgi * formula.armorPerAgi },
                { dot: "bg-red-600", label: "Dmg", base: String(baseDmg), attrIcon: (fAttr === "all" ? "str" : fAttr) as "str" | "agi" | "int", attrVal: isUni ? String(fStr + fAgi + fInt) : String(primaryVal), mul: isUni ? String(formula.universalDmgPerAttr) : String(formula.primaryDmgMultiplier), result: baseDmg + (isUni ? (fStr + fAgi + fInt) * (formula.universalDmgPerAttr ?? 0) : primaryVal * formula.primaryDmgMultiplier) },
                { dot: "bg-green-800", label: "HP/s", base: fmtVal(num(fh.healthRegen)), attrIcon: "str", attrVal: String(fStr), mul: "0.1", result: num(fh.healthRegen) + fStr * 0.1 },
                { dot: "bg-blue-800", label: "MP/s", base: "0", attrIcon: "int", attrVal: String(fInt), mul: "0.05", result: fInt * 0.05 },
              ];

              return (
                <div key={fh.heroId} className="bg-[#0a1219]/95 rounded-lg px-3 py-2 border border-gray-700/50"
                  style={{ borderColor: color.stroke + "40" }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <img src={`${import.meta.env.BASE_URL}icons/${fh.icon}`} alt="" className="w-5 h-5 rounded-sm" />
                    <span className={`text-[11px] font-bold ${color.label}`}>{fh.displayName}</span>
                  </div>
                  <table className="text-[11px] font-mono" style={{ borderSpacing: 0 }}>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.label} className="h-5">
                          <td className="pr-1.5 w-3"><span className={`inline-block w-2 h-2 rounded-full ${row.dot}`} /></td>
                          <td className="text-gray-500 pr-2 font-bold w-10">{row.label}</td>
                          <td className="text-gray-400 text-right pr-0.5 w-7">{row.base}</td>
                          <td className="text-gray-600 px-0.5 w-3 text-center">+</td>
                          <td className="w-4"><AttrIcon type={row.attrIcon} size={12} /></td>
                          <td className="text-white font-bold text-right pr-0.5 w-7">{row.attrVal}</td>
                          <td className="text-gray-600 px-0.5 w-3 text-center">×</td>
                          <td className="text-amber-400 w-7">{row.mul}</td>
                          <td className="text-gray-600 px-0.5 w-3 text-center">=</td>
                          <td className="text-white font-bold text-right w-10">{fmtVal(row.result)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}

        {selectedHeroes.length === 0 ? (
          <svg viewBox="0 0 600 540" className="w-full max-w-[700px] max-h-full" style={{ overflow: "visible" }}>
            {[0.2, 0.4, 0.6, 0.8, 1.0].map((r) => (
              <polygon
                key={r}
                points={activeAxes.map((_, i) => { const p = getPoint(i, r); return `${p.x},${p.y}`; }).join(" ")}
                fill="none" stroke="#1e293b" strokeWidth={r === 1 ? 1.5 : 0.5}
              />
            ))}
            {activeAxes.map((axis, i) => {
              const p = getPoint(i, 1);
              const lp = getPoint(i, 1.25);
              return (
                <g key={axis.id}>
                  <line x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="#1e293b" strokeWidth={0.5} />
                  <text x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle" className="fill-gray-500 text-[12px]">
                    {axis.label}
                  </text>
                </g>
              );
            })}
            <text x={CX} y={CY + 4} textAnchor="middle" className="fill-gray-600 text-[13px]">
              Select heroes to compare
            </text>
          </svg>
        ) : (
          <svg viewBox="0 0 600 540" className="w-full max-w-[700px] max-h-full" style={{ overflow: "visible" }}
            onClick={(e) => { if (e.target === e.currentTarget) setFocusedId(null); }}
          >
            <rect x="0" y="0" width="600" height="540" fill="transparent" onClick={() => setFocusedId(null)} />

            {/* Grid rings */}
            {[0.2, 0.4, 0.6, 0.8, 1.0].map((r) => (
              <polygon
                key={r}
                points={activeAxes.map((_, i) => { const p = getPoint(i, r); return `${p.x},${p.y}`; }).join(" ")}
                fill="none" stroke="#1e293b" strokeWidth={r === 1 ? 1.5 : 0.5}
              />
            ))}

            {/* Axis lines */}
            {activeAxes.map((_, i) => {
              const p = getPoint(i, 1);
              return <line key={i} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="#1e293b" strokeWidth={0.5} />;
            })}

            {/* Hero shapes */}
            {[...selectedHeroes]
              .sort((a, b) => { if (a.heroId === focusedId) return 1; if (b.heroId === focusedId) return -1; return 0; })
              .map((hero) => {
                const color = getColor(hero.heroId);
                const isFocused = hero.heroId === focusedId;
                const hasFocus = focusedId !== null;
                const isHoverTarget = hoveredVertex?.heroId === hero.heroId;
                let opacity = 1;
                if (hasFocus && !isFocused && !isHoverTarget) opacity = 0.12;
                else if (hoveredVertex && !isHoverTarget && !isFocused) opacity = 0.15;
                return (
                  <path
                    key={hero.heroId} d={buildPath(hero)} fill={color.fill} stroke={color.stroke}
                    strokeWidth={isFocused ? 3 : 2} strokeLinejoin="round"
                    className="cursor-pointer transition-all duration-200"
                    style={{ opacity, pointerEvents: hasFocus && !isFocused ? "none" : "auto" }}
                    onClick={() => setFocusedId(isFocused ? null : hero.heroId)}
                  />
                );
              })}

            {/* Stat labels */}
            {activeAxes.map((axis, i) => {
              const range = ranges[axis.id];
              const displayMax = range ? (axis.lowerIsBetter ? range.min : range.max) : 0;
              const angle = (2 * Math.PI * i) / statCount - Math.PI / 2;
              const isBottom = angle > 0 && angle < Math.PI;
              const lp = getPoint(i, 1.25);
              const vp = getPoint(i, 1.08);
              const valOffsetY = isBottom ? -10 : 12;
              return (
                <g key={axis.id}>
                  <text x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle" className="fill-gray-300 text-[12px] font-medium">
                    {axis.label}
                  </text>
                  <text x={vp.x} y={vp.y + valOffsetY} textAnchor="middle" className="fill-gray-600 text-[9px] font-mono">
                    {fmtVal(displayMax)}
                  </text>
                </g>
              );
            })}

            {/* Vertex dots */}
            {[...selectedHeroes]
              .sort((a, b) => { if (a.heroId === focusedId) return 1; if (b.heroId === focusedId) return -1; return 0; })
              .flatMap((hero) => {
                const color = getColor(hero.heroId);
                const isFocused = hero.heroId === focusedId;
                const hasFocus = focusedId !== null;
                return activeAxes.map((axis, i) => {
                  const val = getVal(hero, axis);
                  const p = getPoint(i, normalize(axis, val));
                  const isHovered = hoveredVertex?.heroId === hero.heroId && hoveredVertex?.statIdx === i;
                  let opacity = 1;
                  if (hasFocus && !isFocused) opacity = 0.25;
                  return (
                    <circle
                      key={`${hero.heroId}-${i}`} cx={p.x} cy={p.y}
                      r={isHovered ? 7 : isFocused ? 6 : 5}
                      fill={color.stroke} stroke="#0f1923" strokeWidth={2}
                      className="cursor-pointer transition-all duration-150"
                      style={{ opacity }}
                      onMouseEnter={() => setHoveredVertex({ heroId: hero.heroId, statIdx: i, x: p.x, y: p.y, value: val, statLabel: axis.label, color: color.stroke })}
                      onMouseLeave={() => setHoveredVertex(null)}
                    />
                  );
                });
              })}

            {/* Tooltip */}
            {hoveredVertex && (() => {
              const axis = activeAxes[hoveredVertex.statIdx];
              if (!axis) return null;
              const lines: { name: string; val: number; color: string; diff?: number }[] = [];
              for (const h of selectedHeroes) {
                const color = getColor(h.heroId);
                const val = getVal(h, axis);
                if (h.heroId === hoveredVertex.heroId) {
                  lines.unshift({ name: h.displayName, val, color: color.stroke });
                } else {
                  lines.push({ name: h.displayName, val, color: color.stroke, diff: hoveredVertex.value - val });
                }
              }
              const boxW = 200, lineH = 16;
              const boxH = 24 + lines.length * lineH;
              const flipX = hoveredVertex.x + boxW + 20 > 600;
              const tx = flipX ? hoveredVertex.x - boxW - 14 : hoveredVertex.x + 14;
              const flipY = hoveredVertex.y + boxH / 2 > 520;
              const ty = flipY ? hoveredVertex.y - boxH - 10 : hoveredVertex.y - boxH / 2;
              return (
                <g>
                  <rect x={tx} y={ty} width={boxW} height={boxH} rx={6} fill="#0c1520" stroke="#374151" strokeWidth={1} />
                  <text x={tx + 8} y={ty + 15} className="fill-gray-400 text-[10px]">{axis.label}{axis.computed ? ` (Lv ${level})` : ""}</text>
                  {lines.map((l, li) => {
                    const ly = ty + 28 + li * lineH;
                    return (
                      <g key={li}>
                        <text x={tx + 8} y={ly} className="text-[11px] font-bold" fill={l.color}>{l.name}</text>
                        <text x={tx + boxW - 8} y={ly} textAnchor="end" className="text-[11px] font-mono"
                          fill={l.diff === undefined ? l.color : "#9ca3af"}>
                          {fmtVal(l.val)}
                          {l.diff !== undefined && l.diff !== 0 && (
                            <tspan fill={(axis.lowerIsBetter ? -l.diff : l.diff) > 0 ? "#4ade80" : "#f87171"} className="text-[9px]">
                              {" "}({l.diff > 0 ? "+" : ""}{fmtVal(l.diff)})
                            </tspan>
                          )}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })()}

            {/* Hero icons at centroid */}
            {[...selectedHeroes]
              .sort((a, b) => { if (a.heroId === focusedId) return 1; if (b.heroId === focusedId) return -1; return 0; })
              .map((hero) => {
                let ax = 0, ay = 0;
                activeAxes.forEach((axis, i) => {
                  const val = getVal(hero, axis);
                  const p = getPoint(i, normalize(axis, val));
                  ax += p.x; ay += p.y;
                });
                ax /= statCount; ay /= statCount;
                const color = getColor(hero.heroId);
                const isFocused = hero.heroId === focusedId;
                const hasFocus = focusedId !== null;
                const r = isFocused ? 18 : 16;
                return (
                  <g key={`icon-${hero.heroId}`} className="cursor-pointer"
                    style={{ opacity: hasFocus && !isFocused ? 0.3 : 1 }}
                    onClick={() => setFocusedId(isFocused ? null : hero.heroId)}>
                    <circle cx={ax} cy={ay} r={r} fill="#0f1923" stroke={color.stroke} strokeWidth={isFocused ? 3 : 2} />
                    <clipPath id={`clip-${hero.heroId}`}><circle cx={ax} cy={ay} r={r - 2} /></clipPath>
                    <image href={`${import.meta.env.BASE_URL}icons/${hero.icon}`}
                      x={ax - (r - 2)} y={ay - (r - 2)} width={(r - 2) * 2} height={(r - 2) * 2}
                      clipPath={`url(#clip-${hero.heroId})`} />
                  </g>
                );
              })}
          </svg>
        )}
      </div>

      {/* Right panel — Dota-style hero stat cards */}
      {selectedHeroes.length > 0 && (
        <div className="w-72 shrink-0 flex flex-col gap-3 py-2 pl-3 pr-2 border-l border-gray-800/50 overflow-y-auto custom-scroll">
          {selectedHeroes.map((hero) => {
            const color = getColor(hero.heroId);
            const str = num(hero.baseStrength) + num(hero.strengthGain) * (level - 1);
            const agi = num(hero.baseAgility) + num(hero.agilityGain) * (level - 1);
            const int = num(hero.baseIntelligence) + num(hero.intelligenceGain) * (level - 1);
            const hp = formula.baseHp + str * formula.hpPerStr;
            const mana = formula.baseMana + int * formula.manaPerInt;
            const armor = num(hero.armorPhysical) + agi * formula.armorPerAgi;
            const dmgMin = num(hero.attackDamageMin);
            const dmgMax = num(hero.attackDamageMax);
            const attr = hero.attributePrimary || "str";
            let attrDmg: number;
            if (attr === "all" && formula.universalDmgPerAttr !== null) {
              attrDmg = (str + agi + int) * formula.universalDmgPerAttr;
            } else {
              attrDmg = (attr === "str" ? str : attr === "agi" ? agi : int) * formula.primaryDmgMultiplier;
            }

            return (
              <div
                key={hero.heroId}
                className={`rounded-lg border cursor-pointer transition-all duration-200 bg-[#0c1520] border-gray-700/40 ${
                  focusedId === hero.heroId ? "shadow-lg scale-[1.02]" : focusedId !== null ? "opacity-40" : "hover:opacity-90"
                }`}
                style={focusedId === hero.heroId ? { boxShadow: `0 0 16px ${color.stroke}30`, borderColor: color.stroke + "60" } : undefined}
                onClick={() => setFocusedId(focusedId === hero.heroId ? null : hero.heroId)}
              >
                {/* Header */}
                <div className="flex items-center gap-2 px-3 py-2">
                  <img src={`${import.meta.env.BASE_URL}icons/${hero.icon}`} alt="" className="w-8 h-8 rounded-sm" />
                  <span className={`text-sm font-bold flex-1 ${color.label}`}>{hero.displayName}</span>
                  <button onClick={(e) => { e.stopPropagation(); toggleHero(hero.heroId); }} className="text-gray-500 hover:text-gray-300 text-sm">✕</button>
                </div>

                {/* HP / Mana bars */}
                <div className="px-3 mb-2 space-y-0.5">
                  <div className="relative h-5 rounded-sm overflow-hidden bg-[#1a2820]">
                    <div className="absolute inset-0 rounded-sm" style={{ width: "100%", background: "linear-gradient(90deg, #1a5c1a, #2d8a2d)" }} />
                    <div className="absolute inset-0 flex items-center justify-between px-1.5">
                      <span className="text-[10px] font-mono font-bold text-green-100">{Math.round(hp)}</span>
                      <span className="text-[9px] font-mono text-green-200/70">+{fmtVal(num(hero.healthRegen) + str * 0.1)}</span>
                    </div>
                  </div>
                  <div className="relative h-5 rounded-sm overflow-hidden bg-[#1a2040]">
                    <div className="absolute inset-0 rounded-sm" style={{ width: "100%", background: "linear-gradient(90deg, #1a3a6b, #2d5aaa)" }} />
                    <div className="absolute inset-0 flex items-center justify-between px-1.5">
                      <span className="text-[10px] font-mono font-bold text-blue-100">{Math.round(mana)}</span>
                      <span className="text-[9px] font-mono text-blue-200/70">+{fmtVal(int * 0.05)}</span>
                    </div>
                  </div>
                </div>

                {/* Attributes */}
                <div className="px-3 mb-2 flex justify-between">
                  {([
                    { val: str, gain: num(hero.strengthGain), type: "str" as const },
                    { val: agi, gain: num(hero.agilityGain), type: "agi" as const },
                    { val: int, gain: num(hero.intelligenceGain), type: "int" as const },
                  ]).map((a) => (
                    <div key={a.type} className="flex items-center gap-1.5">
                      <AttrIcon type={a.type} size={16} />
                      <span className="text-[12px] font-bold text-gray-100 font-mono">{Math.round(a.val)}</span>
                      <span className="text-[9px] text-gray-500 font-mono">+{a.gain.toFixed(1)}</span>
                    </div>
                  ))}
                </div>

                {/* Stat groups */}
                <div className="px-3 pb-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
                  <div className="col-span-2 text-[8px] uppercase tracking-widest text-gray-600 mt-1">Attack</div>
                  <StatRow label="Damage" value={`${Math.round(dmgMin + attrDmg)}-${Math.round(dmgMax + attrDmg)}`} />
                  <StatRow label="BAT" value={fmtVal(num(hero.attackRate))} />
                  <StatRow label="Range" value={String(num(hero.attackRange))} />
                  <StatRow label="Anim." value={fmtVal(num(hero.attackAnimationPoint))} />

                  <div className="col-span-2 text-[8px] uppercase tracking-widest text-gray-600 mt-1.5">Defense</div>
                  <StatRow label="Armor" value={fmtVal(armor)} />
                  <StatRow label="Magic Res." value={`${num(hero.magicResistance)}%`} />
                  <StatRow label="HP Regen" value={fmtVal(num(hero.healthRegen) + str * 0.1)} />
                  <StatRow label="Mana Regen" value={fmtVal(int * 0.05)} />

                  <div className="col-span-2 text-[8px] uppercase tracking-widest text-gray-600 mt-1.5">Mobility</div>
                  <StatRow label="Move Spd" value={String(num(hero.movementSpeed))} />
                  <StatRow label="Turn Rate" value={fmtVal(num(hero.movementTurnRate))} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AttrIcon({ type, size = 16 }: { type: "str" | "agi" | "int" | "all"; size?: number }) {
  const colors = { str: "#ef4444", agi: "#22c55e", int: "#3b82f6", all: "#a855f7" };
  const c = colors[type];
  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0"
      style={{ width: size, height: size, background: `radial-gradient(circle, ${c}40, ${c}15)`, border: `1.5px solid ${c}` }}
    />
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-200 font-mono font-bold">{value}</span>
    </div>
  );
}

function fmtVal(v: number): string {
  if (Number.isNaN(v)) return "—";
  if (Number.isInteger(v)) return String(v);
  if (Math.abs(v) >= 100) return Math.round(v).toString();
  return v.toFixed(2);
}
