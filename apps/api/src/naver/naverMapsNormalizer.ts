export type NormalizedNaverPlace = {
  address: string;
  jibunAddress: string | null;
  lat: number;
  lng: number;
  name: string;
  roadAddress: string | null;
};

export type NormalizedNaverAddress = {
  address: string | null;
  landmarkName: string | null;
  roadAddress: string | null;
};

export type NormalizedNaverRoute = {
  distanceMeters: number;
  durationSeconds: number;
  path: Array<{
    lat: number;
    lng: number;
  }>;
};

type NaverGeocodeAddress = {
  roadAddress?: unknown;
  jibunAddress?: unknown;
  x?: unknown;
  y?: unknown;
};

type NaverLocalSearchItem = {
  address?: unknown;
  mapx?: unknown;
  mapy?: unknown;
  roadAddress?: unknown;
  title?: unknown;
};

export type NaverLocalSearchAddressCandidate = {
  address: string;
  jibunAddress: string | null;
  name: string;
  roadAddress: string | null;
};

type NaverReverseGeocodeResult = {
  land?: {
    addition0?: {
      value?: unknown;
    };
    name?: unknown;
    number1?: unknown;
    number2?: unknown;
  };
  region?: Record<string, { name?: unknown } | undefined>;
};

type NaverDirectionRoute = {
  path?: unknown;
  summary?: {
    distance?: unknown;
    duration?: unknown;
  };
};

export function normalizeNaverGeocodeResponse(raw: unknown) {
  const addresses = getRecord(raw).addresses;
  const places = Array.isArray(addresses)
    ? addresses.flatMap((address) => normalizeNaverPlace(address))
    : [];

  return { places };
}

export function normalizeNaverLocalSearchResponse(raw: unknown) {
  const items = getRecord(raw).items;
  const places = Array.isArray(items)
    ? items.flatMap((item) => normalizeNaverLocalSearchPlace(item))
    : [];

  return { places };
}

export function normalizeNaverLocalSearchAddressCandidates(
  raw: unknown,
): NaverLocalSearchAddressCandidate[] {
  const items = getRecord(raw).items;

  if (!Array.isArray(items)) {
    return [];
  }

  return items.flatMap((item) => {
    const record = getRecord(item) as NaverLocalSearchItem;
    const roadAddress = toStringOrNull(record.roadAddress);
    const jibunAddress = toStringOrNull(record.address);
    const displayAddress = roadAddress ?? jibunAddress;
    const name = stripHtmlTags(toStringOrNull(record.title) ?? displayAddress ?? "");

    if (!displayAddress || !name) {
      return [];
    }

    return [
      {
        address: displayAddress,
        jibunAddress,
        name,
        roadAddress,
      },
    ];
  });
}

export function normalizeNaverReverseGeocodeResponse(raw: unknown): NormalizedNaverAddress {
  const results = getRecord(raw).results;
  const first = Array.isArray(results)
    ? results.map((result) => getRecord(result) as NaverReverseGeocodeResult)[0]
    : undefined;

  if (!first) {
    return {
      address: null,
      landmarkName: null,
      roadAddress: null,
    };
  }

  const regionNames = ["area1", "area2", "area3", "area4"]
    .map((key) => toStringOrNull(first.region?.[key]?.name))
    .filter((name): name is string => Boolean(name));
  const roadName = toStringOrNull(first.land?.name);
  const roadNumber = [first.land?.number1, first.land?.number2]
    .map(toStringOrNull)
    .filter((value): value is string => Boolean(value))
    .join("-");
  const roadAddress = [...regionNames, roadName, roadNumber]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ");

  return {
    address: roadAddress || null,
    landmarkName: toStringOrNull(first.land?.addition0?.value),
    roadAddress: roadAddress || null,
  };
}

export function normalizeNaverDirectionsResponse(
  raw: unknown,
  option: string,
): { route: NormalizedNaverRoute | null } {
  const routeGroups = getRecord(getRecord(raw).route);
  const routes = routeGroups[option];
  const first = Array.isArray(routes)
    ? (getRecord(routes[0]) as NaverDirectionRoute)
    : undefined;

  if (!first) {
    return { route: null };
  }

  const distanceMeters = toNumberOrNull(first.summary?.distance);
  const durationMs = toNumberOrNull(first.summary?.duration);

  if (distanceMeters === null || durationMs === null) {
    return { route: null };
  }

  return {
    route: {
      distanceMeters,
      durationSeconds: Math.round(durationMs / 1000),
      path: normalizeNaverPath(first.path),
    },
  };
}

function normalizeNaverPlace(address: unknown): NormalizedNaverPlace[] {
  const record = getRecord(address) as NaverGeocodeAddress;
  const lat = toNumberOrNull(record.y);
  const lng = toNumberOrNull(record.x);
  const roadAddress = toStringOrNull(record.roadAddress);
  const jibunAddress = toStringOrNull(record.jibunAddress);
  const displayAddress = roadAddress ?? jibunAddress;

  if (lat === null || lng === null || !displayAddress) {
    return [];
  }

  return [
    {
      address: displayAddress,
      jibunAddress,
      lat,
      lng,
      name: displayAddress,
      roadAddress,
    },
  ];
}

function normalizeNaverLocalSearchPlace(item: unknown): NormalizedNaverPlace[] {
  const record = getRecord(item) as NaverLocalSearchItem;
  const coordinate = normalizeLocalSearchCoordinate(record.mapx, record.mapy);
  const roadAddress = toStringOrNull(record.roadAddress);
  const jibunAddress = toStringOrNull(record.address);
  const displayAddress = roadAddress ?? jibunAddress;
  const name = stripHtmlTags(toStringOrNull(record.title) ?? displayAddress ?? "");

  if (!coordinate || !displayAddress || !name) {
    return [];
  }

  return [
    {
      address: displayAddress,
      jibunAddress,
      lat: coordinate.lat,
      lng: coordinate.lng,
      name,
      roadAddress,
    },
  ];
}

function normalizeLocalSearchCoordinate(mapx: unknown, mapy: unknown) {
  const rawLng = toNumberOrNull(mapx);
  const rawLat = toNumberOrNull(mapy);

  if (rawLng === null || rawLat === null) {
    return null;
  }

  const candidates = [
    {
      lat: rawLat,
      lng: rawLng,
    },
    {
      lat: rawLat / 10_000_000,
      lng: rawLng / 10_000_000,
    },
  ];

  return candidates.find((candidate) => isKoreanCoordinate(candidate)) ?? null;
}

function normalizeNaverPath(path: unknown) {
  if (!Array.isArray(path)) {
    return [];
  }

  return path.flatMap((point) => {
    if (!Array.isArray(point) || point.length < 2) {
      return [];
    }

    const lng = toNumberOrNull(point[0]);
    const lat = toNumberOrNull(point[1]);

    if (lat === null || lng === null) {
      return [];
    }

    return [{ lat, lng }];
  });
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function isKoreanCoordinate(coordinate: { lat: number; lng: number }) {
  return coordinate.lat >= 33 && coordinate.lat <= 39 && coordinate.lng >= 124 && coordinate.lng <= 132;
}

function toNumberOrNull(value: unknown) {
  if (typeof value !== "number" && typeof value !== "string") {
    return null;
  }

  if (typeof value === "string" && value.trim().length === 0) {
    return null;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function toStringOrNull(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function stripHtmlTags(value: string) {
  return value.replace(/<[^>]*>/g, "").trim();
}
