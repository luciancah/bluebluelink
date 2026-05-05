export type OwnerShareSession = {
  id: string;
  sessionCode: string;
  sessionName: string;
  status: "active" | "expired" | "stopped";
  expiresAt: string;
  lastUpdatedLocation: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  destinationName: string | null;
  destinationLat: number | null;
  destinationLng: number | null;
  hasPin: boolean;
  stoppedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateShareSessionInput = {
  sessionName: string;
  durationMinutes: number;
  pinCode?: string;
};

export async function listShareSessions(): Promise<OwnerShareSession[]> {
  const response = await fetch("/api/share-sessions", {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to load share sessions");
  }

  const data = (await response.json()) as { sessions: OwnerShareSession[] };
  return data.sessions;
}

export async function createShareSession(input: CreateShareSessionInput) {
  const response = await fetch("/api/share-sessions", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error("Failed to create share session");
  }

  return response.json() as Promise<{ session: OwnerShareSession }>;
}

export async function stopShareSession(id: string) {
  const response = await fetch(`/api/share-sessions/${id}/stop`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to stop share session");
  }

  return response.json() as Promise<{ session: OwnerShareSession }>;
}

export async function deleteShareSession(id: string) {
  const response = await fetch(`/api/share-sessions/${id}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to delete share session");
  }
}
