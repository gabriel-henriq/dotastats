import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Hero, HeroMsEvent, PatchChange } from "./App";

interface Props {
  heroes: Hero[];
  heroHistory: Map<string, HeroMsEvent[]>;
  changes: PatchChange[];
}

const GAP = 1;
const X_LABEL_HEIGHT = 18;
const ANIM_DURATION = 500;
const MAX_ROWS = 20;

interface GhostEntry {
  heroName: string;
  heroId: number;
  icon: string;
  fromSpeed: number;
  toSpeed: number;
  type: "buff" | "nerf";
}

interface ArrowLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}

export function MovespeedChart({ heroes, heroHistory, changes }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartInnerRef = useRef<HTMLDivElement>(null);
  const heroRefs = useRef(new Map<number, HTMLDivElement>());
  const ghostRefs = useRef(new Map<number, HTMLDivElement>());
  const prevPositions = useRef(new Map<number, DOMRect>());
  const [availableHeight, setAvailableHeight] = useState(600);
  const [arrows, setArrows] = useState<ArrowLine[]>([]);

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        setAvailableHeight(containerRef.current.clientHeight);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const capturePositions = () => {
    const positions = new Map<number, DOMRect>();
    heroRefs.current.forEach((el, heroId) => {
      positions.set(heroId, el.getBoundingClientRect());
    });
    prevPositions.current = positions;
  };

  const prevHeroesRef = useRef(heroes);
  if (prevHeroesRef.current !== heroes) {
    capturePositions();
    prevHeroesRef.current = heroes;
  }

  const ghosts = useMemo(() => {
    const result: GhostEntry[] = [];
    const heroMap = new Map(heroes.map((h) => [h.name, h]));
    for (const c of changes) {
      const hero = heroMap.get(c.hero);
      if (!hero || c.from === c.to) continue;
      result.push({
        heroName: c.hero,
        heroId: hero.heroId,
        icon: hero.icon,
        fromSpeed: c.from,
        toSpeed: c.to,
        type: c.to > c.from ? "buff" : "nerf",
      });
    }
    return result;
  }, [changes, heroes]);

  type ColumnItem =
    | { kind: "hero"; hero: Hero }
    | { kind: "ghost"; ghost: GhostEntry };

  const { columns, speeds, maxCount } = useMemo(() => {
    const grouped = new Map<number, ColumnItem[]>();

    for (const hero of heroes) {
      const ms = hero.movementSpeed;
      if (!grouped.has(ms)) grouped.set(ms, []);
      grouped.get(ms)!.push({ kind: "hero", hero });
    }

    for (const ghost of ghosts) {
      const ms = ghost.fromSpeed;
      if (!grouped.has(ms)) grouped.set(ms, []);
      grouped.get(ms)!.push({ kind: "ghost", ghost });
    }

    const speeds = [...grouped.keys()].sort((a, b) => a - b);
    const maxCount = Math.min(
      MAX_ROWS,
      Math.max(...[...grouped.values()].map((items) => items.length), 1),
    );
    return { columns: grouped, speeds, maxCount };
  }, [heroes, ghosts]);

  const iconSize = useMemo(() => {
    const usable = availableHeight - X_LABEL_HEIGHT - 20;
    const computed = Math.floor(usable / maxCount) - GAP * 2;
    return Math.max(22, Math.min(50, computed));
  }, [maxCount, availableHeight]);

  const changedHeroes = useMemo(() => {
    const map = new Map<string, "buff" | "nerf">();
    for (const c of changes) {
      map.set(c.hero, c.to > c.from ? "buff" : "nerf");
    }
    return map;
  }, [changes]);

  // FLIP animation + compute arrows
  useLayoutEffect(() => {
    if (prevPositions.current.size === 0) return;

    const chartRect = chartInnerRef.current?.getBoundingClientRect();

    // Capture hero final positions BEFORE applying FLIP transforms
    const heroFinalPositions = new Map<number, DOMRect>();
    heroRefs.current.forEach((el, heroId) => {
      heroFinalPositions.set(heroId, el.getBoundingClientRect());
    });

    // Apply FLIP
    heroRefs.current.forEach((el, heroId) => {
      const prev = prevPositions.current.get(heroId);
      if (!prev) return;

      const curr = heroFinalPositions.get(heroId)!;
      const dx = prev.left - curr.left;
      const dy = prev.top - curr.top;

      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      el.offsetHeight;
      el.style.transition = `transform ${ANIM_DURATION}ms cubic-bezier(0.25, 0.8, 0.25, 1)`;
      el.style.transform = "";
    });

    // Compute arrows using final positions (not mid-animation)
    if (chartRect) {
      const newArrows: ArrowLine[] = [];
      ghostRefs.current.forEach((ghostEl, heroId) => {
        const hRect = heroFinalPositions.get(heroId);
        if (!hRect) return;

        const gRect = ghostEl.getBoundingClientRect();
        const ghost = ghosts.find((g) => g.heroId === heroId);
        const color = ghost?.type === "buff" ? "#4ade80" : "#f87171";

        newArrows.push({
          x1: gRect.left - chartRect.left + gRect.width / 2,
          y1: gRect.top - chartRect.top + gRect.height / 2,
          x2: hRect.left - chartRect.left + hRect.width / 2,
          y2: hRect.top - chartRect.top + hRect.height / 2,
          color,
        });
      });
      setArrows(newArrows);
    }
  }, [heroes, ghosts]);

  // Clear arrows when no changes
  useEffect(() => {
    if (ghosts.length === 0) setArrows([]);
  }, [ghosts]);

  const setHeroRef = (heroId: number) => (el: HTMLDivElement | null) => {
    if (el) heroRefs.current.set(heroId, el);
    else heroRefs.current.delete(heroId);
  };

  const setGhostRef = (heroId: number) => (el: HTMLDivElement | null) => {
    if (el) ghostRefs.current.set(heroId, el);
    else ghostRefs.current.delete(heroId);
  };

  return (
    <div
      ref={containerRef}
      className="flex justify-center items-end w-full h-full"
    >
      <div ref={chartInnerRef} className="inline-flex items-end relative">
        {/* Arrow SVG overlay */}
        {arrows.length > 0 && (
          <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none z-10">
            <defs>
              <marker
                id="arrowhead-green"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#4ade80" />
              </marker>
              <marker
                id="arrowhead-red"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#f87171" />
              </marker>
            </defs>
            {arrows.map((a, i) => (
              <line
                key={i}
                x1={a.x1}
                y1={a.y1}
                x2={a.x2}
                y2={a.y2}
                stroke={a.color}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                opacity={0.6}
                markerEnd={`url(#arrowhead-${a.color === "#4ade80" ? "green" : "red"})`}
              />
            ))}
          </svg>
        )}

        {/* Y axis */}
        <div
          className="relative mr-1"
          style={{ height: maxCount * (iconSize + GAP * 2) }}
        >
          {Array.from({ length: maxCount + 1 }, (_, i) => {
            const step = iconSize < 26 ? 2 : 1;
            if (i % step !== 0) return null;
            return (
              <div
                key={i}
                className="absolute text-[10px] text-gray-600 text-right w-5 leading-none"
                style={{
                  bottom: i * (iconSize + GAP * 2) + iconSize / 2 - 5,
                  right: 0,
                }}
              >
                {i}
              </div>
            );
          })}
        </div>

        {/* Chart columns */}
        <div className="flex items-end border-l border-b border-gray-700/40">
          {speeds.map((speed) => {
            const items = columns.get(speed) || [];
            const subCols: typeof items[] = [];
            for (let i = 0; i < items.length; i += MAX_ROWS) {
              subCols.push(items.slice(i, i + MAX_ROWS));
            }
            const minColWidth = iconSize + 8;
            const naturalWidth =
              subCols.length * (iconSize + GAP * 2) + GAP * 2;
            const colWidth = Math.max(minColWidth, naturalWidth);

            return (
              <div
                key={speed}
                className="flex flex-col items-center"
                style={{ width: colWidth }}
              >
                <div className="flex gap-[1px] items-end justify-center">
                  {subCols.map((subCol, sci) => (
                    <div key={sci} className="flex flex-col-reverse">
                      {subCol.map((item) => {
                        if (item.kind === "hero") {
                          return (
                            <HeroIcon
                              key={item.hero.heroId}
                              ref={setHeroRef(item.hero.heroId)}
                              hero={item.hero}
                              size={iconSize}
                              history={heroHistory.get(item.hero.name)}
                              changeType={changedHeroes.get(item.hero.name)}
                            />
                          );
                        }
                        const g = item.ghost;
                        return (
                          <GhostIcon
                            key={`ghost-${g.heroName}`}
                            ref={setGhostRef(g.heroId)}
                            ghost={g}
                            size={iconSize}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
                <div className="text-[11px] text-gray-400 mt-1.5 tabular-nums font-mono font-bold border-t border-gray-700/30 pt-1 w-full text-center">
                  {speed}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const GhostIcon = forwardRef<
  HTMLDivElement,
  { ghost: GhostEntry; size: number }
>(function GhostIcon({ ghost, size }, ref) {
  return (
    <div
      ref={ref}
      className="relative mx-auto"
      style={{ width: size, height: size, margin: `${GAP}px auto` }}
    >
      <img
        src={`/icons/${ghost.icon}`}
        alt=""
        className="w-full h-full object-cover rounded-sm grayscale opacity-30"
      />
    </div>
  );
});

const HeroIcon = forwardRef<
  HTMLDivElement,
  {
    hero: Hero;
    size: number;
    history?: HeroMsEvent[];
    changeType?: "buff" | "nerf";
  }
>(function HeroIcon({ hero, size, history, changeType }, ref) {
  const ringClass =
    changeType === "buff"
      ? "ring-2 ring-green-400/80 shadow-[0_0_10px_rgba(74,222,128,0.5)]"
      : changeType === "nerf"
        ? "ring-2 ring-red-400/80 shadow-[0_0_10px_rgba(248,113,113,0.5)]"
        : "";

  return (
    <div
      ref={ref}
      className="relative group mx-auto"
      style={{
        width: size,
        height: size,
        margin: `${GAP}px auto`,
      }}
    >
      <img
        src={`/icons/${hero.icon}`}
        alt={hero.name}
        className={`w-full h-full object-cover rounded-sm transition-shadow duration-500 ${ringClass}`}
        loading="lazy"
      />

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 pointer-events-none z-30 transition-opacity">
        <div className="bg-[#0c1520] border border-gray-700 rounded-lg shadow-xl p-2.5 min-w-[180px]">
          <div className="flex items-center gap-2 mb-1.5 pb-1.5 border-b border-gray-700/50">
            <img
              src={`/icons/${hero.icon}`}
              alt=""
              className="w-7 h-7 rounded-sm"
            />
            <div>
              <div className="text-white text-xs font-bold capitalize">
                {hero.name.replace(/_/g, " ")}
              </div>
              <div className="text-blue-400 text-[11px] font-mono font-bold">
                {hero.movementSpeed} ms
              </div>
            </div>
          </div>

          {history && history.length > 0 ? (
            <div className="space-y-0.5">
              <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">
                Patch History
              </div>
              {history.map((e, i) => {
                const diff = e.to - e.from;
                const isUp = diff > 0;
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between text-[11px] gap-2"
                  >
                    <span className="text-gray-400 font-mono">{e.patch}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500 font-mono">{e.from}</span>
                      <span
                        className={isUp ? "text-green-500" : "text-red-500"}
                      >
                        →
                      </span>
                      <span
                        className={`font-mono font-bold ${
                          isUp ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {e.to}
                      </span>
                      <span
                        className={`text-[9px] font-mono ${
                          isUp ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        ({isUp ? "+" : ""}
                        {diff})
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-[10px] text-gray-600 italic">
              No movement speed changes
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
