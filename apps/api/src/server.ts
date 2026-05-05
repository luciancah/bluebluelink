import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { loadConfig, type AppConfig } from "./config";
import { registerHealthRoutes } from "./routes/health";

export function buildServer(config: AppConfig = loadConfig()) {
  const server = Fastify({
    logger: config.NODE_ENV !== "test",
  });

  server.register(cors, {
    origin: config.WEB_ORIGIN,
    credentials: true,
  });

  server.register(cookie, {
    secret: config.COOKIE_SECRET,
  });

  server.register(registerHealthRoutes);

  return server;
}
