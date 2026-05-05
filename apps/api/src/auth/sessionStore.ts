import { randomUUID } from "node:crypto";

export type AuthenticatedUser = {
  id: string;
  email: string;
};

export type SessionRecord = {
  token: string;
  user: AuthenticatedUser;
  expiresAt: Date;
};

export interface SessionStore {
  create(user: AuthenticatedUser): Promise<SessionRecord>;
  get(token: string): Promise<SessionRecord | null>;
  destroy(token: string): Promise<void>;
}

export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, SessionRecord>();

  constructor(private readonly ttlMs = 1000 * 60 * 60 * 24 * 7) {}

  async create(user: AuthenticatedUser): Promise<SessionRecord> {
    const token = randomUUID();
    const session = {
      token,
      user,
      expiresAt: new Date(Date.now() + this.ttlMs),
    };

    this.sessions.set(token, session);
    return session;
  }

  async get(token: string): Promise<SessionRecord | null> {
    const session = this.sessions.get(token);

    if (!session) {
      return null;
    }

    if (session.expiresAt <= new Date()) {
      this.sessions.delete(token);
      return null;
    }

    return session;
  }

  async destroy(token: string): Promise<void> {
    this.sessions.delete(token);
  }
}
