import { z } from "zod";
import { uuid } from "./common.js";

/**
 * Reminders are fixed: an invite push fires at creation and a reminder push
 * fires 1h before the event. There is no configurable lead time.
 */
export const REMINDER_LEAD_MINUTES = 60;

export const createMeetingSchema = z.object({
  title: z.string().min(1).max(120),
  startsAt: z.string().datetime({ offset: true }),
});
export type CreateMeeting = z.infer<typeof createMeetingSchema>;

export const updateMeetingSchema = z.object({
  title: z.string().min(1).max(120),
  startsAt: z.string().datetime({ offset: true }),
});
export type UpdateMeeting = z.infer<typeof updateMeetingSchema>;

export const meetingSchema = z.object({
  id: uuid,
  title: z.string(),
  startsAt: z.string().datetime({ offset: true }),
  createdByMemberId: uuid,
  createdAt: z.string().datetime({ offset: true }),
});
export type Meeting = z.infer<typeof meetingSchema>;
