import { z } from "zod";

/**
 * The error envelope every failing endpoint returns. `details` is present only
 * for validation errors (the Zod flatten() output). The client's fetch wrapper
 * parses this and throws `error.message`.
 */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
