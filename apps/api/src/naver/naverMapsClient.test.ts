import { describe, expect, it, vi } from "vitest";
import { NaverMapsClient } from "./naverMapsClient";

describe("NaverMapsClient", () => {
  it("sends REST credentials only from server-side configuration", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ route: { trafast: [] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const monitor = {
      record: vi.fn(),
    };
    const client = new NaverMapsClient(
      {
        apiKey: "server-secret",
        apiKeyId: "server-client-id",
        baseUrl: "https://naver.example",
      },
      fetchImpl,
      monitor,
    );

    const result = await client.directions({
      goalLat: 37.6,
      goalLng: 127.1,
      option: "trafast",
      startLat: 37.5,
      startLng: 127,
    });

    expect(result).toEqual({ route: { trafast: [] } });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://naver.example/map-direction/v1/driving?start=127%2C37.5&goal=127.1%2C37.6&option=trafast",
      expect.objectContaining({
        headers: {
          Accept: "application/json",
          "x-ncp-apigw-api-key": "server-secret",
          "x-ncp-apigw-api-key-id": "server-client-id",
        },
      }),
    );
    expect(monitor.record).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "directions",
        status: 200,
      }),
    );
  });

  it("reports itself unconfigured when REST secrets are missing", () => {
    const client = new NaverMapsClient({
      apiKey: "",
      apiKeyId: "",
      baseUrl: "https://naver.example",
    });

    expect(client.isConfigured()).toBe(false);
  });
});
