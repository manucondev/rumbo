// Transicion puntual de los frentes de agosto de 2026: "Empleo" pasa a llamarse
// "Ofertas de trabajo" (para que se lleve sus tareas en vez de duplicarlas) y se
// archivan TensorFlow y Master, que ya no estan entre los frentes activos.
//
// Tambien se sube la capacidad diaria, porque con 20 h/semana de objetivo las
// 2 h por dia de antes se quedaban cortas.
//
//   node --import tsx scripts/transicion-frentes.mts

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../lib/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const empleo = await db.project.findFirst({ where: { name: "Empleo" } });
if (empleo) {
  await db.project.update({
    where: { id: empleo.id },
    data: { name: "Ofertas de trabajo" },
  });
  console.log('Renombrado: "Empleo" -> "Ofertas de trabajo"');
}

for (const nombre of ["TensorFlow", "Master"]) {
  const p = await db.project.findFirst({ where: { name: nombre } });
  if (p && !p.archived) {
    await db.project.update({ where: { id: p.id }, data: { archived: true } });
    console.log(`Archivado: ${nombre}`);
  }
}

await db.settings.update({
  where: { id: 1 },
  // dom, lun, mar, mie, jue, vie, sab
  data: { capacityByWeekday: "240,180,180,180,180,120,240", planHourLocal: 9 },
});
console.log("Capacidad diaria actualizada (3 h entre semana, 4 h los findes)");

await db.$disconnect();
