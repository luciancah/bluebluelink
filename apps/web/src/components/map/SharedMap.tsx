import { Car, CircleDot, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getNaverMapsClientConfig } from "../../features/naver/naverConfig";
import { cn } from "../../lib/utils";

export type MapPoint = {
  lat: number;
  lng: number;
  label?: string;
};

export type SharedMapProps = {
  accuracyMeters?: number | null;
  className?: string;
  destination?: MapPoint | null;
  isStale?: boolean;
  route?: MapPoint[];
  vehicle?: MapPoint | null;
  viewer?: MapPoint | null;
};

const EMPTY_ROUTE: MapPoint[] = [];

type NaverMapInstance = unknown;

type NaverOverlay = {
  setMap?: (map: NaverMapInstance | null) => void;
};

type NaverMapsNamespace = {
  LatLng: new (lat: number, lng: number) => unknown;
  Map: new (
    element: HTMLElement,
    options: {
      center: unknown;
      zoom: number;
    },
  ) => NaverMapInstance;
  Marker?: new (options: {
    map: NaverMapInstance;
    position: unknown;
    title: string;
  }) => NaverOverlay;
  Polyline?: new (options: {
    map: NaverMapInstance;
    path: unknown[];
    strokeColor: string;
    strokeOpacity: number;
    strokeWeight: number;
  }) => NaverOverlay;
};

type WindowWithNaverMaps = Window &
  typeof globalThis & {
    naver?: {
      maps?: NaverMapsNamespace;
    };
  };

export function SharedMap({
  accuracyMeters,
  className,
  destination,
  isStale = false,
  route = EMPTY_ROUTE,
  vehicle,
  viewer,
}: SharedMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [naverMapsReadySignal, setNaverMapsReadySignal] = useState(0);
  const naverMapsConfig = getNaverMapsClientConfig();
  const isNaverMapActive = naverMapsConfig.enabled && Boolean(getNaverMaps());
  const provider = isNaverMapActive ? "naver" : "fallback";
  const vehicleKey = getPointKey(vehicle);
  const viewerKey = getPointKey(viewer);
  const destinationKey = getPointKey(destination);
  const routeKey = getRouteKey(route);

  useEffect(() => {
    if (!naverMapsConfig.enabled) {
      return;
    }

    const script = ensureNaverMapsScript(naverMapsConfig.clientId);

    if (getNaverMaps()) {
      return;
    }

    function handleScriptLoad() {
      setNaverMapsReadySignal((current) => current + 1);
    }

    script.addEventListener("load", handleScriptLoad);

    return () => {
      script.removeEventListener("load", handleScriptLoad);
    };
  }, [naverMapsConfig.clientId, naverMapsConfig.enabled]);

  useEffect(() => {
    const maps = getNaverMaps();

    if (!naverMapsConfig.enabled || !maps || !mapContainerRef.current) {
      return;
    }

    const center = vehicle ?? viewer ?? destination ?? { lat: 37.5665, lng: 126.978 };
    const map = new maps.Map(mapContainerRef.current, {
      center: toNaverLatLng(maps, center),
      zoom: 15,
    });
    const overlays: NaverOverlay[] = [];

    if (vehicle) {
      overlays.push(createNaverMarker(maps, map, vehicle, "차량 위치"));
    }

    if (viewer) {
      overlays.push(createNaverMarker(maps, map, viewer, viewer.label ?? "내 위치"));
    }

    if (destination) {
      overlays.push(
        createNaverMarker(
          maps,
          map,
          destination,
          `목적지: ${destination.label ?? "설정됨"}`,
        ),
      );
    }

    if (route.length > 1 && maps.Polyline) {
      overlays.push(
        new maps.Polyline({
          map,
          path: route.map((point) => toNaverLatLng(maps, point)),
          strokeColor: "#2563eb",
          strokeOpacity: 0.88,
          strokeWeight: 5,
        }),
      );
    }

    return () => {
      for (const overlay of overlays) {
        overlay.setMap?.(null);
      }
    };
  }, [
    destinationKey,
    naverMapsConfig.enabled,
    naverMapsReadySignal,
    routeKey,
    vehicleKey,
    viewerKey,
  ]);

  return (
    <section
      aria-label="지도"
      className={cn("shared-map", className)}
      data-provider={provider}
      role="region"
    >
      <div className="shared-map__surface" aria-hidden="true" ref={mapContainerRef} />
      {!isNaverMapActive ? (
        <div className="shared-map__overlay">
          {vehicle ? (
            <button
              aria-label="차량 위치"
              className="shared-map__marker shared-map__marker--vehicle"
              type="button"
            >
              <Car size={24} aria-hidden="true" />
            </button>
          ) : null}

          {viewer ? (
            <button
              aria-label={viewer.label ?? "내 위치"}
              className="shared-map__marker shared-map__marker--viewer"
              type="button"
            >
              <CircleDot size={22} aria-hidden="true" />
            </button>
          ) : null}

          {destination ? (
            <button
              aria-label={`목적지: ${destination.label ?? "설정됨"}`}
              className="shared-map__marker shared-map__marker--destination"
              type="button"
            >
              <MapPin size={24} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="shared-map__status" aria-live="polite">
        {typeof accuracyMeters === "number" ? (
          <span>정확도 {Math.round(accuracyMeters)}m</span>
        ) : null}
        {isStale ? <span>업데이트 지연</span> : null}
        {route.length > 0 ? <span>경로 {route.length}개 지점</span> : null}
      </div>
    </section>
  );
}

function createNaverMarker(
  maps: NaverMapsNamespace,
  map: NaverMapInstance,
  point: MapPoint,
  title: string,
) {
  if (!maps.Marker) {
    return {};
  }

  return new maps.Marker({
    map,
    position: toNaverLatLng(maps, point),
    title,
  });
}

function toNaverLatLng(maps: NaverMapsNamespace, point: MapPoint) {
  return new maps.LatLng(point.lat, point.lng);
}

function getNaverMaps() {
  return (window as WindowWithNaverMaps).naver?.maps;
}

function getPointKey(point: MapPoint | null | undefined) {
  if (!point) {
    return "";
  }

  return `${point.lat}:${point.lng}:${point.label ?? ""}`;
}

function getRouteKey(route: MapPoint[]) {
  return route.map(getPointKey).join("|");
}

function ensureNaverMapsScript(clientId: string) {
  const existingScript = document.querySelector<HTMLScriptElement>(
    "[data-naver-map-script]",
  );

  if (existingScript) {
    return existingScript;
  }

  const scriptUrl = new URL("https://oapi.map.naver.com/openapi/v3/maps.js");
  scriptUrl.searchParams.set("ncpKeyId", clientId);
  scriptUrl.searchParams.set("language", "ko");

  const script = document.createElement("script");
  script.async = true;
  script.dataset.naverMapScript = "true";
  script.src = scriptUrl.toString();
  document.head.append(script);
  return script;
}
