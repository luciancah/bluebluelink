export type NaverPlaceSearchConfig = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
};

export type NaverPlaceSearchInput = {
  count: number;
  query: string;
};

export type NaverPlaceSearchProxy = {
  isConfigured(): boolean;
  search(input: NaverPlaceSearchInput): Promise<unknown>;
};

export class NaverPlaceSearchClient implements NaverPlaceSearchProxy {
  constructor(
    private readonly config: NaverPlaceSearchConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  isConfigured() {
    return this.config.clientId.length > 0 && this.config.clientSecret.length > 0;
  }

  async search(input: NaverPlaceSearchInput) {
    const url = new URL("/v1/search/local.json", this.config.baseUrl);
    url.search = new URLSearchParams({
      display: String(input.count),
      query: input.query,
      sort: "random",
      start: "1",
    }).toString();

    const response = await this.fetchImpl(url.toString(), {
      headers: {
        Accept: "application/json",
        "X-Naver-Client-Id": this.config.clientId,
        "X-Naver-Client-Secret": this.config.clientSecret,
      },
    });

    if (!response.ok) {
      throw new NaverPlaceSearchClientError(response.status);
    }

    return response.json() as Promise<unknown>;
  }
}

export class NaverPlaceSearchClientError extends Error {
  constructor(readonly status: number) {
    super("Naver Local Search request failed");
  }
}
