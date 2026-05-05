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

async function buildServerWithSession() {
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

  const cookie = rawCookie.split(";")[0];
  const create = await server.inject({
    method: "POST",
    url: "/api/share-sessions",
    headers: { cookie },
    payload: {
      sessionName: "퇴근길",
      durationMinutes: 60,
    },
  });

  return {
    server,
    cookie,
    sessionId: create.json().session.id as string,
  };
}

describe("location update routes", () => {
  it("updates the owner's active share session location", async () => {
    const { server, cookie, sessionId } = await buildServerWithSession();

    const response = await server.inject({
      method: "PATCH",
      url: `/api/share-sessions/${sessionId}/location`,
      headers: { cookie },
      payload: {
        latitude: 37.3898,
        longitude: 126.95278,
        accuracyMeters: 18,
        capturedAt: "2026-05-05T10:00:00.000Z",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      session: expect.objectContaining({
        id: sessionId,
        latitude: 37.3898,
        longitude: 126.95278,
        accuracyMeters: 18,
        lastUpdatedLocation: "2026-05-05T10:00:00.000Z",
      }),
    });
  });

  it("rejects unauthenticated location updates", async () => {
    const { server, sessionId } = await buildServerWithSession();

    const response = await server.inject({
      method: "PATCH",
      url: `/api/share-sessions/${sessionId}/location`,
      payload: {
        latitude: 37.3898,
        longitude: 126.95278,
        accuracyMeters: 18,
        capturedAt: "2026-05-05T10:00:00.000Z",
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it("rejects invalid coordinates", async () => {
    const { server, cookie, sessionId } = await buildServerWithSession();

    const response = await server.inject({
      method: "PATCH",
      url: `/api/share-sessions/${sessionId}/location`,
      headers: { cookie },
      payload: {
        latitude: 137.3898,
        longitude: 126.95278,
        accuracyMeters: 18,
        capturedAt: "2026-05-05T10:00:00.000Z",
      },
    });

    expect(response.statusCode).toBe(400);
  });
});
