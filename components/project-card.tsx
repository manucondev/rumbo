"use client";

import { useState, useTransition } from "react";
import { Archive, ChevronDown } from "lucide-react";

import { setProjectArchived, updateProject } from "@/app/actions";
import { formatMin } from "@/lib/date";
import { PROJECT_COLORS } from "@/lib/types";

export type ProjectView = {
  id: string;
  name: string;
  color: string;
  weeklyTargetMin: number;
  priority: number;
  archived: boolean;
  actualMin: number;
  openTasks: number;
};

export function ProjectCard({ project }: { project: ProjectView }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const pct =
    project.weeklyTargetMin > 0
      ? Math.min(100, Math.round((project.actualMin / project.weeklyTargetMin) * 100))
      : 0;

  return (
    <li className={`card overflow-hidden ${pending ? "animate-pulse" : ""}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span
          className="size-3 shrink-0 rounded-full"
          style={{ background: project.color }}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{project.name}</span>
          <span className="mt-0.5 block text-xs text-muted">
            {project.weeklyTargetMin > 0 ? (
              <>
                {formatMin(project.actualMin)} de {formatMin(project.weeklyTargetMin)} esta
                semana
              </>
            ) : (
              <>sin objetivo semanal</>
            )}
            {" · "}
            {project.openTasks} pendientes
          </span>
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-muted transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {project.weeklyTargetMin > 0 && (
        <div className="mx-4 mb-4 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: project.color }}
          />
        </div>
      )}

      {open && (
        <div className="space-y-3 border-t border-border bg-surface-2 p-4">
          <label className="block">
            <span className="text-xs text-muted">Nombre</span>
            <input
              className="field mt-1"
              defaultValue={project.name}
              onBlur={(e) =>
                startTransition(() => updateProject(project.id, { name: e.target.value }))
              }
            />
          </label>

          <div className="flex gap-2">
            <label className="flex-1">
              <span className="text-xs text-muted">Horas por semana</span>
              <input
                type="number"
                min={0}
                step={0.5}
                className="field mt-1"
                defaultValue={project.weeklyTargetMin / 60}
                onBlur={(e) =>
                  startTransition(() =>
                    updateProject(project.id, {
                      weeklyTargetHours: Number(e.target.value),
                    }),
                  )
                }
              />
            </label>

            <label className="flex-1">
              <span className="text-xs text-muted">Prioridad</span>
              <select
                className="field mt-1"
                defaultValue={project.priority}
                onChange={(e) =>
                  startTransition(() =>
                    updateProject(project.id, { priority: Number(e.target.value) }),
                  )
                }
              >
                <option value={1}>Alta</option>
                <option value={2}>Media</option>
                <option value={3}>Baja</option>
              </select>
            </label>
          </div>

          <div>
            <span className="text-xs text-muted">Color</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  onClick={() => startTransition(() => updateProject(project.id, { color: c }))}
                  className={`size-7 rounded-full transition active:scale-90 ${
                    project.color === c ? "ring-2 ring-foreground ring-offset-2 ring-offset-surface-2" : ""
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              startTransition(() => setProjectArchived(project.id, !project.archived))
            }
            className="btn-quiet w-full text-xs"
          >
            <Archive size={14} />
            {project.archived ? "Desarchivar" : "Archivar este frente"}
          </button>
        </div>
      )}
    </li>
  );
}
