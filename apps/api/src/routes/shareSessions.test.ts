import { describe, expect, it } from "vitest";
import { hashPassword } from "../auth/password";
import { buildServer } from "../server";
import { InMemoryShareSessionRepository } from "../sessions/shareSessionRepository";
import type { UserRepository } from "../users/userRepository";

const testConfig = {
  NODE_ENV: "test" as const,
  PORT: 4000,
  WEB_ORIGIN: "http://localhost:5173",
  COOKIE_SECRET: "test-cookie-secret-at-least-16",
  DATABASE_URL: "postgresql://bluebluelink:bluebluelink@localhost:5432/bluebluelink",
};

async function buildLoggedInServer() {
  const passwordHash = await hashPassword("ride-home");
  const users: UserRepository = {
    async findByEmail(email) {
      return email === "driver@example.com"
        ? {
            id: "user_1",
            email,
            passwordHash,
          }
        : null;
    },
  };
  const shareSessions = new InMemoryShareSessionRepository();
  const server = buildServer(testConfig, {
    users,
    shareSessions,
    shareSessionAccess: shareSessions,
  });
  const login = await server.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: {
      email: "driver@example.com",
      password: "ride-home",
    },
  });
  const setCookie = login.headers["set-cookie"];
  const rawCookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;

  if (typeof rawCookie !== "string") {
    throw new Error("Expected login cookie");
  }

  return {
    server,
    cookie: rawCookie.split(";")[0],
    shareSessions,
  };
}

describe("share session routes", () => {
  it("creates and lists share sessions for the owner", async () => {
    const { server, cookie, shareSessions } = await buildLoggedInServer();

    const create = await server.inject({
      method: "POST",
      url: "/api/share-sessions",
      headers: { cookie },
      payload: {
        sessionName: "퇴근길",
        durationMinutes: 60,
        pinCode: "1234",
      },
    });

    expect(create.statusCode).toBe(201);
    expect(create.json()).toEqual({
      session: expect.objectContaining({
        sessionName: "퇴근길",
        status: "active",
        sessionCode: expect.stringMatching(/^[A-Z0-9]{8}$/),
        hasPin: true,
      }),
    });
    expect(create.json().session.pinCodeHash).toBeUndefined();
    const stored = await shareSessions.findByCode(
      create.json().session.sessionCode,
      new Date(),
    );
    expect(stored?.pinCodeHash).toBeTruthy();
    expect(stored?.pinCodeHash).not.toBe("1234");

    const list = await server.inject({
      method: "GET",
      url: "/api/share-sessions",
      headers: { cookie },
    });

    expect(list.statusCode).toBe(200);
    expect(list.json()).toEqual({
      sessions: [
        expect.objectContaining({
          sessionName: "퇴근길",
          status: "active",
          hasPin: true,
        }),
      ],
    });
  });

  it("stops a share session", async () => {
    const { server, cookie } = await buildLoggedInServer();
    const create = await server.inject({
      method: "POST",
      url: "/api/share-sessions",
      headers: { cookie },
      payload: {
        sessionName: "픽업",
        durationMinutes: 30,
      },
    });

    const stop = await server.inject({
      method: "POST",
      url: `/api/share-sessions/${create.json().session.id}/stop`,
      headers: { cookie },
    });

    expect(stop.statusCode).toBe(200);
    expect(stop.json()).toEqual({
      session: expect.objectContaining({
        status: "stopped",
      }),
    });
  });

  it("deletes a share session", async () => {
    const { server, cookie } = await buildLoggedInServer();
    const create = await server.inject({
      method: "POST",
      url: "/api/share-sessions",
      headers: { cookie },
      payload: {
        sessionName: "삭제 테스트",
        durationMinutes: 15,
      },
    });

    const deleted = await server.inject({
      method: "DELETE",
      url: `/api/share-sessions/${create.json().session.id}`,
      headers: { cookie },
    });

    expect(deleted.statusCode).toBe(204);

    const list = await server.inject({
      method: "GET",
      url: "/api/share-sessions",
      headers: { cookie },
    });

    expect(list.json()).toEqual({ sessions: [] });
  });

  it("rejects unauthenticated session lifecycle requests", async () => {
    const { server } = await buildLoggedInServer();

    const create = await server.inject({
      method: "POST",
      url: "/api/share-sessions",
      payload: {
        sessionName: "권한 없음",
        durationMinutes: 15,
      },
    });

    expect(create.statusCode).toBe(401);
  });
});
