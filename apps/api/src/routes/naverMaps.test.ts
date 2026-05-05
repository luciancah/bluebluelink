import { describe, expect, it } from "vitest";
import { buildServer } from "../server";
import { NAVER_PROXY_RATE_LIMIT, type NaverMapsProxy } from "../naver/naverMapsClient";

const testConfig = {
  NODE_ENV: "test" as const,
  PORT: 4000,
  WEB_ORIGIN: "http://localhost:5173",
  COOKIE_SECRET: "test-cookie-secret-at-least-16",
  DATABASE_URL: "postgresql://bluebluelink:bluebluelink@localhost:5432/bluebluelink",
  NAVER_MAPS_API_KEY: "secret",
  NAVER_MAPS_API_KEY_ID: "key-id",
  NAVER_MAPS_BASE_URL: "https://naver.example",
};

function createProxy(configured = true) {
  const calls: Array<{ operation: string; input: unknown }> = [];
  const proxy: NaverMapsProxy = {
    isConfigured() {
      return configured;
    },
    async geocode(input) {
      calls.push({ operation: "geocode", input });
      return { addresses: [] };
    },
    async reverseGeocode(input) {
      calls.push({ operation: "reverseGeocode", input });
      return { results: [] };
    },
    async directions(input) {
      calls.push({ operation: "directions", input });
      return { route: { trafast: [] } };
    },
  };

  return { calls, proxy };
}

describe("Naver Maps proxy routes", () => {
  it("validates and proxies geocoding requests", async () => {
    const { calls, proxy } = createProxy();
    const server = buildServer(testConfig, { naverMaps: proxy });

    const response = await server.inject({
      method: "GET",
      url: "/api/naver/geocode?query=%EA%B0%95%EB%82%A8%EC%97%AD&lat=37.4979&lng=127.0276&count=3",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ addresses: [] });
    expect(calls).toEqual([
      {
        operation: "geocode",
        input: {
          count: 3,
          lat: 37.4979,
          lng: 127.0276,
          query: "강남역",
        },
      },
    ]);
  });

  it("bounds geocoding inputs before calling Naver", async () => {
    const { calls, proxy } = createProxy();
    const server = buildServer(testConfig, { naverMaps: proxy });

    const response = await server.inject({
      method: "GET",
      url: "/api/naver/geocode?query=x&count=100",
    });

    expect(response.statusCode).toBe(400);
    expect(calls).toEqual([]);
  });

  it("proxies reverse geocoding and directions through backend endpoints", async () => {
    const { calls, proxy } = createProxy();
    const server = buildServer(testConfig, { naverMaps: proxy });

    const reverse = await server.inject({
      method: "GET",
      url: "/api/naver/reverse-geocode?lat=37.4979&lng=127.0276",
    });
    const directions = await server.inject({
      method: "GET",
      url: "/api/naver/directions?startLat=37.4979&startLng=127.0276&goalLat=37.5665&goalLng=126.9780&option=trafast",
    });

    expect(reverse.statusCode).toBe(200);
    expect(directions.statusCode).toBe(200);
    expect(calls).toEqual([
      {
        operation: "reverseGeocode",
        input: {
          lat: 37.4979,
          lng: 127.0276,
        },
      },
      {
        operation: "directions",
        input: {
          goalLat: 37.5665,
          goalLng: 126.978,
          option: "trafast",
          startLat: 37.4979,
          startLng: 127.0276,
        },
      },
    ]);
  });

  it("returns unavailable when server-side Naver credentials are missing", async () => {
    const { proxy } = createProxy(false);
    const server = buildServer(testConfig, { naverMaps: proxy });

    const response = await server.inject({
      method: "GET",
      url: "/api/naver/geocode?query=%EA%B0%95%EB%82%A8%EC%97%AD",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe("NAVER_MAPS_NOT_CONFIGURED");
  });

  it("rate limits proxy calls for quota protection", async () => {
    const { proxy } = createProxy();
    const server = buildServer(testConfig, { naverMaps: proxy });

    for (let attempt = 0; attempt < NAVER_PROXY_RATE_LIMIT; attempt += 1) {
      const response = await server.inject({
        method: "GET",
        url: "/api/naver/geocode?query=%EA%B0%95%EB%82%A8%EC%97%AD",
      });
      expect(response.statusCode).toBe(200);
    }

    const limited = await server.inject({
      method: "GET",
      url: "/api/naver/geocode?query=%EA%B0%95%EB%82%A8%EC%97%AD",
    });

    expect(limited.statusCode).toBe(429);
    expect(limited.json().error.code).toBe("RATE_LIMITED");
  });

  it("normalizes upstream Naver failures", async () => {
    const proxy: NaverMapsProxy = {
      isConfigured: () => true,
      geocode: async () => {
        throw new Error("upstream failed");
      },
      reverseGeocode: async () => ({ results: [] }),
      directions: async () => ({ route: {} }),
    };
    const server = buildServer(testConfig, { naverMaps: proxy });

    const response = await server.inject({
      method: "GET",
      url: "/api/naver/geocode?query=%EA%B0%95%EB%82%A8%EC%97%AD",
    });

    expect(response.statusCode).toBe(502);
    expect(response.json().error.code).toBe("NAVER_MAPS_UNAVAILABLE");
  });
});
