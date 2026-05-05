import { describe, expect, it } from "vitest";
import { InMemoryShareSessionRealtime } from "./shareSessionRealtime";

describe("InMemoryShareSessionRealtime", () => {
  it("fans out events by session code and unsubscribes closed listeners", () => {
    const realtime = new InMemoryShareSessionRealtime<{ version: number }>();
    const first: Array<{ version: number }> = [];
    const second: Array<{ version: number }> = [];

    const unsubscribeFirst = realtime.subscribe("AB12CD34", (event) => {
      first.push(event);
    });
    realtime.subscribe("AB12CD34", (event) => {
      second.push(event);
    });

    realtime.publish("OTHER123", { version: 0 });
    realtime.publish("AB12CD34", { version: 1 });
    unsubscribeFirst();
    realtime.publish("AB12CD34", { version: 2 });

    expect(first).toEqual([{ version: 1 }]);
    expect(second).toEqual([{ version: 1 }, { version: 2 }]);
    expect(realtime.listenerCount("AB12CD34")).toBe(1);
  });
});
