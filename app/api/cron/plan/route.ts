import { todayMadrid } from "@/lib/date";
import { ensureDayPlan } from "@/lib/day";
import { componerPlan, enviarMensaje, telegramConfigurado } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/// Lo dispara el cron de Vercel cada manana. Tambien se puede llamar a mano:
///   curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/plan
///
/// Esta ruta queda fuera del middleware de sesion a proposito: se autentica con
/// su propia cabecera, no con la cookie del navegador.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "Falta CRON_SECRET" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const date = todayMadrid();
  const day = await ensureDayPlan(date);
  if (!day) {
    return Response.json({ error: "No se pudo crear el dia" }, { status: 500 });
  }

  if (!telegramConfigurado()) {
    return Response.json({
      date,
      bloques: day.blocks.length,
      aviso: "plan generado, Telegram sin configurar",
    });
  }

  const resultado = await enviarMensaje(componerPlan(day), process.env.APP_URL);

  return Response.json(
    { date, bloques: day.blocks.length, telegram: resultado },
    { status: resultado.ok ? 200 : 502 },
  );
}
