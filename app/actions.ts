"use server";

import { revalidatePath } from "next/cache";

import { todayMadrid } from "@/lib/date";
import { db } from "@/lib/db";
import { ensureDayPlan, regeneratePlan } from "@/lib/day";

function refresh() {
  revalidatePath("/");
  revalidatePath("/tareas");
  revalidatePath("/proyectos");
  revalidatePath("/semana");
}

// ---------------------------------------------------------------- dia y plan

export async function setCapacity(date: string, capacityMin: number) {
  const clamped = Math.max(15, Math.min(960, Math.round(capacityMin)));
  await db.day.update({ where: { date }, data: { capacityMin: clamped } });
  await regeneratePlan(date);
  refresh();
}

export async function regenerateDay(date: string) {
  await regeneratePlan(date);
  refresh();
}

export async function completeBlock(blockId: string) {
  const block = await db.block.findUnique({ where: { id: blockId } });
  if (!block) return;
  await db.block.update({
    where: { id: blockId },
    data: {
      status: "DONE",
      // Si no se uso el cronometro, damos por bueno lo planificado.
      actualMin: block.actualMin > 0 ? block.actualMin : block.plannedMin,
    },
  });
  refresh();
}

export async function uncompleteBlock(blockId: string) {
  await db.block.update({ where: { id: blockId }, data: { status: "PLANNED" } });
  refresh();
}

/// Suma los minutos del cronometro al bloque.
export async function logMinutes(blockId: string, minutes: number) {
  if (minutes <= 0) return;
  const block = await db.block.findUnique({ where: { id: blockId } });
  if (!block) return;
  await db.block.update({
    where: { id: blockId },
    data: {
      actualMin: block.actualMin + Math.round(minutes),
      status: block.status === "PLANNED" ? "PARTIAL" : block.status,
    },
  });
  refresh();
}

/// Aplazar: el bloque se marca como saltado y la tarea sube su contador, lo que
/// hara que el planner la suba de prioridad manana.
export async function postponeBlock(blockId: string) {
  const block = await db.block.findUnique({ where: { id: blockId } });
  if (!block) return;
  await db.$transaction([
    db.block.update({ where: { id: blockId }, data: { status: "SKIPPED" } }),
    db.task.update({
      where: { id: block.taskId },
      data: { postponedCount: { increment: 1 } },
    }),
  ]);
  refresh();
}

export async function removeBlock(blockId: string) {
  await db.block.delete({ where: { id: blockId } });
  refresh();
}

/// Meter una tarea en el dia a mano, saltandose al planner.
export async function addTaskToDay(date: string, taskId: string, minutes: number) {
  const day = await db.day.findUnique({ where: { date }, include: { blocks: true } });
  if (!day) return;
  await db.block.create({
    data: {
      dayId: day.id,
      taskId,
      plannedMin: Math.max(5, Math.round(minutes)),
      sortOrder: day.blocks.length,
      reason: "lo has metido tu",
    },
  });
  refresh();
}

/// Cierre del dia: lo que quedo sin tocar cuenta como aplazado.
export async function closeDay(date: string, energy: number | null, note: string) {
  const day = await db.day.findUnique({ where: { date }, include: { blocks: true } });
  if (!day) return;

  const pending = day.blocks.filter((b) => b.status === "PLANNED");

  await db.$transaction([
    ...pending.map((b) =>
      db.block.update({ where: { id: b.id }, data: { status: "SKIPPED" } }),
    ),
    ...pending.map((b) =>
      db.task.update({
        where: { id: b.taskId },
        data: { postponedCount: { increment: 1 } },
      }),
    ),
    db.day.update({
      where: { id: day.id },
      data: { closedAt: new Date(), energy, note: note.trim() || null },
    }),
  ]);
  refresh();
}

export async function reopenDay(date: string) {
  await db.day.update({ where: { date }, data: { closedAt: null } });
  refresh();
}

// -------------------------------------------------------------------- tareas

export async function createTask(input: {
  projectId: string;
  title: string;
  estimateMin: number;
  importance: number;
  dueDate: string | null;
  parentId?: string | null;
}) {
  const title = input.title.trim();
  if (!title) return;
  await db.task.create({
    data: {
      projectId: input.projectId,
      title,
      estimateMin: Math.max(5, Math.round(input.estimateMin)),
      importance: input.importance,
      dueDate: input.dueDate ? new Date(`${input.dueDate}T12:00:00Z`) : null,
      parentId: input.parentId ?? null,
    },
  });
  refresh();
}

export async function updateTask(
  id: string,
  data: {
    title?: string;
    estimateMin?: number;
    importance?: number;
    dueDate?: string | null;
    notes?: string | null;
  },
) {
  await db.task.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title.trim() } : {}),
      ...(data.estimateMin !== undefined
        ? { estimateMin: Math.max(5, Math.round(data.estimateMin)) }
        : {}),
      ...(data.importance !== undefined ? { importance: data.importance } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.dueDate !== undefined
        ? { dueDate: data.dueDate ? new Date(`${data.dueDate}T12:00:00Z`) : null }
        : {}),
    },
  });
  refresh();
}

export async function setTaskStatus(id: string, status: string) {
  await db.task.update({
    where: { id },
    data: { status, doneAt: status === "DONE" ? new Date() : null },
  });

  // Al cerrar una tarea, sus bloques planificados de hoy dejan de tener sentido.
  if (status === "DONE" || status === "DROPPED") {
    await db.block.deleteMany({
      where: { taskId: id, status: "PLANNED", day: { date: todayMadrid() } },
    });
  }
  refresh();
}

export async function deleteTask(id: string) {
  await db.task.delete({ where: { id } });
  refresh();
}

/// Trocear una tarea en subtareas. Lo usa el boton manual y, mas adelante, la IA.
export async function breakDownTask(
  parentId: string,
  subtasks: { title: string; estimateMin: number }[],
) {
  const parent = await db.task.findUnique({ where: { id: parentId } });
  if (!parent) return;
  await db.task.createMany({
    data: subtasks
      .filter((s) => s.title.trim())
      .map((s) => ({
        projectId: parent.projectId,
        parentId: parent.id,
        title: s.title.trim(),
        estimateMin: Math.max(5, Math.round(s.estimateMin)),
        importance: parent.importance,
        dueDate: parent.dueDate,
      })),
  });
  refresh();
}

// ----------------------------------------------------------------- proyectos

export async function createProject(input: {
  name: string;
  color: string;
  weeklyTargetHours: number;
  priority: number;
}) {
  const name = input.name.trim();
  if (!name) return;
  await db.project.create({
    data: {
      name,
      color: input.color,
      weeklyTargetMin: Math.round(input.weeklyTargetHours * 60),
      priority: input.priority,
    },
  });
  refresh();
}

export async function updateProject(
  id: string,
  data: { name?: string; color?: string; weeklyTargetHours?: number; priority?: number },
) {
  await db.project.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.color !== undefined ? { color: data.color } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.weeklyTargetHours !== undefined
        ? { weeklyTargetMin: Math.round(data.weeklyTargetHours * 60) }
        : {}),
    },
  });
  refresh();
}

export async function setProjectArchived(id: string, archived: boolean) {
  await db.project.update({ where: { id }, data: { archived } });
  refresh();
}

// ------------------------------------------------------------------ ajustes

export async function setWeekdayCapacities(minutes: number[]) {
  await db.settings.update({
    where: { id: 1 },
    data: { capacityByWeekday: minutes.map((m) => Math.max(0, Math.round(m))).join(",") },
  });
  refresh();
}

export async function planToday() {
  await ensureDayPlan(todayMadrid());
  refresh();
}
