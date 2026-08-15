import { describe, expect, it } from "vitest";

import { normalizarBorrador } from "./borrador";

// Un LLM devuelve lo que le da la gana: numeros como texto, fechas imposibles,
// campos que faltan, listas infinitas. Nada de eso puede llegar a la base de
// datos, asi que estos casos fijan el saneado.
describe("normalizarBorrador", () => {
  it("aguanta basura sin romperse", () => {
    expect(normalizarBorrador(null)).toEqual({ frentes: [], tareas: [] });
    expect(normalizarBorrador({})).toEqual({ frentes: [], tareas: [] });
    expect(normalizarBorrador({ frentes: "no", tareas: 42 })).toEqual({
      frentes: [],
      tareas: [],
    });
  });

  it("marca como existente el frente que ya esta, respetando su nombre", () => {
    const b = normalizarBorrador(
      { frentes: [{ nombre: "bycualia", horasSemana: 7, prioridad: 1 }], tareas: [] },
      ["byCualia"],
    );
    expect(b.frentes).toEqual([
      { nombre: "byCualia", horasSemana: 7, prioridad: 1, nuevo: false },
    ]);
  });

  it("marca como nuevo lo que no existia", () => {
    const b = normalizarBorrador({ frentes: [{ nombre: "Chambergo" }], tareas: [] }, ["RSNA"]);
    expect(b.frentes[0]).toMatchObject({ nombre: "Chambergo", nuevo: true, horasSemana: 0 });
  });

  it("no duplica un frente mencionado varias veces", () => {
    const b = normalizarBorrador({
      frentes: [{ nombre: "RSNA" }, { nombre: "rsna" }],
      tareas: [{ frente: "RSNA", titulo: "Una cosa" }],
    });
    expect(b.frentes).toHaveLength(1);
  });

  it("crea el frente de una tarea huerfana en vez de tirarla", () => {
    const b = normalizarBorrador({
      frentes: [],
      tareas: [{ frente: "Chambergo", titulo: "Conseguir la clave de Endesa" }],
    });
    expect(b.frentes.map((f) => f.nombre)).toEqual(["Chambergo"]);
    expect(b.tareas).toHaveLength(1);
  });

  it("acota las estimaciones y las redondea a multiplos de 5", () => {
    const t = (estimateMin: unknown) =>
      normalizarBorrador({ tareas: [{ frente: "F", titulo: "T", estimateMin }] }).tareas[0]
        .estimateMin;

    expect(t(47)).toBe(45);
    expect(t(99999)).toBe(480); // techo de 8 h
    expect(t(-5)).toBe(30); // por defecto
    expect(t("60")).toBe(60); // llega como texto
    expect(t(undefined)).toBe(30);
  });

  it("acota importancia y prioridad a 1..3", () => {
    const b = normalizarBorrador({
      frentes: [{ nombre: "F", prioridad: 9 }],
      tareas: [{ frente: "F", titulo: "T", importancia: 0 }],
    });
    expect(b.frentes[0].prioridad).toBe(2);
    expect(b.tareas[0].importancia).toBe(2);
  });

  it("solo acepta fechas reales en formato YYYY-MM-DD", () => {
    const d = (dueDate: unknown) =>
      normalizarBorrador({ tareas: [{ frente: "F", titulo: "T", dueDate }] }).tareas[0].dueDate;

    expect(d("2026-09-15")).toBe("2026-09-15");
    expect(d("2026-02-31")).toBeNull(); // no existe
    expect(d("15/09/2026")).toBeNull();
    expect(d("manana")).toBeNull();
    expect(d(null)).toBeNull();
  });

  it("descarta tareas sin titulo y recorta los larguisimos", () => {
    const b = normalizarBorrador({
      tareas: [
        { frente: "F", titulo: "   " },
        { frente: "F", titulo: "x".repeat(500) },
      ],
    });
    expect(b.tareas).toHaveLength(1);
    expect(b.tareas[0].titulo).toHaveLength(120);
  });

  it("pone techo a cuantos frentes y tareas puede crear de golpe", () => {
    const b = normalizarBorrador({
      frentes: Array.from({ length: 50 }, (_, i) => ({ nombre: `F${i}` })),
      tareas: Array.from({ length: 200 }, (_, i) => ({ frente: "F0", titulo: `T${i}` })),
    });
    expect(b.frentes.length).toBeLessThanOrEqual(20);
    expect(b.tareas).toHaveLength(60);
  });
});
