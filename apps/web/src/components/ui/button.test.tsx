import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("renders a shadcn-style button with merged classes", () => {
    render(<Button className="tracking-wide">친구에게 공유</Button>);

    const button = screen.getByRole("button", { name: "친구에게 공유" });
    expect(button.className).toContain("tracking-wide");
    expect(button.className).toContain("inline-flex");
  });
});
