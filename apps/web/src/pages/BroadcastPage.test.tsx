import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BroadcastPage } from "./BroadcastPage";

afterEach(() => {
  vi.restoreAllMocks();
});

function renderBroadcastPage() {
  const router = createMemoryRouter(
    [
      {
        path: "/broadcast/:id",
        element: <BroadcastPage />,
      },
    ],
    {
      initialEntries: ["/broadcast/session_1"],
    },
  );

  render(<RouterProvider router={router} />);
}

describe("BroadcastPage", () => {
  it("starts GPS broadcasting from the sender page", async () => {
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        watchPosition: vi.fn((onSuccess: PositionCallback) => {
          onSuccess({
            coords: {
              latitude: 37.3898,
              longitude: 126.95278,
              accuracy: 18,
            } as GeolocationCoordinates,
            timestamp: Date.parse("2026-05-05T10:00:00.000Z"),
            toJSON() {
              return this;
            },
          });
          return 1;
        }),
        clearWatch: vi.fn(),
      },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ session: { id: "session_1" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderBroadcastPage();

    await userEvent.click(screen.getByRole("button", { name: "위치 전송 시작" }));

    await waitFor(() => {
      expect(screen.getByText("방금 전송됨")).toBeTruthy();
    });
  });
});
