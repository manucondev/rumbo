"use client";

import { useState, useTransition } from "react";
import { Check, ChevronDown, Scissors, Trash2, X } from "lucide-react";

import { breakDownTask, deleteTask, setTaskStatus, updateTask } from "@/app/actions";
import { formatMin, relativeDays, todayMadrid } from "@/lib/date";
import { IMPORTANCE_LABEL } from "@/lib/types";

export type TaskView = {
  id: string;
  title: string;
  estimateMin: number;
  spentMin: number;
  importance: number;
  status: string;
  dueDate: string | null;
  postponedCount: number;
  children: TaskView[];
};

export function TaskRow({ task, depth = 0 }: { task: TaskView; depth?: number }) {
  const [open, setOpen] = useState(false);
  const [breaking, setBreaking] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();

  const done = task.status === "DONE";
  const dropped = task.status === "DROPPED";
  const hasChildren = task.children.length > 0;
  const today = todayMadrid();

  return (
    <li className={depth > 0 ? "ml-4 border-l border-border pl-3" : ""}>
      <div
        className={`flex items-start gap-2.5 py-2 ${done || dropped ? "opacity-50" : ""} ${
          pending ? "animate-pulse" : ""
        }`}
      >
        <button
          type="button"
          onClick={() =>
            startTransition(() => setTaskStatus(task.id, done ? "PENDING" : "DONE"))
          }
          aria-label={done ? "Reabrir tarea" : "Marcar como hecha"}
          className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border-2 transition active:scale-90 ${
            done ? "border-success bg-success text-white" : "border-border text-transparent"
          }`}
        >
          <Check size={13} strokeWidth={3} />
        </button>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="min-w-0 flex-1 text-left"
        >
          <p className={`text-sm leading-snug ${done ? "line-through" : ""}`}>
            {task.title}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
            <span className="font-mono">
              {task.spentMin > 0
                ? `${formatMin(task.spentMin)} / ${formatMin(task.estimateMin)}`
                : formatMin(task.estimateMin)}
            </span>
            {task.importance === 1 && <span className="text-warn">importante</span>}
            {task.dueDate && (
              <span className={task.dueDate < today ? "text-danger" : ""}>
                vence {relativeDays(task.dueDate, today)}
              </span>
            )}
            {task.postponedCount > 0 && <span>aplazada x{task.postponedCount}</span>}
            {hasChildren && <span>{task.children.length} subtareas</span>}
          </p>
        </button>

        <ChevronDown
          size={16}
          className={`mt-1 shrink-0 text-muted transition ${open ? "rotate-180" : ""}`}
        />
      </div>

      {open && (
        <div className="mb-2 space-y-3 rounded-xl bg-surface-2 p-3">
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-1.5 text-xs text-muted">
              Estimacion
              <select
                className="field w-20 py-1"
                value={task.estimateMin}
                onChange={(e) =>
                  startTransition(() =>
                    updateTask(task.id, { estimateMin: Number(e.target.value) }),
                  )
                }
              >
                {[15, 30, 45, 60, 90, 120, 180, 240].map((m) => (
                  <option key={m} value={m}>
                    {m}&apos;
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-1.5 text-xs text-muted">
              Importancia
              <select
                className="field w-24 py-1"
                value={task.importance}
                onChange={(e) =>
                  startTransition(() =>
                    updateTask(task.id, { importance: Number(e.target.value) }),
                  )
                }
              >
                {[1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    {IMPORTANCE_LABEL[n]}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-1.5 text-xs text-muted">
              Fecha
              <input
                type="date"
                className="field w-36 py-1"
                defaultValue={task.dueDate ?? ""}
                onChange={(e) =>
                  startTransition(() =>
                    updateTask(task.id, { dueDate: e.target.value || null }),
                  )
                }
              />
            </label>
          </div>

          {breaking ? (
            <div className="space-y-2">
              <p className="text-xs text-muted">
                Una subtarea por linea. Se reparte la estimacion entre todas.
              </p>
              <textarea
                rows={4}
                className="field resize-none"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={"Leer la documentacion\nMontar el script\nProbar con 10 casos"}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-ghost flex-1 py-1.5 text-xs"
                  onClick={() => setBreaking(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-primary flex-1 py-1.5 text-xs"
                  onClick={() => {
                    const lines = draft
                      .split("\n")
                      .map((l) => l.trim())
                      .filter(Boolean);
                    if (lines.length === 0) return;
                    const each = Math.max(
                      15,
                      Math.round(task.estimateMin / lines.length / 5) * 5,
                    );
                    startTransition(async () => {
                      await breakDownTask(
                        task.id,
                        lines.map((title) => ({ title, estimateMin: each })),
                      );
                      setBreaking(false);
                      setDraft("");
                    });
                  }}
                >
                  Crear subtareas
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="chip bg-surface text-muted"
                onClick={() => setBreaking(true)}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Scissors size={13} /> Desglosar
                </span>
              </button>

              <button
                type="button"
                className="chip bg-surface text-muted"
                onClick={() =>
                  startTransition(() =>
                    setTaskStatus(task.id, dropped ? "PENDING" : "DROPPED"),
                  )
                }
              >
                <span className="inline-flex items-center gap-1.5">
                  <X size={13} /> {dropped ? "Recuperar" : "Descartar"}
                </span>
              </button>

              <button
                type="button"
                className="chip ml-auto text-danger"
                aria-label="Borrar tarea"
                onClick={() => startTransition(() => deleteTask(task.id))}
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>
      )}

      {hasChildren && (
        <ul>
          {task.children.map((child) => (
            <TaskRow key={child.id} task={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
