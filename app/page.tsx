import Link from "next/link";

import { AddAdHoc, type TaskOption } from "@/components/add-adhoc";
import { BlockCard, type BlockView } from "@/components/block-card";
import { CapacityChips } from "@/components/capacity-chips";
import { CloseDay } from "@/components/close-day";
import { formatMin, shortLabel, todayMadrid } from "@/lib/date";
import { db } from "@/lib/db";
import { ensureDayPlan } from "@/lib/day";

export const dynamic = "force-dynamic";

export default async function HoyPage() {
  const date = todayMadrid();
  const day = await ensureDayPlan(date);

  const openTasks = await db.task.findMany({
    where: { status: { in: ["PENDING", "DOING"] }, project: { archived: false } },
    include: { project: true, _count: { select: { children: true } } },
    orderBy: { createdAt: "desc" },
  });

  const options: TaskOption[] = openTasks
    .filter((t) => t._count.children === 0)
    .map((t) => ({ id: t.id, title: t.title, projectName: t.project.name }));

  const blocks: BlockView[] = (day?.blocks ?? []).map((b) => ({
    id: b.id,
    taskId: b.taskId,
    title: b.task.title,
    projectName: b.task.project.name,
    projectColor: b.task.project.color,
    plannedMin: b.plannedMin,
    actualMin: b.actualMin,
    status: b.status,
    reason: b.reason,
  }));

  const plannedMin = blocks.reduce((sum, b) => sum + b.plannedMin, 0);
  const doneMin = blocks
    .filter((b) => b.status === "DONE")
    .reduce((sum, b) => sum + b.plannedMin, 0);
  const realMin = blocks.reduce((sum, b) => sum + b.actualMin, 0);
  const doneCount = blocks.filter((b) => b.status === "DONE").length;
  const stillPending = blocks.filter((b) => b.status === "PLANNED").length;
  const closed = Boolean(day?.closedAt);
  const progress = plannedMin > 0 ? Math.round((doneMin / plannedMin) * 100) : 0;

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-medium tracking-wide text-muted uppercase">
          {shortLabel(date)}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {closed ? "Dia cerrado" : "Hoy"}
        </h1>
        {blocks.length > 0 && (
          <p className="mt-1 text-sm text-muted">
            {doneCount} de {blocks.length} bloques
            {realMin > 0 && <> · {formatMin(realMin)} reales</>}
          </p>
        )}
      </header>

      {blocks.length > 0 && (
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <CapacityChips
        date={date}
        capacityMin={day?.capacityMin ?? 120}
        plannedMin={plannedMin}
        locked={closed}
      />

      {blocks.length === 0 ? (
        <div className="card space-y-3 p-6 text-center">
          <p className="text-sm text-muted">
            No hay nada que planificar. Mete tareas en la bandeja y el plan se hace solo.
          </p>
          <Link href="/tareas" className="btn-primary">
            Ir a tareas
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {blocks.map((b) => (
            <BlockCard key={b.id} block={b} locked={closed} />
          ))}
        </ul>
      )}

      {!closed && <AddAdHoc date={date} tasks={options} />}

      <CloseDay date={date} closed={closed} pendingBlocks={stillPending} />

      {day?.note && (
        <p className="text-center text-xs text-muted">
          Nota del cierre: &laquo;{day.note}&raquo;
        </p>
      )}
    </div>
  );
}
