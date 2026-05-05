import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { routes } from "./router";

function renderPath(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  const router = createMemoryRouter(routes, {
    initialEntries: [path],
  });

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BlueBlueLink routes", () => {
  it("renders the owner dashboard shell", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user: {
            id: "user_1",
            email: "driver@example.com",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    renderPath("/");

    expect(await screen.findByRole("heading", { name: "내 위치 공유" })).toBeTruthy();
  });

  it("renders the sender broadcast shell", () => {
    renderPath("/broadcast/demo-session");

    expect(screen.getByRole("heading", { name: "위치 공유 중" })).toBeTruthy();
    expect(screen.getByText("공유 ID: demo-session")).toBeTruthy();
  });

  it("renders the public tracking shell", () => {
    renderPath("/track/AB12CD34");

    expect(screen.getByRole("heading", { name: "도착 정보" })).toBeTruthy();
    expect(screen.getByText("공유 코드: AB12CD34")).toBeTruthy();
  });
});
