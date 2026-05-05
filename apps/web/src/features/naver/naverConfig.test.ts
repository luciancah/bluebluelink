import { describe, expect, it } from "vitest";
import { getNaverMapsClientConfig } from "./naverConfig";

describe("getNaverMapsClientConfig", () => {
  it("exposes only client-safe Naver Maps JavaScript config", () => {
    const config = getNaverMapsClientConfig({
      NAVER_MAPS_API_KEY: "server-secret",
      VITE_NAVER_MAPS_CLIENT_ID: "browser-client-id",
    });

    expect(config).toEqual({
      clientId: "browser-client-id",
      enabled: true,
    });
    expect(JSON.stringify(config)).not.toContain("server-secret");
  });
});
