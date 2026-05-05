import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { verifyPassword } from "../auth/password";
import type {
  ShareSessionRepository,
  StoredShareSession,
} from "../sessions/shareSessionRepository";
import type { ShareSessionRealtime } from "../sessions/shareSessionRealtime";

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
  },
) {
  server.get("/api/public/share-sessions/:code", async (request, reply) => {
    const params = codeParamsSchema.parse(request.params);
    const session = await dependencies.shareSessions.findByCode(params.code, new Date());

    if (!session) {
      return reply.code(404).send({
        error: {
          code: "SHARE_SESSION_NOT_FOUND",
          message: "위치 공유를 찾을 수 없습니다.",
        },
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
      return reply.code(404).send({
        error: {
          code: "SHARE_SESSION_NOT_FOUND",
          message: "위치 공유를 찾을 수 없습니다.",
        },
      });
    }

    if (
      session.pinCodeHash &&
      !(await verifyPassword(parsed.data.pinCode, session.pinCodeHash))
    ) {
      return reply.code(401).send({
        error: {
          code: "INVALID_PIN",
          message: "PIN 코드가 올바르지 않습니다.",
        },
      });
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
    const session = await dependencies.shareSessions.findByCode(params.code, new Date());

    if (!session) {
      return reply.code(404).send({
        error: {
          code: "SHARE_SESSION_NOT_FOUND",
          message: "위치 공유를 찾을 수 없습니다.",
        },
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
