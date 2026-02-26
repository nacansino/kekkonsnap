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
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <WaitingScreen message={message} />
      </div>
    );
  }

  // Announced state: show the winner reveal
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-12">
      {/* Winner reveal (includes its own confetti) */}
      <WinnerReveal
        winnerPhotoUrl={eventState.winnerPhotoUrl}
        winnerGuestName={eventState.winnerGuestName}
      />

      {/* Action button */}
      <div className="relative z-10 mt-10">
        <Button
          variant="primary"
          size="lg"
          onClick={() => router.push(`/${slug}/gallery`)}
        >
          View All Photos
        </Button>
      </div>

      {/* Decorative bottom line */}
      <div className="relative z-10 mt-8 h-px w-24 bg-rose-dust/15" />
    </div>
  );
}
