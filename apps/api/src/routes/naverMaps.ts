import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  NAVER_PROXY_RATE_LIMIT,
  type NaverMapsProxy,
} from "../naver/naverMapsClient";
import {
  normalizeNaverLocalSearchAddressCandidates,
  normalizeNaverLocalSearchResponse,
  normalizeNaverDirectionsResponse,
  normalizeNaverGeocodeResponse,
  normalizeNaverReverseGeocodeResponse,
  type NormalizedNaverPlace,
} from "../naver/naverMapsNormalizer";
import type { NaverPlaceSearchProxy } from "../naver/naverPlaceSearchClient";
import type { RateLimiter } from "../security/rateLimiter";

const NAVER_PROXY_WINDOW_MS = 60 * 1000;
const longitudeSchema = z.coerce.number().min(124).max(132);
const latitudeSchema = z.coerce.number().min(33).max(39);
const geocodeQuerySchema = z
  .object({
    query: z.string().trim().min(2).max(120),
    lat: latitudeSchema.optional(),
    lng: longitudeSchema.optional(),
    count: z.coerce.number().int().min(1).max(10).default(5),
  })
  .refine((value) => (value.lat === undefined) === (value.lng === undefined));
const reverseGeocodeQuerySchema = z.object({
  lat: latitudeSchema,
  lng: longitudeSchema,
});
const directionsQuerySchema = z.object({
  startLat: latitudeSchema,
  startLng: longitudeSchema,
  goalLat: latitudeSchema,
  goalLng: longitudeSchema,
  option: z
    .enum(["trafast", "tracomfort", "traoptimal", "traavoidtoll", "traavoidcaronly"])
    .default("trafast"),
});

export async function registerNaverMapsRoutes(
  server: FastifyInstance,
  dependencies: {
    naverMaps: NaverMapsProxy;
    naverPlaceSearch: NaverPlaceSearchProxy;
    rateLimiter: RateLimiter;
  },
) {
  server.get("/api/naver/geocode", async (request, reply) => {
    if (rejectUnavailableOrLimited(request, reply, dependencies)) {
      return reply;
    }

    const parsed = geocodeQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      return sendInvalidNaverRequest(reply);
    }

    return proxyNaver(reply, async () => {
      const searchedPlaces = await trySearchPlaces(parsed.data, dependencies);

      if (searchedPlaces.places.length > 0) {
        return searchedPlaces;
      }

      return normalizeNaverGeocodeResponse(
        await dependencies.naverMaps.geocode(parsed.data),
      );
    });
  });

  server.get("/api/naver/reverse-geocode", async (request, reply) => {
    if (rejectUnavailableOrLimited(request, reply, dependencies)) {
      return reply;
    }

    const parsed = reverseGeocodeQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      return sendInvalidNaverRequest(reply);
    }

    return proxyNaver(reply, async () =>
      normalizeNaverReverseGeocodeResponse(
        await dependencies.naverMaps.reverseGeocode(parsed.data),
      ),
    );
  });

  server.get("/api/naver/directions", async (request, reply) => {
    if (rejectUnavailableOrLimited(request, reply, dependencies)) {
      return reply;
    }

    const parsed = directionsQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      return sendInvalidNaverRequest(reply);
    }

    return proxyNaver(reply, async () =>
      normalizeNaverDirectionsResponse(
        await dependencies.naverMaps.directions(parsed.data),
        parsed.data.option,
      ),
    );
  });
}

async function trySearchPlaces(
  input: { count: number; query: string },
  dependencies: {
    naverMaps: NaverMapsProxy;
    naverPlaceSearch: NaverPlaceSearchProxy;
  },
): Promise<{ places: NormalizedNaverPlace[] }> {
  if (!dependencies.naverPlaceSearch.isConfigured()) {
    return { places: [] };
  }

  try {
    const rawSearch = await dependencies.naverPlaceSearch.search(input);
    const localSearch = normalizeNaverLocalSearchResponse(rawSearch);

    if (localSearch.places.length > 0) {
      return localSearch;
    }

    return {
      places: await geocodeLocalSearchAddressCandidates(rawSearch, input, dependencies),
    };
  } catch {
    return { places: [] };
  }
}

async function geocodeLocalSearchAddressCandidates(
  rawSearch: unknown,
  input: { count: number },
  dependencies: {
    naverMaps: NaverMapsProxy;
  },
) {
  const places: NormalizedNaverPlace[] = [];
  const candidates = normalizeNaverLocalSearchAddressCandidates(rawSearch).slice(
    0,
    input.count,
  );

  for (const candidate of candidates) {
    const geocoded = normalizeNaverGeocodeResponse(
      await dependencies.naverMaps.geocode({
        count: 1,
        query: candidate.roadAddress ?? candidate.address,
      }),
    );
    const place = geocoded.places[0];

    if (place) {
      places.push({
        ...place,
        address: place.address || candidate.address,
        jibunAddress: place.jibunAddress ?? candidate.jibunAddress,
        name: candidate.name,
        roadAddress: place.roadAddress ?? candidate.roadAddress,
      });
    }
  }

  return places;
}

function rejectUnavailableOrLimited(
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: {
    naverMaps: NaverMapsProxy;
    rateLimiter: RateLimiter;
  },
) {
  if (!dependencies.naverMaps.isConfigured()) {
    reply.code(503).send({
      error: {
        code: "NAVER_MAPS_NOT_CONFIGURED",
        message: "Naver Maps 설정이 필요합니다.",
      },
    });
    return true;
  }

  const rateLimit = dependencies.rateLimiter.consume(`naver:${request.ip}`, {
    limit: NAVER_PROXY_RATE_LIMIT,
    windowMs: NAVER_PROXY_WINDOW_MS,
  });

  if (!rateLimit.allowed) {
    reply.header("Retry-After", String(rateLimit.retryAfterSeconds));
    reply.code(429).send({
      error: {
        code: "RATE_LIMITED",
        message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
    });
    return true;
  }

  return false;
}

function sendInvalidNaverRequest(reply: FastifyReply) {
  return reply.code(400).send({
    error: {
      code: "INVALID_NAVER_MAPS_REQUEST",
      message: "지도 요청 값을 확인해 주세요.",
    },
  });
}

async function proxyNaver(reply: FastifyReply, run: () => Promise<unknown>) {
  try {
    return await run();
  } catch {
    return reply.code(502).send({
      error: {
        code: "NAVER_MAPS_UNAVAILABLE",
        message: "Naver Maps를 잠시 사용할 수 없습니다.",
      },
    });
  }
}
