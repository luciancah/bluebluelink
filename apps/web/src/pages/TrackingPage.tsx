import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LockKeyhole, MapPin, Radio, ShieldAlert } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import {
  getPublicTrackingSession,
  type PublicTrackingSession,
  verifyTrackingPin,
} from "../features/tracking/trackingApi";
import { usePublicTrackingRealtime } from "../features/tracking/usePublicTrackingRealtime";

export function TrackingPage() {
  const { code } = useParams<{ code: string }>();
  const trackingCode = code ?? "";
  const queryClient = useQueryClient();
  const trackingQueryKey = useMemo(
    () => ["public-tracking", trackingCode] as const,
    [trackingCode],
  );
  const [pinCode, setPinCode] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const trackingQuery = useQuery({
    queryKey: trackingQueryKey,
    queryFn: () => getPublicTrackingSession(trackingCode),
    enabled: trackingCode.length > 0,
  });
  const pinMutation = useMutation({
    mutationFn: (input: string) => verifyTrackingPin(trackingCode, input),
    onSuccess: (data) => {
      queryClient.setQueryData(trackingQueryKey, data);
      setPinError(null);
    },
    onError: () => {
      setPinError("PIN 코드가 올바르지 않습니다.");
    },
  });

  const session = trackingQuery.data?.session;
  const coordinates =
    typeof session?.latitude === "number" && typeof session.longitude === "number"
      ? formatCoordinates(session.latitude, session.longitude)
      : null;
  const hasLocation = coordinates !== null;
  const isPinRequired = Boolean(trackingQuery.data?.pinRequired || session?.pinRequired);
  const realtimeStatus = usePublicTrackingRealtime({
    code: trackingCode,
    enabled:
      trackingCode.length > 0 &&
      trackingQuery.isSuccess &&
      !isPinRequired &&
      !trackingQuery.isError,
    queryKey: trackingQueryKey,
  });
  const statusCopy = getTrackingStatusCopy(session, Date.now());
  const refetchTracking = trackingQuery.refetch;

  useEffect(() => {
    if (
      trackingCode.length === 0 ||
      isPinRequired ||
      (realtimeStatus !== "unsupported" && realtimeStatus !== "fallback")
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      void refetchTracking();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [isPinRequired, realtimeStatus, refetchTracking, trackingCode]);

  function handlePinSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!/^\d{4}$/.test(pinCode)) {
      setPinError("4자리 PIN 코드를 입력해 주세요.");
      return;
    }

    pinMutation.mutate(pinCode);
  }

  return (
    <main className="live-shell">
      <header className="live-header">
        <div>
          <p className="eyebrow">공유 위치</p>
          <h1>{session?.sessionName ?? "도착 정보"}</h1>
          <p>{getTrackingDescription(trackingQuery.isLoading, trackingQuery.isError, isPinRequired)}</p>
        </div>
        {isPinRequired ? (
          <LockKeyhole className="status-icon" size={28} aria-label="PIN 보호" />
        ) : (
          <Radio className="status-icon" size={28} aria-label="공유 수신 중" />
        )}
      </header>

      {isPinRequired ? (
        <section className="tracking-summary">
          <ShieldAlert size={28} aria-hidden="true" />
          <h2>PIN 확인</h2>
          <p>공유자가 설정한 PIN 코드를 입력하면 위치를 볼 수 있습니다.</p>
          <form className="pin-form" onSubmit={handlePinSubmit}>
            <label htmlFor="tracking-pin">PIN 코드</label>
            <input
              autoComplete="one-time-code"
              id="tracking-pin"
              inputMode="numeric"
              maxLength={4}
              onChange={(event) => setPinCode(event.target.value.replace(/\D/g, ""))}
              pattern="\d{4}"
              type="password"
              value={pinCode}
            />
            {pinError ? <p className="form-error">{pinError}</p> : null}
            <Button className="primary-action" disabled={pinMutation.isPending} type="submit">
              확인
            </Button>
          </form>
        </section>
      ) : (
        <section className="map-placeholder" aria-label="지도 자리">
          {hasLocation ? (
            <div className="vehicle-marker">
              <MapPin size={28} aria-hidden="true" />
            </div>
          ) : (
            <p className="muted">위치 표시 대기 중</p>
          )}
        </section>
      )}

      <footer className="bottom-panel">
        <div>
          <p>공유 코드: {trackingCode}</p>
          <p className="muted">{statusCopy.label}</p>
        </div>
        <div className="tracking-status">
          {coordinates ? <span>{coordinates}</span> : null}
          <span>{statusCopy.detail}</span>
        </div>
      </footer>
    </main>
  );
}

function getTrackingDescription(
  isLoading: boolean,
  isError: boolean,
  isPinRequired: boolean,
) {
  if (isLoading) {
    return "공유 정보를 불러오는 중입니다.";
  }

  if (isError) {
    return "공유 링크를 찾을 수 없습니다.";
  }

  if (isPinRequired) {
    return "보호된 공유 링크입니다.";
  }

  return "실시간 위치 업데이트를 확인하고 있습니다.";
}

function getTrackingStatusCopy(session: PublicTrackingSession | undefined, now: number) {
  if (!session) {
    return {
      label: "위치 공유를 준비 중입니다.",
      detail: "마지막 업데이트를 기다리는 중",
    };
  }

  if (session.status === "stopped") {
    return {
      label: "공유가 중지되었습니다.",
      detail: "아직 위치가 없습니다.",
    };
  }

  if (session.status === "expired") {
    return {
      label: "공유가 만료되었습니다.",
      detail: "아직 위치가 없습니다.",
    };
  }

  if (typeof session.latitude !== "number" || typeof session.longitude !== "number") {
    return {
      label: "위치 업데이트 대기 중",
      detail: "아직 위치가 없습니다.",
    };
  }

  const capturedAt = session.lastUpdatedLocation
    ? Date.parse(session.lastUpdatedLocation)
    : Number.NaN;

  if (Number.isNaN(capturedAt) || now - capturedAt > 60_000) {
    return {
      label: "업데이트 지연",
      detail: session.destinationName ?? "차량 위치",
    };
  }

  return {
    label: "방금 업데이트됨",
    detail: session.destinationName ?? "차량 위치",
  };
}

function formatCoordinates(latitude: number, longitude: number) {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}
