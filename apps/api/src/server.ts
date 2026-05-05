import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify, { type FastifyRequest } from "fastify";
import { InMemorySessionStore, type SessionStore } from "./auth/sessionStore";
import { loadConfig, type AppConfig } from "./config";
import { registerHealthRoutes } from "./routes/health";
import { registerAuthRoutes } from "./routes/auth";
import { NaverMapsClient, type NaverMapsProxy } from "./naver/naverMapsClient";
import { InMemoryRateLimiter, type RateLimiter } from "./security/rateLimiter";
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
import { registerNaverMapsRoutes } from "./routes/naverMaps";
import { emptyUserRepository, type UserRepository } from "./users/userRepository";

export type ServerDependencies = {
  users?: UserRepository;
  sessions?: SessionStore;
  shareSessions?: ShareSessionRepository;
  shareSessionAccess?: ShareSessionAccessRepository;
  shareSessionRealtime?: ShareSessionRealtime<PublicTrackingEvent>;
  publicRateLimiter?: RateLimiter;
  naverMaps?: NaverMapsProxy;
  naverRateLimiter?: RateLimiter;
};

export function buildServer(
  config: Partial<AppConfig> = loadConfig(),
  dependencies: ServerDependencies = {},
) {
  const resolvedConfig = {
    ...loadConfig({}),
    ...config,
  };
  const server = Fastify({
    logger: buildLoggerOptions(resolvedConfig.NODE_ENV),
    trustProxy: true,
  });
  const sessions = dependencies.sessions ?? new InMemorySessionStore();
  const shareSessions =
    dependencies.shareSessions ?? new InMemoryShareSessionRepository();
  const shareSessionAccess =
    dependencies.shareSessionAccess ?? shareSessions ?? denyAllShareSessionAccess;
  const shareSessionRealtime =
    dependencies.shareSessionRealtime ?? new InMemoryShareSessionRealtime<PublicTrackingEvent>();
  const publicRateLimiter =
    dependencies.publicRateLimiter ?? new InMemoryRateLimiter();
  const naverMaps =
    dependencies.naverMaps ??
    new NaverMapsClient({
      apiKey: resolvedConfig.NAVER_MAPS_API_KEY,
      apiKeyId: resolvedConfig.NAVER_MAPS_API_KEY_ID,
      baseUrl: resolvedConfig.NAVER_MAPS_BASE_URL,
    });
  const naverRateLimiter = dependencies.naverRateLimiter ?? new InMemoryRateLimiter();

  server.addHook("onRequest", async (request, reply) => {
    if (resolvedConfig.NODE_ENV !== "production" || isHttpsRequest(request)) {
      return;
    }

    return reply.code(426).send({
      error: {
        code: "HTTPS_REQUIRED",
        message: "HTTPS 연결이 필요합니다.",
      },
    });
  });

  server.register(cors, {
    origin: resolvedConfig.WEB_ORIGIN,
    credentials: true,
  });

  server.register(cookie, {
    secret: resolvedConfig.COOKIE_SECRET,
  });

  server.register(registerHealthRoutes);
  server.register(registerAuthRoutes, {
    config: resolvedConfig,
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
    publicRateLimiter,
  });
  server.register(registerNaverMapsRoutes, {
    naverMaps,
    rateLimiter: naverRateLimiter,
  });

  return server;
}

export function buildLoggerOptions(environment: AppConfig["NODE_ENV"]) {
  if (environment === "test") {
    return false;
  }

  return {
    redact: [
      "req.body.latitude",
      "req.body.longitude",
      "req.body.pinCode",
      "req.body.capturedAt",
    ],
  };
}

function isHttpsRequest(request: FastifyRequest) {
  const forwardedProto = request.headers["x-forwarded-proto"];
  const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;

  return proto?.split(",")[0]?.trim() === "https" || request.protocol === "https";
}
