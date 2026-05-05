import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
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

const openServers: Array<ReturnType<typeof buildServer>> = [];

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

  return {
    server,
    code: session.sessionCode as string,
    sessionId: session.id as string,
    cookie,
  };
}

afterEach(async () => {
  await Promise.all(openServers.splice(0).map((server) => server.close()));
});

describe("public tracking event stream", () => {
  it("streams a current snapshot and fans out sender location updates", async () => {
    const { server, code, sessionId, cookie } = await buildTrackingServer();
    const baseUrl = await listen(server);
    const controller = new AbortController();
    const response = await fetch(`${baseUrl}/api/public/share-sessions/${code}/events`, {
      signal: controller.signal,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Expected SSE response body");
    }

    const snapshot = await readSseEvent(reader);
    expect(snapshot).toEqual({
      event: "snapshot",
      data: {
        session: expect.objectContaining({
          sessionCode: code,
          sessionName: "퇴근길",
          latitude: null,
          longitude: null,
        }),
      },
    });
    expect(snapshot.data.session.ownerId).toBeUndefined();
    expect(snapshot.data.session.pinCodeHash).toBeUndefined();

    await server.inject({
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

    const location = await readSseEvent(reader);
    expect(location).toEqual({
      event: "location",
      data: {
        session: expect.objectContaining({
          sessionCode: code,
          latitude: 37.3898,
          longitude: 126.95278,
          accuracyMeters: 18,
          lastUpdatedLocation: "2026-05-05T10:00:00.000Z",
        }),
      },
    });

    await reader.cancel();
    controller.abort();
  });

  it("requires a verified PIN cookie before streaming protected sessions", async () => {
    const { server, code } = await buildTrackingServer("1234");
    const baseUrl = await listen(server);
    const streamUrl = `${baseUrl}/api/public/share-sessions/${code}/events`;

    const blocked = await fetch(streamUrl);
    expect(blocked.status).toBe(401);

    const verified = await fetch(
      `${baseUrl}/api/public/share-sessions/${code}/verify-pin`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pinCode: "1234" }),
      },
    );
    expect(verified.status).toBe(200);
    const setCookie = verified.headers.get("set-cookie");
    expect(setCookie).toContain(`tracking_access_${code}=`);

    const response = await fetch(streamUrl, {
      headers: {
        cookie: setCookie?.split(";")[0] ?? "",
      },
    });
    expect(response.status).toBe(200);
    await response.body?.cancel();
  });
});

async function listen(server: ReturnType<typeof buildServer>) {
  await server.listen({ host: "127.0.0.1", port: 0 });
  openServers.push(server);
  const address = server.server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function readSseEvent(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const result = await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Timed out waiting for SSE event")), 1000);
      }),
    ]);

    if (result.done) {
      throw new Error("SSE stream closed before an event arrived");
    }

    buffer += decoder.decode(result.value, { stream: true });
    const eventEnd = buffer.indexOf("\n\n");

    if (eventEnd === -1) {
      continue;
    }

    const rawEvent = buffer.slice(0, eventEnd);
    const lines = rawEvent.split("\n");
    const event = lines.find((line) => line.startsWith("event: "))?.slice(7);
    const data = lines
      .filter((line) => line.startsWith("data: "))
      .map((line) => line.slice(6))
      .join("\n");

    return {
      event,
      data: JSON.parse(data) as {
        session: Record<string, unknown>;
      },
    };
  }
}
