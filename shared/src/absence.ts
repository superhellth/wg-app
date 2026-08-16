import { z } from "zod";
import { uuid } from "./common.js";

export const absenceSchema = z.object({
  id: uuid,
  memberId: uuid,
  from: z.string().datetime({ offset: true }),
  until: z.string().datetime({ offset: true }),
  createdAt: z.string().datetime({ offset: true }),
});
export type Absence = z.infer<typeof absenceSchema>;

export const createAbsenceSchema = z
  .object({
    memberId: uuid,
    from: z.string().datetime({ offset: true }),
    until: z.string().datetime({ offset: true }),
  })
  .refine((v) => new Date(v.from) < new Date(v.until), {
    message: "from must be before until",
  });
export type CreateAbsence = z.infer<typeof createAbsenceSchema>;

export const updateAbsenceSchema = createAbsenceSchema;
export type UpdateAbsence = z.infer<typeof updateAbsenceSchema>;
