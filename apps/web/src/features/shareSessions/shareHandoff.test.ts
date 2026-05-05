import { describe, expect, it } from "vitest";
import { buildShareHandoff } from "./shareHandoff";
import type { OwnerShareSession } from "./shareSessionsApi";

function session(overrides: Partial<OwnerShareSession> = {}): OwnerShareSession {
  return {
    id: "session_1",
    sessionCode: "AB12CD34",
    sessionName: "퇴근길",
    status: "active",
    expiresAt: "2026-05-05T11:00:00.000Z",
    lastUpdatedLocation: null,
    latitude: null,
    longitude: null,
    accuracyMeters: null,
    destinationName: "강남역",
    destinationLat: 37.497952,
    destinationLng: 127.027621,
    hasPin: false,
    stoppedAt: null,
    createdAt: "2026-05-05T10:00:00.000Z",
    updatedAt: "2026-05-05T10:00:00.000Z",
    ...overrides,
  };
}

describe("buildShareHandoff", () => {
  it("builds a Korean share message with destination, time window, and tracking link", () => {
    const handoff = buildShareHandoff({
      session: session(),
      origin: "https://bluebluelink.test",
      now: new Date("2026-05-05T10:00:00.000Z"),
    });

    expect(handoff.trackingUrl).toBe("https://bluebluelink.test/track/AB12CD34");
    expect(handoff.title).toBe("진형링크 위치 공유");
    expect(handoff.message).toContain("퇴근길");
    expect(handoff.message).toContain("목적지: 강남역");
    expect(handoff.message).toContain("도착 전까지 실시간 위치를 확인해 주세요.");
    expect(handoff.message).toContain("공유 시간: 약 1시간 남음");
    expect(handoff.message).toContain("https://bluebluelink.test/track/AB12CD34");
  });

  it("builds an sms handoff URL from the full message", () => {
    const handoff = buildShareHandoff({
      session: session({ destinationName: null }),
      origin: "https://bluebluelink.test",
      now: new Date("2026-05-05T10:45:00.000Z"),
    });

    expect(handoff.message).not.toContain("목적지:");
    expect(handoff.message).toContain("공유 시간: 약 15분 남음");
    expect(decodeURIComponent(handoff.smsHref)).toContain(handoff.message);
    expect(handoff.smsHref).toMatch(/^sms:\?&body=/);
  });
});
