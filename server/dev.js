// Local development entry point. If DATABASE_URL isn't set (i.e. you haven't
// connected a real Postgres database yet), this spins up a small embedded
// Postgres-compatible database on disk so you can develop with zero setup.
// In production, set DATABASE_URL to a real Postgres database and run
// `node index.js` directly instead — this file is dev-only.

if (!process.env.DATABASE_URL) {
  const { PGlite } = await import("@electric-sql/pglite");
  const { PGLiteSocketServer } = await import("@electric-sql/pglite-socket");

  const db = new PGlite("./data/local-dev-db");
  const socket = new PGLiteSocketServer({ db, port: 5433, host: "127.0.0.1" });
  await socket.start();

  process.env.DATABASE_URL = "postgres://postgres@127.0.0.1:5433/postgres";
  console.log("Local dev database ready on 127.0.0.1:5433 (data saved in server/data/local-dev-db)");
}

await import("./index.js");
