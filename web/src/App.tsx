import { useEffect, useMemo, useState } from "react";
import { MovespeedChart } from "./MovespeedChart";
import { PatchTimeline } from "./PatchTimeline";
import { PatchChanges } from "./PatchChanges";

export interface Hero {
  name: string;
  key: string;
  heroId: number;
  movementSpeed: number;
  attackAnimationPoint: number;
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

const STATS = [
  { id: "movespeed", label: "Movement Speed", file: "timeline_movespeed.json" },
  { id: "aap", label: "Attack Animation Point", file: "timeline_aap.json" },
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
  const buffs = changes.filter((c) => {
    // For AAP, lower is better (buff), for movespeed, higher is better
    if (statId === "aap") return c.to < c.from;
    return c.to > c.from;
  });
  const nerfs = changes.filter((c) => {
    if (statId === "aap") return c.to > c.from;
    return c.to < c.from;
  });

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#0f1923]">
      <div className="flex-1 flex min-h-0">
        <PatchChanges
          changes={buffs}
          side="left"
          label="Buffs"
          patch={snapshot.patch}
          invertColor={statId === "aap"}
        />

        <div className="flex-1 flex flex-col items-center justify-center min-w-0">
          {/* Header with stat picker */}
          <div className="flex items-center gap-3 mt-2">
            <h1 className="text-xl font-bold text-gray-100 tracking-tight">
              Dota 2 — {statDef.label}
              <span className="text-sm font-normal text-gray-500 ml-2">
                {heroesAtPatch.length} heroes
              </span>
            </h1>
            <div className="flex gap-1 ml-3">
              {STATS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStatId(s.id)}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    statId === s.id
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800/60 text-gray-400 hover:bg-gray-700 hover:text-gray-300"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
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
          invertColor={statId === "aap"}
        />
      </div>

      <PatchTimeline
        snapshots={timeline.snapshots}
        currentIndex={patchIndex}
        onChange={setPatchIndex}
      />
    </div>
  );
}

export default App;
