import { useEffect, useMemo, useRef, useState } from "react";
import { STATS } from "./App";

interface HeroData {
  name: string;
  key: string;
  heroId: number;
  icon: string;
  [key: string]: any;
}

interface Props {
  heroes: HeroData[];
  initialX?: string;
  initialY?: string;
  onAxesChange?: (x: string, y: string) => void;
}

interface PlotPoint {
  hero: HeroData;
  x: number;
  y: number;
  groupKey: string;
}

interface Cluster {
  key: string;
  cx: number;
  cy: number;
  heroes: HeroData[];
}

const ICON_SIZE = 32;
const PADDING = { top: 20, right: 30, bottom: 40, left: 50 };
const FAN_RADIUS = 50;

export function ScatterPlot({ heroes, initialX, initialY, onAxesChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [xStat, setXStatRaw] = useState(initialX || "movementSpeed");
  const [yStat, setYStatRaw] = useState(initialY || "armorPhysical");

  const setXStat = (v: string) => {
    setXStatRaw(v);
    onAxesChange?.(v, yStat);
  };
  const setYStat = (v: string) => {
    setYStatRaw(v);
    onAxesChange?.(xStat, v);
  };
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);
  const [hoveredCluster, setHoveredCluster] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setSize({ w: rect.width, h: rect.height });
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Reset expanded cluster when stats change
  useEffect(() => {
    setExpandedCluster(null);
  }, [xStat, yStat]);

  // Search matching
  const searchLower = search.toLowerCase().replace(/_/g, " ");
  const matchedHeroes = useMemo(() => {
    if (!searchLower) return new Set<string>();
    return new Set(
      heroes
        .filter((h) => h.name.replace(/_/g, " ").includes(searchLower))
        .map((h) => h.name),
    );
  }, [heroes, searchLower]);

  const plotW = size.w - PADDING.left - PADDING.right;
  const plotH = size.h - PADDING.top - PADDING.bottom;

  const { clusters, xTicks, yTicks, xRange, yRange } = useMemo(() => {
    const xVals = heroes.map((h) => Number(h[xStat]) || 0);
    const yVals = heroes.map((h) => Number(h[yStat]) || 0);

    const xMin = Math.min(...xVals);
    const xMax = Math.max(...xVals);
    const yMin = Math.min(...yVals);
    const yMax = Math.max(...yVals);

    const xPad = (xMax - xMin) * 0.05 || 1;
    const yPad = (yMax - yMin) * 0.05 || 1;

    const xRange = { min: xMin - xPad, max: xMax + xPad };
    const yRange = { min: yMin - yPad, max: yMax + yPad };

    const scaleX = (v: number) =>
      PADDING.left + ((v - xRange.min) / (xRange.max - xRange.min)) * plotW;
    const scaleY = (v: number) =>
      PADDING.top + plotH - ((v - yRange.min) / (yRange.max - yRange.min)) * plotH;

    // Group heroes by same X/Y values
    const groups = new Map<string, { cx: number; cy: number; heroes: HeroData[] }>();
    for (const h of heroes) {
      const xv = Number(h[xStat]) || 0;
      const yv = Number(h[yStat]) || 0;
      const key = `${xv}_${yv}`;
      if (!groups.has(key)) {
        groups.set(key, { cx: scaleX(xv), cy: scaleY(yv), heroes: [] });
      }
      groups.get(key)!.heroes.push(h);
    }

    const clusters: Cluster[] = [...groups.entries()].map(([key, g]) => ({
      key,
      cx: g.cx,
      cy: g.cy,
      heroes: g.heroes,
    }));

    const xTicks = niceTicks(xRange.min, xRange.max, 10).map((v) => ({
      v,
      x: scaleX(v),
    }));
    const yTicks = niceTicks(yRange.min, yRange.max, 8).map((v) => ({
      v,
      y: scaleY(v),
    }));

    return { clusters, xTicks, yTicks, xRange, yRange };
  }, [heroes, xStat, yStat, plotW, plotH]);

  // Auto-expand clusters containing searched heroes
  useEffect(() => {
    if (matchedHeroes.size === 0) return;
    for (const cluster of clusters) {
      if (cluster.heroes.length > 1 && cluster.heroes.some((h) => matchedHeroes.has(h.name))) {
        setExpandedCluster(cluster.key);
        return;
      }
    }
  }, [matchedHeroes, clusters]);

  const hasSearch = searchLower.length > 0;

  const xLabel = STATS.find((s) => s.heroKey === xStat)?.label || xStat;
  const yLabel = STATS.find((s) => s.heroKey === yStat)?.label || yStat;

  const statOptions = STATS.map((s) => ({
    value: s.heroKey,
    label: s.label,
  }));

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="flex items-center gap-4 mb-3">
        <h2 className="text-lg font-bold text-gray-100">Scatter Plot</h2>
        <div className="relative ml-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search hero..."
            className="bg-gray-800 text-gray-200 text-xs rounded-md px-3 py-1.5 pl-7 border border-gray-700 outline-none focus:border-blue-500 w-44"
          />
          <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" strokeWidth="2" />
            <path d="M21 21l-4.35-4.35" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-xs text-gray-500">X:</label>
          <select
            value={xStat}
            onChange={(e) => setXStat(e.target.value)}
            className="bg-gray-800 text-gray-200 text-xs rounded px-2 py-1 border border-gray-700 outline-none"
          >
            {statOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <label className="text-xs text-gray-500 ml-2">Y:</label>
          <select
            value={yStat}
            onChange={(e) => setYStat(e.target.value)}
            className="bg-gray-800 text-gray-200 text-xs rounded px-2 py-1 border border-gray-700 outline-none"
          >
            {statOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Chart */}
      <div
        ref={containerRef}
        className="flex-1 relative min-h-0"
        onClick={() => setExpandedCluster(null)}
      >
        <svg width={size.w} height={size.h} className="absolute inset-0">
          {/* Grid */}
          {xTicks.map((t, i) => (
            <line key={`xg-${i}`} x1={t.x} y1={PADDING.top} x2={t.x} y2={PADDING.top + plotH} stroke="#1e293b" />
          ))}
          {yTicks.map((t, i) => (
            <line key={`yg-${i}`} x1={PADDING.left} y1={t.y} x2={PADDING.left + plotW} y2={t.y} stroke="#1e293b" />
          ))}

          {/* Axes */}
          <line x1={PADDING.left} y1={PADDING.top + plotH} x2={PADDING.left + plotW} y2={PADDING.top + plotH} stroke="#374151" />
          <line x1={PADDING.left} y1={PADDING.top} x2={PADDING.left} y2={PADDING.top + plotH} stroke="#374151" />

          {/* X labels */}
          {xTicks.map((t, i) => (
            <text key={`xl-${i}`} x={t.x} y={PADDING.top + plotH + 16} textAnchor="middle" className="fill-gray-500 text-[10px] font-mono">
              {fmtVal(t.v)}
            </text>
          ))}

          {/* Y labels */}
          {yTicks.map((t, i) => (
            <text key={`yl-${i}`} x={PADDING.left - 8} y={t.y + 3} textAnchor="end" className="fill-gray-500 text-[10px] font-mono">
              {fmtVal(t.v)}
            </text>
          ))}

          {/* Axis titles */}
          <text x={PADDING.left + plotW / 2} y={size.h - 4} textAnchor="middle" className="fill-gray-400 text-[11px]">
            {xLabel}
          </text>
          <text x={14} y={PADDING.top + plotH / 2} textAnchor="middle" transform={`rotate(-90, 14, ${PADDING.top + plotH / 2})`} className="fill-gray-400 text-[11px]">
            {yLabel}
          </text>
        </svg>

        {/* Clusters — render expanded last so it paints on top */}
        {[...clusters].sort((a, b) => {
          if (a.key === expandedCluster) return 1;
          if (b.key === expandedCluster) return -1;
          return 0;
        }).map((cluster) => {
          const isExpanded = expandedCluster === cluster.key;
          const isSingle = cluster.heroes.length === 1;

          if (isSingle) {
            const isMatch = matchedHeroes.has(cluster.heroes[0].name);
            return (
              <HeroIcon
                key={cluster.key}
                hero={cluster.heroes[0]}
                x={cluster.cx}
                y={cluster.cy}
                xStat={xStat}
                yStat={yStat}
                xLabel={xLabel}
                yLabel={yLabel}
                dimmed={hasSearch && !isMatch}
                highlighted={hasSearch && isMatch}
              />
            );
          }

          if (isExpanded) {
            const count = cluster.heroes.length;
            const radius = Math.max(FAN_RADIUS, count * 8);
            const bgSize = (radius + ICON_SIZE) * 2 + 20;
            return (
              <div key={cluster.key}>
                {/* Dark backdrop */}
                <div
                  className="absolute rounded-full"
                  style={{
                    left: cluster.cx - bgSize / 2,
                    top: cluster.cy - bgSize / 2,
                    width: bgSize,
                    height: bgSize,
                    zIndex: 30,
                    background: "radial-gradient(circle, rgba(10,18,25,0.95) 0%, rgba(10,18,25,0.85) 70%, transparent 100%)",
                    animation: "scatter-ring 0.3s ease-out forwards",
                  }}
                />
                {/* Lines from center to each hero */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 31 }}>
                  {cluster.heroes.map((hero, i) => {
                    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
                    const fx = cluster.cx + Math.cos(angle) * radius;
                    const fy = cluster.cy + Math.sin(angle) * radius;
                    return (
                      <line
                        key={hero.heroId}
                        x1={cluster.cx}
                        y1={cluster.cy}
                        x2={fx}
                        y2={fy}
                        stroke="#374151"
                        strokeWidth={1}
                        strokeDasharray="3 3"
                        opacity={0.4}
                      />
                    );
                  })}
                </svg>
                {/* Fan-out hero icons */}
                {cluster.heroes.map((hero, i) => {
                  const angle = (2 * Math.PI * i) / count - Math.PI / 2;
                  const fx = cluster.cx + Math.cos(angle) * radius;
                  const fy = cluster.cy + Math.sin(angle) * radius;
                  const isMatch = matchedHeroes.has(hero.name);
                  return (
                    <HeroIcon
                      key={hero.heroId}
                      hero={hero}
                      x={fx}
                      y={fy}
                      xStat={xStat}
                      yStat={yStat}
                      xLabel={xLabel}
                      yLabel={yLabel}
                      animated
                      fromX={cluster.cx}
                      fromY={cluster.cy}
                      dimmed={hasSearch && !isMatch}
                      highlighted={hasSearch && isMatch}
                    />
                  );
                })}
              </div>
            );
          }

          // Collapsed cluster — show stacked with badge
          return (
            <div
              key={cluster.key}
              className="absolute cursor-pointer group"
              style={{
                left: cluster.cx - ICON_SIZE / 2,
                top: cluster.cy - ICON_SIZE / 2,
                width: ICON_SIZE,
                height: ICON_SIZE,
                zIndex: hoveredCluster === cluster.key ? 40 : 10,
              }}
              onClick={(e) => {
                e.stopPropagation();
                setExpandedCluster(cluster.key);
              }}
              onMouseEnter={() => setHoveredCluster(cluster.key)}
              onMouseLeave={() => setHoveredCluster(null)}
            >
              {/* Stacked icons (show top 3) */}
              {cluster.heroes.slice(0, 3).map((hero, i) => (
                <img
                  key={hero.heroId}
                  src={`${import.meta.env.BASE_URL}icons/${hero.icon}`}
                  alt={hero.name}
                  className="absolute w-full h-full object-cover rounded-sm border border-gray-700/50 hover:scale-110 transition-transform"
                  style={{
                    top: -i * 3,
                    left: i * 3,
                    zIndex: 3 - i,
                    opacity: 1 - i * 0.15,
                  }}
                />
              ))}
              {/* Count badge */}
              <div
                className="absolute -top-2 -right-2 bg-blue-600 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
                style={{ zIndex: 10 }}
              >
                {cluster.heroes.length}
              </div>
              {/* Tooltip showing all hero names */}
              <div
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
                style={{ zIndex: 50 }}
              >
                <div className="bg-[#0c1520] border border-gray-700 rounded-lg shadow-xl p-2 min-w-[120px]">
                  <div className="text-[10px] text-gray-500 mb-1">
                    {cluster.heroes.length} heroes — click to expand
                  </div>
                  {cluster.heroes.map((h) => (
                    <div key={h.heroId} className="flex items-center gap-1.5 py-0.5">
                      <img
                        src={`${import.meta.env.BASE_URL}icons/${h.icon}`}
                        className="w-4 h-4 rounded-sm"
                        alt=""
                      />
                      <span className="text-[10px] text-gray-300 capitalize">
                        {h.name.replace(/_/g, " ")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HeroIcon({
  hero,
  x,
  y,
  xStat,
  yStat,
  xLabel,
  yLabel,
  animated,
  fromX,
  fromY,
  dimmed,
  highlighted,
}: {
  hero: HeroData;
  x: number;
  y: number;
  xStat: string;
  yStat: string;
  xLabel: string;
  yLabel: string;
  animated?: boolean;
  fromX?: number;
  fromY?: number;
  dimmed?: boolean;
  highlighted?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!animated || fromX === undefined || fromY === undefined || !ref.current) return;
    const el = ref.current;
    const dx = fromX - x;
    const dy = fromY - y;
    el.style.transition = "none";
    el.style.transform = `translate(${dx}px, ${dy}px) scale(0.3)`;
    el.style.opacity = "0";
    el.offsetHeight;
    el.style.transition = "transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s ease-out";
    el.style.transform = "translate(0, 0) scale(1)";
    el.style.opacity = "1";
  }, [animated, fromX, fromY, x, y]);

  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      ref={ref}
      className="absolute group"
      style={{
        left: x - ICON_SIZE / 2,
        top: y - ICON_SIZE / 2,
        width: ICON_SIZE,
        height: ICON_SIZE,
        zIndex: isHovered ? 50 : highlighted ? 45 : animated ? 35 : 20,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <img
        src={`${import.meta.env.BASE_URL}icons/${hero.icon}`}
        alt={hero.name}
        className={`w-full h-full object-cover rounded-sm transition-all duration-150 ${
          highlighted
            ? "ring-2 ring-yellow-400 shadow-[0_0_16px_rgba(250,204,21,0.6)] scale-125"
            : dimmed
              ? "opacity-20 grayscale"
              : "hover:ring-2 hover:ring-blue-400 hover:shadow-[0_0_12px_rgba(96,165,250,0.5)] hover:scale-110"
        }`}
      />
      <div
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
        style={{ zIndex: 50 }}
      >
        <div className="bg-[#0c1520] border border-gray-700 rounded-lg shadow-xl p-2 min-w-[140px]">
          <div className="text-white text-xs font-bold capitalize mb-1">
            {hero.name.replace(/_/g, " ")}
          </div>
          <div className="text-[10px] text-gray-400 space-y-0.5">
            <div>
              <span className="text-gray-500">{xLabel}:</span>{" "}
              <span className="text-blue-400 font-mono">{fmtVal(Number(hero[xStat]))}</span>
            </div>
            <div>
              <span className="text-gray-500">{yLabel}:</span>{" "}
              <span className="text-blue-400 font-mono">{fmtVal(Number(hero[yStat]))}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function fmtVal(v: number): string {
  if (Number.isNaN(v)) return "—";
  if (Number.isInteger(v)) return String(v);
  if (Math.abs(v) < 10) return v.toFixed(2);
  return v.toFixed(1);
}

function niceTicks(min: number, max: number, count: number): number[] {
  const range = max - min;
  if (range === 0) return [min];
  const rawStep = range / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  let step: number;
  if (norm <= 1.5) step = 1 * mag;
  else if (norm <= 3) step = 2 * mag;
  else if (norm <= 7) step = 5 * mag;
  else step = 10 * mag;

  const ticks: number[] = [];
  let tick = Math.ceil(min / step) * step;
  while (tick <= max) {
    ticks.push(Math.round(tick * 1000) / 1000);
    tick += step;
  }
  return ticks;
}
