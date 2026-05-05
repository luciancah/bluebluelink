import { describe, expect, it, vi } from "vitest";
import { NaverPlaceSearchClient } from "./naverPlaceSearchClient";

describe("NaverPlaceSearchClient", () => {
  it("calls Naver Local Search with dedicated Search API credentials", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = new NaverPlaceSearchClient(
      {
        baseUrl: "https://openapi.example",
        clientId: "search-client-id",
        clientSecret: "search-secret",
      },
      fetchImpl,
    );

    const result = await client.search({
      count: 5,
      query: "강남역",
    });

    expect(result).toEqual({ items: [] });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://openapi.example/v1/search/local.json?display=5&query=%EA%B0%95%EB%82%A8%EC%97%AD&sort=random&start=1",
      expect.objectContaining({
        headers: {
          Accept: "application/json",
          "X-Naver-Client-Id": "search-client-id",
          "X-Naver-Client-Secret": "search-secret",
        },
      }),
    );
  });

  it("reports itself unconfigured when Search API credentials are missing", () => {
    const client = new NaverPlaceSearchClient({
      baseUrl: "https://openapi.example",
      clientId: "",
      clientSecret: "",
    });

    expect(client.isConfigured()).toBe(false);
  });
});
