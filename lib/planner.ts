// Motor de planificacion del dia.
//
// Funcion pura y sin Prisma dentro: entra el estado del mundo, sale la lista de
// bloques. Asi se puede testear entero sin base de datos, y cada bloque sale con
// un `reason` en lenguaje natural para que el plan sea explicable.

import { diffDays, formatMin } from "./date";

export type PlannerTask = {
  id: string;
  projectId: string;
  title: string;
  /// Minutos que faltan por dedicarle (estimacion menos lo ya invertido).
  remainingMin: number;
  /// "YYYY-MM-DD" o null.
  dueDate: string | null;
  /// 1 alta - 2 media - 3 baja
  importance: number;
  postponedCount: number;
  /// Si tiene subtareas, se planifican las hijas y esta se ignora.
  hasChildren: boolean;
};

export type PlannerProject = {
  id: string;
  name: string;
  weeklyTargetMin: number;
  /// 1 alta - 2 media - 3 baja
  priority: number;
  /// Minutos reales ya dedicados en la semana en curso.
  minutesThisWeek: number;
};

export type PlannerInput = {
  /// "YYYY-MM-DD" del dia a planificar.
  date: string;
  capacityMin: number;
  tasks: PlannerTask[];
  projects: PlannerProject[];
};

export type PlannedBlock = {
  taskId: string;
  plannedMin: number;
  sortOrder: number;
  reason: string;
};

/// Colchon: se planifica solo el 80% del tiempo declarado, porque los dias
/// siempre se tuercen y un plan imposible se abandona el segundo dia.
export const BUFFER = 0.8;
export const MIN_BLOCK = 25;
export const MAX_BLOCK = 90;
export const MAX_PROJECTS_PER_DAY = 3;
/// Por debajo de esto ya no merece la pena abrir otro bloque.
const MIN_USEFUL_REMAINDER = 10;
/// Penalizacion por cada bloque que ese proyecto ya tiene hoy: obliga a
/// repartir en vez de dedicar el dia entero a un solo frente.
const SAME_PROJECT_PENALTY = 15;

type Scored = {
  task: PlannerTask;
  base: number;
  urgency: number;
  debt: number;
  postponed: number;
  importance: number;
};

function urgencyScore(task: PlannerTask, date: string): number {
  if (!task.dueDate) return 0;
  const days = diffDays(task.dueDate, date);
  if (days < 0) return 45; // vencida: por encima de todo lo demas
  return Math.max(0, 40 - days * 5);
}

function debtScore(project: PlannerProject | undefined): number {
  if (!project || project.weeklyTargetMin <= 0) return 0;
  const missing = project.weeklyTargetMin - project.minutesThisWeek;
  if (missing <= 0) return 0;
  return Math.min(1, missing / project.weeklyTargetMin) * 25;
}

function reasonFor(s: Scored, project: PlannerProject | undefined, date: string): string {
  if (s.urgency >= 45) return `se paso la fecha limite`;
  if (s.urgency >= 20) {
    const days = diffDays(s.task.dueDate!, date);
    return days === 0 ? "vence hoy" : days === 1 ? "vence manana" : `vence en ${days} dias`;
  }
  if (s.debt >= 12 && project) {
    const missing = project.weeklyTargetMin - project.minutesThisWeek;
    return `${project.name} va ${formatMin(missing)} por debajo del objetivo semanal`;
  }
  if (s.postponed >= 16) {
    return `lo llevas aplazando ${s.task.postponedCount} veces`;
  }
  if (s.task.importance === 1) return "marcada como importante";
  if (project) return `toca avanzar en ${project.name}`;
  return "toca ir avanzando";
}

export function buildPlan(input: PlannerInput): PlannedBlock[] {
  const { date, capacityMin, tasks, projects } = input;

  const byProject = new Map(projects.map((p) => [p.id, p]));

  const candidates: Scored[] = tasks
    .filter((t) => !t.hasChildren && t.remainingMin > 0)
    .map((task) => {
      const project = byProject.get(task.projectId);
      const urgency = urgencyScore(task, date);
      const debt = debtScore(project);
      const postponed = Math.min(task.postponedCount * 8, 24);
      const importance = (4 - task.importance) * 10;
      const projectPriority = project ? (4 - project.priority) * 5 : 0;
      return {
        task,
        urgency,
        debt,
        postponed,
        importance,
        base: urgency + debt + postponed + importance + projectPriority,
      };
    });

  if (candidates.length === 0) return [];

  const effective = Math.floor(capacityMin * BUFFER);
  if (effective < MIN_USEFUL_REMAINDER) return [];

  // Si el dia es muy corto, se permite un unico bloque mas pequeno que
  // MIN_BLOCK; mejor 20 minutos de algo que un plan vacio.
  const minBlock = Math.min(MIN_BLOCK, effective);

  const blocks: PlannedBlock[] = [];
  const usedByProject = new Map<string, number>();
  const pending = [...candidates];
  let left = effective;

  while (left >= MIN_USEFUL_REMAINDER && pending.length > 0) {
    const projectsUsed = usedByProject.size;

    // El score efectivo cae con cada bloque que ese proyecto ya tiene hoy.
    let bestIdx = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < pending.length; i++) {
      const c = pending[i];
      const already = usedByProject.get(c.task.projectId) ?? 0;
      if (already === 0 && projectsUsed >= MAX_PROJECTS_PER_DAY) continue;
      const score = c.base - already * SAME_PROJECT_PENALTY;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) break;

    const chosen = pending.splice(bestIdx, 1)[0];
    const project = byProject.get(chosen.task.projectId);

    // El primer bloque del dia es el profundo: se le da hasta MAX_BLOCK.
    const cap = blocks.length === 0 ? MAX_BLOCK : Math.min(MAX_BLOCK, 60);
    const plannedMin = Math.min(chosen.task.remainingMin, cap, left);

    // Si hay que truncar la tarea, el trozo tiene que valer la pena. Si la
    // tarea entera cabe (aunque sean 10 minutos), se acepta tal cual.
    const truncated = plannedMin < chosen.task.remainingMin;
    if (truncated && plannedMin < minBlock) continue;
    if (plannedMin <= 0) continue;

    const reason = reasonFor(chosen, project, date);
    blocks.push({
      taskId: chosen.task.id,
      plannedMin,
      sortOrder: blocks.length,
      reason: blocks.length === 0 ? `Bloque profundo - ${reason}` : reason,
    });

    usedByProject.set(
      chosen.task.projectId,
      (usedByProject.get(chosen.task.projectId) ?? 0) + 1,
    );
    left -= plannedMin;
  }

  return blocks;
}
