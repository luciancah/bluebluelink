import { afterEach, describe, expect, it, vi } from "vitest";
import { getNaverDirections, searchNaverPlaces } from "./naverApi";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getNaverDirections", () => {
  it("loads normalized traffic-aware route data from the backend proxy", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          route: {
            distanceMeters: 12500,
            durationSeconds: 1800,
            path: [
              { lat: 37.497952, lng: 127.027621 },
              { lat: 37.5665, lng: 126.978 },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const route = await getNaverDirections({
      goalLat: 37.5665,
      goalLng: 126.978,
      startLat: 37.497952,
      startLng: 127.027621,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/naver/directions?startLat=37.497952&startLng=127.027621&goalLat=37.5665&goalLng=126.978&option=trafast",
    );
    expect(route).toEqual({
      distanceMeters: 12500,
      durationSeconds: 1800,
      path: [
        { lat: 37.497952, lng: 127.027621 },
        { lat: 37.5665, lng: 126.978 },
      ],
    });
  });
});

describe("searchNaverPlaces", () => {
  it("loads Korean destination search results from the backend proxy", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          places: [
            {
              address: "서울특별시 강남구 강남대로 396",
              jibunAddress: "서울특별시 강남구 역삼동 858",
              lat: 37.497952,
              lng: 127.027621,
              name: "서울특별시 강남구 강남대로 396",
              roadAddress: "서울특별시 강남구 강남대로 396",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const places = await searchNaverPlaces("강남역");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/naver/geocode?query=%EA%B0%95%EB%82%A8%EC%97%AD&count=5",
    );
    expect(places).toEqual([
      {
        address: "서울특별시 강남구 강남대로 396",
        jibunAddress: "서울특별시 강남구 역삼동 858",
        lat: 37.497952,
        lng: 127.027621,
        name: "서울특별시 강남구 강남대로 396",
        roadAddress: "서울특별시 강남구 강남대로 396",
      },
    ]);
  });
});
