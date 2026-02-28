import { db } from "@/db";
import { events } from "@/db/schema";
import { eq, and, lte, isNotNull } from "drizzle-orm";
import { emitEventChange } from "@/lib/event-emitter";

const DEBOUNCE_MS = 30_000;
let lastChecked = 0;

/**
 * Check for active events past their scheduledLockAt time and auto-lock them.
 * Debounced to run at most once every 30 seconds.
 */
export async function checkScheduledLocks(): Promise<void> {
  const now = Date.now();
  if (now - lastChecked < DEBOUNCE_MS) return;
  lastChecked = now;

  const nowDate = new Date();

  // Find active events whose scheduled lock time has passed
  const dueEvents = await db
    .select({ id: events.id, slug: events.slug })
    .from(events)
    .where(
      and(
        eq(events.status, "active"),
        isNotNull(events.scheduledLockAt),
        lte(events.scheduledLockAt, nowDate)
      )
    )
    .all();

  for (const event of dueEvents) {
    await db
      .update(events)
      .set({
        status: "locked",
        lockedAt: nowDate,
        scheduledLockAt: null,
      })
      .where(eq(events.id, event.id));

    emitEventChange({
      slug: event.slug,
      type: "status_change",
      status: "locked",
    });
  }
}
