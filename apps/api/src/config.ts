import "dotenv/config";
import { z } from "zod";

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  COOKIE_SECRET: z.string().min(16).default("dev-cookie-secret-change-me"),
  DATABASE_URL: z.string().min(1).default("postgresql://bluebluelink:bluebluelink@localhost:5432/bluebluelink"),
  NAVER_MAPS_API_KEY: z.string().default(""),
  NAVER_MAPS_API_KEY_ID: z.string().default(""),
  NAVER_MAPS_BASE_URL: z.string().url().default("https://naveropenapi.apigw.ntruss.com"),
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return configSchema.parse(env);
}
