// Prueba la interpretacion de texto libre sin escribir nada en la base de datos.
//   node --import tsx --conditions=react-server scripts/probar-captura.mts "texto"
import "dotenv/config";

const { interpretar, proveedorIA } = await import("../lib/captura");
const { db } = await import("../lib/db");
const { formatMin } = await import("../lib/date");

const texto = process.argv[2] ?? "";
console.log("proveedor:", proveedorIA());

const t0 = Date.now();
const b = await interpretar(texto);
console.log(`interpretado en ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

console.log("FRENTES");
for (const f of b.frentes) {
  console.log(
    `  ${f.nuevo ? "nuevo   " : "existe  "}${f.nombre.padEnd(22)} ${f.horasSemana} h/sem  prio ${f.prioridad}`,
  );
}
console.log("\nTAREAS");
for (const t of b.tareas) {
  console.log(
    `  ${formatMin(t.estimateMin).padStart(6)}  imp${t.importancia}  ${(t.dueDate ?? "sin plazo").padEnd(11)} ${t.frente} - ${t.titulo}`,
  );
}
await db.$disconnect();
