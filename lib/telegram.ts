import "server-only";

import { formatMin, shortLabel } from "./date";
import type { DayWithBlocks } from "./day";
import { urlPublica } from "./url";

const API = "https://api.telegram.org";

export function telegramConfigurado() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

function escapar(texto: string) {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export type BotonCallback = { text: string; callback_data: string };

async function llamar(metodo: string, cuerpo: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, motivo: "Telegram sin configurar" };

  const res = await fetch(`${API}/bot${token}/${metodo}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(cuerpo),
  });

  if (!res.ok) {
    return { ok: false, motivo: `Telegram respondio ${res.status}: ${await res.text()}` };
  }
  return { ok: true };
}

export async function enviarMensaje(
  html: string,
  urlBoton?: string,
  botones?: BotonCallback[][],
) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) return { ok: false, motivo: "Telegram sin configurar" };

  // Si APP_URL no es una URL publica valida, se manda sin boton: mejor eso que
  // perder el mensaje entero por un 400 de Telegram.
  const botonUrl = urlPublica(urlBoton) ? urlBoton : undefined;
  const teclado = botones ?? (botonUrl ? [[{ text: "Abrir Rumbo", url: botonUrl }]] : null);

  return llamar("sendMessage", {
    chat_id: chatId,
    text: html,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(teclado ? { reply_markup: { inline_keyboard: teclado } } : {}),
  });
}

/// Sustituye el texto de un mensaje ya enviado y le quita los botones. Se usa
/// al confirmar o descartar, para que no se pueda pulsar dos veces.
export async function editarMensaje(messageId: number, html: string) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) return { ok: false, motivo: "Telegram sin configurar" };

  return llamar("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: html,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  });
}

/// Telegram deja el boton girando hasta que se le contesta al callback.
export async function responderCallback(callbackId: string, texto: string) {
  return llamar("answerCallbackQuery", { callback_query_id: callbackId, text: texto });
}

/// El mensaje de las 7:30. Corto, escaneable de un vistazo en la pantalla de
/// bloqueo, y con el porque de cada bloque en gris.
export function componerPlan(day: DayWithBlocks): string {
  const total = day.blocks.reduce((sum, b) => sum + b.plannedMin, 0);

  if (day.blocks.length === 0) {
    return [
      `<b>Buenos dias.</b> ${escapar(shortLabel(day.date))}`,
      "",
      "Hoy no hay nada planificado: no quedan tareas pendientes.",
      "Si eso no cuadra, mete alguna en la bandeja.",
    ].join("\n");
  }

  const lineas = day.blocks.map((b, i) => {
    const titulo = escapar(b.task.title);
    const proyecto = escapar(b.task.project.name);
    const motivo = escapar(b.reason);
    return `${i + 1}. <b>${formatMin(b.plannedMin)}</b> · ${titulo}\n    <i>${proyecto} — ${motivo}</i>`;
  });

  return [
    `<b>Buenos dias.</b> ${escapar(shortLabel(day.date))}`,
    `Hoy: <b>${formatMin(total)}</b> en ${day.blocks.length} bloque${day.blocks.length > 1 ? "s" : ""}.`,
    "",
    ...lineas,
  ].join("\n");
}
