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

async function buildTrackingServer(pinCode?: string) {
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
      ...(pinCode ? { pinCode } : {}),
    },
  });
  const session = create.json().session;
  await server.inject({
    method: "PATCH",
    url: `/api/share-sessions/${session.id}/location`,
    headers: { cookie },
    payload: {
      latitude: 37.3898,
      longitude: 126.95278,
      accuracyMeters: 18,
      capturedAt: "2026-05-05T10:00:00.000Z",
    },
  });

  return {
    server,
    code: session.sessionCode as string,
    sessionId: session.id as string,
    cookie,
  };
}

describe("public tracking routes", () => {
  it("returns public tracking data without authentication", async () => {
    const { server, code } = await buildTrackingServer();

    const response = await server.inject({
      method: "GET",
      url: `/api/public/share-sessions/${code}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      session: expect.objectContaining({
        sessionCode: code,
        sessionName: "퇴근길",
        status: "active",
        latitude: 37.3898,
        longitude: 126.95278,
        lastUpdatedLocation: "2026-05-05T10:00:00.000Z",
        pinRequired: false,
      }),
    });
    expect(response.json().session.ownerId).toBeUndefined();
    expect(response.json().session.pinCodeHash).toBeUndefined();
  });

  it("hides protected sessions until the correct PIN is submitted", async () => {
    const { server, code } = await buildTrackingServer("1234");

    const gated = await server.inject({
      method: "GET",
      url: `/api/public/share-sessions/${code}`,
    });
    expect(gated.statusCode).toBe(200);
    expect(gated.json()).toEqual({
      pinRequired: true,
      session: expect.objectContaining({
        sessionCode: code,
        sessionName: "퇴근길",
        status: "active",
      }),
    });
    expect(gated.json().session.latitude).toBeUndefined();

    const wrongPin = await server.inject({
      method: "POST",
      url: `/api/public/share-sessions/${code}/verify-pin`,
      payload: {
        pinCode: "9999",
      },
    });
    expect(wrongPin.statusCode).toBe(401);

    const correctPin = await server.inject({
      method: "POST",
      url: `/api/public/share-sessions/${code}/verify-pin`,
      payload: {
        pinCode: "1234",
      },
    });
    expect(correctPin.statusCode).toBe(200);
    expect(correctPin.json()).toEqual({
      session: expect.objectContaining({
        sessionCode: code,
        latitude: 37.3898,
        longitude: 126.95278,
        pinRequired: false,
      }),
    });
  });

  it("returns stopped status for stopped sessions", async () => {
    const { server, code, sessionId, cookie } = await buildTrackingServer();
    await server.inject({
      method: "POST",
      url: `/api/share-sessions/${sessionId}/stop`,
      headers: { cookie },
    });

    const response = await server.inject({
      method: "GET",
      url: `/api/public/share-sessions/${code}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().session.status).toBe("stopped");
  });

  it("returns not found for unknown codes", async () => {
    const { server } = await buildTrackingServer();

    const response = await server.inject({
      method: "GET",
      url: "/api/public/share-sessions/NOPE1234",
    });

    expect(response.statusCode).toBe(404);
  });
});
