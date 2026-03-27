import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PatchSnapshot } from "./App";
import { FORMULA_VERSIONS, type FormulaVersion } from "./formulas";

interface Props {
  snapshots: PatchSnapshot[];
  currentIndex: number;
  onChange: (index: number) => void;
}

function comparePatch(a: string, b: string): boolean {
  const ap = parsePV(a);
  const bp = parsePV(b);
  if (ap[0] !== bp[0]) return ap[0] < bp[0];
  if (ap[1] !== bp[1]) return ap[1] < bp[1];
  return ap[2] < bp[2];
}

function parsePV(v: string): [string, string, string] {
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

export function PatchTimeline({ snapshots, currentIndex, onChange }: Props) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(500);

  const indexRef = useRef(currentIndex);
  indexRef.current = currentIndex;

  const step = useCallback(
    (dir: number) => {
      onChange(Math.max(0, Math.min(snapshots.length - 1, currentIndex + dir)));
    },
    [currentIndex, snapshots.length, onChange],
  );

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const next = indexRef.current + 1;
      if (next >= snapshots.length) {
        setPlaying(false);
        return;
      }
      onChange(next);
    }, speed);
    return () => clearInterval(id);
  }, [playing, speed, snapshots.length, onChange]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [step]);

  const current = snapshots[currentIndex];

  // Find formula events that match patches in this timeline
  const formulaEvents = useMemo(() => {
    const events: { index: number; formula: FormulaVersion }[] = [];
    for (const fv of FORMULA_VERSIONS) {
      // Find the first snapshot at or after this formula version's patch
      const idx = snapshots.findIndex(
        (s) => s.patch === fv.patch || (!comparePatch(s.patch, fv.patch) && !comparePatch(fv.patch, s.patch))
      );
      if (idx >= 0) {
        events.push({ index: idx, formula: fv });
      }
    }
    return events;
  }, [snapshots]);

  // Find the active formula for the current patch
  const activeFormula = useMemo(() => {
    let result = formulaEvents[0]?.formula;
    for (const e of formulaEvents) {
      if (e.index > currentIndex) break;
      result = e.formula;
    }
    return result;
  }, [formulaEvents, currentIndex]);

  const isExactChange = formulaEvents.some((e) => e.index === currentIndex);

  return (
    <div className="px-6 py-2 bg-[#0a1219] border-t border-gray-800/50">
      {/* Formula era — always visible */}
      <div className={`max-w-3xl mx-auto mb-1.5 px-3 py-1 rounded flex items-center gap-2 transition-colors ${
        isExactChange
          ? "bg-amber-900/30 border border-amber-700/40"
          : "bg-gray-800/30 border border-transparent"
      }`}>
        <span className={`text-[10px] font-bold shrink-0 ${isExactChange ? "text-amber-400" : "text-gray-500"}`}>
          {activeFormula?.label || ""}
        </span>
        <span className={`text-[10px] truncate ${isExactChange ? "text-amber-200/70" : "text-gray-600"}`}>
          {activeFormula?.description || ""}
        </span>
      </div>

      <div className="max-w-3xl mx-auto flex items-center gap-3">
        {/* Controls */}
        <div className="flex items-center gap-1">
          <Btn onClick={() => onChange(0)}>⏮</Btn>
          <Btn onClick={() => step(-1)}>◀</Btn>
          <button
            onClick={() => setPlaying((p) => !p)}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold transition-colors min-w-[50px]"
          >
            {playing ? "⏸" : "▶"}
          </button>
          <Btn onClick={() => step(1)}>▶</Btn>
          <Btn onClick={() => onChange(snapshots.length - 1)}>⏭</Btn>
        </div>

        {/* Slider with formula markers */}
        <div className="flex-1 relative">
          <input
            type="range"
            min={0}
            max={snapshots.length - 1}
            value={currentIndex}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full h-1.5 cursor-pointer accent-blue-500"
          />
          {/* Formula change tick marks */}
          {formulaEvents.map((e) => {
            const pct = (e.index / Math.max(snapshots.length - 1, 1)) * 100;
            return (
              <div
                key={e.formula.patch}
                className="absolute top-0 group cursor-pointer"
                style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
                onClick={() => onChange(e.index)}
              >
                <div className="w-2 h-4 bg-amber-500/50 -mt-1 rounded-sm" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                  <div className="bg-[#0c1520] border border-amber-700/50 rounded px-2 py-1 whitespace-nowrap">
                    <div className="text-amber-400 text-[10px] font-bold">{e.formula.label}</div>
                    <div className="text-amber-200/60 text-[9px] max-w-[250px] whitespace-normal">{e.formula.description}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Patch label */}
        <span className="text-white font-mono text-lg font-bold min-w-[70px] text-right">
          {current.patch}
        </span>

        {/* Speed */}
        <div className="flex gap-0.5 ml-1">
          {[1000, 500, 200].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                speed === s
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-500 hover:text-gray-300"
              }`}
            >
              {s === 1000 ? "1x" : s === 500 ? "2x" : "5x"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Btn({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="p-1 bg-gray-800/60 hover:bg-gray-700 text-gray-400 rounded transition-colors text-xs"
    >
      {children}
    </button>
  );
}
