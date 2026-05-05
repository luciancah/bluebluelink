import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
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
