import { z } from "zod";
import { uuid } from "./common.js";

/** Web Push subscription keys (PushSubscription.toJSON().keys). */
export const pushKeysSchema = z.object({
  p256dh: z.string().min(1),
  auth: z.string().min(1),
});
export type PushKeys = z.infer<typeof pushKeysSchema>;

/**
 * POST /api/devices — register or update a device. Upserted by pushEndpoint
 * (the browser's stable subscription URL). Re-posting with a new memberId is
 * how a device switches identity.
 */
export const registerDeviceSchema = z.object({
  pushEndpoint: z.string().url(),
  pushKeys: pushKeysSchema,
  memberId: uuid,
});
export type RegisterDevice = z.infer<typeof registerDeviceSchema>;

/** DELETE /api/devices — unregister (on logout / notifications off). */
export const unregisterDeviceSchema = z.object({
  pushEndpoint: z.string().url(),
});
export type UnregisterDevice = z.infer<typeof unregisterDeviceSchema>;

export const deviceSchema = z.object({
  id: uuid,
  currentMemberId: uuid.nullable(),
  pushEndpoint: z.string().url(),
  createdAt: z.string().datetime({ offset: true }),
});
export type Device = z.infer<typeof deviceSchema>;
