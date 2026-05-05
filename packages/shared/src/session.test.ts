import { describe, expect, it } from "vitest";
import {
  getSessionAvailability,
  isLocationStale,
  shareSessionSchema,
} from "./session";

describe("share session domain", () => {
  it("marks expired sessions unavailable", () => {
    const result = getSessionAvailability({
      status: "active",
      expiresAt: "2026-05-05T09:00:00.000Z",
      now: new Date("2026-05-05T10:00:00.000Z"),
    });

    expect(result).toEqual({ available: false, reason: "expired" });
  });

  it("marks stopped sessions unavailable", () => {
    const result = getSessionAvailability({
      status: "stopped",
      expiresAt: "2026-05-05T11:00:00.000Z",
      now: new Date("2026-05-05T10:00:00.000Z"),
    });

    expect(result).toEqual({ available: false, reason: "stopped" });
  });

  it("accepts active unexpired sessions", () => {
    const result = getSessionAvailability({
      status: "active",
      expiresAt: "2026-05-05T11:00:00.000Z",
      now: new Date("2026-05-05T10:00:00.000Z"),
    });

    expect(result).toEqual({ available: true, reason: null });
  });

  it("marks old location updates stale", () => {
    expect(
      isLocationStale({
        lastUpdatedLocation: "2026-05-05T09:59:00.000Z",
        now: new Date("2026-05-05T10:00:10.000Z"),
        staleAfterSeconds: 30,
      }),
    ).toBe(true);
  });

  it("validates public share session shape", () => {
    expect(() =>
      shareSessionSchema.parse({
        id: "session_1",
        sessionCode: "AB12CD34",
        sessionName: "퇴근길",
        status: "active",
        expiresAt: "2026-05-05T11:00:00.000Z",
        lastUpdatedLocation: null,
        latitude: null,
        longitude: null,
        accuracyMeters: null,
        destinationName: null,
        destinationLat: null,
        destinationLng: null,
      }),
    ).not.toThrow();
  });
});
