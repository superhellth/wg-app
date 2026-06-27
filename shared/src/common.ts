import { z } from "zod";

/** All monetary values are stored as integer cents (EUR only). */
export const cents = z.number().int();

export const uuid = z.string().uuid();

export const isoDate = z.string().datetime({ offset: true });

export type Uuid = z.infer<typeof uuid>;

/** Shared route-param schema for `/:id` endpoints. */
export const idParamSchema = z.object({ id: uuid });
export type IdParam = z.infer<typeof idParamSchema>;
