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
import {
  InMemoryShareSessionRepository,
  type ShareSessionRepository,
} from "./sessions/shareSessionRepository";
import {
  InMemoryShareSessionRealtime,
  type ShareSessionRealtime,
} from "./sessions/shareSessionRealtime";
import { registerShareSessionRoutes } from "./routes/shareSessions";
import { registerLocationUpdateRoutes } from "./routes/locationUpdates";
import {
  registerPublicTrackingRoutes,
  type PublicTrackingEvent,
} from "./routes/publicTracking";
import { emptyUserRepository, type UserRepository } from "./users/userRepository";

export type ServerDependencies = {
  users?: UserRepository;
  sessions?: SessionStore;
  shareSessions?: ShareSessionRepository;
  shareSessionAccess?: ShareSessionAccessRepository;
  shareSessionRealtime?: ShareSessionRealtime<PublicTrackingEvent>;
};

export function buildServer(
  config: AppConfig = loadConfig(),
  dependencies: ServerDependencies = {},
) {
  const server = Fastify({
    logger: config.NODE_ENV !== "test",
  });
  const sessions = dependencies.sessions ?? new InMemorySessionStore();
  const shareSessions =
    dependencies.shareSessions ?? new InMemoryShareSessionRepository();
  const shareSessionAccess =
    dependencies.shareSessionAccess ?? shareSessions ?? denyAllShareSessionAccess;
  const shareSessionRealtime =
    dependencies.shareSessionRealtime ?? new InMemoryShareSessionRealtime<PublicTrackingEvent>();

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
    shareSessionAccess,
  });
  server.register(registerShareSessionRoutes, {
    sessions,
    shareSessions,
  });
  server.register(registerLocationUpdateRoutes, {
    sessions,
    shareSessions,
    shareSessionRealtime,
  });
  server.register(registerPublicTrackingRoutes, {
    shareSessions,
    shareSessionRealtime,
  });

  return server;
}
