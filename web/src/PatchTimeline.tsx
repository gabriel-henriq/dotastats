import { useCallback, useEffect, useRef, useState } from "react";
import type { PatchSnapshot } from "./App";

interface Props {
  snapshots: PatchSnapshot[];
  currentIndex: number;
  onChange: (index: number) => void;
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

  return (
    <div className="px-6 py-3 bg-[#0a1219] border-t border-gray-800/50">
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

        {/* Slider */}
        <input
          type="range"
          min={0}
          max={snapshots.length - 1}
          value={currentIndex}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 h-1.5 cursor-pointer accent-blue-500"
        />

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
