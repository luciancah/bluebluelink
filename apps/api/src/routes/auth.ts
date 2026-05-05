import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppConfig } from "../config";
import { verifyPassword } from "../auth/password";
import { clearSessionCookie, readSignedSessionToken, setSessionCookie } from "../auth/sessionCookie";
import type { SessionStore } from "../auth/sessionStore";
import type { ShareSessionAccessRepository } from "../sessions/shareSessionAccess";
import type { UserRepository } from "../users/userRepository";
import { buildRequireAuth } from "../auth/requireAuth";

const loginSchema = z.object({
  email: z.string().email().transform((email) => email.toLowerCase()),
  password: z.string().min(1),
});

export type AuthRouteDependencies = {
  config: AppConfig;
  users: UserRepository;
  sessions: SessionStore;
  shareSessionAccess: ShareSessionAccessRepository;
};

export async function registerAuthRoutes(
  server: FastifyInstance,
  dependencies: AuthRouteDependencies,
) {
  const requireAuth = buildRequireAuth(dependencies.sessions);

  server.post("/api/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: "INVALID_LOGIN_REQUEST",
          message: "이메일과 비밀번호를 확인해 주세요.",
        },
      });
    }

    const user = await dependencies.users.findByEmail(parsed.data.email);
    const verified = user
      ? await verifyPassword(parsed.data.password, user.passwordHash)
      : false;

    if (!user || !verified) {
      return reply.code(401).send({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "이메일 또는 비밀번호가 올바르지 않습니다.",
        },
      });
    }

    const session = await dependencies.sessions.create({
      id: user.id,
      email: user.email,
    });

    setSessionCookie(reply, session.token, dependencies.config);

    return {
      user: session.user,
    };
  });

  server.post("/api/auth/logout", async (request, reply) => {
    const token = readSignedSessionToken(request);

    if (token) {
      await dependencies.sessions.destroy(token);
    }

    clearSessionCookie(reply, dependencies.config);
    return reply.code(204).send();
  });

  server.get("/api/auth/me", { preHandler: requireAuth }, async (request) => ({
    user: request.user,
  }));

  server.get(
    "/api/share-sessions/:id/sender-access",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const hasAccess = await dependencies.shareSessionAccess.isOwner(
        params.id,
        request.user!.id,
      );

      if (!hasAccess) {
        return reply.code(403).send({
          error: {
            code: "SENDER_ACCESS_DENIED",
            message: "이 위치 공유를 전송할 권한이 없습니다.",
          },
        });
      }

      return { ok: true };
    },
  );
}
