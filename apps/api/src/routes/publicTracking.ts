import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { verifyPassword } from "../auth/password";
import type {
  ShareSessionRepository,
  StoredShareSession,
} from "../sessions/shareSessionRepository";

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

    return {
      session: toPublicTrackingDto(session),
    };
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

function toPublicTrackingDto(session: StoredShareSession) {
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
