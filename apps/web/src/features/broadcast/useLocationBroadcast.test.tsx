import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLocationBroadcast } from "./useLocationBroadcast";

type PositionSuccess = PositionCallback;
type PositionError = PositionErrorCallback;

function createPosition({
  latitude = 37.3898,
  longitude = 126.95278,
  accuracy = 18,
  timestamp = Date.parse("2026-05-05T10:00:00.000Z"),
}: {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  timestamp?: number;
} = {}): GeolocationPosition {
  return {
    coords: {
      latitude,
      longitude,
      accuracy,
    } as GeolocationCoordinates,
    timestamp,
    toJSON() {
      return this;
    },
  };
}

function mockSecureContext(value: boolean) {
  Object.defineProperty(window, "isSecureContext", {
    configurable: true,
    value,
  });
}

function mockOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    get: () => value,
  });
}

function mockGeolocation({
  success,
  error,
}: {
  success?: GeolocationPosition;
  error?: GeolocationPositionError;
}) {
  const watchPosition = vi.fn((onSuccess: PositionSuccess, onError: PositionError) => {
    if (success) {
      onSuccess(success);
    }

    if (error) {
      onError(error);
    }

    return 7;
  });
  const clearWatch = vi.fn();

  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      watchPosition,
      clearWatch,
    },
  });

  return { watchPosition, clearWatch };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useLocationBroadcast", () => {
  it("keeps an untouched sender idle during React StrictMode mount checks", () => {
    render(
      <StrictMode>
        <BroadcastStatusProbe />
      </StrictMode>,
    );

    expect(screen.getByText("idle")).toBeTruthy();
  });

  it("marks insecure contexts unavailable before watching GPS", async () => {
    mockSecureContext(false);
    const { result } = renderHook(() => useLocationBroadcast("session_1"));

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("insecure");
  });

  it("sends captured GPS updates to the API", async () => {
    mockSecureContext(true);
    const wakeLockRequest = vi.fn().mockResolvedValue({ release: vi.fn() });
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: {
        request: wakeLockRequest,
      },
    });
    mockGeolocation({
      success: {
        coords: {
          latitude: 37.3898,
          longitude: 126.95278,
          accuracy: 18,
        } as GeolocationCoordinates,
        timestamp: Date.parse("2026-05-05T10:00:00.000Z"),
        toJSON() {
          return this;
        },
      },
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ session: { id: "session_1" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const { result } = renderHook(() => useLocationBroadcast("session_1"));

    await act(async () => {
      await result.current.start();
    });

    await waitFor(() => {
      expect(result.current.status).toBe("sent");
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/share-sessions/session_1/location",
      expect.objectContaining({
        method: "PATCH",
        credentials: "include",
        body: JSON.stringify({
          latitude: 37.3898,
          longitude: 126.95278,
          accuracyMeters: 18,
          capturedAt: "2026-05-05T10:00:00.000Z",
        }),
      }),
    );
    expect(wakeLockRequest).toHaveBeenCalledWith("screen");
  });

  it("reports permission denial", async () => {
    mockSecureContext(true);
    mockGeolocation({
      error: {
        code: 1,
        message: "denied",
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      } as GeolocationPositionError,
    });
    const { result } = renderHook(() => useLocationBroadcast("session_1"));

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("denied");
  });

  it("resends the latest GPS point while the app remains active", async () => {
    vi.useFakeTimers();
    mockSecureContext(true);
    mockOnline(true);
    mockGeolocation({
      success: {
        coords: {
          latitude: 37.3898,
          longitude: 126.95278,
          accuracy: 18,
        } as GeolocationCoordinates,
        timestamp: Date.parse("2026-05-05T10:00:00.000Z"),
        toJSON() {
          return this;
        },
      },
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ session: { id: "session_1" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const { result } = renderHook(() => useLocationBroadcast("session_1"));

    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.status).toBe("sent");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throttles noisy GPS callbacks to the foreground resend cadence", async () => {
    vi.useFakeTimers();
    mockSecureContext(true);
    mockOnline(true);
    let sendGpsUpdate: PositionSuccess | undefined;
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        watchPosition: vi.fn((onSuccess: PositionSuccess) => {
          sendGpsUpdate = onSuccess;
          return 7;
        }),
        clearWatch: vi.fn(),
      },
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ session: { id: "session_1" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const { result } = renderHook(() => useLocationBroadcast("session_1"));

    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      sendGpsUpdate?.(createPosition({ latitude: 37.3898 }));
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      sendGpsUpdate?.(createPosition({ latitude: 37.4901 }));
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/share-sessions/session_1/location",
      expect.objectContaining({
        body: expect.stringContaining("\"latitude\":37.4901"),
      }),
    );
  });

  it("retries the latest GPS point when the app comes back online", async () => {
    let isOnline = false;
    mockSecureContext(true);
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      get: () => isOnline,
    });
    mockGeolocation({
      success: {
        coords: {
          latitude: 37.3898,
          longitude: 126.95278,
          accuracy: 18,
        } as GeolocationCoordinates,
        timestamp: Date.parse("2026-05-05T10:00:00.000Z"),
        toJSON() {
          return this;
        },
      },
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ session: { id: "session_1" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const { result } = renderHook(() => useLocationBroadcast("session_1"));

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("delayed");
    expect(fetchMock).not.toHaveBeenCalled();

    isOnline = true;
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => {
      expect(result.current.status).toBe("sent");
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("marks backgrounded broadcasts and refreshes when visible again", async () => {
    let visibilityState: DocumentVisibilityState = "visible";
    mockSecureContext(true);
    mockOnline(true);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibilityState,
    });
    mockGeolocation({
      success: {
        coords: {
          latitude: 37.3898,
          longitude: 126.95278,
          accuracy: 18,
        } as GeolocationCoordinates,
        timestamp: Date.parse("2026-05-05T10:00:00.000Z"),
        toJSON() {
          return this;
        },
      },
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ session: { id: "session_1" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const { result } = renderHook(() => useLocationBroadcast("session_1"));

    await act(async () => {
      await result.current.start();
    });
    await waitFor(() => {
      expect(result.current.status).toBe("sent");
    });

    visibilityState = "hidden";
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current.status).toBe("background");

    visibilityState = "visible";
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(result.current.status).toBe("sent");
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

function BroadcastStatusProbe() {
  const broadcast = useLocationBroadcast("session_1");

  return <p>{broadcast.status}</p>;
}
