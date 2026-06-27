import type { ActivityKind } from "@wg/shared";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { schema } from "../db/client.js";
import type * as dbSchema from "../db/schema.js";

type Database = NodePgDatabase<typeof dbSchema>;
/** A Drizzle transaction handle (the arg to db.transaction's callback). */
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Append one row to the activity feed. ALWAYS called inside the same
 * transaction as the mutation it records (no change without its log, no log
 * without its change). The feed is also the audit trail — pass full-row
 * snapshots: { snapshot } for created/deleted, { before, after } for updated.
 */
export async function logActivity(
  tx: Tx,
  entry: { memberId: string | null; kind: ActivityKind; data: unknown },
): Promise<void> {
  await tx.insert(schema.activity).values(entry);
}
