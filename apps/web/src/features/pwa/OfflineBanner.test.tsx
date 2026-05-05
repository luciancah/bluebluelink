import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OfflineBanner } from "./OfflineBanner";

function setOnlineStatus(isOnline: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    get: () => isOnline,
  });
}

afterEach(() => {
  setOnlineStatus(true);
});

describe("OfflineBanner", () => {
  it("stays hidden while the app is online", () => {
    setOnlineStatus(true);

    render(<OfflineBanner />);

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("makes offline limits explicit without promising live GPS", () => {
    setOnlineStatus(false);

    render(<OfflineBanner />);

    const banner = screen.getByRole("status");
    expect(banner.textContent).toContain("오프라인입니다");
    expect(banner.textContent).toContain("실시간 위치와 경로");
    expect(banner.textContent).toContain("연결되면 다시 업데이트됩니다");
  });
});
