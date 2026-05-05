import type { FastifyReply, FastifyRequest } from "fastify";
import { readSignedSessionToken } from "./sessionCookie";
import type { AuthenticatedUser, SessionStore } from "./sessionStore";

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthenticatedUser;
    sessionToken?: string;
  }
}

export function buildRequireAuth(sessions: SessionStore) {
  return async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
    const token = readSignedSessionToken(request);

    if (!token) {
      return reply.code(401).send({
        error: {
          code: "AUTH_REQUIRED",
          message: "로그인이 필요합니다.",
        },
      });
    }

    const session = await sessions.get(token);

    if (!session) {
      return reply.code(401).send({
        error: {
          code: "AUTH_REQUIRED",
          message: "로그인이 필요합니다.",
        },
      });
    }

    request.user = session.user;
    request.sessionToken = token;
  };
}
