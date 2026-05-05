import { z } from "zod";

export const shareSessionStatusSchema = z.enum(["active", "expired", "stopped"]);
export type ShareSessionStatus = z.infer<typeof shareSessionStatusSchema>;

export const shareSessionSchema = z.object({
  id: z.string().min(1),
  sessionCode: z.string().min(6).max(16),
  sessionName: z.string().min(1).max(80),
  status: shareSessionStatusSchema,
  expiresAt: z.string().datetime(),
  lastUpdatedLocation: z.string().datetime().nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  accuracyMeters: z.number().nonnegative().nullable(),
  destinationName: z.string().min(1).max(120).nullable(),
  destinationLat: z.number().min(-90).max(90).nullable(),
  destinationLng: z.number().min(-180).max(180).nullable(),
});

export type ShareSession = z.infer<typeof shareSessionSchema>;

export type SessionUnavailableReason = "expired" | "stopped";

export function getSessionAvailability(input: {
  status: ShareSessionStatus;
  expiresAt: string;
  now: Date;
}): { available: true; reason: null } | { available: false; reason: SessionUnavailableReason } {
  if (input.status === "stopped") {
    return { available: false, reason: "stopped" };
  }

  if (input.status === "expired" || new Date(input.expiresAt) <= input.now) {
    return { available: false, reason: "expired" };
  }

  return { available: true, reason: null };
}

export function isLocationStale(input: {
  lastUpdatedLocation: string | null;
  now: Date;
  staleAfterSeconds: number;
}): boolean {
  if (!input.lastUpdatedLocation) {
    return true;
  }

  const ageMs = input.now.getTime() - new Date(input.lastUpdatedLocation).getTime();
  return ageMs > input.staleAfterSeconds * 1000;
}
