import "server-only";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/prisma/client";

// Prisma 7 exige un driver adapter. Elegimos segun el esquema de la URL para
// que el mismo codigo valga en local (SQLite) y en Vercel (Postgres/Supabase).
//
// OJO: al pasar a Supabase hay que cambiar tambien `provider` en
// prisma/schema.prisma a "postgresql" y regenerar las migraciones. Ver README.
function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");

  const adapter = url.startsWith("file:")
    ? new PrismaBetterSqlite3({ url })
    : new PrismaPg({ connectionString: url });

  return new PrismaClient({ adapter });
}

// En desarrollo Next recarga los modulos en cada cambio; sin este cache se
// abririan conexiones nuevas hasta agotar el pool.
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createClient>;
};

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
