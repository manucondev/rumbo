"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";

import { addTaskToDay } from "@/app/actions";

export type TaskOption = { id: string; title: string; projectName: string };

export function AddAdHoc({ date, tasks }: { date: string; tasks: TaskOption[] }) {
  const [open, setOpen] = useState(false);
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? "");
  const [minutes, setMinutes] = useState(30);
  const [pending, startTransition] = useTransition();

  if (tasks.length === 0) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-ghost w-full border-dashed text-muted"
      >
        <Plus size={16} /> Meter otra cosa en el dia
      </button>
    );
  }

  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Meter una tarea en el dia</p>
        <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar">
          <X size={16} className="text-muted" />
        </button>
      </div>

      <select
        className="field"
        value={taskId}
        onChange={(e) => setTaskId(e.target.value)}
      >
        {tasks.map((t) => (
          <option key={t.id} value={t.id}>
            {t.projectName} · {t.title}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-2">
        <input
          type="number"
          min={5}
          step={5}
          className="field w-24"
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
        />
        <span className="text-sm text-muted">minutos</span>
        <button
          type="button"
          disabled={pending || !taskId}
          className="btn-primary ml-auto"
          onClick={() =>
            startTransition(async () => {
              await addTaskToDay(date, taskId, minutes);
              setOpen(false);
            })
          }
        >
          Anadir
        </button>
      </div>
    </div>
  );
}
