import { z } from "zod";
import { uuid } from "./common.js";
import {
  meetingMode,
  rsvpValue,
  type MeetingMode,
  type RsvpValue,
} from "./enums.js";

export { meetingMode, rsvpValue };
export type { MeetingMode, RsvpValue };

/**
 * Reminders are fixed: an invite push fires at creation and a reminder push
 * fires 1h before the event (recomputed per occurrence for recurring). There is
 * no configurable lead time.
 */
export const REMINDER_LEAD_MINUTES = 60;

export const createMeetingSchema = z
  .object({
    title: z.string().min(1).max(120),
    mode: meetingMode,
    /** fixed/recurring: the event time. poll: omit, use options. */
    startsAt: z.string().datetime({ offset: true }).optional(),
    /** recurring: interval in days */
    recurEveryDays: z.number().int().positive().optional(),
    /** poll: proposed time options (>= 2) */
    options: z.array(z.string().datetime({ offset: true })).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.mode === "poll") {
      if (!v.options || v.options.length < 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "poll requires >= 2 options", path: ["options"] });
      }
    } else if (!v.startsAt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "fixed/recurring requires startsAt", path: ["startsAt"] });
    }
    if (v.mode === "recurring" && v.recurEveryDays == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "recurring requires recurEveryDays", path: ["recurEveryDays"] });
    }
  });
export type CreateMeeting = z.infer<typeof createMeetingSchema>;

export const meetingSchema = z.object({
  id: uuid,
  title: z.string(),
  mode: meetingMode,
  startsAt: z.string().datetime({ offset: true }).nullable(),
  recurEveryDays: z.number().int().positive().nullable(),
  createdByMemberId: uuid,
  createdAt: z.string().datetime({ offset: true }),
});
export type Meeting = z.infer<typeof meetingSchema>;

/** Resolve a poll: pick the winning option → meeting becomes fixed. */
export const resolvePollSchema = z.object({ optionId: uuid });
export type ResolvePoll = z.infer<typeof resolvePollSchema>;

/** Cast/replace an approval vote on a poll option. */
export const voteSchema = z.object({ optionId: uuid });
export type Vote = z.infer<typeof voteSchema>;

/** Set/replace this member's RSVP. */
export const rsvpSchema = z.object({ value: rsvpValue });
export type Rsvp = z.infer<typeof rsvpSchema>;
