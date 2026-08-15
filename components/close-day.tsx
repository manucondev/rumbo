"use client";

import { useState, useTransition } from "react";
import { Moon, RotateCcw } from "lucide-react";

import { closeDay, reopenDay } from "@/app/actions";
import { ENERGY_LABEL } from "@/lib/types";

export function CloseDay({
  date,
  closed,
  pendingBlocks,
}: {
  date: string;
  closed: boolean;
  pendingBlocks: number;
}) {
  const [open, setOpen] = useState(false);
  const [energy, setEnergy] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  if (closed) {
    return (
      <button
        type="button"
        onClick={() => startTransition(() => reopenDay(date))}
        className="btn-quiet w-full"
      >
        <RotateCcw size={15} /> Reabrir el dia
      </button>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost w-full">
        <Moon size={16} /> Cerrar el dia
      </button>
    );
  }

  return (
    <div className="card space-y-4 p-4">
      <div>
        <p className="font-medium">Cerrar el dia</p>
        <p className="mt-1 text-xs text-muted">
          {pendingBlocks > 0
            ? `Quedan ${pendingBlocks} bloque${pendingBlocks > 1 ? "s" : ""} sin marcar. Cuentan como aplazados y subiran de prioridad manana.`
            : "Todo marcado. Buen dia."}
        </p>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">
          Como has acabado
        </p>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setEnergy(n)}
              className={`chip flex-1 ${
                energy === n ? "bg-accent text-white" : "bg-surface-2 text-muted"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        {energy && <p className="mt-1.5 text-xs text-muted">{ENERGY_LABEL[energy]}</p>}
      </div>

      <div>
        <label htmlFor="nota" className="text-xs font-medium tracking-wide text-muted uppercase">
          Que te ha frenado
        </label>
        <textarea
          id="nota"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Opcional, una linea"
          className="field mt-2 resize-none"
        />
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost flex-1">
          Ahora no
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => closeDay(date, energy, note))}
          className="btn-primary flex-1"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
