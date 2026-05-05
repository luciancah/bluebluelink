import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getNaverMapsClientConfig } from "../../features/naver/naverConfig";
import { SharedMap } from "./SharedMap";

vi.mock("../../features/naver/naverConfig", () => ({
  getNaverMapsClientConfig: vi.fn(() => ({ clientId: "", enabled: false })),
}));

const getNaverMapsClientConfigMock = vi.mocked(getNaverMapsClientConfig);

afterEach(() => {
  getNaverMapsClientConfigMock.mockReturnValue({ clientId: "", enabled: false });
  document.querySelectorAll("[data-naver-map-script]").forEach((script) => script.remove());
  vi.unstubAllGlobals();
});

describe("SharedMap", () => {
  it("renders shared tracking markers from provider-neutral props", () => {
    render(
      <SharedMap
        accuracyMeters={18}
        destination={{ lat: 37.4979, lng: 127.0276, label: "강남역" }}
        isStale={true}
        route={[
          { lat: 37.3898, lng: 126.95278 },
          { lat: 37.4979, lng: 127.0276 },
        ]}
        vehicle={{ lat: 37.3898, lng: 126.95278 }}
        viewer={{ lat: 37.39, lng: 126.953, label: "내 위치" }}
      />,
    );

    expect(screen.getByRole("region", { name: "지도" }).getAttribute("data-provider")).toBe(
      "fallback",
    );
    expect(screen.getByLabelText("차량 위치")).toBeTruthy();
    expect(screen.getByLabelText("내 위치")).toBeTruthy();
    expect(screen.getByLabelText("목적지: 강남역")).toBeTruthy();
    expect(screen.getByText("정확도 18m")).toBeTruthy();
    expect(screen.getByText("업데이트 지연")).toBeTruthy();
    expect(screen.getByText("경로 2개 지점")).toBeTruthy();
  });

  it("loads the Naver Maps JavaScript SDK with Korean labels while keeping the fallback map during load", () => {
    getNaverMapsClientConfigMock.mockReturnValue({
      clientId: "browser-key",
      enabled: true,
    });

    render(<SharedMap vehicle={{ lat: 37.3898, lng: 126.95278 }} />);

    const mapRegion = screen.getByRole("region", { name: "지도" });
    const script = document.querySelector<HTMLScriptElement>("[data-naver-map-script]");
    const scriptUrl = new URL(script?.src ?? "");

    expect(mapRegion.getAttribute("data-provider")).toBe("fallback");
    expect(scriptUrl.origin).toBe("https://oapi.map.naver.com");
    expect(scriptUrl.pathname).toBe("/openapi/v3/maps.js");
    expect(scriptUrl.searchParams.get("ncpKeyId")).toBe("browser-key");
    expect(scriptUrl.searchParams.get("language")).toBe("ko");
    expect(script?.async).toBe(true);
  });

  it("creates Naver map overlays without exposing SDK objects to callers", () => {
    getNaverMapsClientConfigMock.mockReturnValue({
      clientId: "browser-key",
      enabled: true,
    });
    const LatLng = vi.fn(function (
      this: { lat: number; lng: number },
      lat: number,
      lng: number,
    ) {
      this.lat = lat;
      this.lng = lng;
    });
    const Map = vi.fn();
    const Marker = vi.fn();
    const Polyline = vi.fn();

    vi.stubGlobal("naver", {
      maps: {
        LatLng,
        Map,
        Marker,
        Polyline,
      },
    });

    render(
      <SharedMap
        destination={{ lat: 37.4979, lng: 127.0276, label: "강남역" }}
        route={[
          { lat: 37.3898, lng: 126.95278 },
          { lat: 37.4979, lng: 127.0276 },
        ]}
        vehicle={{ lat: 37.3898, lng: 126.95278 }}
        viewer={{ lat: 37.39, lng: 126.953 }}
      />,
    );

    expect(Map).toHaveBeenCalledTimes(1);
    expect(Map).toHaveBeenCalledWith(expect.any(HTMLDivElement), {
      center: expect.objectContaining({ lat: 37.3898, lng: 126.95278 }),
      zoom: 15,
    });
    expect(Marker).toHaveBeenCalledTimes(3);
    expect(Marker).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "차량 위치",
        position: expect.objectContaining({ lat: 37.3898, lng: 126.95278 }),
      }),
    );
    expect(Polyline).toHaveBeenCalledWith(
      expect.objectContaining({
        path: [
          expect.objectContaining({ lat: 37.3898, lng: 126.95278 }),
          expect.objectContaining({ lat: 37.4979, lng: 127.0276 }),
        ],
        strokeColor: "#2563eb",
      }),
    );
  });

  it("does not render fallback marker controls over an active Naver map", () => {
    getNaverMapsClientConfigMock.mockReturnValue({
      clientId: "browser-key",
      enabled: true,
    });
    vi.stubGlobal("naver", {
      maps: createNaverMapsMock(),
    });

    render(
      <SharedMap
        destination={{ lat: 37.4979, lng: 127.0276, label: "강남역" }}
        vehicle={{ lat: 37.3898, lng: 126.95278 }}
      />,
    );

    expect(screen.getByRole("region", { name: "지도" }).getAttribute("data-provider")).toBe(
      "naver",
    );
    expect(screen.queryByLabelText("차량 위치")).toBeNull();
    expect(screen.queryByLabelText("목적지: 강남역")).toBeNull();
  });

  it("keeps the active Naver map instance when equal coordinate props rerender", () => {
    getNaverMapsClientConfigMock.mockReturnValue({
      clientId: "browser-key",
      enabled: true,
    });
    const maps = createNaverMapsMock();
    vi.stubGlobal("naver", {
      maps,
    });

    const { rerender } = render(
      <SharedMap
        route={[
          { lat: 37.3898, lng: 126.95278 },
          { lat: 37.4979, lng: 127.0276 },
        ]}
        vehicle={{ lat: 37.3898, lng: 126.95278 }}
      />,
    );

    rerender(
      <SharedMap
        route={[
          { lat: 37.3898, lng: 126.95278 },
          { lat: 37.4979, lng: 127.0276 },
        ]}
        vehicle={{ lat: 37.3898, lng: 126.95278 }}
      />,
    );

    expect(maps.Map).toHaveBeenCalledTimes(1);
  });

  it("creates the Naver map after the SDK script finishes loading", async () => {
    getNaverMapsClientConfigMock.mockReturnValue({
      clientId: "browser-key",
      enabled: true,
    });
    const LatLng = vi.fn(function (
      this: { lat: number; lng: number },
      lat: number,
      lng: number,
    ) {
      this.lat = lat;
      this.lng = lng;
    });
    const Map = vi.fn();

    render(<SharedMap vehicle={{ lat: 37.3898, lng: 126.95278 }} />);

    vi.stubGlobal("naver", {
      maps: {
        LatLng,
        Map,
      },
    });
    await act(async () => {
      document
        .querySelector<HTMLScriptElement>("[data-naver-map-script]")
        ?.dispatchEvent(new Event("load"));
    });

    await waitFor(() => {
      expect(Map).toHaveBeenCalledTimes(1);
    });
  });
});

function createNaverMapsMock() {
  const LatLng = vi.fn(function (
    this: { lat: number; lng: number },
    lat: number,
    lng: number,
  ) {
    this.lat = lat;
    this.lng = lng;
  });

  return {
    LatLng,
    Map: vi.fn(),
    Marker: vi.fn(),
    Polyline: vi.fn(),
  };
}
