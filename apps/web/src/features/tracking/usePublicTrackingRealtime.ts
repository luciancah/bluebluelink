import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  getPublicTrackingStreamUrl,
  type PublicTrackingResponse,
} from "./trackingApi";

export type PublicTrackingRealtimeStatus =
  | "idle"
  | "unsupported"
  | "connecting"
  | "connected"
  | "fallback";

type UsePublicTrackingRealtimeOptions = {
  code: string;
  enabled: boolean;
  queryKey: QueryKey;
};

export function usePublicTrackingRealtime({
  code,
  enabled,
  queryKey,
}: UsePublicTrackingRealtimeOptions): PublicTrackingRealtimeStatus {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<PublicTrackingRealtimeStatus>("idle");

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }

    if (typeof EventSource === "undefined") {
      setStatus("unsupported");
      return;
    }

    setStatus("connecting");

    const source = new EventSource(getPublicTrackingStreamUrl(code), {
      withCredentials: true,
    });
    const handleEvent = (event: MessageEvent<string>) => {
      queryClient.setQueryData<PublicTrackingResponse>(
        queryKey,
        JSON.parse(event.data) as PublicTrackingResponse,
      );
    };

    source.addEventListener("snapshot", handleEvent);
    source.addEventListener("location", handleEvent);
    source.onopen = () => setStatus("connected");
    source.onerror = () => {
      setStatus("fallback");
      void queryClient.invalidateQueries({ queryKey });
    };

    return () => {
      source.close();
    };
  }, [code, enabled, queryClient, queryKey]);

  return status;
}
