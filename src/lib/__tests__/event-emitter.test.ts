import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  eventEmitter,
  emitEventChange,
  type EventChangePayload,
} from "@/lib/event-emitter";

describe("event-emitter", () => {
  beforeEach(() => {
    eventEmitter.removeAllListeners("eventChange");
  });

  it("should emit and receive an event", () => {
    const handler = vi.fn();
    eventEmitter.on("eventChange", handler);

    const payload: EventChangePayload = {
      slug: "wedding-2026",
      type: "status_change",
      status: "active",
    };

    emitEventChange(payload);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(payload);
  });

  it("should deliver the same event to multiple listeners", () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const handler3 = vi.fn();

    eventEmitter.on("eventChange", handler1);
    eventEmitter.on("eventChange", handler2);
    eventEmitter.on("eventChange", handler3);

    const payload: EventChangePayload = {
      slug: "wedding-2026",
      type: "photo_uploaded",
      status: "active",
      photoCount: 42,
    };

    emitEventChange(payload);

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler1).toHaveBeenCalledWith(payload);
    expect(handler2).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledWith(payload);
    expect(handler3).toHaveBeenCalledTimes(1);
    expect(handler3).toHaveBeenCalledWith(payload);
  });

  it("should not interfere between events with different slugs", () => {
    const receivedPayloads: EventChangePayload[] = [];
    eventEmitter.on("eventChange", (p: EventChangePayload) => {
      receivedPayloads.push(p);
    });

    const payloadA: EventChangePayload = {
      slug: "wedding-a",
      type: "status_change",
      status: "locked",
    };

    const payloadB: EventChangePayload = {
      slug: "wedding-b",
      type: "winner_announced",
      status: "announced",
      winnerPhotoId: 7,
      winnerGuestName: "Tanaka Yuki",
      winnerPhotoUrl: "/uploads/photo-7.jpg",
    };

    emitEventChange(payloadA);
    emitEventChange(payloadB);

    expect(receivedPayloads).toHaveLength(2);
    expect(receivedPayloads[0].slug).toBe("wedding-a");
    expect(receivedPayloads[0].type).toBe("status_change");
    expect(receivedPayloads[0].status).toBe("locked");
    expect(receivedPayloads[1].slug).toBe("wedding-b");
    expect(receivedPayloads[1].type).toBe("winner_announced");
    expect(receivedPayloads[1].status).toBe("announced");
    expect(receivedPayloads[1].winnerPhotoId).toBe(7);
    expect(receivedPayloads[1].winnerGuestName).toBe("Tanaka Yuki");
    expect(receivedPayloads[1].winnerPhotoUrl).toBe("/uploads/photo-7.jpg");
  });

  it("should support status_change payload type", () => {
    const handler = vi.fn();
    eventEmitter.on("eventChange", handler);

    const payload: EventChangePayload = {
      slug: "test-event",
      type: "status_change",
      status: "locked",
    };

    emitEventChange(payload);

    const received = handler.mock.calls[0][0] as EventChangePayload;
    expect(received.type).toBe("status_change");
    expect(received.status).toBe("locked");
    expect(received.winnerPhotoId).toBeUndefined();
    expect(received.winnerGuestName).toBeUndefined();
    expect(received.winnerPhotoUrl).toBeUndefined();
    expect(received.photoCount).toBeUndefined();
  });

  it("should support winner_announced payload type with winner details", () => {
    const handler = vi.fn();
    eventEmitter.on("eventChange", handler);

    const payload: EventChangePayload = {
      slug: "test-event",
      type: "winner_announced",
      status: "announced",
      winnerPhotoId: 99,
      winnerGuestName: "Sato Haruki",
      winnerPhotoUrl: "/uploads/winner-99.jpg",
    };

    emitEventChange(payload);

    const received = handler.mock.calls[0][0] as EventChangePayload;
    expect(received.type).toBe("winner_announced");
    expect(received.status).toBe("announced");
    expect(received.winnerPhotoId).toBe(99);
    expect(received.winnerGuestName).toBe("Sato Haruki");
    expect(received.winnerPhotoUrl).toBe("/uploads/winner-99.jpg");
  });

  it("should support photo_uploaded payload type with photoCount", () => {
    const handler = vi.fn();
    eventEmitter.on("eventChange", handler);

    const payload: EventChangePayload = {
      slug: "test-event",
      type: "photo_uploaded",
      status: "active",
      photoCount: 150,
    };

    emitEventChange(payload);

    const received = handler.mock.calls[0][0] as EventChangePayload;
    expect(received.type).toBe("photo_uploaded");
    expect(received.status).toBe("active");
    expect(received.photoCount).toBe(150);
  });

  it("should support max listeners of at least 200", () => {
    expect(eventEmitter.getMaxListeners()).toBeGreaterThanOrEqual(200);
  });

  it("should be a module-level singleton (same reference on re-import)", async () => {
    const { eventEmitter: emitter2 } = await import("@/lib/event-emitter");
    expect(emitter2).toBe(eventEmitter);
  });
});
