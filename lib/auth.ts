// Auth de usuario unico: un PIN y una cookie firmada. No hay registro, ni
// usuarios, ni recuperacion de contrasena, porque solo entra una persona.
//
// Se usa `jose` porque funciona tanto en el runtime de Node como en el edge,
// que es donde corre el middleware.

import { SignJWT, jwtVerify } from "jose";

export const COOKIE_NAME = "rumbo_sesion";
const DIAS = 90;

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 16) {
    throw new Error("Falta AUTH_SECRET (o es demasiado corto)");
  }
  return new TextEncoder().encode(value);
}

export async function crearSesion(): Promise<string> {
  return new SignJWT({ ok: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DIAS}d`)
    .sign(secret());
}

export async function sesionValida(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}

export const COOKIE_MAX_AGE = DIAS * 24 * 60 * 60;
