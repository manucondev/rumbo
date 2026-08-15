import "server-only";

import { normalizarBorrador, type Borrador } from "./borrador";
import { todayMadrid } from "./date";
import { db } from "./db";
import { pedirJson, proveedorIA } from "./ia";

export { proveedorIA };

const INSTRUCCIONES = `Eres el clasificador de una agenda personal. Recibes un texto libre en
espanol donde alguien cuenta en que esta trabajando, y lo conviertes en frentes (proyectos) y
tareas concretas.

Devuelve SOLO un objeto JSON con esta forma:

{
  "frentes": [{ "nombre": string, "horasSemana": number, "prioridad": 1|2|3 }],
  "tareas": [{ "frente": string, "titulo": string, "estimateMin": number, "importancia": 1|2|3, "dueDate": "YYYY-MM-DD"|null }]
}

Reglas:
- Reutiliza los frentes que ya existen cuando el texto se refiera a ellos, con su nombre EXACTO.
  Solo crea un frente nuevo si de verdad es algo distinto.
- "al menos una hora al dia" son 7 horas a la semana. "algunos dias si y otros no", entre 2 y 4.
  Si no dice nada del tiempo, pon horasSemana 0.
- prioridad e importancia: 1 alta, 2 media, 3 baja. Por defecto 2.
- estimateMin en minutos, multiplo de 15, lo que costaria UNA sesion de trabajo (entre 15 y 180).
  Si algo es enorme, parte lo en varias tareas en vez de poner un numero gigante.
- Convierte los plazos relativos a fecha absoluta usando la fecha de hoy que se te da.
  Si no hay plazo, dueDate null.
- Los titulos, en infinitivo y concretos: "Conseguir la clave de Endesa", no "Endesa".
- Si algo esta bloqueado esperando a un tercero, crea primero la tarea de desbloquearlo.
- No te inventes tareas que el texto no menciona. Ante la duda, menos tareas y mas concretas.`;

/// Interpreta un texto libre y devuelve el borrador, sin tocar la base de datos.
export async function interpretar(texto: string): Promise<Borrador> {
  const limpio = texto.trim().slice(0, 4000);
  if (!limpio) return { frentes: [], tareas: [] };

  const proyectos = await db.project.findMany({
    where: { archived: false },
    select: { name: true },
    orderBy: { name: "asc" },
  });
  const nombres = proyectos.map((p) => p.name);

  const contexto = [
    `Hoy es ${todayMadrid()}.`,
    nombres.length
      ? `Frentes que ya existen: ${nombres.join(", ")}.`
      : "Todavia no hay ningun frente creado.",
    "",
    "Texto:",
    limpio,
  ].join("\n");

  const crudo = await pedirJson(INSTRUCCIONES, contexto);

  let bruto: unknown;
  try {
    bruto = JSON.parse(crudo);
  } catch {
    // Algunos modelos envuelven el JSON en ```json ... ```
    const match = crudo.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("El modelo no devolvio JSON");
    bruto = JSON.parse(match[0]);
  }

  return normalizarBorrador(bruto, nombres);
}

/// Aplica un borrador: crea los frentes que falten y despues las tareas.
/// Devuelve el recuento para poder contarselo al usuario.
export async function aplicar(borrador: Borrador) {
  const porNombre = new Map<string, string>();
  let frentesCreados = 0;

  for (const f of borrador.frentes) {
    const existente = await db.project.findFirst({ where: { name: f.nombre } });
    if (existente) {
      porNombre.set(f.nombre, existente.id);
      // Si venia archivado y vuelve a mencionarse, se reactiva.
      if (existente.archived) {
        await db.project.update({ where: { id: existente.id }, data: { archived: false } });
      }
      continue;
    }

    const creado = await db.project.create({
      data: {
        name: f.nombre,
        color: await colorLibre(),
        weeklyTargetMin: Math.round(f.horasSemana * 60),
        priority: f.prioridad,
      },
    });
    porNombre.set(f.nombre, creado.id);
    frentesCreados++;
  }

  let tareasCreadas = 0;
  for (const t of borrador.tareas) {
    const projectId = porNombre.get(t.frente);
    if (!projectId) continue;

    // No duplicar si ya existe una tarea igual pendiente en ese frente.
    const dup = await db.task.findFirst({
      where: { projectId, title: t.titulo, status: { in: ["PENDING", "DOING"] } },
    });
    if (dup) continue;

    await db.task.create({
      data: {
        projectId,
        title: t.titulo,
        estimateMin: t.estimateMin,
        importance: t.importancia,
        dueDate: t.dueDate ? new Date(`${t.dueDate}T12:00:00Z`) : null,
      },
    });
    tareasCreadas++;
  }

  return { frentesCreados, tareasCreadas };
}

const PALETA = [
  "#6366f1",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#ec4899",
  "#64748b",
];

async function colorLibre() {
  const usados = new Set((await db.project.findMany({ select: { color: true } })).map((p) => p.color));
  return PALETA.find((c) => !usados.has(c)) ?? PALETA[0];
}
