import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { routes } from "./router";

function renderPath(path: string) {
  const router = createMemoryRouter(routes, {
    initialEntries: [path],
  });

  render(<RouterProvider router={router} />);
}

describe("BlueBlueLink routes", () => {
  it("renders the owner dashboard shell", () => {
    renderPath("/");

    expect(screen.getByRole("heading", { name: "내 위치 공유" })).toBeTruthy();
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
