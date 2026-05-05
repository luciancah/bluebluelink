import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { hashPassword } from "../auth/password";
import { buildRequireAuth } from "../auth/requireAuth";
import { generateSessionCode } from "../sessions/codeGenerator";
import type {
  ShareSessionRepository,
  StoredShareSession,
} from "../sessions/shareSessionRepository";
import type { SessionStore } from "../auth/sessionStore";

const createShareSessionSchema = z.object({
  sessionName: z.string().trim().min(1).max(80),
  durationMinutes: z.number().int().min(5).max(24 * 60),
  pinCode: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
  destinationName: z.string().trim().min(1).max(120).optional(),
  destinationLat: z.number().min(-90).max(90).optional(),
  destinationLng: z.number().min(-180).max(180).optional(),
}).refine((value) => {
  const destinationFields = [
    value.destinationName,
    value.destinationLat,
    value.destinationLng,
  ];
  const providedCount = destinationFields.filter((field) => field !== undefined).length;

  return providedCount === 0 || providedCount === destinationFields.length;
});

export async function registerShareSessionRoutes(
  server: FastifyInstance,
  dependencies: {
    sessions: SessionStore;
    shareSessions: ShareSessionRepository;
  },
) {
  const requireAuth = buildRequireAuth(dependencies.sessions);

  server.post("/api/share-sessions", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = createShareSessionSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: "INVALID_SHARE_SESSION",
          message: "위치 공유 정보를 확인해 주세요.",
        },
      });
    }

    const pinCodeHash = parsed.data.pinCode
      ? await hashPassword(parsed.data.pinCode)
      : null;
    const session = await dependencies.shareSessions.create({
      ownerId: request.user!.id,
      sessionCode: generateSessionCode(),
      sessionName: parsed.data.sessionName,
      expiresAt: new Date(Date.now() + parsed.data.durationMinutes * 60 * 1000),
      pinCodeHash,
      destinationName: parsed.data.destinationName ?? null,
      destinationLat: parsed.data.destinationLat ?? null,
      destinationLng: parsed.data.destinationLng ?? null,
    });

    return reply.code(201).send({
      session: toOwnerSessionDto(session),
    });
  });

  server.get("/api/share-sessions", { preHandler: requireAuth }, async (request) => {
    const sessions = await dependencies.shareSessions.listByOwner(
      request.user!.id,
      new Date(),
    );

    return {
      sessions: sessions.map(toOwnerSessionDto),
    };
  });

  server.post(
    "/api/share-sessions/:id/stop",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const session = await dependencies.shareSessions.stop(params.id, request.user!.id);

      if (!session) {
        return reply.code(404).send({
          error: {
            code: "SHARE_SESSION_NOT_FOUND",
            message: "위치 공유를 찾을 수 없습니다.",
          },
        });
      }

      return {
        session: toOwnerSessionDto(session),
      };
    },
  );

  server.delete(
    "/api/share-sessions/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const deleted = await dependencies.shareSessions.delete(params.id, request.user!.id);

      if (!deleted) {
        return reply.code(404).send({
          error: {
            code: "SHARE_SESSION_NOT_FOUND",
            message: "위치 공유를 찾을 수 없습니다.",
          },
        });
      }

      return reply.code(204).send();
    },
  );
}

export function toOwnerSessionDto(session: StoredShareSession) {
  return {
    id: session.id,
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
    hasPin: Boolean(session.pinCodeHash),
    stoppedAt: session.stoppedAt?.toISOString() ?? null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}
