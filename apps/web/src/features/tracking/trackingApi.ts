export type PublicTrackingSession = {
  sessionCode: string;
  sessionName: string;
  status: "active" | "expired" | "stopped";
  expiresAt: string;
  lastUpdatedLocation?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracyMeters?: number | null;
  destinationName?: string | null;
  destinationLat?: number | null;
  destinationLng?: number | null;
  pinRequired: boolean;
};

export type PublicTrackingResponse = {
  pinRequired?: boolean;
  session: PublicTrackingSession;
};

export async function getPublicTrackingSession(
  code: string,
): Promise<PublicTrackingResponse> {
  const response = await fetch(`/api/public/share-sessions/${code}`);

  if (!response.ok) {
    throw new Error("Failed to load public tracking session");
  }

  return response.json() as Promise<PublicTrackingResponse>;
}

export async function verifyTrackingPin(
  code: string,
  pinCode: string,
): Promise<PublicTrackingResponse> {
  const response = await fetch(`/api/public/share-sessions/${code}/verify-pin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ pinCode }),
  });

  if (!response.ok) {
    throw new Error("Failed to verify tracking PIN");
  }

  return response.json() as Promise<PublicTrackingResponse>;
}

export function getPublicTrackingStreamUrl(code: string) {
  return `/api/public/share-sessions/${code}/events`;
}
