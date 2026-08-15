import "server-only";

import { db } from "./db";
import { todayMadrid, weekStart, weekdayIndex } from "./date";
import { buildPlan, type PlannerProject, type PlannerTask } from "./planner";

const DEFAULT_CAPACITY = 120;

export async function getSettings() {
  const existing = await db.settings.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return db.settings.create({ data: { id: 1 } });
}

/// Minutos disponibles por defecto para ese dia de la semana.
export async function defaultCapacityFor(date: string): Promise<number> {
  const settings = await getSettings();
  const values = settings.capacityByWeekday.split(",").map((v) => Number(v.trim()));
  const value = values[weekdayIndex(date)];
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_CAPACITY;
}

/// Minutos reales dedicados a cada proyecto en la semana de `date`.
export async function minutesPerProjectThisWeek(date: string) {
  const from = weekStart(date);
  const blocks = await db.block.findMany({
    where: { day: { date: { gte: from, lte: date } } },
    select: { actualMin: true, task: { select: { projectId: true } } },
  });

  const totals = new Map<string, number>();
  for (const b of blocks) {
    const current = totals.get(b.task.projectId) ?? 0;
    totals.set(b.task.projectId, current + b.actualMin);
  }
  return totals;
}

/// Minutos ya invertidos en cada tarea (suma de los bloques reales).
export async function minutesPerTask() {
  const blocks = await db.block.findMany({ select: { taskId: true, actualMin: true } });
  const totals = new Map<string, number>();
  for (const b of blocks) {
    totals.set(b.taskId, (totals.get(b.taskId) ?? 0) + b.actualMin);
  }
  return totals;
}

/// Regenera los bloques PLANNED de un dia. Respeta lo que ya esta hecho o a
/// medias: esos bloques se quedan y su tiempo se descuenta de la capacidad.
export async function regeneratePlan(date: string) {
  const day = await db.day.findUnique({ where: { date }, include: { blocks: true } });
  if (!day) return;

  const locked = day.blocks.filter((b) => b.status !== "PLANNED");
  const lockedTaskIds = new Set(locked.map((b) => b.taskId));
  const lockedMin = locked.reduce((sum, b) => sum + Math.max(b.plannedMin, b.actualMin), 0);

  await db.block.deleteMany({ where: { dayId: day.id, status: "PLANNED" } });

  const capacityLeft = Math.max(0, day.capacityMin - lockedMin);
  if (capacityLeft <= 0) return;

  const [projects, tasks, spentByTask, weekByProject] = await Promise.all([
    db.project.findMany({ where: { archived: false } }),
    db.task.findMany({
      where: { status: { in: ["PENDING", "DOING"] }, project: { archived: false } },
      include: { _count: { select: { children: true } } },
    }),
    minutesPerTask(),
    minutesPerProjectThisWeek(date),
  ]);

  const plannerProjects: PlannerProject[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    weeklyTargetMin: p.weeklyTargetMin,
    priority: p.priority,
    minutesThisWeek: weekByProject.get(p.id) ?? 0,
  }));

  const plannerTasks: PlannerTask[] = tasks
    .filter((t) => !lockedTaskIds.has(t.id))
    .map((t) => {
      const spent = spentByTask.get(t.id) ?? 0;
      // Si la estimacion se quedo corta, la tarea sigue viva: se le dan 30
      // minutos mas en vez de dejarla fuera del plan para siempre.
      const remainingMin = Math.max(t.estimateMin - spent, 0) || 30;
      return {
        id: t.id,
        projectId: t.projectId,
        title: t.title,
        remainingMin,
        dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
        importance: t.importance,
        postponedCount: t.postponedCount,
        hasChildren: t._count.children > 0,
      };
    });

  const plan = buildPlan({
    date,
    capacityMin: capacityLeft,
    tasks: plannerTasks,
    projects: plannerProjects,
  });

  if (plan.length === 0) return;

  await db.block.createMany({
    data: plan.map((b) => ({
      dayId: day.id,
      taskId: b.taskId,
      plannedMin: b.plannedMin,
      sortOrder: locked.length + b.sortOrder,
      reason: b.reason,
    })),
  });
}

/// Crea el dia si no existe y lo planifica si aun no tiene bloques.
/// Idempotente a proposito: la llaman tanto el cron como la pantalla Hoy, asi
/// que el sistema funciona aunque el cron no llegue a dispararse.
export async function ensureDayPlan(date: string = todayMadrid()) {
  const existing = await db.day.findUnique({
    where: { date },
    include: { blocks: true },
  });

  if (!existing) {
    await db.day.create({ data: { date, capacityMin: await defaultCapacityFor(date) } });
    await regeneratePlan(date);
  } else if (existing.blocks.length === 0 && !existing.closedAt) {
    await regeneratePlan(date);
  }

  return getDay(date);
}

export async function getDay(date: string) {
  return db.day.findUnique({
    where: { date },
    include: {
      blocks: {
        orderBy: { sortOrder: "asc" },
        include: { task: { include: { project: true } } },
      },
    },
  });
}

export type DayWithBlocks = NonNullable<Awaited<ReturnType<typeof getDay>>>;
export type BlockWithTask = DayWithBlocks["blocks"][number];

/// Resumen de la semana de `date`: objetivo vs. real por proyecto.
export async function weekSummary(date: string) {
  const from = weekStart(date);
  const [projects, minutes, days] = await Promise.all([
    db.project.findMany({ where: { archived: false }, orderBy: { priority: "asc" } }),
    minutesPerProjectThisWeek(date),
    db.day.findMany({
      where: { date: { gte: from, lte: date } },
      include: { blocks: true },
      orderBy: { date: "asc" },
    }),
  ]);

  const doneTasks = await db.task.count({
    where: { status: "DONE", doneAt: { gte: new Date(`${from}T00:00:00.000Z`) } },
  });

  return {
    from,
    to: date,
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      targetMin: p.weeklyTargetMin,
      actualMin: minutes.get(p.id) ?? 0,
    })),
    days,
    doneTasks,
    closedDays: days.filter((d) => d.closedAt).length,
    totalMin: [...minutes.values()].reduce((a, b) => a + b, 0),
  };
}
