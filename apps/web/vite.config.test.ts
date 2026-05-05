import { describe, expect, it } from "vitest";
import config from "./vite.config";

describe("Vite development server", () => {
  it("proxies API calls to the local API server", () => {
    expect(config.server?.proxy?.["/api"]).toMatchObject({
      changeOrigin: true,
      target: "http://127.0.0.1:4000",
    });
  });
});
