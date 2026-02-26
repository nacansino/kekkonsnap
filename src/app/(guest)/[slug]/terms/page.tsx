"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "@/components/providers/SessionProvider";
import TermsConsent from "@/components/guest/TermsConsent";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

export default function TermsPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const session = useSession();

  const [termsText, setTermsText] = useState<string | null>(null);
  const [isAgreeing, setIsAgreeing] = useState(false);
  const [error, setError] = useState("");

  // If already agreed, redirect to camera
  useEffect(() => {
    if (session?.agreedToTerms) {
      router.replace(`/${slug}/camera`);
    }
  }, [session, slug, router]);

  // Fetch the event's terms text
  useEffect(() => {
    let cancelled = false;

    async function fetchTerms() {
      try {
        const res = await fetch(`/api/events/${slug}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setTermsText(data.termsText ?? "By participating, you agree that photos you take will be visible to other guests after the event. Photos cannot be deleted once submitted.");
          }
        }
      } catch {
        // Silently fail, will show loading state
      }
    }

    fetchTerms();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // If session doesn't exist, redirect to landing
  if (session === null) {
    // Session is still loading or doesn't exist
    // SessionProvider returns null while loading, so we wait briefly
    return (
      <div className="flex flex-1 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (session.agreedToTerms) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const handleAgree = async () => {
    setIsAgreeing(true);
    setError("");

    try {
      const res = await fetch(`/api/events/${slug}/agree`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to record your agreement. Please try again.");
        setIsAgreeing(false);
        return;
      }

      router.replace(`/${slug}/camera`);
    } catch {
      setError("Network error. Please check your connection and try again.");
      setIsAgreeing(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <h2 className="font-heading text-2xl font-semibold text-charcoal">
            Before we begin
          </h2>
          <p className="mt-2 text-sm text-charcoal-light/70">
            Please review and accept the following terms to participate.
          </p>
        </div>

        {/* Terms content */}
        {termsText === null ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="md" />
          </div>
        ) : (
          <TermsConsent
            termsText={termsText}
            onAgree={handleAgree}
            loading={isAgreeing}
          />
        )}

        {error && (
          <p className="mt-4 text-center text-sm text-red-500" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
