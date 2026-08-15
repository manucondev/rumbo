import { describe, expect, it } from "vitest";

import { urlPublica } from "./url";

// Una APP_URL mala ya ha tumbado el envio de Telegram dos veces: primero con
// localhost y despues con la linea entera del .env pegada dentro del valor.
// Como Telegram responde 400 y se pierde el mensaje ENTERO, no solo el boton,
// conviene tener estos casos clavados.
describe("urlPublica", () => {
  it("acepta un dominio publico con https", () => {
    expect(urlPublica("https://rumbo-ashy.vercel.app")).toBe(true);
    expect(urlPublica("https://rumbo.midominio.es/hoy")).toBe(true);
  });

  it("rechaza localhost y http plano", () => {
    expect(urlPublica("http://localhost:3000")).toBe(false);
    expect(urlPublica("https://localhost:3000")).toBe(false);
    expect(urlPublica("http://rumbo-ashy.vercel.app")).toBe(false);
  });

  it("rechaza el valor con la clave pegada delante", () => {
    // `new URL()` se lo traga: deja de host "rumbo-ashy.vercel.appapp_url=https".
    expect(
      urlPublica("https://rumbo-ashy.vercel.appAPP_URL=https://rumbo-ashy.vercel.app"),
    ).toBe(false);
  });

  it("rechaza lo vacio y lo que no es una URL", () => {
    expect(urlPublica(undefined)).toBe(false);
    expect(urlPublica("")).toBe(false);
    expect(urlPublica("rumbo-ashy.vercel.app")).toBe(false);
    expect(urlPublica("https://sinpunto")).toBe(false);
  });
});
