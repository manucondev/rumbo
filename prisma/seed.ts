// Los frentes reales de Manu y sus objetivos semanales.
//
// Es idempotente y ademas actualiza: si cambias aqui un objetivo o un color y
// vuelves a lanzarlo, se aplica sin duplicar nada. Las tareas se crean solo si
// no existe ya una con el mismo titulo en ese frente, asi que no pisa lo que
// hayas escrito tu.
//
// A proposito NO archiva los frentes que falten de esta lista: si no, cada
// `npm run seed` te archivaria todo lo que hubieras creado desde la app.

import "dotenv/config";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../lib/generated/prisma/client";

const url = process.env.DATABASE_URL!;
const adapter = url.startsWith("file:")
  ? new PrismaBetterSqlite3({ url })
  : new PrismaPg({ connectionString: url });
const db = new PrismaClient({ adapter });

// Objetivos semanales: 6 + 7 + 4 + 2 + 1 = 20 h.
const PROJECTS = [
  {
    name: "byCualia",
    color: "#10b981",
    weeklyTargetMin: 420, // 7 h — una hora al dia
    priority: 1,
    tasks: [
      {
        title: "Definir en que consiste el trabajo diario de byCualia",
        estimateMin: 20,
        importance: 1,
      },
    ],
  },
  {
    name: "RSNA Kaggle",
    color: "#6366f1",
    weeklyTargetMin: 360, // 6 h
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
      {
        title: "Envio valido que supere el baseline",
        estimateMin: 60,
        importance: 1,
        dueDate: "2026-10-22",
      },
    ],
  },
  {
    name: "Curso de LangChain",
    color: "#a855f7",
    weeklyTargetMin: 240, // 4 h — para acabarlo en un mes
    priority: 2,
    tasks: [
      {
        title: "Avanzar en el curso de LangChain",
        estimateMin: 600,
        importance: 2,
        dueDate: "2026-09-15",
      },
    ],
  },
  {
    name: "Ofertas de trabajo",
    color: "#0ea5e9",
    weeklyTargetMin: 120, // 2 h
    priority: 2,
    tasks: [
      { title: "Actualizar el CV con el TFG y el RSNA", estimateMin: 45, importance: 1 },
      { title: "Tanda de 3 candidaturas", estimateMin: 45, importance: 2 },
    ],
  },
  {
    name: "Chambergo",
    color: "#f59e0b",
    weeklyTargetMin: 60, // 1 h — esta bloqueado, no tiene sentido pedirle mas
    priority: 2,
    tasks: [
      // Lo unico que se puede hacer hasta que llegue la clave.
      { title: "Conseguir la clave de Endesa", estimateMin: 15, importance: 1 },
      {
        title: "Terminar Chambergo con los datos de Endesa",
        estimateMin: 120,
        importance: 2,
      },
    ],
  },
];

async function main() {
  await db.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      // dom, lun, mar, mie, jue, vie, sab
      capacityByWeekday: "240,180,180,180,180,120,240",
      timezone: "Europe/Madrid",
      planHourLocal: 9,
    },
  });

  for (const p of PROJECTS) {
    const existing = await db.project.findFirst({ where: { name: p.name } });

    const project = existing
      ? await db.project.update({
          where: { id: existing.id },
          data: {
            color: p.color,
            weeklyTargetMin: p.weeklyTargetMin,
            priority: p.priority,
            archived: false,
          },
        })
      : await db.project.create({
          data: {
            name: p.name,
            color: p.color,
            weeklyTargetMin: p.weeklyTargetMin,
            priority: p.priority,
          },
        });

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

  const activos = await db.project.findMany({
    where: { archived: false },
    orderBy: { priority: "asc" },
  });
  const total = activos.reduce((s, p) => s + p.weeklyTargetMin, 0);
  console.log(`Frentes activos (${(total / 60).toFixed(1)} h/semana):`);
  for (const p of activos) {
    console.log(`  ${(p.weeklyTargetMin / 60).toFixed(1).padStart(4)} h  ${p.name}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
