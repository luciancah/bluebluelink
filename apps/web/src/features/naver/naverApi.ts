import type { MapPoint } from "../../components/map/SharedMap";

export type NaverRoute = {
  distanceMeters: number;
  durationSeconds: number;
  path: MapPoint[];
};

export type NaverPlace = {
  address: string;
  jibunAddress: string | null;
  lat: number;
  lng: number;
  name: string;
  roadAddress: string | null;
};

export type NaverDirectionsInput = {
  goalLat: number;
  goalLng: number;
  startLat: number;
  startLng: number;
};

export async function getNaverDirections(input: NaverDirectionsInput) {
  const query = new URLSearchParams({
    startLat: String(input.startLat),
    startLng: String(input.startLng),
    goalLat: String(input.goalLat),
    goalLng: String(input.goalLng),
    option: "trafast",
  });
  const response = await fetch(`/api/naver/directions?${query.toString()}`);

  if (!response.ok) {
    throw new Error("Failed to load Naver directions");
  }

  const data = (await response.json()) as { route: NaverRoute | null };
  return data.route;
}

export async function searchNaverPlaces(queryText: string) {
  const query = new URLSearchParams({
    query: queryText,
    count: "5",
  });
  const response = await fetch(`/api/naver/geocode?${query.toString()}`);

  if (!response.ok) {
    throw new Error("Failed to search Naver places");
  }

  const data = (await response.json()) as { places: NaverPlace[] };
  return data.places;
}
