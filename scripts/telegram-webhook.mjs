// Registra (o consulta) el webhook del bot de Telegram.
//
//   npm run telegram:webhook            -> registra usando APP_URL
//   npm run telegram:webhook -- estado  -> solo consulta como esta
//   npm run telegram:webhook -- borrar  -> lo quita
//
// Hay que lanzarlo una sola vez, y de nuevo si cambia el dominio o el secreto.
import "dotenv/config";

const token = process.env.TELEGRAM_BOT_TOKEN;
const secreto = process.env.TELEGRAM_WEBHOOK_SECRET;
const appUrl = process.env.APP_URL;

if (!token) throw new Error("Falta TELEGRAM_BOT_TOKEN");

const api = (metodo, cuerpo) =>
  fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(cuerpo ?? {}),
  }).then((r) => r.json());

const accion = process.argv[2] ?? "registrar";

if (accion === "estado") {
  const info = await api("getWebhookInfo");
  console.log(JSON.stringify(info.result, null, 2));
} else if (accion === "borrar") {
  console.log(await api("deleteWebhook", { drop_pending_updates: true }));
} else {
  if (!secreto) throw new Error("Falta TELEGRAM_WEBHOOK_SECRET");
  if (!appUrl?.startsWith("https://")) {
    throw new Error(`APP_URL tiene que ser https publica, y vale "${appUrl}"`);
  }

  const url = `${appUrl.replace(/\/$/, "")}/api/telegram`;
  const res = await api("setWebhook", {
    url,
    secret_token: secreto,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  console.log(res.ok ? `Webhook registrado en ${url}` : res);
}
