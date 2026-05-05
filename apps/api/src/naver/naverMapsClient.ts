export const NAVER_PROXY_RATE_LIMIT = 60;

export type NaverMapsOperation = "geocode" | "reverseGeocode" | "directions";

export type NaverMapsMonitor = {
  record(event: {
    operation: NaverMapsOperation;
    status: number;
    durationMs: number;
  }): void;
};

export type NaverMapsConfig = {
  apiKey: string;
  apiKeyId: string;
  baseUrl: string;
};

export type NaverGeocodeInput = {
  query: string;
  lat?: number;
  lng?: number;
  count: number;
};

export type NaverReverseGeocodeInput = {
  lat: number;
  lng: number;
};

export type NaverDirectionsInput = {
  startLat: number;
  startLng: number;
  goalLat: number;
  goalLng: number;
  option: "trafast" | "tracomfort" | "traoptimal" | "traavoidtoll" | "traavoidcaronly";
};

export type NaverMapsProxy = {
  isConfigured(): boolean;
  geocode(input: NaverGeocodeInput): Promise<unknown>;
  reverseGeocode(input: NaverReverseGeocodeInput): Promise<unknown>;
  directions(input: NaverDirectionsInput): Promise<unknown>;
};

export class NaverMapsClient implements NaverMapsProxy {
  constructor(
    private readonly config: NaverMapsConfig,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly monitor: NaverMapsMonitor = {
      record() {
        return;
      },
    },
  ) {}

  isConfigured() {
    return this.config.apiKey.length > 0 && this.config.apiKeyId.length > 0;
  }

  geocode(input: NaverGeocodeInput) {
    const query = new URLSearchParams({
      count: String(input.count),
      language: "kor",
      query: input.query,
    });

    if (typeof input.lat === "number" && typeof input.lng === "number") {
      query.set("coordinate", `${input.lng},${input.lat}`);
    }

    return this.request("geocode", "/map-geocode/v2/geocode", query);
  }

  reverseGeocode(input: NaverReverseGeocodeInput) {
    return this.request(
      "reverseGeocode",
      "/map-reversegeocode/v2/gc",
      new URLSearchParams({
        coords: `${input.lng},${input.lat}`,
        orders: "roadaddr,addr,admcode",
        output: "json",
      }),
    );
  }

  directions(input: NaverDirectionsInput) {
    return this.request(
      "directions",
      "/map-direction/v1/driving",
      new URLSearchParams({
        start: `${input.startLng},${input.startLat}`,
        goal: `${input.goalLng},${input.goalLat}`,
        option: input.option,
      }),
    );
  }

  private async request(
    operation: NaverMapsOperation,
    path: string,
    query: URLSearchParams,
  ) {
    const startedAt = Date.now();
    const url = new URL(path, this.config.baseUrl);
    url.search = query.toString();

    const response = await this.fetchImpl(url.toString(), {
      headers: {
        Accept: "application/json",
        "x-ncp-apigw-api-key": this.config.apiKey,
        "x-ncp-apigw-api-key-id": this.config.apiKeyId,
      },
    });
    this.monitor.record({
      durationMs: Date.now() - startedAt,
      operation,
      status: response.status,
    });

    if (!response.ok) {
      throw new NaverMapsClientError(response.status);
    }

    return response.json() as Promise<unknown>;
  }
}

export class NaverMapsClientError extends Error {
  constructor(readonly status: number) {
    super("Naver Maps request failed");
  }
}
