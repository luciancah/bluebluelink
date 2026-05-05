import { describe, expect, it } from "vitest";
import { hashPassword } from "../auth/password";
import { buildServer } from "../server";
import { InMemoryShareSessionRepository } from "../sessions/shareSessionRepository";
import type { UserRepository } from "../users/userRepository";
import {
  PUBLIC_CODE_LOOKUP_LIMIT,
  PUBLIC_PIN_ATTEMPT_LIMIT,
} from "./publicTracking";

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

  return {
    server,
    code: create.json().session.sessionCode as string,
  };
}

describe("public tracking security controls", () => {
  it("rate limits public share-code lookups", async () => {
    const { server, code } = await buildTrackingServer();

    for (let attempt = 0; attempt < PUBLIC_CODE_LOOKUP_LIMIT; attempt += 1) {
      const response = await server.inject({
        method: "GET",
        url: `/api/public/share-sessions/${code}`,
      });
      expect(response.statusCode).toBe(200);
    }

    const limited = await server.inject({
      method: "GET",
      url: `/api/public/share-sessions/${code}`,
    });

    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toEqual({
      error: expect.objectContaining({
        code: "RATE_LIMITED",
        message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
      }),
    });
  });

  it("rate limits public PIN verification attempts", async () => {
    const { server, code } = await buildTrackingServer("1234");

    for (let attempt = 0; attempt < PUBLIC_PIN_ATTEMPT_LIMIT; attempt += 1) {
      const response = await server.inject({
        method: "POST",
        url: `/api/public/share-sessions/${code}/verify-pin`,
        payload: {
          pinCode: "9999",
        },
      });
      expect(response.statusCode).toBe(401);
    }

    const limited = await server.inject({
      method: "POST",
      url: `/api/public/share-sessions/${code}/verify-pin`,
      payload: {
        pinCode: "9999",
      },
    });

    expect(limited.statusCode).toBe(429);
    expect(limited.json().error.code).toBe("RATE_LIMITED");
  });

  it("uses the same generic PIN failure for unknown codes and wrong PINs", async () => {
    const { server, code } = await buildTrackingServer("1234");

    const wrongPin = await server.inject({
      method: "POST",
      url: `/api/public/share-sessions/${code}/verify-pin`,
      payload: {
        pinCode: "9999",
      },
    });
    const unknownCode = await server.inject({
      method: "POST",
      url: "/api/public/share-sessions/NOPE1234/verify-pin",
      payload: {
        pinCode: "9999",
      },
    });

    expect(unknownCode.statusCode).toBe(wrongPin.statusCode);
    expect(unknownCode.json()).toEqual(wrongPin.json());
  });
});
