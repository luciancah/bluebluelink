import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "./DashboardPage";

function session(overrides: Partial<Record<string, unknown>> = {}) {
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
    destinationName: null,
    destinationLat: null,
    destinationLng: null,
    hasPin: false,
    stoppedAt: null,
    createdAt: "2026-05-05T10:00:00.000Z",
    updatedAt: "2026-05-05T10:00:00.000Z",
    ...overrides,
  };
}

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardPage />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DashboardPage", () => {
  it("separates active and past location shares", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          sessions: [
            session({ id: "active_1", sessionName: "퇴근길", status: "active" }),
            session({ id: "past_1", sessionName: "어제 픽업", status: "stopped" }),
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    renderDashboard();

    expect(await screen.findByText("공유 중 (1)")).toBeTruthy();
    expect(screen.getByText("지난 공유 (1)")).toBeTruthy();
    expect(screen.getByText("퇴근길")).toBeTruthy();
    expect(screen.getByText("어제 픽업")).toBeTruthy();
  });

  it("creates a location share", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ sessions: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ session: session({ sessionName: "공항 픽업" }) }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ sessions: [session({ sessionName: "공항 픽업" })] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    renderDashboard();

    await userEvent.type(await screen.findByLabelText("공유 이름"), "공항 픽업");
    await userEvent.selectOptions(screen.getByLabelText("공유 시간"), "60");
    await userEvent.type(screen.getByLabelText("PIN 코드 (선택)"), "1234");
    await userEvent.click(screen.getByRole("button", { name: "공유 시작" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/share-sessions",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({
            sessionName: "공항 픽업",
            durationMinutes: 60,
            pinCode: "1234",
          }),
        }),
      );
    });
  });

  it("searches a Korean destination and includes it when creating a location share", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ sessions: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            places: [
              {
                address: "서울특별시 강남구 강남대로 396",
                jibunAddress: "서울특별시 강남구 역삼동 858",
                lat: 37.497952,
                lng: 127.027621,
                name: "강남역",
                roadAddress: "서울특별시 강남구 강남대로 396",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ session: session({ sessionName: "공항 픽업" }) }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ sessions: [session({ sessionName: "공항 픽업" })] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    renderDashboard();

    await userEvent.type(await screen.findByLabelText("공유 이름"), "공항 픽업");
    await userEvent.type(screen.getByLabelText("목적지"), "강남역");
    await userEvent.click(screen.getByRole("button", { name: "목적지 검색" }));
    await userEvent.click(await screen.findByRole("button", { name: /강남역/ }));
    await userEvent.click(screen.getByRole("button", { name: "공유 시작" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/share-sessions",
        expect.objectContaining({
          body: JSON.stringify({
            sessionName: "공항 픽업",
            durationMinutes: 60,
            destinationName: "강남역",
            destinationLat: 37.497952,
            destinationLng: 127.027621,
          }),
        }),
      );
    });
  });

  it("clears stale destination results when the search query changes", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ sessions: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            places: [
              {
                address: "서울특별시 강남구 강남대로 396",
                jibunAddress: null,
                lat: 37.497952,
                lng: 127.027621,
                name: "강남역",
                roadAddress: "서울특별시 강남구 강남대로 396",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    renderDashboard();

    await userEvent.type(await screen.findByLabelText("목적지"), "강남역");
    await userEvent.click(screen.getByRole("button", { name: "목적지 검색" }));
    expect(await screen.findByRole("button", { name: /강남역/ })).toBeTruthy();

    await userEvent.clear(screen.getByLabelText("목적지"));
    await userEvent.type(screen.getByLabelText("목적지"), "서울역");

    expect(screen.queryByRole("button", { name: /강남역/ })).toBeNull();
  });

  it("stops and deletes a location share", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ sessions: [session({ id: "session_1" })] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            session: session({ id: "session_1", status: "stopped" }),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            sessions: [session({ id: "session_1", status: "stopped" })],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ sessions: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderDashboard();

    await userEvent.click(await screen.findByRole("button", { name: "공유 중지" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/share-sessions/session_1/stop",
        expect.objectContaining({ method: "POST" }),
      );
    });

    await userEvent.click(await screen.findByRole("button", { name: "삭제" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/share-sessions/session_1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });
});
