import "server-only";

import { formatMin, shortLabel } from "./date";
import type { DayWithBlocks } from "./day";

const API = "https://api.telegram.org";

export function telegramConfigurado() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

function escapar(texto: string) {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/// Telegram rechaza los botones que apuntan a localhost o a http plano, asi que
/// en desarrollo el mensaje sale sin boton en vez de fallar entero.
function botonUsable(url: string | undefined): url is string {
  return Boolean(url?.startsWith("https://") && !url.includes("localhost"));
}

export async function enviarMensaje(html: string, urlBoton?: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { ok: false, motivo: "Telegram sin configurar" };

  const botonUrl = botonUsable(urlBoton) ? urlBoton : undefined;

  const res = await fetch(`${API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: html,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      ...(botonUrl
        ? {
            reply_markup: {
              inline_keyboard: [[{ text: "Abrir Rumbo", url: botonUrl }]],
            },
          }
        : {}),
    }),
  });

  if (!res.ok) {
    return { ok: false, motivo: `Telegram respondio ${res.status}: ${await res.text()}` };
  }
  return { ok: true };
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
