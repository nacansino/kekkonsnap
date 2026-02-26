"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useSession } from "./SessionProvider";

interface EventState {
  status: "active" | "locked" | "announced";
  winnerPhotoId?: number;
  winnerGuestName?: string;
  winnerPhotoUrl?: string;
  connected: boolean;
}

const EventStreamContext = createContext<EventState | null>(null);

const MAX_BACKOFF_MS = 30_000;

export function EventStreamProvider({
  slug,
  initialStatus,
  children,
}: {
  slug: string;
  initialStatus: "active" | "locked" | "announced";
  children: ReactNode;
}): React.ReactNode {
  const [state, setState] = useState<EventState>({
    status: initialStatus,
    connected: false,
  });

  const session = useSession();
  const hasSession = session !== null;
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    // Clean up any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const es = new EventSource(`/api/events/${slug}/status`);
    eventSourceRef.current = es;

    es.onopen = () => {
      retryCountRef.current = 0;
      setState((prev) => ({ ...prev, connected: true }));
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setState((prev) => ({
          ...prev,
          status: data.status ?? prev.status,
          winnerPhotoId: data.winnerPhotoId ?? prev.winnerPhotoId,
          winnerGuestName: data.winnerGuestName ?? prev.winnerGuestName,
          winnerPhotoUrl: data.winnerPhotoUrl ?? prev.winnerPhotoUrl,
        }));
      } catch {
        // Ignore malformed messages
      }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      setState((prev) => ({ ...prev, connected: false }));

      // Exponential backoff: 1s, 2s, 4s, 8s, ..., max 30s
      const backoff = Math.min(
        1000 * Math.pow(2, retryCountRef.current),
        MAX_BACKOFF_MS
      );
      retryCountRef.current += 1;

      retryTimeoutRef.current = setTimeout(() => {
        connect();
      }, backoff);
    };
  }, [slug]);

  useEffect(() => {
    // Only connect SSE when the user has an authenticated session
    if (!hasSession) return;

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [connect, hasSession]);

  return (
    <EventStreamContext.Provider value={state}>
      {children}
    </EventStreamContext.Provider>
  );
}

export function useEventStream(): EventState {
  const ctx = useContext(EventStreamContext);
  if (ctx === null) {
    throw new Error("useEventStream must be used within an EventStreamProvider");
  }
  return ctx;
}
