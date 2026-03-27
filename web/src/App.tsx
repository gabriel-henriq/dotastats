import { useEffect, useMemo, useState } from "react";
import { MovespeedChart } from "./MovespeedChart";
import { PatchTimeline } from "./PatchTimeline";
import { PatchChanges } from "./PatchChanges";

export interface Hero {
  name: string;
  key: string;
  heroId: number;
  movementSpeed: number;
  icon: string;
}

export interface PatchChange {
  hero: string;
  from: number;
  to: number;
}

export interface PatchSnapshot {
  patch: string;
  speeds: Record<string, number>;
  changes?: PatchChange[];
}

export interface HeroMsEvent {
  patch: string;
  from: number;
  to: number;
}

interface TimelineData {
  heroes: Hero[];
  snapshots: PatchSnapshot[];
}

function App() {
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [patchIndex, setPatchIndex] = useState(0);

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + "timeline.json")
      .then((r) => r.json())
      .then((data: TimelineData) => {
        setTimeline(data);
        setPatchIndex(data.snapshots.length - 1);
      });
  }, []);

  // Precompute per-hero movespeed history from snapshot changes
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

  if (!timeline) return null;

  const snapshot = timeline.snapshots[patchIndex];
  const heroesAtPatch = timeline.heroes
    .filter((h) => snapshot.speeds[h.name] !== undefined)
    .map((h) => ({
      ...h,
      movementSpeed: snapshot.speeds[h.name],
    }));

  const changes = snapshot.changes || [];
  const buffs = changes.filter((c) => c.to > c.from);
  const nerfs = changes.filter((c) => c.to < c.from);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#0f1923]">
      <div className="flex-1 flex min-h-0">
        <PatchChanges
          changes={buffs}
          side="left"
          label="Buffs"
          patch={snapshot.patch}
        />

        <div className="flex-1 flex flex-col items-center justify-center min-w-0">
          <h1 className="text-xl font-bold text-gray-100 tracking-tight mt-2">
            Dota 2 — Movement Speed
            <span className="text-sm font-normal text-gray-500 ml-2">
              {heroesAtPatch.length} heroes
            </span>
          </h1>
          <div className="flex-1 flex items-center justify-center w-full min-h-0 px-2">
            <MovespeedChart heroes={heroesAtPatch} heroHistory={heroHistory} changes={changes} />
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
  );
}

export default App;
