import { describe, expect, it, vi } from "vitest";
import { registerServiceWorker } from "./registerServiceWorker";

describe("registerServiceWorker", () => {
  it("registers the root service worker after window load when enabled", async () => {
    const loadHandlers: EventListener[] = [];
    const register = vi.fn().mockResolvedValue(undefined);
    const win = {
      addEventListener: vi.fn((type: string, handler: EventListener) => {
        if (type === "load") {
          loadHandlers.push(handler);
        }
      }),
    };

    registerServiceWorker({
      enabled: true,
      serviceWorker: { register },
      win,
    });

    expect(register).not.toHaveBeenCalled();
    expect(loadHandlers).toHaveLength(1);
    loadHandlers[0](new Event("load"));
    await Promise.resolve();

    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });

  it("does nothing when disabled or unsupported", () => {
    const register = vi.fn();

    registerServiceWorker({
      enabled: false,
      serviceWorker: { register },
      win: { addEventListener: vi.fn() },
    });
    registerServiceWorker({
      enabled: true,
      serviceWorker: undefined,
      win: { addEventListener: vi.fn() },
    });

    expect(register).not.toHaveBeenCalled();
  });
});
