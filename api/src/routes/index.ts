import type { FastifyInstance } from "fastify";
import { authHook } from "../plugins/auth.js";
import { activityRoutes } from "./activity.js";
import { balancesRoutes } from "./balances.js";
import { choresRoutes } from "./chores.js";
import { devicesRoutes } from "./devices.js";
import { expensesRoutes } from "./expenses.js";
import { fixedCostsRoutes } from "./fixedCosts.js";
import { inviteRedeemRoutes, invitesRoutes } from "./invites.js";
import { meetingsRoutes } from "./meetings.js";
import { membersRoutes } from "./members.js";
import { settlementsRoutes } from "./settlements.js";
import { shoppingRoutes } from "./shopping.js";
import { wgRoutes } from "./wg.js";

export async function registerRoutes(app: FastifyInstance) {
  // ── Public (no auth) ──
  await app.register(wgRoutes, { prefix: "/api/wg" }); // first-run create
  await app.register(inviteRedeemRoutes, { prefix: "/api/invites" }); // redeem

  // ── Protected (WG bearer token + X-Member-Id) ──
  await app.register(async (protectedApp) => {
    protectedApp.addHook("onRequest", authHook);
    await protectedApp.register(membersRoutes, { prefix: "/api/members" });
    await protectedApp.register(invitesRoutes, { prefix: "/api/invites" });
    await protectedApp.register(devicesRoutes, { prefix: "/api/devices" });
    await protectedApp.register(expensesRoutes, { prefix: "/api/expenses" });
    await protectedApp.register(settlementsRoutes, { prefix: "/api/settlements" });
    await protectedApp.register(balancesRoutes, { prefix: "/api/balances" });
    await protectedApp.register(shoppingRoutes, { prefix: "/api/shopping" });
    await protectedApp.register(choresRoutes, { prefix: "/api/chores" });
    await protectedApp.register(meetingsRoutes, { prefix: "/api/meetings" });
    await protectedApp.register(fixedCostsRoutes, { prefix: "/api/fixed-costs" });
    await protectedApp.register(activityRoutes, { prefix: "/api/activity" });
  });
}
