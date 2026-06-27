import type { FastifyInstance } from "fastify";
import { authHook } from "../plugins/auth.js";
import { membersRoutes } from "./members.js";

export async function registerRoutes(app: FastifyInstance) {
  // Public (no auth): POST /api/wg (first-run), POST /api/invites/:token/redeem.
  //   TODO: implement these.

  // Protected — require WG bearer token + X-Member-Id (auth hook).
  await app.register(async (protectedApp) => {
    protectedApp.addHook("onRequest", authHook);
    await protectedApp.register(membersRoutes, { prefix: "/api/members" });
    // TODO: invites(create), devices(push), expenses, settlements, balances,
    //       shopping, chores, meetings, fixed-costs, activity
  });
}
