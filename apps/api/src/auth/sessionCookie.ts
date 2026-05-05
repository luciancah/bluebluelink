import type { FastifyReply, FastifyRequest } from "fastify";
import type { AppConfig } from "../config";

export const sessionCookieName = "bluebluelink_session";

export function setSessionCookie(reply: FastifyReply, token: string, config: AppConfig) {
  reply.setCookie(sessionCookieName, token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: config.NODE_ENV === "production",
    signed: true,
  });
}

export function clearSessionCookie(reply: FastifyReply, config: AppConfig) {
  reply.clearCookie(sessionCookieName, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: config.NODE_ENV === "production",
  });
}

export function readSignedSessionToken(request: FastifyRequest): string | null {
  const rawCookie = request.cookies[sessionCookieName];

  if (!rawCookie) {
    return null;
  }

  const unsigned = request.unsignCookie(rawCookie);
  return unsigned.valid ? unsigned.value : null;
}
