import { describe, expect, it } from "vitest";
import { hashPassword } from "../auth/password";
import { buildServer } from "../server";
import type { UserRepository } from "../users/userRepository";

const testConfig = {
  NODE_ENV: "test" as const,
  PORT: 4000,
  WEB_ORIGIN: "http://localhost:5173",
  COOKIE_SECRET: "test-cookie-secret-at-least-16",
  DATABASE_URL: "postgresql://bluebluelink:bluebluelink@localhost:5432/bluebluelink",
};

async function buildTestServer() {
  const passwordHash = await hashPassword("ride-home");
  const users: UserRepository = {
    async findByEmail(email) {
      if (email !== "driver@example.com") {
        return null;
      }

      return {
        id: "user_1",
        email,
        passwordHash,
      };
    },
  };

  return buildServer(testConfig, {
    users,
    shareSessionAccess: {
      async isOwner(sessionId, userId) {
        return sessionId === "session_owned" && userId === "user_1";
      },
    },
  });
}

function sessionCookieHeader(response: { headers: Record<string, unknown> }) {
  const setCookie = response.headers["set-cookie"];
  const rawCookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;

  if (typeof rawCookie !== "string") {
    throw new Error("Expected set-cookie header");
  }

  return rawCookie.split(";")[0];
}

describe("auth routes", () => {
  it("logs in with a signed HTTP-only session cookie and returns current user", async () => {
    const server = await buildTestServer();

    const login = await server.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "driver@example.com",
        password: "ride-home",
      },
    });

    expect(login.statusCode).toBe(200);
    expect(login.json()).toEqual({
      user: {
        id: "user_1",
        email: "driver@example.com",
      },
    });
    expect(login.headers["set-cookie"]).toEqual(
      expect.stringContaining("bluebluelink_session="),
    );
    expect(login.headers["set-cookie"]).toEqual(expect.stringContaining("HttpOnly"));
    expect(login.headers["set-cookie"]).toEqual(expect.stringContaining("SameSite=Lax"));

    const currentUser = await server.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: {
        cookie: sessionCookieHeader(login),
      },
    });

    expect(currentUser.statusCode).toBe(200);
    expect(currentUser.json()).toEqual({
      user: {
        id: "user_1",
        email: "driver@example.com",
      },
    });
  });

  it("provides the demo driver account in development", async () => {
    const server = buildServer({
      ...testConfig,
      NODE_ENV: "development",
    });

    const login = await server.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "driver@example.com",
        password: "ride-home",
      },
    });

    expect(login.statusCode).toBe(200);
    expect(login.json()).toEqual({
      user: {
        id: "demo_driver",
        email: "driver@example.com",
      },
    });
  });

  it("rejects invalid credentials", async () => {
    const server = await buildTestServer();

    const response = await server.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "driver@example.com",
        password: "bad-password",
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: {
        code: "INVALID_CREDENTIALS",
        message: "이메일 또는 비밀번호가 올바르지 않습니다.",
      },
    });
  });

  it("logs out and clears the session cookie", async () => {
    const server = await buildTestServer();

    const login = await server.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "driver@example.com",
        password: "ride-home",
      },
    });

    const logout = await server.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: {
        cookie: sessionCookieHeader(login),
      },
    });

    expect(logout.statusCode).toBe(204);
    expect(logout.headers["set-cookie"]).toEqual(
      expect.stringContaining("bluebluelink_session=;"),
    );

    const currentUser = await server.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: {
        cookie: sessionCookieHeader(login),
      },
    });

    expect(currentUser.statusCode).toBe(401);
  });

  it("keeps public routes unauthenticated", async () => {
    const server = await buildTestServer();

    const health = await server.inject({
      method: "GET",
      url: "/health",
    });

    expect(health.statusCode).toBe(200);
  });

  it("allows sender access only for the owning user", async () => {
    const server = await buildTestServer();
    const login = await server.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "driver@example.com",
        password: "ride-home",
      },
    });

    const owned = await server.inject({
      method: "GET",
      url: "/api/share-sessions/session_owned/sender-access",
      headers: {
        cookie: sessionCookieHeader(login),
      },
    });
    expect(owned.statusCode).toBe(200);
    expect(owned.json()).toEqual({ ok: true });

    const notOwned = await server.inject({
      method: "GET",
      url: "/api/share-sessions/session_other/sender-access",
      headers: {
        cookie: sessionCookieHeader(login),
      },
    });
    expect(notOwned.statusCode).toBe(403);
  });
});
