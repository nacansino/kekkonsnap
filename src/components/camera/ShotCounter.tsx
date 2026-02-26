"use client";

interface ShotCounterProps {
  remaining: number;
  total: number;
  className?: string;
}

export default function ShotCounter({
  remaining,
  total,
  className = "",
}: ShotCounterProps) {
  const isLow = remaining <= 1;

  return (
    <div
      className={`
        inline-flex items-center gap-1.5
        rounded-full px-3.5 py-1.5
        text-sm font-medium font-body
        backdrop-blur-md
        transition-colors duration-300
        ${
          isLow
            ? "bg-red-500/80 text-white"
            : "bg-black/40 text-white"
        }
        ${className}
      `}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
      >
        <rect x="2" y="6" width="20" height="14" rx="2" />
        <circle cx="12" cy="13" r="4" />
        <path d="M17 2l3 4H4l3-4" />
      </svg>
      <span>
        {remaining} of {total}
      </span>
    </div>
  );
}
