import cors from "@fastify/cors";
import Fastify from "fastify";
import { env } from "./env.js";
import { registerErrorHandler } from "./lib/errors.js";
import { registerRoutes } from "./routes/index.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.decorateRequest("member", null);
registerErrorHandler(app);

app.get("/health", async () => ({ ok: true }));

await registerRoutes(app);

app
  .listen({ port: env.PORT, host: env.HOST })
  .then((addr) => app.log.info(`API listening on ${addr}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
