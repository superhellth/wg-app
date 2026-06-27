import type { PushPayload } from "@wg/shared";
import { eq, isNull } from "drizzle-orm";
import webpush from "web-push";
import { db, schema } from "../db/client.js";
import { env } from "../env.js";

let configured: boolean | null = null;
function isConfigured(): boolean {
  if (configured === null) {
    configured = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
    if (configured) {
      webpush.setVapidDetails(
        env.VAPID_SUBJECT,
        env.VAPID_PUBLIC_KEY,
        env.VAPID_PRIVATE_KEY,
      );
    }
  }
  return configured;
}

/**
 * Send a push to every device currently claiming `memberId`. Fire-and-forget:
 * never throws (call without awaiting after the DB transaction commits). Dead
 * subscriptions (404/410) are deleted.
 */
export async function sendPushToMember(
  memberId: string,
  payload: PushPayload,
): Promise<void> {
  if (!isConfigured()) return; // VAPID not set up → no-op
  try {
    const devices = await db
      .select()
      .from(schema.devices)
      .where(eq(schema.devices.currentMemberId, memberId));
    const body = JSON.stringify(payload);
    await Promise.all(
      devices.map(async (d) => {
        try {
          await webpush.sendNotification(
            { endpoint: d.pushEndpoint, keys: d.pushKeys },
            body,
          );
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await db.delete(schema.devices).where(eq(schema.devices.id, d.id));
          } else {
            console.error("[push] send failed", status, err);
          }
        }
      }),
    );
  } catch (err) {
    console.error("[push] dispatch failed", err);
  }
}

/** Invite-style broadcast to all active members (optionally excluding one). */
export async function sendPushToAllMembers(
  payload: PushPayload,
  exceptMemberId?: string,
): Promise<void> {
  if (!isConfigured()) return;
  const members = await db
    .select({ id: schema.members.id })
    .from(schema.members)
    .where(isNull(schema.members.archivedAt));
  await Promise.all(
    members
      .filter((m) => m.id !== exceptMemberId)
      .map((m) => sendPushToMember(m.id, payload)),
  );
}
