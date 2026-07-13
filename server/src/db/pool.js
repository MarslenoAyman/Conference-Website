import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. See README for local dev and deployment setup.");
}

const useSsl = /sslmode=require|render\.com|neon\.tech|supabase\.co|amazonaws\.com/i.test(connectionString);
const isLocalEmbeddedDb = connectionString.includes("127.0.0.1:5433");

export const pool = new Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  // The local dev database (PGlite over a socket) only handles one connection at a time.
  max: isLocalEmbeddedDb ? 1 : 10,
});
