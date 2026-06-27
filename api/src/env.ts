import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),
  WG_TOKEN_SECRET: z.string().min(8),
  VAPID_PUBLIC_KEY: z.string().default(""),
  VAPID_PRIVATE_KEY: z.string().default(""),
  VAPID_SUBJECT: z.string().default("mailto:admin@example.com"),
});

export const env = envSchema.parse(process.env);
