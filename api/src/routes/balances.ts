import type { FastifyInstance } from "fastify";
import { computeBalances } from "../services/balances.js";
import { simplifyDebts } from "../services/netting.js";

export async function balancesRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    const balances = await computeBalances();
    return { balances, suggestedTransfers: simplifyDebts(balances) };
  });
}
