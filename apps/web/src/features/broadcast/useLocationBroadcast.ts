import { useCallback, useEffect, useRef, useState } from "react";

export type BroadcastStatus =
  | "idle"
  | "gps-checking"
  | "sending"
  | "sent"
  | "delayed"
  | "background"
  | "denied"
  | "unavailable"
  | "insecure"
  | "stopped";

type WakeLockSentinel = {
  release: () => Promise<void>;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinel>;
  };
};

const LOCATION_RESEND_INTERVAL_MS = 15_000;

export function useLocationBroadcast(sessionId: string | undefined) {
  const [status, setStatus] = useState<BroadcastStatus>("idle");
  const watchIdRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const activeRef = useRef(false);
  const latestPositionRef = useRef<GeolocationPosition | null>(null);
  const lastUploadAttemptedAtRef = useRef<number | null>(null);
  const resendTimerRef = useRef<number | null>(null);

  const releaseWakeLock = useCallback(async () => {
    if (!wakeLockRef.current) {
      return;
    }

    await Promise.resolve(wakeLockRef.current.release()).catch(() => undefined);
    wakeLockRef.current = null;
  }, []);

  const requestWakeLock = useCallback(async () => {
    try {
      wakeLockRef.current =
        (await (navigator as NavigatorWithWakeLock).wakeLock?.request("screen")) ?? null;
    } catch {
      wakeLockRef.current = null;
    }
  }, []);

  const clearResendTimer = useCallback(() => {
    if (resendTimerRef.current === null) {
      return;
    }

    window.clearInterval(resendTimerRef.current);
    resendTimerRef.current = null;
  }, []);

  const stop = useCallback(async ({ markStopped = true } = {}) => {
    const hadActiveBroadcast =
      activeRef.current ||
      watchIdRef.current !== null ||
      wakeLockRef.current !== null ||
      resendTimerRef.current !== null;

    activeRef.current = false;
    latestPositionRef.current = null;
    lastUploadAttemptedAtRef.current = null;
    clearResendTimer();

    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    await releaseWakeLock();

    if (markStopped || hadActiveBroadcast) {
      setStatus("stopped");
    }
  }, [clearResendTimer, releaseWakeLock]);

  const sendPosition = useCallback(
    async (position: GeolocationPosition) => {
      if (!sessionId || !activeRef.current) {
        return;
      }

      if (document.visibilityState === "hidden") {
        setStatus("background");
        return;
      }

      if (navigator.onLine === false) {
        setStatus("delayed");
        return;
      }

      setStatus("sending");
      lastUploadAttemptedAtRef.current = Date.now();

      try {
        const response = await fetch(`/api/share-sessions/${sessionId}/location`, {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
            capturedAt: new Date(position.timestamp).toISOString(),
          }),
        });

        if (activeRef.current) {
          setStatus(response.ok ? "sent" : "delayed");
        }
      } catch {
        if (activeRef.current) {
          setStatus("delayed");
        }
      }
    },
    [sessionId],
  );

  const startResendTimer = useCallback(() => {
    if (resendTimerRef.current !== null) {
      return;
    }

    resendTimerRef.current = window.setInterval(() => {
      if (!activeRef.current || !latestPositionRef.current) {
        return;
      }

      if (
        lastUploadAttemptedAtRef.current !== null &&
        Date.now() - lastUploadAttemptedAtRef.current < LOCATION_RESEND_INTERVAL_MS
      ) {
        return;
      }

      void sendPosition(latestPositionRef.current);
    }, LOCATION_RESEND_INTERVAL_MS);
  }, [sendPosition]);

  const sendPositionIfDue = useCallback(
    (position: GeolocationPosition) => {
      if (
        lastUploadAttemptedAtRef.current !== null &&
        Date.now() - lastUploadAttemptedAtRef.current < LOCATION_RESEND_INTERVAL_MS
      ) {
        return;
      }

      void sendPosition(position);
    },
    [sendPosition],
  );

  const start = useCallback(async () => {
    if (!sessionId) {
      setStatus("unavailable");
      return;
    }

    if (activeRef.current) {
      if (latestPositionRef.current) {
        void sendPosition(latestPositionRef.current);
      }
      return;
    }

    if (!window.isSecureContext) {
      setStatus("insecure");
      return;
    }

    if (!navigator.geolocation) {
      setStatus("unavailable");
      return;
    }

    activeRef.current = true;
    latestPositionRef.current = null;
    lastUploadAttemptedAtRef.current = null;
    setStatus("gps-checking");

    await requestWakeLock();

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        latestPositionRef.current = position;
        sendPositionIfDue(position);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setStatus("denied");
          return;
        }

        setStatus("unavailable");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      },
    );

    startResendTimer();
  }, [requestWakeLock, sendPosition, sendPositionIfDue, sessionId, startResendTimer]);

  useEffect(() => {
    function handleOnline() {
      if (!activeRef.current || !latestPositionRef.current) {
        return;
      }

      void sendPosition(latestPositionRef.current);
    }

    function handleOffline() {
      if (activeRef.current) {
        setStatus("delayed");
      }
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [sendPosition]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (!activeRef.current) {
        return;
      }

      if (document.visibilityState === "hidden") {
        setStatus("background");
        void releaseWakeLock();
        return;
      }

      void requestWakeLock();

      if (latestPositionRef.current) {
        void sendPosition(latestPositionRef.current);
        return;
      }

      setStatus("gps-checking");
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [releaseWakeLock, requestWakeLock, sendPosition]);

  useEffect(() => {
    return () => {
      void stop({ markStopped: false });
    };
  }, [stop]);

  return {
    status,
    start,
    stop,
  };
}
