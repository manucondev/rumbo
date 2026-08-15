import { NextResponse, type NextRequest } from "next/server";

import { COOKIE_NAME, sesionValida } from "@/lib/auth";

/// Puerta de entrada: sin cookie firmada, a la pantalla del PIN.
/// (En Next 16 esto se llama `proxy`; antes era `middleware`.)
export default async function proxy(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (await sesionValida(token)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/entrar";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Todo protegido menos la pantalla de entrada, los estaticos y las dos rutas
  // que traen su propia autenticacion en cabecera en vez de cookie: el cron
  // (Authorization) y el webhook de Telegram (X-Telegram-Bot-Api-Secret-Token).
  matcher: [
    "/((?!entrar|api/cron|api/telegram|_next/static|_next/image|favicon.ico|manifest.json|icon-).*)",
  ],
};
