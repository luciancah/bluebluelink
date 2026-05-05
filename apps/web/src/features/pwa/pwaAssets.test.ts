import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readPublicFile(path: string) {
  return readFileSync(resolve(process.cwd(), "public", path), "utf8");
}

describe("PWA assets", () => {
  it("defines an installable Korean app manifest", () => {
    const manifest = JSON.parse(readPublicFile("manifest.webmanifest")) as {
      name?: string;
      short_name?: string;
      lang?: string;
      start_url?: string;
      scope?: string;
      display?: string;
      theme_color?: string;
      background_color?: string;
      icons?: Array<{ src: string; sizes: string; type: string; purpose?: string }>;
    };

    expect(manifest.name).toBe("진형링크 - 실시간 위치 공유");
    expect(manifest.short_name).toBe("진형링크");
    expect(manifest.lang).toBe("ko");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toBe("#2563eb");
    expect(manifest.background_color).toBe("#f8fafc");
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sizes: "192x192",
          src: "/icons/icon-192.png",
          type: "image/png",
        }),
        expect.objectContaining({
          sizes: "512x512",
          src: "/icons/icon-512.png",
          type: "image/png",
        }),
        expect.objectContaining({
          purpose: "any maskable",
          sizes: "512x512",
          src: "/icons/maskable-icon-512.png",
          type: "image/png",
        }),
      ]),
    );
  });

  it("caches a truthful offline app shell", () => {
    const serviceWorker = readPublicFile("sw.js");
    const offlinePage = readPublicFile("offline.html");

    expect(serviceWorker).toContain("self.addEventListener(\"install\"");
    expect(serviceWorker).toContain("self.addEventListener(\"fetch\"");
    expect(serviceWorker).toContain("\"/offline.html\"");
    expect(serviceWorker).toContain("\"/manifest.webmanifest\"");
    expect(serviceWorker).toContain("\"/icons/icon-192.png\"");
    expect(serviceWorker).toContain("request.mode === \"navigate\"");
    expect(offlinePage).toContain("오프라인");
    expect(offlinePage).toContain("실시간 위치");
    expect(offlinePage).toContain("경로");
  });
});
