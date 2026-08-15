"use client";

import { useTransition } from "react";

import { regenerateDay, setCapacity } from "@/app/actions";
import { formatMin } from "@/lib/date";

const PRESETS = [60, 120, 180, 240];

export function CapacityChips({
  date,
  capacityMin,
  plannedMin,
  locked,
}: {
  date: string;
  capacityMin: number;
  plannedMin: number;
  locked: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className={pending ? "opacity-60" : ""}>
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">
          Tiempo de hoy
        </p>
        <p className="text-xs text-muted">
          plan: <span className="font-mono">{formatMin(plannedMin)}</span>
        </p>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {PRESETS.map((min) => (
          <button
            key={min}
            type="button"
            disabled={locked}
            onClick={() => startTransition(() => setCapacity(date, min))}
            className={`chip ${
              capacityMin === min
                ? "bg-accent text-white"
                : "bg-surface-2 text-muted"
            }`}
          >
            {formatMin(min)}
          </button>
        ))}

        <button
          type="button"
          disabled={locked}
          onClick={() => startTransition(() => setCapacity(date, capacityMin + 30))}
          className="chip bg-surface-2 text-muted"
        >
          +30&apos;
        </button>

        {!PRESETS.includes(capacityMin) && (
          <span className="chip bg-accent text-white">{formatMin(capacityMin)}</span>
        )}

        <button
          type="button"
          disabled={locked}
          onClick={() => startTransition(() => regenerateDay(date))}
          className="chip ml-auto text-muted underline underline-offset-4"
        >
          replanificar
        </button>
      </div>
    </div>
  );
}
