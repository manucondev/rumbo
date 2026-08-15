// Vuelve a planificar el dia de hoy y lo imprime.
//   node --import tsx --conditions=react-server scripts/replanificar-hoy.mts
import "dotenv/config";

const { todayMadrid, formatMin } = await import("../lib/date");
const { regeneratePlan, getDay } = await import("../lib/day");
const { db } = await import("../lib/db");

const hoy = todayMadrid();
await regeneratePlan(hoy);
const dia = await getDay(hoy);
console.log(`Plan de ${hoy} (capacidad ${formatMin(dia?.capacityMin ?? 0)}):`);
for (const b of dia?.blocks ?? []) {
  console.log(`  ${formatMin(b.plannedMin).padStart(7)}  ${b.task.project.name} - ${b.task.title}`);
  console.log(`           ${b.reason}`);
}
await db.$disconnect();
