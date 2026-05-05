import { describe, expect, it } from "vitest";
import { buildServer } from "./server";

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
});
