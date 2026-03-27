import { useEffect, useMemo, useState } from "react";
import { MovespeedChart } from "./MovespeedChart";
import { PatchTimeline } from "./PatchTimeline";
import { PatchChanges } from "./PatchChanges";
import { ScatterPlot } from "./ScatterPlot";

export interface Hero {
  name: string;
  key: string;
  heroId: number;
  icon: string;
}

export interface PatchChange {
  hero: string;
  from: number;
  to: number;
}

export interface PatchSnapshot {
  patch: string;
  values: Record<string, number>;
  changes?: PatchChange[];
}

export interface HeroMsEvent {
  patch: string;
  from: number;
  to: number;
}

interface TimelineData {
  stat: string;
  label: string;
  heroes: Hero[];
  snapshots: PatchSnapshot[];
}

export interface StatDef {
  id: string;
  label: string;
  short: string;
  file: string;
  lowerIsBetter?: boolean;
  heroKey: string; // key in heroes.json
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

type ViewMode = { type: "stat"; statId: string } | { type: "scatter" };

interface HashState {
  view: ViewMode;
  patch?: string;
  scatterX?: string;
  scatterY?: string;
}

function parseHash(): HashState {
  const parts = window.location.hash.slice(1).split("@");
  const viewPart = parts[0] || "";
  const patch = parts[1] || undefined;

  if (viewPart === "scatter") {
    return {
      view: { type: "scatter" },
      patch,
      scatterX: parts[2] || undefined,
      scatterY: parts[3] || undefined,
    };
  }
  if (viewPart && STATS.some((s) => s.id === viewPart)) {
    return { view: { type: "stat", statId: viewPart }, patch };
  }
  return { view: { type: "stat", statId: "movespeed" } };
}

function buildHash(state: HashState): string {
  const viewPart = state.view.type === "scatter" ? "scatter" : state.view.statId;
  const parts = [viewPart];
  if (state.patch) parts.push(state.patch);
  if (state.view.type === "scatter") {
    // Ensure patch slot exists even if empty
    if (!state.patch) parts.push("");
    parts.push(state.scatterX || "movementSpeed");
    parts.push(state.scatterY || "armorPhysical");
  }
  return parts.join("@");
}

function App() {
  const initial = parseHash();
  const [view, setViewState] = useState<ViewMode>(initial.view);
  const [savedPatch, setSavedPatch] = useState<string | undefined>(initial.patch);
  const [scatterX, setScatterX] = useState(initial.scatterX || "movementSpeed");
  const [scatterY, setScatterY] = useState(initial.scatterY || "armorPhysical");

  const syncHash = (overrides?: Partial<HashState>) => {
    const state: HashState = {
      view: overrides?.view ?? view,
      patch: overrides?.patch ?? savedPatch,
      scatterX: overrides?.scatterX ?? scatterX,
      scatterY: overrides?.scatterY ?? scatterY,
    };
    window.location.hash = buildHash(state);
  };

  const setView = (v: ViewMode) => {
    setViewState(v);
    syncHash({ view: v });
  };

  const onPatchChange = (patch: string) => {
    setSavedPatch(patch);
    syncHash({ patch });
  };

  const onScatterAxesChange = (x: string, y: string) => {
    setScatterX(x);
    setScatterY(y);
    syncHash({ scatterX: x, scatterY: y });
  };

  useEffect(() => {
    const onHash = () => {
      const parsed = parseHash();
      setViewState(parsed.view);
      if (parsed.patch) setSavedPatch(parsed.patch);
      if (parsed.scatterX) setScatterX(parsed.scatterX);
      if (parsed.scatterY) setScatterY(parsed.scatterY);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <div className="h-screen flex overflow-hidden bg-[#0f1923]">
      {/* Sidebar */}
      <nav className="w-48 shrink-0 bg-[#0a1219] border-r border-gray-800/50 flex flex-col py-4">
        <div className="px-4 mb-4">
          <h1 className="text-sm font-bold text-gray-100 tracking-tight">
            Dota 2 Stats
          </h1>
        </div>

        <div className="px-3 mb-2">
          <div className="text-[9px] uppercase tracking-widest text-gray-600 px-1 mb-1">
            Stats
          </div>
        </div>
        <div className="px-2 space-y-0.5">
          {STATS.map((s) => (
            <button
              key={s.id}
              onClick={() => setView({ type: "stat", statId: s.id })}
              className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors flex items-center gap-2 ${
                view.type === "stat" && view.statId === s.id
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                  : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-300 border border-transparent"
              }`}
            >
              <span className="font-mono text-[10px] w-6 text-gray-500 shrink-0">
                {s.short}
              </span>
              {s.label}
            </button>
          ))}
        </div>

        <div className="px-3 mt-4 mb-2">
          <div className="text-[9px] uppercase tracking-widest text-gray-600 px-1 mb-1">
            Compare
          </div>
        </div>
        <div className="px-2 space-y-0.5">
          <button
            onClick={() => setView({ type: "scatter" })}
            className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors flex items-center gap-2 ${
              view.type === "scatter"
                ? "bg-purple-600/20 text-purple-400 border border-purple-500/30"
                : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-300 border border-transparent"
            }`}
          >
            <span className="font-mono text-[10px] w-6 text-gray-500 shrink-0">
              ⊞
            </span>
            Scatter Plot
          </button>
        </div>
      </nav>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {view.type === "stat" ? (
          <StatView statId={view.statId} initialPatch={savedPatch} onPatchChange={onPatchChange} />
        ) : (
          <ScatterView
            initialPatch={savedPatch}
            onPatchChange={onPatchChange}
            initialX={scatterX}
            initialY={scatterY}
            onAxesChange={onScatterAxesChange}
          />
        )}
      </div>
    </div>
  );
}

function StatView({ statId, initialPatch, onPatchChange }: { statId: string; initialPatch?: string; onPatchChange: (p: string) => void }) {
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [patchIndex, setPatchIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  const statDef = STATS.find((s) => s.id === statId)!;

  useEffect(() => {
    setLoading(true);
    fetch(import.meta.env.BASE_URL + statDef.file)
      .then((r) => r.json())
      .then((data: TimelineData) => {
        setTimeline(data);
        // Restore patch from URL if available
        if (initialPatch) {
          const idx = data.snapshots.findIndex((s) => s.patch === initialPatch);
          setPatchIndex(idx >= 0 ? idx : data.snapshots.length - 1);
        } else {
          setPatchIndex(data.snapshots.length - 1);
        }
        setLoading(false);
      });
  }, [statDef.file]);

  const heroHistory = useMemo(() => {
    if (!timeline) return new Map<string, HeroMsEvent[]>();
    const history = new Map<string, HeroMsEvent[]>();
    for (const snap of timeline.snapshots) {
      for (const c of snap.changes || []) {
        if (!history.has(c.hero)) history.set(c.hero, []);
        history.get(c.hero)!.push({ patch: snap.patch, from: c.from, to: c.to });
      }
    }
    return history;
  }, [timeline]);

  if (!timeline || loading) return null;

  const snapshot = timeline.snapshots[patchIndex];
  const heroesAtPatch = timeline.heroes
    .filter((h) => snapshot.values[h.name] !== undefined)
    .map((h) => ({ ...h, statValue: snapshot.values[h.name] }));

  const changes = snapshot.changes || [];
  const lowerIsBetter = statDef.lowerIsBetter;
  const buffs = changes.filter((c) => (lowerIsBetter ? c.to < c.from : c.to > c.from));
  const nerfs = changes.filter((c) => (lowerIsBetter ? c.to > c.from : c.to < c.from));

  return (
    <>
      <div className="flex-1 flex min-h-0">
        <PatchChanges changes={buffs} side="left" label="Buffs" patch={snapshot.patch} />
        <div className="flex-1 flex flex-col items-center justify-center min-w-0">
          <h2 className="text-lg font-bold text-gray-100 tracking-tight mt-2">
            {statDef.label}
            <span className="text-sm font-normal text-gray-500 ml-2">
              {heroesAtPatch.length} heroes
            </span>
          </h2>
          <div className="flex-1 flex items-center justify-center w-full min-h-0 px-2">
            <MovespeedChart
              heroes={heroesAtPatch}
              heroHistory={heroHistory}
              changes={changes}
              statId={statId}
            />
          </div>
        </div>
        <PatchChanges changes={nerfs} side="right" label="Nerfs" patch={snapshot.patch} />
      </div>
      <PatchTimeline
        snapshots={timeline.snapshots}
        currentIndex={patchIndex}
        onChange={(idx) => {
          setPatchIndex(idx);
          onPatchChange(timeline.snapshots[idx].patch);
        }}
      />
    </>
  );
}

interface AllTimelines {
  heroes: Hero[];
  // For each stat, patch -> hero -> value
  statData: Record<string, { patches: string[]; snapshots: Record<string, Record<string, number>> }>;
  allPatches: string[];
}

function ScatterView({ initialPatch, onPatchChange, initialX, initialY, onAxesChange }: {
  initialPatch?: string;
  onPatchChange: (p: string) => void;
  initialX: string;
  initialY: string;
  onAxesChange: (x: string, y: string) => void;
}) {
  const [data, setData] = useState<AllTimelines | null>(null);
  const [patchIndex, setPatchIndex] = useState(0);

  useEffect(() => {
    Promise.all(
      STATS.map((s) =>
        fetch(import.meta.env.BASE_URL + s.file)
          .then((r) => r.json())
          .then((t: any) => ({ stat: s, timeline: t }))
      )
    ).then((results) => {
      const heroes = results[0].timeline.heroes as Hero[];

      // Collect all unique patches across all stats, sorted
      const patchSet = new Set<string>();
      for (const r of results) {
        for (const snap of r.timeline.snapshots) {
          patchSet.add(snap.patch);
        }
      }
      const allPatches = [...patchSet].sort((a, b) => {
        if (comparePatchVersions(a, b)) return -1;
        if (comparePatchVersions(b, a)) return 1;
        return 0;
      });

      // For each stat, build patch -> hero -> value lookup
      const statData: AllTimelines["statData"] = {};
      for (const r of results) {
        const patches = r.timeline.snapshots.map((s: any) => s.patch);
        const snapshots: Record<string, Record<string, number>> = {};
        for (const snap of r.timeline.snapshots) {
          snapshots[snap.patch] = snap.values;
        }
        statData[r.stat.heroKey] = { patches, snapshots };
      }

      setData({ heroes, statData, allPatches });
      if (initialPatch) {
        const idx = allPatches.indexOf(initialPatch);
        setPatchIndex(idx >= 0 ? idx : allPatches.length - 1);
      } else {
        setPatchIndex(allPatches.length - 1);
      }
    });
  }, []);

  if (!data) return null;

  const currentPatch = data.allPatches[patchIndex];

  // Build hero objects with all stat values at the current patch
  const heroesAtPatch = data.heroes
    .map((h) => {
      const hero: Record<string, any> = { ...h };
      let hasAnyValue = false;
      for (const stat of STATS) {
        const sd = data.statData[stat.heroKey];
        // Find the latest snapshot at or before currentPatch
        const val = getValueAtPatch(sd, currentPatch, h.name, data.allPatches);
        if (val !== undefined) {
          hero[stat.heroKey] = val;
          hasAnyValue = true;
        }
      }
      return hasAnyValue ? hero : null;
    })
    .filter((h): h is Record<string, any> => h !== null);

  // Build simple snapshots for the timeline slider
  const snapshots = data.allPatches.map((p) => ({
    patch: p,
    values: {} as Record<string, number>,
  }));

  return (
    <>
      <div className="flex-1 flex flex-col min-h-0 p-4">
        <ScatterPlot heroes={heroesAtPatch} initialX={initialX} initialY={initialY} onAxesChange={onAxesChange} />
      </div>
      <PatchTimeline
        snapshots={snapshots}
        currentIndex={patchIndex}
        onChange={(idx) => {
          setPatchIndex(idx);
          onPatchChange(data.allPatches[idx]);
        }}
      />
    </>
  );
}

function getValueAtPatch(
  sd: AllTimelines["statData"][string],
  targetPatch: string,
  heroName: string,
  allPatches: string[],
): number | undefined {
  // Find the latest snapshot patch that is <= targetPatch
  let lastVal: number | undefined;
  for (const p of sd.patches) {
    if (comparePatchVersions(targetPatch, p)) break; // p > targetPatch
    const snap = sd.snapshots[p];
    if (snap && snap[heroName] !== undefined) {
      lastVal = snap[heroName];
    }
  }
  return lastVal;
}

function comparePatchVersions(a: string, b: string): boolean {
  const ap = parsePatchVer(a);
  const bp = parsePatchVer(b);
  if (ap[0] !== bp[0]) return ap[0] < bp[0];
  if (ap[1] !== bp[1]) return ap[1] < bp[1];
  return ap[2] < bp[2];
}

function parsePatchVer(v: string): [string, string, string] {
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

export default App;
