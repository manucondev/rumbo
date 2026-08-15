// Diagnostico de la conexion a Postgres, saltandose Prisma para saber si un
// fallo viene de las credenciales o de como Prisma interpreta la cadena.
//
//   node scripts/probar-conexion.mjs
import "dotenv/config";
import pg from "pg";

for (const nombre of ["DIRECT_URL", "DATABASE_URL"]) {
  const url = process.env[nombre];
  if (!url) {
    console.log(`${nombre}: sin definir`);
    continue;
  }

  const parsed = new URL(url);
  console.log(
    `\n${nombre}\n  host: ${parsed.hostname}:${parsed.port}` +
      `\n  usuario: ${decodeURIComponent(parsed.username)}` +
      `\n  password: ${parsed.password.length} caracteres`,
  );

  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    const { rows } = await client.query("select current_user, version()");
    console.log(`  OK -> conectado como ${rows[0].current_user}`);
    await client.end();
  } catch (e) {
    console.log(`  FALLO -> ${e.message}`);
  }
}
