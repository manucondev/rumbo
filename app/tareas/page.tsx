import Link from "next/link";
import { Sparkles } from "lucide-react";

import { QuickAdd, type ProjectOption } from "@/components/quick-add";
import { TaskRow, type TaskView } from "@/components/task-row";
import { db } from "@/lib/db";
import { minutesPerTask } from "@/lib/day";

export const dynamic = "force-dynamic";

export default async function TareasPage() {
  const [projects, tasks, spent] = await Promise.all([
    db.project.findMany({ where: { archived: false }, orderBy: { priority: "asc" } }),
    db.task.findMany({
      where: { project: { archived: false } },
      orderBy: [{ createdAt: "asc" }],
    }),
    minutesPerTask(),
  ]);

  const options: ProjectOption[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
  }));

  function toView(t: (typeof tasks)[number]): TaskView {
    return {
      id: t.id,
      title: t.title,
      estimateMin: t.estimateMin,
      spentMin: spent.get(t.id) ?? 0,
      importance: t.importance,
      status: t.status,
      dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
      postponedCount: t.postponedCount,
      children: tasks.filter((c) => c.parentId === t.id).map(toView),
    };
  }

  const roots = tasks.filter((t) => !t.parentId).map(toView);
  const open = roots.filter((t) => t.status === "PENDING" || t.status === "DOING");
  const closed = roots.filter((t) => t.status === "DONE" || t.status === "DROPPED");

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Tareas</h1>
        <p className="mt-1 text-sm text-muted">
          Suelta aqui todo lo que se te ocurra. El plan de cada dia sale de esta lista.
        </p>
      </header>

      {projects.length === 0 ? (
        <div className="card space-y-3 p-6 text-center">
          <p className="text-sm text-muted">Primero necesitas al menos un frente abierto.</p>
          <Link href="/proyectos" className="btn-primary">
            Crear un frente
          </Link>
        </div>
      ) : (
        <>
          <QuickAdd projects={options} />
          <Link
            href="/capturar"
            className="btn-ghost w-full border-dashed text-muted"
          >
            <Sparkles size={15} /> Soltar varias cosas en texto
          </Link>
        </>
      )}

      {projects.map((project) => {
        const suyas = open.filter(
          (t) => tasks.find((raw) => raw.id === t.id)?.projectId === project.id,
        );
        if (suyas.length === 0) return null;
        return (
          <section key={project.id}>
            <h2 className="mb-1 flex items-center gap-2 text-xs font-medium tracking-wide text-muted uppercase">
              <span
                className="size-2 rounded-full"
                style={{ background: project.color }}
                aria-hidden
              />
              {project.name}
            </h2>
            <ul className="card divide-y divide-border px-3">
              {suyas.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </ul>
          </section>
        );
      })}

      {open.length === 0 && projects.length > 0 && (
        <p className="py-8 text-center text-sm text-muted">
          Sin tareas pendientes. Disfrutalo o mete alguna.
        </p>
      )}

      {closed.length > 0 && (
        <details className="card px-3 py-2">
          <summary className="cursor-pointer py-1 text-xs font-medium tracking-wide text-muted uppercase">
            Cerradas ({closed.length})
          </summary>
          <ul className="divide-y divide-border">
            {closed.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
