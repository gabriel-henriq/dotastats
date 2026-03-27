import type { PatchChange } from "./App";

interface Props {
  changes: PatchChange[];
  side: "left" | "right";
  label: string;
  patch: string;
}

export function PatchChanges({ changes, side, label, patch }: Props) {
  const isLeft = side === "left";
  const color = isLeft ? "green" : "red";

  return (
    <div className="w-52 flex flex-col py-3 px-3 shrink-0">
      {changes.length > 0 && (
        <>
          <div
            className={`text-[10px] uppercase tracking-widest mb-2 ${
              isLeft ? "text-green-500" : "text-red-500"
            }`}
          >
            {label} — {patch}
          </div>
          <div className="space-y-1.5 overflow-y-auto flex-1 min-h-0">
            {changes.map((c) => {
              const diff = c.to - c.from;
              return (
                <div
                  key={c.hero}
                  className={`flex items-center gap-2 rounded px-2 py-1.5 border ${
                    isLeft
                      ? "bg-green-950/20 border-green-800/20"
                      : "bg-red-950/20 border-red-800/20"
                  }`}
                >
                  <img
                    src={`${import.meta.env.BASE_URL}icons/npc_dota_hero_${c.hero}_png.png`}
                    alt={c.hero}
                    className="w-6 h-6 rounded-sm shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] text-gray-300 truncate capitalize">
                      {c.hero.replace(/_/g, " ")}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-mono text-gray-500">
                        {c.from}
                      </span>
                      <span
                        className={`text-[10px] ${
                          isLeft ? "text-green-500" : "text-red-500"
                        }`}
                      >
                        →
                      </span>
                      <span
                        className={`text-[11px] font-mono font-bold ${
                          isLeft ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {c.to}
                      </span>
                      <span
                        className={`text-[9px] font-mono ${
                          isLeft ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        ({diff > 0 ? "+" : ""}
                        {diff})
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
