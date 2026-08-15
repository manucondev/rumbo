// Firma una cookie de sesion valida para probar la app sin navegador:
//   node scripts/token.mjs
import "dotenv/config";
import { SignJWT } from "jose";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
const token = await new SignJWT({ ok: true })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("1d")
  .sign(secret);

console.log(token);
