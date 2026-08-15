"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { COOKIE_MAX_AGE, COOKIE_NAME, crearSesion } from "@/lib/auth";

export async function entrar(pin: string): Promise<{ error: string } | never> {
  const esperado = process.env.APP_PIN;
  if (!esperado) return { error: "Falta APP_PIN en el servidor" };

  // Pequeno freno para que no se pueda probar el PIN a lo bruto.
  await new Promise((r) => setTimeout(r, 400));

  if (pin.trim() !== esperado) return { error: "PIN incorrecto" };

  const store = await cookies();
  store.set(COOKIE_NAME, await crearSesion(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  redirect("/");
}
