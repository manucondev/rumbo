"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";

import { createProject } from "@/app/actions";
import { PROJECT_COLORS } from "@/lib/types";

export function NewProject({ taken }: { taken: string[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [hours, setHours] = useState(3);
  const [priority, setPriority] = useState(2);
  const [color, setColor] = useState(
    PROJECT_COLORS.find((c) => !taken.includes(c)) ?? PROJECT_COLORS[0],
  );
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-ghost w-full border-dashed text-muted"
      >
        <Plus size={16} /> Nuevo frente
      </button>
    );
  }

  return (
    <div className="card space-y-3 p-4">
      <input
        className="field"
        autoFocus
        placeholder="Nombre del frente"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <div className="flex gap-2">
        <label className="flex-1">
          <span className="text-xs text-muted">Horas por semana</span>
          <input
            type="number"
            min={0}
            step={0.5}
            className="field mt-1"
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
          />
        </label>
        <label className="flex-1">
          <span className="text-xs text-muted">Prioridad</span>
          <select
            className="field mt-1"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
          >
            <option value={1}>Alta</option>
            <option value={2}>Media</option>
            <option value={3}>Baja</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {PROJECT_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Color ${c}`}
            onClick={() => setColor(c)}
            className={`size-7 rounded-full transition active:scale-90 ${
              color === c ? "ring-2 ring-foreground ring-offset-2 ring-offset-surface" : ""
            }`}
            style={{ background: c }}
          />
        ))}
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost flex-1">
          Cancelar
        </button>
        <button
          type="button"
          disabled={pending || !name.trim()}
          className="btn-primary flex-1"
          onClick={() =>
            startTransition(async () => {
              await createProject({ name, color, weeklyTargetHours: hours, priority });
              setName("");
              setOpen(false);
            })
          }
        >
          Crear
        </button>
      </div>
    </div>
  );
}
