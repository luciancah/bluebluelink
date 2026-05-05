import { describe, expect, it } from "vitest";
import { buildLoggerOptions, buildServer } from "./server";

describe("api server", () => {
  it("responds to health checks", async () => {
    const server = buildServer();

    const response = await server.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      service: "bluebluelink-api",
    });
  });

  it("requires HTTPS in production deployments", async () => {
    const server = buildServer({
      NODE_ENV: "production",
      PORT: 4000,
      WEB_ORIGIN: "https://bluebluelink.example",
      COOKIE_SECRET: "test-cookie-secret-at-least-16",
      DATABASE_URL: "postgresql://bluebluelink:bluebluelink@localhost:5432/bluebluelink",
    });

    const insecure = await server.inject({
      method: "GET",
      url: "/health",
      headers: {
        "x-forwarded-proto": "http",
      },
    });
    const secure = await server.inject({
      method: "GET",
      url: "/health",
      headers: {
        "x-forwarded-proto": "https",
      },
    });

    expect(insecure.statusCode).toBe(426);
    expect(insecure.json().error.code).toBe("HTTPS_REQUIRED");
    expect(secure.statusCode).toBe(200);
  });

  it("redacts precise coordinates and PINs from production request logs", () => {
    expect(buildLoggerOptions("production")).toEqual({
      redact: [
        "req.body.latitude",
        "req.body.longitude",
        "req.body.pinCode",
        "req.body.capturedAt",
      ],
    });
  });
});
