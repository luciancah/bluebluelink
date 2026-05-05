import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthGate } from "./AuthGate";

function renderWithQuery(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AuthGate", () => {
  it("renders protected content when current user exists", async () => {
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

    renderWithQuery(
      <AuthGate>
        <h1>내 위치 공유</h1>
      </AuthGate>,
    );

    expect(await screen.findByRole("heading", { name: "내 위치 공유" })).toBeTruthy();
  });

  it("renders the login form when current user is missing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: "AUTH_REQUIRED" } }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderWithQuery(
      <AuthGate>
        <h1>내 위치 공유</h1>
      </AuthGate>,
    );

    expect(await screen.findByRole("heading", { name: "로그인" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "내 위치 공유" })).toBeNull();
  });

  it("submits credentials and refreshes the current user", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: "AUTH_REQUIRED" } }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: {
              id: "user_1",
              email: "driver@example.com",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
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

    renderWithQuery(
      <AuthGate>
        <h1>내 위치 공유</h1>
      </AuthGate>,
    );

    await userEvent.type(await screen.findByLabelText("이메일"), "driver@example.com");
    await userEvent.type(screen.getByLabelText("비밀번호"), "ride-home");
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/login",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
        }),
      );
    });
    expect(await screen.findByRole("heading", { name: "내 위치 공유" })).toBeTruthy();
  });
});
