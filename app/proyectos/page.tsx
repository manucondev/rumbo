import { NewProject } from "@/components/new-project";
import { ProjectCard, type ProjectView } from "@/components/project-card";
import { formatMin, todayMadrid } from "@/lib/date";
import { db } from "@/lib/db";
import { minutesPerProjectThisWeek } from "@/lib/day";

export const dynamic = "force-dynamic";

export default async function ProyectosPage() {
  const date = todayMadrid();
  const [projects, minutes] = await Promise.all([
    db.project.findMany({
      orderBy: [{ archived: "asc" }, { priority: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { tasks: { where: { status: { in: ["PENDING", "DOING"] } } } } },
      },
    }),
    minutesPerProjectThisWeek(date),
  ]);

  const views: ProjectView[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    weeklyTargetMin: p.weeklyTargetMin,
    priority: p.priority,
    archived: p.archived,
    actualMin: minutes.get(p.id) ?? 0,
    openTasks: p._count.tasks,
  }));

  const activos = views.filter((p) => !p.archived);
  const archivados = views.filter((p) => p.archived);
  const totalTarget = activos.reduce((sum, p) => sum + p.weeklyTargetMin, 0);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Frentes</h1>
        <p className="mt-1 text-sm text-muted">
          Cuanto quieres dedicarle a cada cosa por semana. De aqui sale el reparto del dia.
        </p>
        {totalTarget > 0 && (
          <p className="mt-2 text-xs text-muted">
            Comprometido: <span className="font-mono">{formatMin(totalTarget)}</span> a la
            semana
            {totalTarget > 900 && (
              <span className="text-warn"> · ojo, son mas de 15 h</span>
            )}
          </p>
        )}
      </header>

      <ul className="space-y-3">
        {activos.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
      </ul>

      <NewProject taken={activos.map((p) => p.color)} />

      {archivados.length > 0 && (
        <details>
          <summary className="cursor-pointer py-2 text-xs font-medium tracking-wide text-muted uppercase">
            Archivados ({archivados.length})
          </summary>
          <ul className="mt-2 space-y-3">
            {archivados.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
