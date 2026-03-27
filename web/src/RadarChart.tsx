import { useMemo, useState } from "react";
import { STATS } from "./stats";

interface HeroData {
  name: string;
  heroId: number;
  icon: string;
  [key: string]: any;
}

interface Props {
  heroes: HeroData[];
  selectedIds: number[];
  onSelectedChange: (ids: number[]) => void;
}

const COLORS = [
  { stroke: "#3b82f6", fill: "rgba(59,130,246,0.12)", label: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/30" },
  { stroke: "#f97316", fill: "rgba(249,115,22,0.12)", label: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30" },
  { stroke: "#22c55e", fill: "rgba(34,197,94,0.12)", label: "text-green-400", bg: "bg-green-500/10 border-green-500/30" },
  { stroke: "#a855f7", fill: "rgba(168,85,247,0.12)", label: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/30" },
];

const MAX_HEROES = 4;
const RADAR_STATS = STATS.filter((s) => s.heroKey !== "projectileSpeed");

const CX = 300;
const CY = 270;
const RADIUS = 210;

export function RadarChart({ heroes, selectedIds, onSelectedChange }: Props) {
  const [search, setSearch] = useState("");
  const [hoveredVertex, setHoveredVertex] = useState<{
    heroId: number;
    statIdx: number;
    x: number;
    y: number;
    value: number;
    statLabel: string;
    heroName: string;
    color: string;
  } | null>(null);

  const ranges = useMemo(() => {
    const r: Record<string, { min: number; max: number }> = {};
    for (const stat of RADAR_STATS) {
      const vals = heroes.map((h) => Number(h[stat.heroKey]) || 0);
      r[stat.heroKey] = { min: Math.min(...vals), max: Math.max(...vals) };
    }
    return r;
  }, [heroes]);

  const normalize = (stat: (typeof RADAR_STATS)[number], val: number) => {
    const { min, max } = ranges[stat.heroKey];
    if (max === min) return 0.5;
    let norm = (val - min) / (max - min);
    if (stat.lowerIsBetter) norm = 1 - norm;
    return norm * 0.8 + 0.15;
  };

  const [focusedId, setFocusedId] = useState<number | null>(null);

  const selectedHeroes = selectedIds
    .map((id) => heroes.find((h) => h.heroId === id))
    .filter((h): h is HeroData => h != null);

  const toggleHero = (id: number) => {
    if (selectedIds.includes(id)) {
      if (focusedId === id) setFocusedId(null);
      onSelectedChange(selectedIds.filter((i) => i !== id));
    } else if (selectedIds.length < MAX_HEROES) {
      onSelectedChange([...selectedIds, id]);
    }
  };

  const searchLower = search.toLowerCase().replace(/_/g, " ");
  const filteredHeroes = searchLower
    ? heroes.filter((h) => h.name.replace(/_/g, " ").includes(searchLower))
    : heroes;

  const statCount = RADAR_STATS.length;

  const getPoint = (statIdx: number, value: number) => {
    const angle = (2 * Math.PI * statIdx) / statCount - Math.PI / 2;
    const r = value * RADIUS;
    return { x: CX + Math.cos(angle) * r, y: CY + Math.sin(angle) * r };
  };

  const buildPath = (hero: HeroData) => {
    return RADAR_STATS.map((stat, i) => {
      const val = Number(hero[stat.heroKey]) || 0;
      const p = getPoint(i, normalize(stat, val));
      return (i === 0 ? "M " : "L ") + `${p.x} ${p.y}`;
    }).join(" ") + " Z";
  };

  return (
    <div className="flex h-full gap-0">
      {/* Hero picker */}
      <div className="w-48 shrink-0 flex flex-col border-r border-gray-800/50 pr-3">
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
            const colorIdx = selectedIds.indexOf(hero.heroId);
            const isSelected = colorIdx >= 0;
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
                <img
                  src={`${import.meta.env.BASE_URL}icons/${hero.icon}`}
                  alt=""
                  className="w-5 h-5 rounded-sm"
                />
                <span className="text-gray-300 capitalize truncate flex-1 text-left">
                  {hero.name.replace(/_/g, " ")}
                </span>
                {isSelected && (
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: COLORS[colorIdx].stroke }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Radar */}
      <div className="flex-1 flex items-center justify-center min-w-0 relative px-4">
        {selectedHeroes.length === 0 ? (
          <svg
            viewBox="0 0 600 540"
            className="w-full max-w-[700px] max-h-full"
            style={{ overflow: "visible" }}
          >
            {[0.2, 0.4, 0.6, 0.8, 1.0].map((r) => (
              <polygon
                key={r}
                points={RADAR_STATS.map((_, i) => {
                  const p = getPoint(i, r);
                  return `${p.x},${p.y}`;
                }).join(" ")}
                fill="none"
                stroke="#1e293b"
                strokeWidth={r === 1 ? 1.5 : 0.5}
              />
            ))}
            {RADAR_STATS.map((stat, i) => {
              const p = getPoint(i, 1);
              const labelPoint = getPoint(i, 1.25);
              return (
                <g key={stat.id}>
                  <line x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="#1e293b" strokeWidth={0.5} />
                  <text
                    x={labelPoint.x}
                    y={labelPoint.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-gray-500 text-[12px]"
                  >
                    {stat.label}
                  </text>
                </g>
              );
            })}
            <text x={CX} y={CY + 4} textAnchor="middle" className="fill-gray-600 text-[13px]">
              Select heroes to compare
            </text>
          </svg>
        ) : (
          <svg
            viewBox="0 0 600 540"
            className="w-full max-w-[700px] max-h-full"
            style={{ overflow: "visible" }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setFocusedId(null);
            }}
          >
            {/* Invisible background rect for click-to-unfocus */}
            <rect x="0" y="0" width="600" height="540" fill="transparent" onClick={() => setFocusedId(null)} />
              {/* Grid rings */}
              {[0.2, 0.4, 0.6, 0.8, 1.0].map((r) => (
                <polygon
                  key={r}
                  points={RADAR_STATS.map((_, i) => {
                    const p = getPoint(i, r);
                    return `${p.x},${p.y}`;
                  }).join(" ")}
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth={r === 1 ? 1.5 : 0.5}
                />
              ))}

              {/* Axis lines */}
              {RADAR_STATS.map((_, i) => {
                const p = getPoint(i, 1);
                return (
                  <line
                    key={i}
                    x1={CX}
                    y1={CY}
                    x2={p.x}
                    y2={p.y}
                    stroke="#1e293b"
                    strokeWidth={0.5}
                  />
                );
              })}

              {/* Hero shapes — focused hero renders last (on top) */}
              {[...selectedHeroes]
                .sort((a, b) => {
                  if (a.heroId === focusedId) return 1;
                  if (b.heroId === focusedId) return -1;
                  return 0;
                })
                .map((hero) => {
                  const hi = selectedIds.indexOf(hero.heroId);
                  const color = COLORS[hi % COLORS.length];
                  const isFocused = hero.heroId === focusedId;
                  const hasFocus = focusedId !== null;
                  const hasHover = hoveredVertex !== null;
                  const isHoverTarget = hoveredVertex?.heroId === hero.heroId;

                  let opacity = 1;
                  if (hasFocus && !isFocused && !isHoverTarget) opacity = 0.12;
                  else if (hasHover && !isHoverTarget && !isFocused) opacity = 0.15;

                  return (
                    <path
                      key={hero.heroId}
                      d={buildPath(hero)}
                      fill={color.fill}
                      stroke={color.stroke}
                      strokeWidth={isFocused ? 3 : 2}
                      strokeLinejoin="round"
                      className="cursor-pointer transition-all duration-200"
                      style={{
                        opacity,
                        pointerEvents: hasFocus && !isFocused ? "none" : "auto",
                      }}
                      onClick={() => setFocusedId(isFocused ? null : hero.heroId)}
                    />
                  );
                })}

              {/* Stat labels + axis values */}
              {RADAR_STATS.map((stat, i) => {
                const { min, max } = ranges[stat.heroKey];
                const displayMax = stat.lowerIsBetter ? min : max;

                // Label further out, value between label and outer ring
                const angle = (2 * Math.PI * i) / statCount - Math.PI / 2;
                const isBottom = angle > 0 && angle < Math.PI;
                const labelPoint = getPoint(i, 1.25);
                const valuePoint = getPoint(i, 1.08);

                // Offset value text away from the label
                const valOffsetY = isBottom ? -10 : 12;

                return (
                  <g key={stat.id}>
                    <text
                      x={labelPoint.x}
                      y={labelPoint.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-gray-300 text-[12px] font-medium"
                    >
                      {stat.label}
                    </text>
                    <text
                      x={valuePoint.x}
                      y={valuePoint.y + valOffsetY}
                      textAnchor="middle"
                      className="fill-gray-600 text-[9px] font-mono"
                    >
                      {fmtVal(displayMax)}
                    </text>
                  </g>
                );
              })}

              {/* Vertex dots — focused hero's dots render last */}
              {[...selectedHeroes]
                .sort((a, b) => {
                  if (a.heroId === focusedId) return 1;
                  if (b.heroId === focusedId) return -1;
                  return 0;
                })
                .flatMap((hero) => {
                  const hi = selectedIds.indexOf(hero.heroId);
                  const color = COLORS[hi % COLORS.length];
                  const isFocused = hero.heroId === focusedId;
                  const hasFocus = focusedId !== null;

                  return RADAR_STATS.map((stat, i) => {
                    const val = Number(hero[stat.heroKey]) || 0;
                    const p = getPoint(i, normalize(stat, val));
                    const isHovered =
                      hoveredVertex?.heroId === hero.heroId &&
                      hoveredVertex?.statIdx === i;

                    let opacity = 1;
                    if (hasFocus && !isFocused) opacity = 0.25;

                    return (
                      <circle
                        key={`${hero.heroId}-${i}`}
                        cx={p.x}
                        cy={p.y}
                        r={isHovered ? 7 : isFocused ? 6 : 5}
                        fill={color.stroke}
                        stroke="#0f1923"
                        strokeWidth={2}
                        className="cursor-pointer transition-all duration-150"
                        style={{ opacity }}
                        onMouseEnter={() =>
                          setHoveredVertex({
                            heroId: hero.heroId,
                            statIdx: i,
                            x: p.x,
                            y: p.y,
                            value: val,
                            statLabel: stat.label,
                            heroName: hero.name,
                            color: color.stroke,
                          })
                        }
                        onMouseLeave={() => setHoveredVertex(null)}
                      />
                    );
                  });
                })}

              {/* Tooltip with comparison */}
              {hoveredVertex && (() => {
                const stat = RADAR_STATS[hoveredVertex.statIdx];
                // Build comparison lines: hovered hero vs all others
                const lines: { name: string; val: number; color: string; diff?: number }[] = [];
                for (const h of selectedHeroes) {
                  const hi = selectedIds.indexOf(h.heroId);
                  const color = COLORS[hi % COLORS.length];
                  const val = Number(h[stat.heroKey]) || 0;
                  if (h.heroId === hoveredVertex.heroId) {
                    lines.unshift({ name: h.name, val, color: color.stroke });
                  } else {
                    const diff = hoveredVertex.value - val;
                    lines.push({ name: h.name, val, color: color.stroke, diff });
                  }
                }

                const boxW = 200;
                const lineH = 16;
                const boxH = 24 + lines.length * lineH;
                // Flip horizontally if near right edge
                const flipX = hoveredVertex.x + boxW + 20 > 600;
                const tx = flipX ? hoveredVertex.x - boxW - 14 : hoveredVertex.x + 14;
                // Flip vertically if near bottom
                const flipY = hoveredVertex.y + boxH / 2 > 520;
                const ty = flipY ? hoveredVertex.y - boxH - 10 : hoveredVertex.y - boxH / 2;

                return (
                  <g>
                    <rect
                      x={tx}
                      y={ty}
                      width={boxW}
                      height={boxH}
                      rx={6}
                      fill="#0c1520"
                      stroke="#374151"
                      strokeWidth={1}
                    />
                    <text
                      x={tx + 8}
                      y={ty + 15}
                      className="fill-gray-400 text-[10px]"
                    >
                      {stat.label}
                    </text>
                    {lines.map((l, li) => {
                      const ly = ty + 28 + li * lineH;
                      return (
                        <g key={li}>
                          <text
                            x={tx + 8}
                            y={ly}
                            className="text-[11px] font-bold"
                            fill={l.color}
                            style={{ textTransform: "capitalize" }}
                          >
                            {l.name.replace(/_/g, " ")}
                          </text>
                          <text
                            x={tx + boxW - 8}
                            y={ly}
                            textAnchor="end"
                            className="text-[11px] font-mono"
                            fill={l.diff === undefined ? l.color : "#9ca3af"}
                          >
                            {fmtVal(l.val)}
                            {l.diff !== undefined && l.diff !== 0 && (
                              <tspan
                                fill={
                                  (stat.lowerIsBetter ? -l.diff : l.diff) > 0
                                    ? "#4ade80"
                                    : "#f87171"
                                }
                                className="text-[9px]"
                              >
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

              {/* Hero icons at center of their shape — focused last */}
              {[...selectedHeroes]
                .sort((a, b) => {
                  if (a.heroId === focusedId) return 1;
                  if (b.heroId === focusedId) return -1;
                  return 0;
                })
                .map((hero) => {
                const hi = selectedIds.indexOf(hero.heroId);
                // Average position of all vertices
                let ax = 0,
                  ay = 0;
                RADAR_STATS.forEach((stat, i) => {
                  const val = Number(hero[stat.heroKey]) || 0;
                  const p = getPoint(i, normalize(stat, val));
                  ax += p.x;
                  ay += p.y;
                });
                ax /= statCount;
                ay /= statCount;
                const color = COLORS[hi % COLORS.length];
                const isFocused = hero.heroId === focusedId;
                const hasFocus = focusedId !== null;
                const r = isFocused ? 18 : 16;
                return (
                  <g
                    key={`icon-${hero.heroId}`}
                    className="cursor-pointer"
                    style={{ opacity: hasFocus && !isFocused ? 0.3 : 1 }}
                    onClick={() => setFocusedId(isFocused ? null : hero.heroId)}
                  >
                    <circle
                      cx={ax}
                      cy={ay}
                      r={r}
                      fill="#0f1923"
                      stroke={color.stroke}
                      strokeWidth={isFocused ? 3 : 2}
                    />
                    <clipPath id={`clip-${hero.heroId}`}>
                      <circle cx={ax} cy={ay} r={r - 2} />
                    </clipPath>
                    <image
                      href={`${import.meta.env.BASE_URL}icons/${hero.icon}`}
                      x={ax - (r - 2)}
                      y={ay - (r - 2)}
                      width={(r - 2) * 2}
                      height={(r - 2) * 2}
                      clipPath={`url(#clip-${hero.heroId})`}
                    />
                  </g>
                );
              })}
            </svg>
        )}
      </div>

      {/* Right panel — hero stat cards */}
      {selectedHeroes.length > 0 && (
        <div className="w-56 shrink-0 flex flex-col gap-3 py-2 pl-3 pr-1 border-l border-gray-800/50 overflow-y-auto custom-scroll">
          <div className="text-[9px] uppercase tracking-widest text-gray-600 px-1">
            Selected Heroes
          </div>
          {selectedHeroes.map((hero) => {
            const hi = selectedIds.indexOf(hero.heroId);
            const color = COLORS[hi % COLORS.length];
            return (
              <div
                key={hero.heroId}
                className={`rounded-lg border cursor-pointer transition-all duration-200 ${color.bg} ${
                  focusedId === hero.heroId
                    ? "shadow-lg scale-[1.02]"
                    : focusedId !== null
                      ? "opacity-40"
                      : "hover:opacity-90"
                }`}
                style={focusedId === hero.heroId ? { boxShadow: `0 0 16px ${color.stroke}30` } : undefined}
                onClick={() => setFocusedId(focusedId === hero.heroId ? null : hero.heroId)}
              >
                {/* Header */}
                <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700/20">
                  <img
                    src={`${import.meta.env.BASE_URL}icons/${hero.icon}`}
                    alt=""
                    className="w-7 h-7 rounded-sm"
                  />
                  <span
                    className={`text-sm font-bold capitalize flex-1 ${color.label}`}
                  >
                    {hero.name.replace(/_/g, " ")}
                  </span>
                  <button
                    onClick={() => toggleHero(hero.heroId)}
                    className="text-gray-500 hover:text-gray-300 text-sm"
                  >
                    ✕
                  </button>
                </div>
                {/* Stats */}
                <div className="px-3 py-2 space-y-1">
                  {RADAR_STATS.map((stat) => {
                    const val = Number(hero[stat.heroKey]) || 0;
                    const norm = normalize(stat, val);
                    return (
                      <div key={stat.id}>
                        <div className="flex justify-between text-[11px] mb-0.5">
                          <span className="text-gray-400">{stat.label}</span>
                          <span className="text-gray-100 font-mono font-bold">
                            {fmtVal(val)}
                          </span>
                        </div>
                        <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${norm * 100}%`,
                              background: color.stroke,
                              opacity: 0.7,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function fmtVal(v: number): string {
  if (Number.isNaN(v)) return "—";
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2);
}
