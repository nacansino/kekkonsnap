"use client";

import { useRouter, useParams } from "next/navigation";
import { useEventStream } from "@/components/providers/EventStreamProvider";
import WinnerReveal from "@/components/winner/WinnerReveal";
import WaitingScreen from "@/components/winner/WaitingScreen";
import Button from "@/components/ui/Button";

export default function WinnerPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const eventState = useEventStream();

  // Active or locked state: show waiting screen
  if (eventState.status === "active" || eventState.status === "locked") {
    const message =
      eventState.status === "active"
        ? "The contest is still open..."
        : "The judges are deliberating...";

    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-6">
        <WaitingScreen message={message} />
        <div className="mt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/${slug}/photos`)}
          >
            Your Snaps
          </Button>
        </div>
      </div>
    );
  }

  // Announced state: show the winner reveal
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-6">
      {/* Winner reveal (includes its own confetti) */}
      <WinnerReveal
        winnerPhotoUrl={eventState.winnerPhotoUrl}
        winnerGuestName={eventState.winnerGuestName}
      />

      {/* Action buttons */}
      <div className="relative z-10 mt-4 flex flex-col items-center gap-3">
        <Button
          variant="primary"
          size="lg"
          onClick={() => router.push(`/${slug}/gallery`)}
        >
          View All Snaps
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/${slug}/photos`)}
        >
          Your Snaps
        </Button>
      </div>

      {/* Decorative bottom line */}
      <div className="relative z-10 mt-4 h-px w-24 bg-rose-dust/15" />
    </div>
  );
}
