"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";

import { createTask } from "@/app/actions";

export type ProjectOption = { id: string; name: string; color: string };

/// Entrada rapida: escribir el titulo y darle a enter. Lo demas son valores por
/// defecto razonables que se pueden afinar luego en la propia tarea.
export function QuickAdd({ projects }: { projects: ProjectOption[] }) {
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [estimateMin, setEstimateMin] = useState(30);
  const [importance, setImportance] = useState(2);
  const [dueDate, setDueDate] = useState("");
  const [pending, startTransition] = useTransition();

  if (projects.length === 0) return null;

  function submit() {
    if (!title.trim()) return;
    startTransition(async () => {
      await createTask({
        projectId,
        title,
        estimateMin,
        importance,
        dueDate: dueDate || null,
      });
      setTitle("");
      setDueDate("");
    });
  }

  return (
    <div className="card space-y-2.5 p-3">
      <div className="flex gap-2">
        <input
          className="field"
          placeholder="Que hay que hacer"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending || !title.trim()}
          aria-label="Anadir tarea"
          className="btn-primary shrink-0 px-3"
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          className="field flex-1 basis-32"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          className="field w-24"
          value={estimateMin}
          onChange={(e) => setEstimateMin(Number(e.target.value))}
        >
          {[15, 30, 45, 60, 90, 120, 180].map((m) => (
            <option key={m} value={m}>
              {m}&apos;
            </option>
          ))}
        </select>

        <select
          className="field w-28"
          value={importance}
          onChange={(e) => setImportance(Number(e.target.value))}
        >
          <option value={1}>Alta</option>
          <option value={2}>Media</option>
          <option value={3}>Baja</option>
        </select>

        <input
          type="date"
          className="field flex-1 basis-36"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>
    </div>
  );
}
