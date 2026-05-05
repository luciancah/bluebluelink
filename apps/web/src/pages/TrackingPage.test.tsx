import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TrackingPage } from "./TrackingPage";

function trackingSession(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    sessionCode: "AB12CD34",
    sessionName: "퇴근길",
    status: "active",
    expiresAt: "2026-05-05T11:00:00.000Z",
    lastUpdatedLocation: new Date().toISOString(),
    latitude: 37.3898,
    longitude: 126.95278,
    accuracyMeters: 18,
    destinationName: null,
    destinationLat: null,
    destinationLng: null,
    pinRequired: false,
    ...overrides,
  };
}

function renderTrackingPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  const router = createMemoryRouter(
    [
      {
        path: "/track/:code",
        element: <TrackingPage />,
      },
    ],
    {
      initialEntries: ["/track/AB12CD34"],
    },
  );

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("TrackingPage", () => {
  it("renders public tracking details", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ session: trackingSession() }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderTrackingPage();

    expect(await screen.findByRole("heading", { name: "퇴근길" })).toBeTruthy();
    expect(screen.getByText("37.389800, 126.952780")).toBeTruthy();
    expect(screen.getByText("방금 업데이트됨")).toBeTruthy();
  });

  it("shows a PIN gate and unlocks tracking with the correct PIN", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            pinRequired: true,
            session: trackingSession({
              latitude: undefined,
              longitude: undefined,
              pinRequired: true,
            }),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ session: trackingSession() }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    renderTrackingPage();

    await userEvent.type(await screen.findByLabelText("PIN 코드"), "1234");
    await userEvent.click(screen.getByRole("button", { name: "확인" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/public/share-sessions/AB12CD34/verify-pin",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ pinCode: "1234" }),
        }),
      );
    });
    expect(await screen.findByText("37.389800, 126.952780")).toBeTruthy();
  });

  it("opens a realtime stream and applies location events", async () => {
    const EventSourceMock = installEventSourceMock();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ session: trackingSession() }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderTrackingPage();

    expect(await screen.findByRole("heading", { name: "퇴근길" })).toBeTruthy();
    await waitFor(() => {
      expect(EventSourceMock.instances[0]?.url).toBe(
        "/api/public/share-sessions/AB12CD34/events",
      );
    });

    act(() => {
      EventSourceMock.instances[0].emit("location", {
        session: trackingSession({
          latitude: 37.5,
          longitude: 127,
          lastUpdatedLocation: new Date().toISOString(),
        }),
      });
    });

    expect(await screen.findByText("37.500000, 127.000000")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses fallback refresh while the realtime stream reconnects", async () => {
    const EventSourceMock = installEventSourceMock();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ session: trackingSession() }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            session: trackingSession({
              latitude: 37.5,
              longitude: 127,
              lastUpdatedLocation: new Date().toISOString(),
            }),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    renderTrackingPage();

    expect(await screen.findByText("37.389800, 126.952780")).toBeTruthy();
    act(() => {
      EventSourceMock.instances[0].emitOpen();
      EventSourceMock.instances[0].emitError();
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText("37.500000, 127.000000")).toBeTruthy();
    expect(EventSourceMock.instances[0].close).not.toHaveBeenCalled();

    act(() => {
      EventSourceMock.instances[0].emitOpen();
      EventSourceMock.instances[0].emit("location", {
        session: trackingSession({
          latitude: 37.6,
          longitude: 127.1,
          lastUpdatedLocation: new Date().toISOString(),
        }),
      });
    });
    expect(await screen.findByText("37.600000, 127.100000")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not open a realtime stream while the PIN gate is locked", async () => {
    const EventSourceMock = installEventSourceMock();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          pinRequired: true,
          session: trackingSession({
            latitude: undefined,
            longitude: undefined,
            pinRequired: true,
          }),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    renderTrackingPage();

    expect(await screen.findByLabelText("PIN 코드")).toBeTruthy();
    expect(EventSourceMock.instances).toHaveLength(0);
  });

  it("shows an invalid PIN state in Korean", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            pinRequired: true,
            session: trackingSession({
              latitude: undefined,
              longitude: undefined,
              pinRequired: true,
            }),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: "INVALID_PIN" } }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      );

    renderTrackingPage();

    await userEvent.type(await screen.findByLabelText("PIN 코드"), "9999");
    await userEvent.click(screen.getByRole("button", { name: "확인" }));

    expect(await screen.findByText("PIN 코드가 올바르지 않습니다.")).toBeTruthy();
  });

  it("shows stopped and no-location states", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          session: trackingSession({
            status: "stopped",
            latitude: null,
            longitude: null,
            lastUpdatedLocation: null,
          }),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    renderTrackingPage();

    expect(await screen.findByText("공유가 중지되었습니다.")).toBeTruthy();
    expect(screen.getByText("아직 위치가 없습니다.")).toBeTruthy();
  });

  it("shows stale update state before raw coordinates", async () => {
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-05-05T10:05:00.000Z").getTime());
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          session: trackingSession({
            lastUpdatedLocation: "2026-05-05T10:00:00.000Z",
          }),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    renderTrackingPage();

    const staleCopy = await screen.findByText("업데이트 지연");
    const coordinates = screen.getByText("37.389800, 126.952780");
    expect(staleCopy.compareDocumentPosition(coordinates)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});

class MockEventSource {
  static instances: MockEventSource[] = [];

  readonly close = vi.fn();
  readonly listeners = new Map<string, Set<(event: MessageEvent<string>) => void>>();
  onerror: (() => void) | null = null;
  onopen: (() => void) | null = null;

  constructor(readonly url: string) {
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add((event) => {
      if (typeof listener === "function") {
        listener(event);
        return;
      }

      listener.handleEvent(event);
    });
    this.listeners.set(type, listeners);
  }

  emit(type: string, data: unknown) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ data: JSON.stringify(data) } as MessageEvent<string>);
    }
  }

  emitError() {
    this.onerror?.();
  }

  emitOpen() {
    this.onopen?.();
  }
}

function installEventSourceMock() {
  MockEventSource.instances = [];
  vi.stubGlobal("EventSource", MockEventSource);
  return MockEventSource;
}
