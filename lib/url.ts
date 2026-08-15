// Validacion de URLs. Vive aparte de lib/telegram.ts, que es "server-only",
// para poder testearla sin montar el entorno de servidor.

/// Un dominio de verdad. Hace falta ser asi de estricto porque `new URL()` se
/// traga cosas como "https://midominio.comAPP_URL=https://midominio.com" y le
/// deja de host "midominio.comapp_url=https", que parece valido y no lo es.
const DOMINIO = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;

/// Telegram tumba el mensaje ENTERO con un 400 si el boton lleva una URL que no
/// le gusta: localhost, http plano o cualquier cosa mal formada. El plan del dia
/// importa mas que el boton, asi que ante la duda se manda sin el.
export function urlPublica(url: string | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && DOMINIO.test(parsed.hostname);
  } catch {
    return false;
  }
}
