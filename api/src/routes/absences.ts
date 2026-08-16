import { createAbsenceSchema, idParamSchema, updateAbsenceSchema, uuid } from "@wg/shared";
import { asc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db, schema } from "../db/client.js";
import { logActivity } from "../lib/activity.js";
import { NotFoundError } from "../lib/errors.js";
import { parse } from "../lib/parse.js";
import { requireMember } from "../plugins/auth.js";

const listQuerySchema = z.object({ memberId: uuid.optional() });

export async function absencesRoutes(app: FastifyInstance) {
  // List absences, optionally filtered by member, sorted by start.
  app.get("/", async (req) => {
    const { memberId } = parse(listQuerySchema, req.query);
    return db
      .select()
      .from(schema.absences)
      .where(memberId ? eq(schema.absences.memberId, memberId) : undefined)
      .orderBy(asc(schema.absences.from));
  });

  // Plan an absence.
  app.post("/", async (req, reply) => {
    const actor = requireMember(req);
    const body = parse(createAbsenceSchema, req.body);
    const absence = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(schema.absences)
        .values({
          memberId: body.memberId,
          from: new Date(body.from),
          until: new Date(body.until),
        })
        .returning();
      await logActivity(tx, {
        memberId: actor.id,
        kind: "absence.created",
        data: { snapshot: row },
      });
      return row!;
    });
    return reply.status(201).send(absence);
  });

  app.get("/:id", async (req) => {
    const { id } = parse(idParamSchema, req.params);
    const [absence] = await db.select().from(schema.absences).where(eq(schema.absences.id, id));
    if (!absence) throw new NotFoundError("absence not found");
    return absence;
  });

  app.put("/:id", async (req) => {
    const actor = requireMember(req);
    const { id } = parse(idParamSchema, req.params);
    const body = parse(updateAbsenceSchema, req.body);
    return db.transaction(async (tx) => {
      const [before] = await tx.select().from(schema.absences).where(eq(schema.absences.id, id));
      if (!before) throw new NotFoundError("absence not found");

      const [after] = await tx
        .update(schema.absences)
        .set({ memberId: body.memberId, from: new Date(body.from), until: new Date(body.until) })
        .where(eq(schema.absences.id, id))
        .returning();
      await logActivity(tx, {
        memberId: actor.id,
        kind: "absence.updated",
        data: { before, after },
      });
      return after!;
    });
  });

  // Cancel a planned/past absence.
  app.delete("/:id", async (req, reply) => {
    const actor = requireMember(req);
    const { id } = parse(idParamSchema, req.params);
    await db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(schema.absences)
        .where(eq(schema.absences.id, id));
      if (!before) throw new NotFoundError("absence not found");

      await tx.delete(schema.absences).where(eq(schema.absences.id, id));
      await logActivity(tx, {
        memberId: actor.id,
        kind: "absence.deleted",
        data: { snapshot: before },
      });
    });
    return reply.status(204).send();
  });
}
