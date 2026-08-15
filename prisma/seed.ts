// Semilla con los frentes reales de Manu. Es idempotente: se puede volver a
// lanzar sin duplicar nada. Los objetivos semanales suman 15 h, el techo de
// dedicacion declarado.

import "dotenv/config";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../lib/generated/prisma/client";

const url = process.env.DATABASE_URL!;
const adapter = url.startsWith("file:")
  ? new PrismaBetterSqlite3({ url })
  : new PrismaPg({ connectionString: url });
const db = new PrismaClient({ adapter });

const PROJECTS = [
  {
    key: "RSNA",
    name: "RSNA Kaggle",
    color: "#6366f1",
    weeklyTargetMin: 480, // 8 h
    priority: 1,
    tasks: [
      { title: "Explorar el dataset y los DICOM", estimateMin: 90, importance: 1 },
      { title: "Baseline 2D con timm sobre un subconjunto", estimateMin: 180, importance: 1 },
      {
        title: "Preparar el notebook de envio (sin internet, <9 h GPU)",
        estimateMin: 120,
        importance: 1,
        dueDate: "2026-10-15",
      },
      { title: "Envio valido que supere el baseline", estimateMin: 60, importance: 1, dueDate: "2026-10-22" },
    ],
  },
  {
    key: "TF",
    name: "TensorFlow",
    color: "#f59e0b",
    weeklyTargetMin: 120, // 2 h
    priority: 3,
    tasks: [
      { title: "Replicar en Keras el ultimo ejercicio de PyTorch", estimateMin: 60, importance: 2 },
    ],
  },
  {
    key: "EMPLEO",
    name: "Empleo",
    color: "#10b981",
    weeklyTargetMin: 180, // 3 h
    priority: 1,
    tasks: [
      { title: "Actualizar el CV con el TFG y el RSNA", estimateMin: 45, importance: 1 },
      { title: "Tanda de 3 candidaturas", estimateMin: 45, importance: 2 },
    ],
  },
  {
    key: "MASTER",
    name: "Master",
    color: "#0ea5e9",
    weeklyTargetMin: 120, // 2 h
    priority: 2,
    tasks: [{ title: "Revisar el material pendiente", estimateMin: 60, importance: 2 }],
  },
];

async function main() {
  await db.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      // dom, lun, mar, mie, jue, vie, sab
      capacityByWeekday: "240,120,120,120,120,90,240",
      timezone: "Europe/Madrid",
      planHourLocal: 7,
    },
  });

  for (const p of PROJECTS) {
    const existing = await db.project.findFirst({ where: { name: p.name } });
    const project =
      existing ??
      (await db.project.create({
        data: {
          name: p.name,
          color: p.color,
          weeklyTargetMin: p.weeklyTargetMin,
          priority: p.priority,
        },
      }));

    for (const t of p.tasks) {
      const dup = await db.task.findFirst({
        where: { projectId: project.id, title: t.title },
      });
      if (dup) continue;
      await db.task.create({
        data: {
          projectId: project.id,
          title: t.title,
          estimateMin: t.estimateMin,
          importance: t.importance,
          dueDate: "dueDate" in t && t.dueDate ? new Date(`${t.dueDate}T12:00:00Z`) : null,
        },
      });
    }
  }

  const [projects, tasks] = await Promise.all([db.project.count(), db.task.count()]);
  console.log(`Semilla lista: ${projects} proyectos, ${tasks} tareas.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
