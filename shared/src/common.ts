import { z } from "zod";

/** All monetary values are stored as integer cents (EUR only). */
export const cents = z.number().int();

export const uuid = z.string().uuid();

export const isoDate = z.string().datetime({ offset: true });

export type Uuid = z.infer<typeof uuid>;

/**
 * Boolean from a URL query string. `z.coerce.boolean()` is WRONG here — it does
 * `Boolean(value)`, so the string "false" (non-empty) becomes `true`. Parse the
 * literal "true"/"1" instead; everything else is false.
 */
export const queryBool = z.preprocess(
  (v) => (typeof v === "string" ? v === "true" || v === "1" : Boolean(v)),
  z.boolean(),
);

/** Shared route-param schema for `/:id` endpoints. */
export const idParamSchema = z.object({ id: uuid });
export type IdParam = z.infer<typeof idParamSchema>;
