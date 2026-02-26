"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

interface SessionState {
  guestId: number;
  guestName: string;
  eventId: number;
  eventSlug: string;
  shotLimit: number;
  photosCount: number;
  agreedToTerms: boolean;
}

interface SessionContextValue {
  session: SessionState | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue>({
  session: null,
  loading: true,
  refresh: async () => {},
});

export function SessionProvider({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}): React.ReactNode {
  const [session, setSession] = useState<SessionState | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${slug}/session`);
      if (!res.ok) {
        setSession(null);
        return;
      }
      const data = await res.json();
      setSession(data);
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  return (
    <SessionContext.Provider value={{ session, loading, refresh: fetchSession }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionState | null {
  return useContext(SessionContext).session;
}

export function useSessionLoading(): boolean {
  return useContext(SessionContext).loading;
}

export function useSessionRefresh(): () => Promise<void> {
  return useContext(SessionContext).refresh;
}

export function useSessionContext(): SessionContextValue {
  return useContext(SessionContext);
}

export function useSessionRequired(): SessionState {
  const { session } = useContext(SessionContext);
  if (session === null) {
    throw new Error(
      "useSessionRequired: no session available. The user may not be authenticated or SessionProvider is missing."
    );
  }
  return session;
}
