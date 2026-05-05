export type ShareSessionRealtime<Event> = {
  subscribe(sessionCode: string, listener: (event: Event) => void): () => void;
  publish(sessionCode: string, event: Event): void;
};

export class InMemoryShareSessionRealtime<Event> implements ShareSessionRealtime<Event> {
  private readonly listeners = new Map<string, Set<(event: Event) => void>>();

  subscribe(sessionCode: string, listener: (event: Event) => void) {
    const listenersForCode = this.listeners.get(sessionCode) ?? new Set();
    listenersForCode.add(listener);
    this.listeners.set(sessionCode, listenersForCode);

    return () => {
      listenersForCode.delete(listener);

      if (listenersForCode.size === 0) {
        this.listeners.delete(sessionCode);
      }
    };
  }

  publish(sessionCode: string, event: Event) {
    const listenersForCode = this.listeners.get(sessionCode);

    if (!listenersForCode) {
      return;
    }

    for (const listener of listenersForCode) {
      listener(event);
    }
  }

  listenerCount(sessionCode: string) {
    return this.listeners.get(sessionCode)?.size ?? 0;
  }
}
