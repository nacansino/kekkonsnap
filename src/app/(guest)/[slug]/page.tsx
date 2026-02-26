"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession, useSessionLoading, useSessionRefresh } from "@/components/providers/SessionProvider";
import NameAutocomplete from "@/components/guest/NameAutocomplete";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

export default function LandingPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const session = useSession();
  const loading = useSessionLoading();
  const refreshSession = useSessionRefresh();

  const [selectedGuest, setSelectedGuest] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [error, setError] = useState("");

  // Redirect if session already exists (after loading completes)
  useEffect(() => {
    if (loading) return;
    if (session) {
      if (session.agreedToTerms) {
        router.replace(`/${slug}/camera`);
      } else {
        router.replace(`/${slug}/terms`);
      }
    }
  }, [session, loading, slug, router]);

  // Show spinner while checking for existing session
  if (loading || session) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const handleIdentify = async () => {
    if (!selectedGuest) return;

    setIsIdentifying(true);
    setError("");

    try {
      const res = await fetch(`/api/events/${slug}/identify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestId: selectedGuest.id }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Something went wrong. Please try again.");
        setIsIdentifying(false);
        return;
      }

      // Refresh session context so providers pick up the new session
      await refreshSession();

      // Session refresh will trigger the useEffect redirect above
    } catch {
      setError("Network error. Please check your connection and try again.");
      setIsIdentifying(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      {/* Decorative element */}
      <div className="mb-6 flex items-center gap-3 text-rose-dust/30">
        <div className="h-px w-12 bg-rose-dust/30" />
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        <div className="h-px w-12 bg-rose-dust/30" />
      </div>

      {/* Hero heading */}
      <h2 className="font-heading text-3xl font-semibold text-charcoal text-center leading-snug sm:text-4xl">
        Capture the moment
      </h2>

      <p className="mt-3 text-center text-charcoal-light/70 font-body text-sm max-w-xs">
        Find your name below to get started with the photo contest.
      </p>

      {/* Name selection */}
      <div className="mt-10 w-full max-w-sm">
        <NameAutocomplete
          slug={slug}
          onSelect={(guest) => {
            setSelectedGuest(guest);
            setError("");
          }}
        />

        {error && (
          <p className="mt-3 text-center text-sm text-red-500" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6">
          <Button
            onClick={handleIdentify}
            disabled={!selectedGuest}
            loading={isIdentifying}
            size="lg"
            className="w-full"
          >
            {isIdentifying ? "Joining..." : "Join the Contest"}
          </Button>
        </div>
      </div>

      {/* Bottom decorative line */}
      <div className="mt-16 h-px w-24 bg-rose-dust/15" />
    </div>
  );
}
