import { z } from "zod";

/** Payload the server sends and the service worker renders. */
export const pushPayloadSchema = z.object({
  title: z.string(),
  body: z.string(),
  /** deep-link path opened on notification click, e.g. "/chores" */
  url: z.string().optional(),
  /** collapse key — a new push with the same tag replaces the old one */
  tag: z.string().optional(),
});
export type PushPayload = z.infer<typeof pushPayloadSchema>;
