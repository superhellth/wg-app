import { MEMBER_HEADER } from "@wg/shared";
import { eq } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { db, schema } from "../db/client.js";
import { env } from "../env.js";
import { BadRequestError, UnauthorizedError } from "../lib/errors.js";

type MemberRow = typeof schema.members.$inferSelect;

declare module "fastify" {
  interface FastifyRequest {
    /** Acting identity (unverified X-Member-Id lookup); null if none/unknown. */
    member: MemberRow | null;
  }
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  // length leak is acceptable; compare contents in constant time when equal-length
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * onRequest hook for protected routes. Validates the WG bearer token (== the
 * shared WG secret) and resolves the unverified acting member from X-Member-Id.
 * Membership is proven; identity is NOT (trust model).
 */
export async function authHook(req: FastifyRequest): Promise<void> {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token || !safeEqual(token, env.WG_TOKEN_SECRET)) {
    throw new UnauthorizedError();
  }

  const memberId = req.headers[MEMBER_HEADER];
  if (typeof memberId === "string" && memberId.length > 0) {
    const [m] = await db
      .select()
      .from(schema.members)
      .where(eq(schema.members.id, memberId));
    req.member = m ?? null;
  } else {
    req.member = null;
  }
}

/** Require a valid, active acting member (for mutations that attribute activity). */
export function requireMember(req: FastifyRequest): MemberRow {
  if (!req.member) throw new BadRequestError("X-Member-Id header required");
  if (req.member.archivedAt) throw new BadRequestError("acting member is archived");
  return req.member;
}
