import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { buildRequireAuth } from "../auth/requireAuth";
import type { SessionStore } from "../auth/sessionStore";
import type { ShareSessionRepository } from "../sessions/shareSessionRepository";
import { toOwnerSessionDto } from "./shareSessions";

const updateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().nonnegative().max(5000),
  capturedAt: z.string().datetime(),
});

export async function registerLocationUpdateRoutes(
  server: FastifyInstance,
  dependencies: {
    sessions: SessionStore;
    shareSessions: ShareSessionRepository;
  },
) {
  const requireAuth = buildRequireAuth(dependencies.sessions);

  server.patch(
    "/api/share-sessions/:id/location",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const parsed = updateLocationSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          error: {
            code: "INVALID_LOCATION_UPDATE",
            message: "위치 정보가 올바르지 않습니다.",
          },
        });
      }

      const session = await dependencies.shareSessions.updateLocation(
        params.id,
        request.user!.id,
        {
          ...parsed.data,
          capturedAt: new Date(parsed.data.capturedAt),
        },
      );

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
}
