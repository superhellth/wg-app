import {
  type DisplayConfig,
  displayFunction,
  updateDisplayConfigSchema,
} from "@wg/shared";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { db, schema } from "../db/client.js";
import { parse } from "../lib/parse.js";
import { renderDisplay } from "../services/display.js";

type ConfigRow = typeof schema.displayConfig.$inferSelect;

function toConfig(row: ConfigRow): DisplayConfig {
  return {
    defaultFunction: row.defaultFunction,
    idleTimeoutSeconds: row.idleTimeoutSeconds,
    buttons: {
      blue: row.buttonBlue,
      yellow: row.buttonYellow,
      red: row.buttonRed,
      green: row.buttonGreen,
    },
  };
}

/** Fetch the single config row, creating defaults on first access. */
async function ensureConfig(): Promise<ConfigRow> {
  const [existing] = await db.select().from(schema.displayConfig).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(schema.displayConfig).values({}).returning();
  return created!;
}

const renderParamSchema = z.object({ function: displayFunction });

export async function displayRoutes(app: FastifyInstance) {
  // Current config (web settings + the daemon both read this).
  app.get("/config", async () => toConfig(await ensureConfig()));

  // Replace the config (web settings page).
  app.put("/config", async (req) => {
    const body = parse(updateDisplayConfigSchema, req.body);
    const row = await ensureConfig();
    const [after] = await db
      .update(schema.displayConfig)
      .set({
        defaultFunction: body.defaultFunction,
        idleTimeoutSeconds: body.idleTimeoutSeconds,
        buttonBlue: body.buttons.blue,
        buttonYellow: body.buttons.yellow,
        buttonRed: body.buttons.red,
        buttonGreen: body.buttons.green,
      })
      .where(eq(schema.displayConfig.id, row.id))
      .returning();
    return toConfig(after!);
  });

  // 16x2-ready payload for one function (polled by the daemon).
  app.get("/render/:function", async (req) => {
    const { function: fn } = parse(renderParamSchema, req.params);
    return renderDisplay(fn);
  });
}
