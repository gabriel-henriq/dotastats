import { useEffect, useMemo, useState } from "react";
import { MovespeedChart } from "./MovespeedChart";
import { PatchTimeline } from "./PatchTimeline";
import { PatchChanges } from "./PatchChanges";

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

interface StatDef {
  id: string;
  label: string;
  short: string;
  file: string;
  lowerIsBetter?: boolean;
}

const STATS: StatDef[] = [
  { id: "movespeed", label: "Movement Speed", short: "MS", file: "timeline_movespeed.json" },
  { id: "aap", label: "Attack Animation", short: "AAP", file: "timeline_aap.json", lowerIsBetter: true },
  { id: "armor", label: "Base Armor", short: "ARM", file: "timeline_armor.json" },
  { id: "attack_range", label: "Attack Range", short: "RNG", file: "timeline_attack_range.json" },
  { id: "bat", label: "Base Attack Time", short: "BAT", file: "timeline_bat.json", lowerIsBetter: true },
  { id: "turn_rate", label: "Turn Rate", short: "TR", file: "timeline_turn_rate.json" },
  { id: "projectile_speed", label: "Projectile Speed", short: "PS", file: "timeline_projectile_speed.json" },
];

function App() {
  const [statId, setStatId] = useState("movespeed");
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
        setPatchIndex(data.snapshots.length - 1);
        setLoading(false);
      });
  }, [statDef.file]);

  const heroHistory = useMemo(() => {
    if (!timeline) return new Map<string, HeroMsEvent[]>();
    const history = new Map<string, HeroMsEvent[]>();
    for (const snap of timeline.snapshots) {
      for (const c of snap.changes || []) {
        if (!history.has(c.hero)) history.set(c.hero, []);
        history.get(c.hero)!.push({
          patch: snap.patch,
          from: c.from,
          to: c.to,
        });
      }
    }
    return history;
  }, [timeline]);

  if (!timeline || loading) return null;

  const snapshot = timeline.snapshots[patchIndex];
  const heroesAtPatch = timeline.heroes
    .filter((h) => snapshot.values[h.name] !== undefined)
    .map((h) => ({
      ...h,
      statValue: snapshot.values[h.name],
    }));

  const changes = snapshot.changes || [];
  const lowerIsBetter = statDef.lowerIsBetter;
  const buffs = changes.filter((c) =>
    lowerIsBetter ? c.to < c.from : c.to > c.from,
  );
  const nerfs = changes.filter((c) =>
    lowerIsBetter ? c.to > c.from : c.to < c.from,
  );

  return (
    <div className="h-screen flex overflow-hidden bg-[#0f1923]">
      {/* Sidebar */}
      <nav className="w-48 shrink-0 bg-[#0a1219] border-r border-gray-800/50 flex flex-col py-4">
        <div className="px-4 mb-4">
          <h1 className="text-sm font-bold text-gray-100 tracking-tight">
            Dota 2 Stats
          </h1>
          <p className="text-[10px] text-gray-600 mt-0.5">
            {heroesAtPatch.length} heroes &middot; Patch {snapshot.patch}
          </p>
        </div>
        <div className="flex-1 px-2 space-y-0.5">
          {STATS.map((s) => (
            <button
              key={s.id}
              onClick={() => setStatId(s.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors flex items-center gap-2 ${
                statId === s.id
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
      </nav>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 flex min-h-0">
          <PatchChanges
            changes={buffs}
            side="left"
            label="Buffs"
            patch={snapshot.patch}
          />

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

          <PatchChanges
            changes={nerfs}
            side="right"
            label="Nerfs"
            patch={snapshot.patch}
          />
        </div>

        <PatchTimeline
          snapshots={timeline.snapshots}
          currentIndex={patchIndex}
          onChange={setPatchIndex}
        />
      </div>
    </div>
  );
}

export default App;
