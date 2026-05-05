import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { verifyPassword } from "../auth/password";
import type { RateLimiter } from "../security/rateLimiter";
import type {
  ShareSessionRepository,
  StoredShareSession,
} from "../sessions/shareSessionRepository";
import type { ShareSessionRealtime } from "../sessions/shareSessionRealtime";

export const PUBLIC_CODE_LOOKUP_LIMIT = 60;
export const PUBLIC_PIN_ATTEMPT_LIMIT = 5;

const PUBLIC_CODE_LOOKUP_WINDOW_MS = 60 * 1000;
const PUBLIC_PIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const rateLimitedError = {
  code: "RATE_LIMITED",
  message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
};
const unavailableLinkError = {
  code: "TRACKING_LINK_UNAVAILABLE",
  message: "위치 공유를 확인할 수 없습니다.",
};
const invalidPinOrLinkError = {
  code: "INVALID_PIN_OR_LINK",
  message: "PIN 코드 또는 공유 링크를 확인해 주세요.",
};

const codeParamsSchema = z.object({
  code: z.string().min(6).max(16),
});
const pinSchema = z.object({
  pinCode: z.string().regex(/^\d{4}$/),
});

export async function registerPublicTrackingRoutes(
  server: FastifyInstance,
  dependencies: {
    shareSessions: ShareSessionRepository;
    shareSessionRealtime: ShareSessionRealtime<PublicTrackingEvent>;
    publicRateLimiter: RateLimiter;
  },
) {
  server.get("/api/public/share-sessions/:code", async (request, reply) => {
    const params = codeParamsSchema.parse(request.params);
    if (
      enforceRateLimit({
        code: params.code,
        keyPrefix: "public-code",
        limit: PUBLIC_CODE_LOOKUP_LIMIT,
        rateLimiter: dependencies.publicRateLimiter,
        reply,
        request,
        windowMs: PUBLIC_CODE_LOOKUP_WINDOW_MS,
      })
    ) {
      return reply;
    }

    const session = await dependencies.shareSessions.findByCode(params.code, new Date());

    if (!session) {
      return reply.code(404).send({
        error: unavailableLinkError,
      });
    }

    if (session.pinCodeHash) {
      return {
        pinRequired: true,
        session: toPublicTrackingGateDto(session),
      };
    }

    return {
      session: toPublicTrackingDto(session),
    };
  });

  server.post("/api/public/share-sessions/:code/verify-pin", async (request, reply) => {
    const params = codeParamsSchema.parse(request.params);
    if (
      enforceRateLimit({
        code: params.code,
        keyPrefix: "public-pin",
        limit: PUBLIC_PIN_ATTEMPT_LIMIT,
        rateLimiter: dependencies.publicRateLimiter,
        reply,
        request,
        windowMs: PUBLIC_PIN_ATTEMPT_WINDOW_MS,
      })
    ) {
      return reply;
    }

    const parsed = pinSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: "INVALID_PIN",
          message: "PIN 코드를 확인해 주세요.",
        },
      });
    }

    const session = await dependencies.shareSessions.findByCode(params.code, new Date());

    if (!session) {
      return sendInvalidPinOrLink(reply);
    }

    if (
      session.pinCodeHash &&
      !(await verifyPassword(parsed.data.pinCode, session.pinCodeHash))
    ) {
      return sendInvalidPinOrLink(reply);
    }

    reply.setCookie(trackingAccessCookieName(params.code), params.code, {
      httpOnly: true,
      path: `/api/public/share-sessions/${params.code}`,
      sameSite: "lax",
      signed: true,
    });

    return {
      session: toPublicTrackingDto(session),
    };
  });

  server.get("/api/public/share-sessions/:code/events", async (request, reply) => {
    const params = codeParamsSchema.parse(request.params);
    if (
      enforceRateLimit({
        code: params.code,
        keyPrefix: "public-code",
        limit: PUBLIC_CODE_LOOKUP_LIMIT,
        rateLimiter: dependencies.publicRateLimiter,
        reply,
        request,
        windowMs: PUBLIC_CODE_LOOKUP_WINDOW_MS,
      })
    ) {
      return reply;
    }

    const session = await dependencies.shareSessions.findByCode(params.code, new Date());

    if (!session) {
      return reply.code(404).send({
        error: unavailableLinkError,
      });
    }

    if (session.pinCodeHash && !hasTrackingAccessCookie(request, params.code)) {
      return reply.code(401).send({
        error: {
          code: "PIN_REQUIRED",
          message: "PIN 확인이 필요합니다.",
        },
      });
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    });

    const writeEvent = (eventName: string, event: PublicTrackingEvent) => {
      if (!reply.raw.destroyed) {
        reply.raw.write(formatSseEvent(eventName, event));
      }
    };
    const unsubscribe = dependencies.shareSessionRealtime.subscribe(
      session.sessionCode,
      (event) => writeEvent("location", event),
    );

    request.raw.on("close", unsubscribe);
    writeEvent("snapshot", {
      session: toPublicTrackingDto(session),
    });
  });
}

