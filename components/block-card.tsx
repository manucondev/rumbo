"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, CircleCheck, Pause, Play, SkipForward, Trash2 } from "lucide-react";

import {
  completeBlock,
  logMinutes,
  postponeBlock,
  removeBlock,
  setTaskStatus,
  uncompleteBlock,
} from "@/app/actions";
import { formatMin } from "@/lib/date";

export type BlockView = {
  id: string;
  taskId: string;
  title: string;
  projectName: string;
  projectColor: string;
  plannedMin: number;
  actualMin: number;
  status: string;
  reason: string;
};

const STATUS_LABEL: Record<string, string> = {
  DONE: "hecho",
  PARTIAL: "a medias",
  SKIPPED: "aplazado",
};

export function BlockCard({ block, locked }: { block: BlockView; locked: boolean }) {
  const [pending, startTransition] = useTransition();
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const storageKey = `rumbo:timer:${block.id}`;

  // El cronometro vive en localStorage: si cierras la pestana y vuelves, sigue.
  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey);
    if (raw) setStartedAt(Number(raw));
  }, [storageKey]);

  useEffect(() => {
    if (!startedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  const done = block.status === "DONE";
  const skipped = block.status === "SKIPPED";
  const elapsedSec = startedAt ? Math.floor((now - startedAt) / 1000) : 0;

  function start() {
    const ts = Date.now();
    window.localStorage.setItem(storageKey, String(ts));
    setStartedAt(ts);
    setNow(ts);
  }

  function stop() {
    if (!startedAt) return;
    const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60_000));
    window.localStorage.removeItem(storageKey);
    setStartedAt(null);
    startTransition(() => logMinutes(block.id, minutes));
  }

  return (
    <li
      className={`card relative overflow-hidden p-4 pl-5 transition ${
        done || skipped ? "opacity-55" : ""
      } ${pending ? "animate-pulse" : ""}`}
    >
      <span
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ background: block.projectColor }}
        aria-hidden
      />

      <div className="flex items-start gap-3">
        <button
          type="button"
          disabled={locked || skipped}
          onClick={() =>
            startTransition(() =>
              done ? uncompleteBlock(block.id) : completeBlock(block.id),
            )
          }
          aria-label={done ? "Desmarcar bloque" : "Marcar bloque como hecho"}
          className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-full border-2 transition active:scale-90 ${
            done
              ? "border-success bg-success text-white"
              : "border-border text-transparent"
          }`}
        >
          <Check size={18} strokeWidth={3} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className={`font-medium leading-snug ${done ? "line-through" : ""}`}>
              {block.title}
            </p>
            <span className="shrink-0 pt-0.5 font-mono text-sm text-muted">
              {formatMin(block.plannedMin)}
            </span>
          </div>

          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
            <span
              className="size-2 rounded-full"
              style={{ background: block.projectColor }}
              aria-hidden
            />
            {block.projectName}
            {block.actualMin > 0 && (
              <span className="text-foreground/70">· {formatMin(block.actualMin)} reales</span>
            )}
            {STATUS_LABEL[block.status] && <span>· {STATUS_LABEL[block.status]}</span>}
          </p>

          {block.reason && (
            <p className="mt-1.5 text-xs leading-relaxed text-muted/80">{block.reason}</p>
          )}

          {!locked && !done && !skipped && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {startedAt ? (
                <button type="button" onClick={stop} className="chip bg-accent text-white">
                  <span className="inline-flex items-center gap-1.5">
                    <Pause size={13} />
                    <span className="font-mono tabular-nums">
                      {String(Math.floor(elapsedSec / 60)).padStart(2, "0")}:
                      {String(elapsedSec % 60).padStart(2, "0")}
                    </span>
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={start}
                  className="chip bg-surface-2 text-foreground"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Play size={13} /> Empezar
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => startTransition(() => postponeBlock(block.id))}
                className="chip bg-surface-2 text-muted"
              >
                <span className="inline-flex items-center gap-1.5">
                  <SkipForward size={13} /> Aplazar
                </span>
              </button>

              <button
                type="button"
                onClick={() => startTransition(() => setTaskStatus(block.taskId, "DONE"))}
                className="chip bg-surface-2 text-muted"
                title="La tarea entera esta terminada, no solo este bloque"
              >
                <span className="inline-flex items-center gap-1.5">
                  <CircleCheck size={13} /> Tarea lista
                </span>
              </button>

              <button
                type="button"
                onClick={() => startTransition(() => removeBlock(block.id))}
                aria-label="Quitar del dia"
                className="chip ml-auto text-muted"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
