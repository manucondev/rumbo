"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, FolderPlus, Sparkles, Trash2 } from "lucide-react";

import { aplicarBorrador, interpretarTexto } from "@/app/capturar/actions";
import type { Borrador } from "@/lib/borrador";
import { formatMin, relativeDays, todayMadrid } from "@/lib/date";
import { IMPORTANCE_LABEL } from "@/lib/types";

const EJEMPLO = `Lo que llevo ahora mismo:
lo de RSNA
byCualia, le quiero dedicar al menos 1 hora al dia
terminar lo de chambergo, que necesito la clave de endesa
el curso de langchain, algunos dias si y otros no, para tenerlo de aqui a un mes
buscar ofertas de trabajo, no todos los dias pero sin olvidarme`;

export function Capturador() {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [error, setError] = useState("");
  const [hecho, setHecho] = useState("");
  const [pending, startTransition] = useTransition();
  const hoy = todayMadrid();

  function interpretar() {
    setError("");
    setHecho("");
    startTransition(async () => {
      const res = await interpretarTexto(texto);
      if ("error" in res) {
        setError(res.error);
        setBorrador(null);
      } else {
        setBorrador(res.borrador);
      }
    });
  }

  function quitarTarea(indice: number) {
    if (!borrador) return;
    setBorrador({ ...borrador, tareas: borrador.tareas.filter((_, i) => i !== indice) });
  }

  function quitarFrente(nombre: string) {
    if (!borrador) return;
    setBorrador({
      frentes: borrador.frentes.filter((f) => f.nombre !== nombre),
      tareas: borrador.tareas.filter((t) => t.frente !== nombre),
    });
  }

  function crear() {
    if (!borrador) return;
    startTransition(async () => {
      const res = await aplicarBorrador(borrador);
      setHecho(
        `Creados ${res.frentesCreados} frente${res.frentesCreados === 1 ? "" : "s"} y ` +
          `${res.tareasCreadas} tarea${res.tareasCreadas === 1 ? "" : "s"}.`,
      );
      setBorrador(null);
      setTexto("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="card p-3">
        <textarea
          rows={7}
          className="field resize-none"
          placeholder={EJEMPLO}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <button
          type="button"
          onClick={interpretar}
          disabled={pending || !texto.trim()}
          className="btn-primary mt-2 w-full"
        >
          <Sparkles size={16} />
          {pending && !borrador ? "Leyendo..." : "Interpretar"}
        </button>
      </div>

      {error && <p className="card p-4 text-sm text-danger">{error}</p>}

      {hecho && (
        <div className="card space-y-3 p-4 text-center">
          <p className="text-sm text-success">{hecho}</p>
          <a href="/" className="btn-ghost">
            Ver el plan de hoy
          </a>
        </div>
      )}

      {borrador && (
        <div className="space-y-4">
          {borrador.frentes.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">
                Frentes
              </h2>
              <ul className="card divide-y divide-border">
                {borrador.frentes.map((f) => (
                  <li key={f.nombre} className="flex items-center gap-3 p-3">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        {f.nuevo && <FolderPlus size={13} className="shrink-0 text-accent" />}
                        {f.nombre}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {f.nuevo ? "nuevo" : "ya existe"}
                        {f.horasSemana > 0 && <> · {f.horasSemana} h/semana</>}
                        {" · prioridad "}
                        {IMPORTANCE_LABEL[f.prioridad].toLowerCase()}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => quitarFrente(f.nombre)}
                      aria-label={`Quitar ${f.nombre}`}
                      className="chip text-muted"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {borrador.tareas.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">
                Tareas
              </h2>
              <ul className="card divide-y divide-border">
                {borrador.tareas.map((t, i) => (
                  <li key={`${t.frente}-${t.titulo}-${i}`} className="flex items-start gap-3 p-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm leading-snug">{t.titulo}</span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {t.frente} · {formatMin(t.estimateMin)}
                        {t.importancia === 1 && " · importante"}
                        {t.dueDate && ` · vence ${relativeDays(t.dueDate, hoy)}`}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => quitarTarea(i)}
                      aria-label={`Quitar ${t.titulo}`}
                      className="chip text-muted"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setBorrador(null)}
              className="btn-ghost flex-1"
            >
              Descartar
            </button>
            <button
              type="button"
              onClick={crear}
              disabled={pending || (borrador.frentes.length === 0 && borrador.tareas.length === 0)}
              className="btn-primary flex-1"
            >
              <Check size={16} /> Crear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
