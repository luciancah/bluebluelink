import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  NAVER_PROXY_RATE_LIMIT,
  type NaverMapsProxy,
} from "../naver/naverMapsClient";
import {
  normalizeNaverDirectionsResponse,
  normalizeNaverGeocodeResponse,
  normalizeNaverReverseGeocodeResponse,
} from "../naver/naverMapsNormalizer";
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

    return proxyNaver(reply, async () =>
      normalizeNaverGeocodeResponse(await dependencies.naverMaps.geocode(parsed.data)),
    );
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
