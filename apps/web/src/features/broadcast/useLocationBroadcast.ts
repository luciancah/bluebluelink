import { useCallback, useEffect, useRef, useState } from "react";

export type BroadcastStatus =
  | "idle"
  | "gps-checking"
  | "sending"
  | "sent"
  | "delayed"
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

export function useLocationBroadcast(sessionId: string | undefined) {
  const [status, setStatus] = useState<BroadcastStatus>("idle");
  const watchIdRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const activeRef = useRef(false);

  const stop = useCallback(async () => {
    activeRef.current = false;

    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (wakeLockRef.current) {
      await Promise.resolve(wakeLockRef.current.release()).catch(() => undefined);
      wakeLockRef.current = null;
    }

    setStatus("stopped");
  }, []);

  const sendPosition = useCallback(
    async (position: GeolocationPosition) => {
      if (!sessionId || !activeRef.current) {
        return;
      }

      setStatus("sending");

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

      setStatus(response.ok ? "sent" : "delayed");
    },
    [sessionId],
  );

  const start = useCallback(async () => {
    if (!sessionId) {
      setStatus("unavailable");
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
    setStatus("gps-checking");

    try {
      wakeLockRef.current =
        (await (navigator as NavigatorWithWakeLock).wakeLock?.request("screen")) ?? null;
    } catch {
      wakeLockRef.current = null;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        void sendPosition(position).catch(() => setStatus("delayed"));
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
  }, [sendPosition, sessionId]);

  useEffect(() => {
    return () => {
      void stop();
    };
  }, [stop]);

  return {
    status,
    start,
    stop,
  };
}
