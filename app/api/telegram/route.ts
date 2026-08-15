import type { Borrador } from "@/lib/borrador";
import { aplicar, interpretar, proveedorIA } from "@/lib/captura";
import { db } from "@/lib/db";
import { formatMin } from "@/lib/date";
import { editarMensaje, enviarMensaje, responderCallback } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/// Webhook del bot. Escribes lo que llevas entre manos, te contesta con lo que
/// ha entendido y no crea nada hasta que le das al boton.
///
/// Tres candados, porque esta URL es publica: la cabecera secreta que Telegram
/// manda en cada peticion, el chat autorizado y nada mas.
export async function POST(request: Request) {
  const secreto = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secreto) return Response.json({ ok: true }); // sin configurar: se ignora

  if (request.headers.get("x-telegram-bot-api-secret-token") !== secreto) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const update = await request.json().catch(() => null);
  if (!update) return Response.json({ ok: true });

  // Telegram reintenta si no le respondes 200, asi que ante cualquier problema
  // se contesta 200 igualmente y el error se cuenta por el chat.
  try {
    if (update.callback_query) await manejarBoton(update.callback_query);
    else if (update.message?.text) await manejarMensaje(update.message);
  } catch (e) {
    console.error("webhook de telegram:", e);
  }

  return Response.json({ ok: true });
}

function autorizado(chatId: unknown) {
  return String(chatId) === String(process.env.TELEGRAM_CHAT_ID);
}

async function manejarMensaje(message: { chat: { id: number }; text: string }) {
  if (!autorizado(message.chat.id)) return;

  const texto = message.text.trim();

  if (texto.startsWith("/")) {
    await enviarMensaje(
      [
        "Escribeme en cristiano lo que llevas entre manos y lo convierto en frentes y tareas.",
        "",
        "Por ejemplo:",
        "<i>el curso de langchain, algunos dias si y otros no, para tenerlo de aqui a un mes</i>",
      ].join("\n"),
    );
    return;
  }

  if (!proveedorIA()) {
    await enviarMensaje("No tengo clave de IA configurada, asi que no puedo interpretar texto.");
    return;
  }

  const borrador = await interpretar(texto);
  if (borrador.frentes.length === 0 && borrador.tareas.length === 0) {
    await enviarMensaje("No he sacado nada en claro de eso.");
    return;
  }

  const draft = await db.draft.create({ data: { payload: JSON.stringify(borrador) } });
  await enviarMensaje(resumen(borrador), undefined, [
    [
      { text: "Crear", callback_data: `crear:${draft.id}` },
      { text: "Descartar", callback_data: `nada:${draft.id}` },
    ],
  ]);

  // Limpieza oportunista de borradores que nadie confirmo.
  await db.draft.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
}

async function manejarBoton(callback: {
  id: string;
  data?: string;
  message?: { chat: { id: number }; message_id: number };
}) {
  const chatId = callback.message?.chat.id;
  if (!autorizado(chatId) || !callback.data) return;

  const [accion, draftId] = callback.data.split(":");
  const draft = await db.draft.findUnique({ where: { id: draftId } });

  if (!draft) {
    await responderCallback(callback.id, "Ese borrador ya no esta");
    return;
  }

  await db.draft.delete({ where: { id: draft.id } });

  if (accion !== "crear") {
    await responderCallback(callback.id, "Descartado");
    if (callback.message) {
      await editarMensaje(callback.message.message_id, "<i>Descartado.</i>");
    }
    return;
  }

  const borrador = JSON.parse(draft.payload) as Borrador;
  const res = await aplicar(borrador);

  await responderCallback(callback.id, "Creado");
  if (callback.message) {
    await editarMensaje(
      callback.message.message_id,
      `<b>Creado.</b> ${res.frentesCreados} frente(s) y ${res.tareasCreadas} tarea(s).` +
        `\nEntra en Rumbo y replanifica el dia si quieres que entren ya.`,
    );
  }
}

function resumen(borrador: Borrador): string {
  const lineas: string[] = ["<b>Esto es lo que he entendido:</b>"];

  const nuevos = borrador.frentes.filter((f) => f.nuevo);
  if (nuevos.length > 0) {
    lineas.push("", "<b>Frentes nuevos</b>");
    for (const f of nuevos) {
      lineas.push(`· ${f.nombre}${f.horasSemana > 0 ? ` — ${f.horasSemana} h/semana` : ""}`);
    }
  }

  if (borrador.tareas.length > 0) {
    lineas.push("", "<b>Tareas</b>");
    for (const t of borrador.tareas) {
      const plazo = t.dueDate ? ` · vence ${t.dueDate}` : "";
      lineas.push(`· ${t.titulo}\n   <i>${t.frente} · ${formatMin(t.estimateMin)}${plazo}</i>`);
    }
  }

  return lineas.join("\n");
}
