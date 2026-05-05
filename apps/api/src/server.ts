import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { InMemorySessionStore, type SessionStore } from "./auth/sessionStore";
import { loadConfig, type AppConfig } from "./config";
import { registerHealthRoutes } from "./routes/health";
import { registerAuthRoutes } from "./routes/auth";
import {
  denyAllShareSessionAccess,
  type ShareSessionAccessRepository,
} from "./sessions/shareSessionAccess";
import { emptyUserRepository, type UserRepository } from "./users/userRepository";

export type ServerDependencies = {
  users?: UserRepository;
  sessions?: SessionStore;
  shareSessionAccess?: ShareSessionAccessRepository;
};

export function buildServer(
  config: AppConfig = loadConfig(),
  dependencies: ServerDependencies = {},
) {
  const server = Fastify({
    logger: config.NODE_ENV !== "test",
  });
  const sessions = dependencies.sessions ?? new InMemorySessionStore();

  server.register(cors, {
    origin: config.WEB_ORIGIN,
    credentials: true,
  });

  server.register(cookie, {
    secret: config.COOKIE_SECRET,
  });

  server.register(registerHealthRoutes);
  server.register(registerAuthRoutes, {
    config,
    users: dependencies.users ?? emptyUserRepository,
    sessions,
    shareSessionAccess: dependencies.shareSessionAccess ?? denyAllShareSessionAccess,
  });

  return server;
}
