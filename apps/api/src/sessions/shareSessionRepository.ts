import { randomUUID } from "node:crypto";
import type { ShareSessionStatus } from "@bluebluelink/shared";
import { type ShareSessionAccessRepository } from "./shareSessionAccess";

export type StoredShareSession = {
  id: string;
  ownerId: string;
  sessionCode: string;
  sessionName: string;
  status: ShareSessionStatus;
  expiresAt: Date;
  lastUpdatedLocation: Date | null;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  pinCodeHash: string | null;
  destinationName: string | null;
  destinationLat: number | null;
  destinationLng: number | null;
  stoppedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateShareSessionInput = {
  ownerId: string;
  sessionCode: string;
  sessionName: string;
  expiresAt: Date;
  pinCodeHash: string | null;
  destinationName: string | null;
  destinationLat: number | null;
  destinationLng: number | null;
};

export interface ShareSessionRepository extends ShareSessionAccessRepository {
  create(input: CreateShareSessionInput): Promise<StoredShareSession>;
  listByOwner(ownerId: string, now: Date): Promise<StoredShareSession[]>;
  stop(id: string, ownerId: string): Promise<StoredShareSession | null>;
  delete(id: string, ownerId: string): Promise<boolean>;
  updateLocation(
    id: string,
    ownerId: string,
    input: {
      latitude: number;
      longitude: number;
      accuracyMeters: number;
      capturedAt: Date;
    },
  ): Promise<StoredShareSession | null>;
}

export class InMemoryShareSessionRepository implements ShareSessionRepository {
  private readonly sessions = new Map<string, StoredShareSession>();

  async create(input: CreateShareSessionInput): Promise<StoredShareSession> {
    const now = new Date();
    const session: StoredShareSession = {
      id: randomUUID(),
      ownerId: input.ownerId,
      sessionCode: input.sessionCode,
      sessionName: input.sessionName,
      status: "active",
      expiresAt: input.expiresAt,
      lastUpdatedLocation: null,
      latitude: null,
      longitude: null,
      accuracyMeters: null,
      pinCodeHash: input.pinCodeHash,
      destinationName: input.destinationName,
      destinationLat: input.destinationLat,
      destinationLng: input.destinationLng,
      stoppedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.set(session.id, session);
    return session;
  }

  async listByOwner(ownerId: string, now: Date): Promise<StoredShareSession[]> {
    return [...this.sessions.values()]
      .filter((session) => session.ownerId === ownerId)
      .map((session) => this.withComputedStatus(session, now))
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  async stop(id: string, ownerId: string): Promise<StoredShareSession | null> {
    const session = this.sessions.get(id);

    if (!session || session.ownerId !== ownerId) {
      return null;
    }

    const now = new Date();
    const stopped = {
      ...session,
      status: "stopped" as const,
      stoppedAt: now,
      updatedAt: now,
    };
    this.sessions.set(id, stopped);
    return stopped;
  }

  async delete(id: string, ownerId: string): Promise<boolean> {
    const session = this.sessions.get(id);

    if (!session || session.ownerId !== ownerId) {
      return false;
    }

    return this.sessions.delete(id);
  }

  async updateLocation(
    id: string,
    ownerId: string,
    input: {
      latitude: number;
      longitude: number;
      accuracyMeters: number;
      capturedAt: Date;
    },
  ): Promise<StoredShareSession | null> {
    const session = this.sessions.get(id);

    if (!session || session.ownerId !== ownerId || session.status !== "active") {
      return null;
    }

    const updated = {
      ...session,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracyMeters: input.accuracyMeters,
      lastUpdatedLocation: input.capturedAt,
      updatedAt: new Date(),
    };
    this.sessions.set(id, updated);
    return updated;
  }

  async isOwner(sessionId: string, userId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    return session?.ownerId === userId;
  }

  private withComputedStatus(session: StoredShareSession, now: Date): StoredShareSession {
    if (session.status === "active" && session.expiresAt <= now) {
      return {
        ...session,
        status: "expired",
      };
    }

    return session;
  }
}
