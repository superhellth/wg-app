// Apply pending Drizzle migrations from ./drizzle (relative to cwd), then exit.
// Runs from the slim runtime image (`node dist/migrate.js`), so it only needs
// DATABASE_URL — not the app env from env.ts.
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("migration failed: DATABASE_URL is not set");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString });
try {
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  console.log("migrations applied");
} catch (err) {
  console.error("migration failed:", err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
