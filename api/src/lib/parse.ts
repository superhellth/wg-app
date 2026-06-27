import type { z, ZodTypeAny } from "zod";
import { ValidationError } from "./errors.js";

/**
 * Validate body/params/query against a Zod schema. On failure throws a
 * ValidationError (→ 400 { error:{ code:"validation", details }}) caught by the
 * shared error handler. Returns the parsed OUTPUT type (defaults applied).
 */
export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) throw new ValidationError(result.error.flatten());
  return result.data;
}