function toPublicTrackingGateDto(session: StoredShareSession) {
  return {
    sessionCode: session.sessionCode,
    sessionName: session.sessionName,
    status: session.status,
    expiresAt: session.expiresAt.toISOString(),
    pinRequired: true,
  };
}

export type PublicTrackingDto = {
  sessionCode: string;
  sessionName: string;
  status: StoredShareSession["status"];
  expiresAt: string;
  lastUpdatedLocation: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  destinationName: string | null;
  destinationLat: number | null;
  destinationLng: number | null;
  pinRequired: false;
};

export type PublicTrackingEvent = {
  session: PublicTrackingDto;
};

export function toPublicTrackingDto(session: StoredShareSession): PublicTrackingDto {
  return {
    sessionCode: session.sessionCode,
    sessionName: session.sessionName,
    status: session.status,
    expiresAt: session.expiresAt.toISOString(),
    lastUpdatedLocation: session.lastUpdatedLocation?.toISOString() ?? null,
    latitude: session.latitude,
    longitude: session.longitude,
    accuracyMeters: session.accuracyMeters,
    destinationName: session.destinationName,
    destinationLat: session.destinationLat,
    destinationLng: session.destinationLng,
    pinRequired: false,
  };
}

function formatSseEvent(eventName: string, event: PublicTrackingEvent) {
  return `event: ${eventName}\ndata: ${JSON.stringify(event)}\n\n`;
}

function trackingAccessCookieName(code: string) {
  return `tracking_access_${code}`;
}

function hasTrackingAccessCookie(request: FastifyRequest, code: string) {
  const rawCookie = request.cookies[trackingAccessCookieName(code)];

  if (!rawCookie) {
    return false;
  }

  const unsigned = request.unsignCookie(rawCookie);
  return unsigned.valid && unsigned.value === code;
}

function enforceRateLimit({
  code,
  keyPrefix,
  limit,
  rateLimiter,
  reply,
  request,
  windowMs,
}: {
  code: string;
  keyPrefix: string;
  limit: number;
  rateLimiter: RateLimiter;
  reply: FastifyReply;
  request: FastifyRequest;
  windowMs: number;
}) {
  const result = rateLimiter.consume(`${keyPrefix}:${request.ip}:${code}`, {
    limit,
    windowMs,
  });

  if (result.allowed) {
    return false;
  }

  reply.header("Retry-After", String(result.retryAfterSeconds));
  reply.code(429).send({
    error: {
      ...rateLimitedError,
      retryAfterSeconds: result.retryAfterSeconds,
    },
  });
  return true;
}

function sendInvalidPinOrLink(reply: FastifyReply) {
  return reply.code(401).send({
    error: invalidPinOrLinkError,
  });
}
