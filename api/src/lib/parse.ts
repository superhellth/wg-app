import type { ZodSchema } from "zod";
import { ValidationError } from "./errors.js";

/**
 * Validate body/params/query against a Zod schema. On failure throws a
 * ValidationError (→ 400 { error:{ code:"validation", details }}) caught by the
 * shared error handler. Single owner of the 400 validation contract.
 */
export function parse<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new ValidationError(result.error.flatten());
  return result.data;
}
