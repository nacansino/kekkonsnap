import { EventEmitter } from "events";

export interface EventChangePayload {
  slug: string;
  type: "status_change" | "winner_announced" | "photo_uploaded";
  status: "active" | "locked" | "announced";
  winnerPhotoId?: number;
  winnerGuestName?: string;
  winnerPhotoUrl?: string;
  photoCount?: number;
}

// Module-level singleton
export const eventEmitter = new EventEmitter();
eventEmitter.setMaxListeners(200); // Support 100+ concurrent SSE connections

export function emitEventChange(payload: EventChangePayload): void {
  eventEmitter.emit("eventChange", payload);
}
