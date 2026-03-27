import { useMemo, useState } from "react";
import { STATS } from "./stats";
import type { StatDef } from "./stats";

interface HeroData {
  name: string;
  displayName: string;
  heroId: number;
  icon: string;
  [key: string]: any;
}

interface AllTimelines {
  heroes: HeroData[];
  statData: Record<string, { patches: string[]; snapshots: Record<string, Record<string, number>> }>;
  allPatches: string[];
}

interface Props {
  data: AllTimelines;
  patchA: string;
  patchB: string;
  onPatchAChange: (p: string) => void;
  onPatchBChange: (p: string) => void;
}

interface HeroDelta {
  hero: HeroData;
  diffs: { stat: StatDef; from: number; to: number; diff: number }[];
  totalScore: number;
}

function fmt(v: number) {
  if (Number.isNaN(v)) return "—";
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2);
}

export function DeltaView({ data, patchA, patchB, onPatchAChange, onPatchBChange }: Props) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"score" | "name">("score");
  const [filterStat, setFilterStat] = useState<string>("all");

  const deltas = useMemo(() => {
    const result: HeroDelta[] = [];

    for (const hero of data.heroes) {
      const diffs: HeroDelta["diffs"] = [];
      let totalScore = 0;

      for (const stat of STATS) {
        const sd = data.statData[stat.heroKey];
        if (!sd) continue;

        const snapA = sd.snapshots[patchA];
        const snapB = sd.snapshots[patchB];
        const valA = snapA?.[hero.name];
        const valB = snapB?.[hero.name];

        if (valA === undefined || valB === undefined) continue;
        if (valA === valB) continue;

        const diff = valB - valA;
        diffs.push({ stat, from: valA, to: valB, diff });

        // Normalize score: positive = buff direction
        const range = Math.max(Math.abs(valA), Math.abs(valB), 1);
        const normalized = Math.abs(diff) / range;
        totalScore += stat.lowerIsBetter ? (diff < 0 ? normalized : -normalized) : (diff > 0 ? normalized : -normalized);
      }

      if (diffs.length > 0) {
        result.push({ hero, diffs, totalScore });
      }
    }

    return result;
  }, [data, patchA, patchB]);

  const searchLower = search.toLowerCase();
  const filtered = useMemo(() => {
    let items = deltas;
    if (searchLower) {
      items = items.filter((d) => d.hero.displayName.toLowerCase().includes(searchLower));
    }
    if (filterStat !== "all") {
      items = items.filter((d) => d.diffs.some((df) => df.stat.heroKey === filterStat));
    }
    if (sortBy === "score") {
      items = [...items].sort((a, b) => b.totalScore - a.totalScore);
    } else {
      items = [...items].sort((a, b) => a.hero.displayName.localeCompare(b.hero.displayName));
    }
    return items;
  }, [deltas, searchLower, sortBy, filterStat]);

  const buffed = filtered.filter((d) => d.totalScore > 0);
  const nerfed = filtered.filter((d) => d.totalScore < 0);
  const mixed = filtered.filter((d) => d.totalScore === 0);

  return (
    <div className="flex flex-col h-full p-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <h2 className="text-lg font-bold text-gray-100">Patch Delta</h2>

        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">From:</label>
          <select
            value={patchA}
            onChange={(e) => onPatchAChange(e.target.value)}
            className="bg-gray-800 text-gray-200 text-xs rounded px-2 py-1.5 border border-gray-700 outline-none focus:border-blue-500"
          >
            {data.allPatches.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">To:</label>
          <select
            value={patchB}
            onChange={(e) => onPatchBChange(e.target.value)}
            className="bg-gray-800 text-gray-200 text-xs rounded px-2 py-1.5 border border-gray-700 outline-none focus:border-blue-500"
          >
            {data.allPatches.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="relative ml-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search hero..."
            className="bg-gray-800 text-gray-200 text-xs rounded-md px-3 py-1.5 pl-7 border border-gray-700 outline-none focus:border-blue-500 w-40"
          />
          <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" strokeWidth="2" />
            <path d="M21 21l-4.35-4.35" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <label className="text-xs text-gray-500">Filter:</label>
          <select
            value={filterStat}
            onChange={(e) => setFilterStat(e.target.value)}
            className="bg-gray-800 text-gray-200 text-xs rounded px-2 py-1 border border-gray-700 outline-none"
          >
            <option value="all">All Stats</option>
            {STATS.map((s) => (
              <option key={s.heroKey} value={s.heroKey}>{s.label}</option>
            ))}
          </select>

          <label className="text-xs text-gray-500 ml-2">Sort:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "score" | "name")}
            className="bg-gray-800 text-gray-200 text-xs rounded px-2 py-1 border border-gray-700 outline-none"
          >
            <option value="score">Impact</option>
            <option value="name">Name</option>
          </select>
        </div>
      </div>

      {/* Summary */}
      <div className="flex gap-4 mb-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <span className="text-gray-400">{buffed.length} buffed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="text-gray-400">{nerfed.length} nerfed</span>
        </div>
        {mixed.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
            <span className="text-gray-400">{mixed.length} mixed</span>
          </div>
        )}
        <span className="text-gray-600">
          {data.heroes.length - filtered.length} unchanged
        </span>
      </div>

      {patchA === patchB ? (
        <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
          Select two different patches to compare
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
          No changes found between {patchA} and {patchB}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto min-h-0 custom-scroll">
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
            {filtered.map((d) => (
              <HeroCard key={d.hero.heroId} delta={d} filterStat={filterStat} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HeroCard({ delta, filterStat }: { delta: HeroDelta; filterStat: string }) {
  const isBuffed = delta.totalScore > 0;
  const isNerfed = delta.totalScore < 0;
  const borderColor = isBuffed ? "border-green-800/30" : isNerfed ? "border-red-800/30" : "border-yellow-800/30";
  const bgColor = isBuffed ? "bg-green-950/15" : isNerfed ? "bg-red-950/15" : "bg-yellow-950/15";

  const diffs = filterStat !== "all"
    ? delta.diffs.filter((d) => d.stat.heroKey === filterStat)
    : delta.diffs;

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} p-3`}>
      <div className="flex items-center gap-2.5 mb-2">
        <img
          src={`${import.meta.env.BASE_URL}icons/${delta.hero.icon}`}
          alt=""
          className="w-8 h-8 rounded-sm"
        />
        <span className="text-sm font-bold text-gray-200 flex-1">
          {delta.hero.displayName}
        </span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
          isBuffed ? "bg-green-900/40 text-green-400" : isNerfed ? "bg-red-900/40 text-red-400" : "bg-yellow-900/40 text-yellow-400"
        }`}>
          {isBuffed ? "BUFFED" : isNerfed ? "NERFED" : "MIXED"}
        </span>
      </div>
      <div className="space-y-1">
        {diffs.map((d) => {
          const isBuff = d.stat.lowerIsBetter ? d.diff < 0 : d.diff > 0;
          return (
            <div key={d.stat.id} className="flex items-center gap-2 text-[11px]">
              <span className="text-gray-500 w-28 shrink-0 truncate">{d.stat.label}</span>
              <span className="text-gray-500 font-mono w-12 text-right">{fmt(d.from)}</span>
              <span className={isBuff ? "text-green-500" : "text-red-500"}>→</span>
              <span className={`font-mono font-bold ${isBuff ? "text-green-400" : "text-red-400"}`}>
                {fmt(d.to)}
              </span>
              <span className={`text-[9px] font-mono ${isBuff ? "text-green-600" : "text-red-600"}`}>
                ({d.diff > 0 ? "+" : ""}{fmt(d.diff)})
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
