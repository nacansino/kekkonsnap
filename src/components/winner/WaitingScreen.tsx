"use client";

interface WaitingScreenProps {
  message?: string;
  className?: string;
}

export default function WaitingScreen({
  message = "The judges are deliberating...",
  className = "",
}: WaitingScreenProps) {
  return (
    <div
      className={`
        flex flex-col items-center justify-center gap-8
        px-8 text-center
        ${className}
      `}
    >
      {/* Pulsing rings */}
      <div className="relative flex items-center justify-center">
        <div className="absolute h-24 w-24 rounded-full border-2 border-rose-dust/20 animate-[pulseRing_2s_ease-out_infinite]" />
        <div className="absolute h-24 w-24 rounded-full border-2 border-rose-dust/15 animate-[pulseRing_2s_ease-out_0.5s_infinite]" />
        <div className="absolute h-24 w-24 rounded-full border-2 border-rose-dust/10 animate-[pulseRing_2s_ease-out_1s_infinite]" />

        {/* Center icon */}
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-rose-dust/10">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-rose-dust animate-pulse"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="font-heading text-2xl text-charcoal animate-pulse">
          {message}
        </h2>
        <p className="text-sm text-charcoal-light/60">
          The winner will be revealed shortly
        </p>
      </div>

      {/* Animated dots */}
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-rose-dust/40 animate-[bounce_1.4s_ease-in-out_infinite]" />
        <span className="h-2 w-2 rounded-full bg-rose-dust/40 animate-[bounce_1.4s_ease-in-out_0.2s_infinite]" />
        <span className="h-2 w-2 rounded-full bg-rose-dust/40 animate-[bounce_1.4s_ease-in-out_0.4s_infinite]" />
      </div>
    </div>
  );
}
