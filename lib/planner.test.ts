import { describe, expect, it } from "vitest";

import {
  BUFFER,
  MAX_BLOCK,
  MAX_PROJECTS_PER_DAY,
  buildPlan,
  type PlannerProject,
  type PlannerTask,
} from "./planner";

const HOY = "2026-08-15";

function project(over: Partial<PlannerProject> = {}): PlannerProject {
  return {
    id: "p1",
    name: "Proyecto",
    weeklyTargetMin: 0,
    priority: 2,
    minutesThisWeek: 0,
    ...over,
  };
}

function task(over: Partial<PlannerTask> = {}): PlannerTask {
  return {
    id: "t1",
    projectId: "p1",
    title: "Tarea",
    remainingMin: 60,
    dueDate: null,
    importance: 2,
    postponedCount: 0,
    hasChildren: false,
    ...over,
  };
}

describe("buildPlan", () => {
  it("no planifica nada si no hay tareas pendientes", () => {
    expect(buildPlan({ date: HOY, capacityMin: 180, tasks: [], projects: [] })).toEqual([]);
  });

  it("ignora las tareas ya consumidas y las que tienen subtareas", () => {
    const plan = buildPlan({
      date: HOY,
      capacityMin: 180,
      projects: [project()],
      tasks: [
        task({ id: "madre", hasChildren: true }),
        task({ id: "consumida", remainingMin: 0 }),
        task({ id: "hija" }),
      ],
    });
    expect(plan.map((b) => b.taskId)).toEqual(["hija"]);
  });

  it("nunca supera la capacidad efectiva (80% del tiempo declarado)", () => {
    const plan = buildPlan({
      date: HOY,
      capacityMin: 180,
      projects: [project({ id: "a" }), project({ id: "b" }), project({ id: "c" })],
      tasks: [
        task({ id: "1", projectId: "a", remainingMin: 120 }),
        task({ id: "2", projectId: "b", remainingMin: 120 }),
        task({ id: "3", projectId: "c", remainingMin: 120 }),
      ],
    });
    const total = plan.reduce((sum, b) => sum + b.plannedMin, 0);
    expect(total).toBeLessThanOrEqual(Math.floor(180 * BUFFER));
    expect(total).toBeGreaterThan(0);
  });

  it("prioriza lo que tiene el deadline mas cerca", () => {
    const plan = buildPlan({
      date: HOY,
      capacityMin: 120,
      projects: [project({ id: "a" }), project({ id: "b" })],
      tasks: [
        task({ id: "tranquila", projectId: "a", dueDate: "2026-10-22" }),
        task({ id: "urgente", projectId: "b", dueDate: "2026-08-17" }),
      ],
    });
    expect(plan[0].taskId).toBe("urgente");
    expect(plan[0].reason).toContain("vence en 2 dias");
  });

  it("pone por delante lo vencido", () => {
    const plan = buildPlan({
      date: HOY,
      capacityMin: 120,
      projects: [project({ id: "a" }), project({ id: "b" })],
      tasks: [
        task({ id: "importante", projectId: "a", importance: 1 }),
        task({ id: "vencida", projectId: "b", dueDate: "2026-08-10" }),
      ],
    });
    expect(plan[0].taskId).toBe("vencida");
    expect(plan[0].reason).toContain("fecha limite");
  });

  it("compensa el proyecto que va por debajo de su objetivo semanal", () => {
    const plan = buildPlan({
      date: HOY,
      capacityMin: 120,
      projects: [
        project({ id: "aldia", name: "Al dia", weeklyTargetMin: 300, minutesThisWeek: 300 }),
        project({ id: "colgado", name: "Colgado", weeklyTargetMin: 300, minutesThisWeek: 0 }),
      ],
      tasks: [
        task({ id: "t-aldia", projectId: "aldia" }),
        task({ id: "t-colgado", projectId: "colgado" }),
      ],
    });
    expect(plan[0].taskId).toBe("t-colgado");
    expect(plan[0].reason).toContain("por debajo del objetivo semanal");
  });

  it("rescata lo que se lleva aplazando muchas veces", () => {
    const plan = buildPlan({
      date: HOY,
      capacityMin: 120,
      projects: [project({ id: "a" }), project({ id: "b" })],
      tasks: [
        task({ id: "nueva", projectId: "a" }),
        task({ id: "podrida", projectId: "b", postponedCount: 5 }),
      ],
    });
    expect(plan[0].taskId).toBe("podrida");
    expect(plan[0].reason).toContain("aplazando");
  });

  it("no mete mas de tres proyectos en el mismo dia", () => {
    const projects = ["a", "b", "c", "d", "e"].map((id) => project({ id, name: id }));
    const plan = buildPlan({
      date: HOY,
      capacityMin: 600,
      projects,
      tasks: projects.map((p) => task({ id: `t-${p.id}`, projectId: p.id, remainingMin: 30 })),
    });
    const distintos = new Set(
      plan.map((b) => projects.find((p) => `t-${p.id}` === b.taskId)!.id),
    );
    expect(distintos.size).toBeLessThanOrEqual(MAX_PROJECTS_PER_DAY);
  });

  it("reparte: no encadena todo el dia en el mismo proyecto", () => {
    const plan = buildPlan({
      date: HOY,
      capacityMin: 300,
      projects: [project({ id: "a", name: "A" }), project({ id: "b", name: "B" })],
      tasks: [
        task({ id: "a1", projectId: "a", remainingMin: 60 }),
        task({ id: "a2", projectId: "a", remainingMin: 60 }),
        task({ id: "b1", projectId: "b", remainingMin: 60 }),
      ],
    });
    // El segundo bloque cambia de proyecto por la penalizacion.
    expect(plan[1].taskId).toBe("b1");
  });

  it("el primer bloque es el profundo y no pasa de 90 minutos", () => {
    const plan = buildPlan({
      date: HOY,
      capacityMin: 480,
      projects: [project()],
      tasks: [task({ id: "gorda", remainingMin: 600 })],
    });
    expect(plan[0].plannedMin).toBe(MAX_BLOCK);
    expect(plan[0].reason).toContain("Bloque profundo");
  });

  it("con un dia de 30 minutos planifica un unico bloque corto", () => {
    const plan = buildPlan({
      date: HOY,
      capacityMin: 30,
      projects: [project()],
      tasks: [task({ id: "gorda", remainingMin: 300 })],
    });
    expect(plan).toHaveLength(1);
    expect(plan[0].plannedMin).toBe(24); // 30 * 0.8
  });

  it("acepta tareas cortas enteras sin estirarlas al minimo de bloque", () => {
    const plan = buildPlan({
      date: HOY,
      capacityMin: 120,
      projects: [project()],
      tasks: [task({ id: "corta", remainingMin: 10 })],
    });
    expect(plan).toHaveLength(1);
    expect(plan[0].plannedMin).toBe(10);
  });

  it("es determinista: mismo input, mismo plan", () => {
    const input = {
      date: HOY,
      capacityMin: 240,
      projects: [project({ id: "a" }), project({ id: "b" })],
      tasks: [
        task({ id: "1", projectId: "a", dueDate: "2026-08-20" }),
        task({ id: "2", projectId: "b", postponedCount: 2 }),
      ],
    };
    expect(buildPlan(input)).toEqual(buildPlan(input));
  });
});
