// Verificacion del bucle completo contra una base de datos desechable:
// planificar hoy -> marcar resultados -> cerrar el dia -> planificar manana y
// comprobar que lo aplazado sube.
//
//   npm run verificar
//
// Usa la condicion `react-server` porque lib/day.ts importa "server-only".

process.env.DATABASE_URL = "file:./verificacion.db";

const { addDays, formatMin, todayMadrid } = await import("../lib/date");
const { db } = await import("../lib/db");
const { ensureDayPlan, getDay, weekSummary } = await import("../lib/day");

let fallos = 0;
function comprobar(descripcion: string, condicion: boolean) {
  console.log(`${condicion ? "  ok  " : " FALLO"}  ${descripcion}`);
  if (!condicion) fallos++;
}

const hoy = todayMadrid();
const manana = addDays(hoy, 1);

console.log(`\n1. Plan de hoy (${hoy})`);
const dia = await ensureDayPlan(hoy);
if (!dia) throw new Error("no se creo el dia");

for (const b of dia.blocks) {
  console.log(`   ${formatMin(b.plannedMin).padStart(6)}  ${b.task.title}  [${b.reason}]`);
}
comprobar("se planifican bloques", dia.blocks.length > 0);
const planificado = dia.blocks.reduce((s, b) => s + b.plannedMin, 0);
comprobar(
  `no se pasa del 80% de la capacidad (${formatMin(planificado)} de ${formatMin(dia.capacityMin)})`,
  planificado <= Math.floor(dia.capacityMin * 0.8),
);
comprobar(
  "el primer bloque es el profundo",
  dia.blocks[0].reason.startsWith("Bloque profundo"),
);

console.log("\n2. Se marca: 1 hecho, 1 a medias, 1 sin tocar");
const [hecho, medias, sinTocar] = dia.blocks;
await db.block.update({
  where: { id: hecho.id },
  data: { status: "DONE", actualMin: hecho.plannedMin },
});
if (medias) {
  await db.block.update({
    where: { id: medias.id },
    data: { status: "PARTIAL", actualMin: 15 },
  });
}

console.log("\n3. Cierre del dia: lo que quedo sin tocar cuenta como aplazado");
if (sinTocar) {
  await db.block.update({ where: { id: sinTocar.id }, data: { status: "SKIPPED" } });
  await db.task.update({
    where: { id: sinTocar.taskId },
    data: { postponedCount: { increment: 1 } },
  });
}
await db.day.update({ where: { date: hoy }, data: { closedAt: new Date(), energy: 3 } });

const tareaAplazada = sinTocar
  ? await db.task.findUnique({ where: { id: sinTocar.taskId } })
  : null;
comprobar("la tarea sin tocar sube su contador de aplazos", (tareaAplazada?.postponedCount ?? 0) === 1);

console.log(`\n4. Plan de manana (${manana})`);
const diaManana = await ensureDayPlan(manana);
if (!diaManana) throw new Error("no se creo el dia de manana");
for (const b of diaManana.blocks) {
  console.log(`   ${formatMin(b.plannedMin).padStart(6)}  ${b.task.title}  [${b.reason}]`);
}

const posicionAyer = dia.blocks.findIndex((b) => b.taskId === sinTocar?.taskId);
const posicionHoy = diaManana.blocks.findIndex((b) => b.taskId === sinTocar?.taskId);
comprobar("lo aplazado vuelve a entrar en el plan", posicionHoy !== -1);
comprobar(
  `lo aplazado sube de posicion (${posicionAyer} -> ${posicionHoy})`,
  posicionHoy !== -1 && posicionHoy < posicionAyer,
);
comprobar(
  "la tarea ya empezada no se replanifica entera",
  !diaManana.blocks.some(
    (b) => b.taskId === hecho.taskId && b.plannedMin >= hecho.plannedMin,
  ),
);

console.log("\n5. Resumen de la semana");
const semana = await weekSummary(manana);
const esperados = hecho.plannedMin + (medias ? 15 : 0);
console.log(
  `   ${formatMin(semana.totalMin)} reales · ${semana.closedDays} dia(s) cerrado(s)`,
);
comprobar(
  `los minutos reales cuadran (${semana.totalMin} = ${esperados})`,
  semana.totalMin === esperados,
);

const diaGuardado = await getDay(hoy);
comprobar("el dia queda cerrado", Boolean(diaGuardado?.closedAt));

console.log(fallos === 0 ? "\nTodo correcto.\n" : `\n${fallos} comprobacion(es) fallidas.\n`);
await db.$disconnect();
process.exit(fallos === 0 ? 0 : 1);
