"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import ConfettiEffect from "./ConfettiEffect";

interface WinnerRevealProps {
  winnerPhotoUrl?: string;
  winnerGuestName?: string;
  badgeLabel?: string;
  className?: string;
}

export default function WinnerReveal({
  winnerPhotoUrl,
  winnerGuestName,
  badgeLabel = "Best Photo",
  className = "",
}: WinnerRevealProps) {
  const [revealed, setRevealed] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);

  useEffect(() => {
    const revealTimer = setTimeout(() => setRevealed(true), 300);
    const confettiTimer = setTimeout(() => setConfettiActive(true), 600);

    return () => {
      clearTimeout(revealTimer);
      clearTimeout(confettiTimer);
    };
  }, []);

  return (
    <div
      className={`
        relative flex flex-col items-center justify-center gap-6
        px-6 py-4 text-center
        ${className}
      `}
    >
      <ConfettiEffect active={confettiActive} duration={3500} />

      {/* Badge */}
      <div
        className={`
          transition-all duration-700 ease-out
          ${revealed ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}
        `}
      >
        <div
          className="
            inline-flex items-center gap-2
            rounded-full px-5 py-2
            bg-gradient-to-r from-amber-500/90 to-yellow-500/90
            text-white font-heading text-sm
            shadow-lg shadow-amber-500/25
          "
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          {badgeLabel}
        </div>
      </div>

      {/* Winning photo */}
      {winnerPhotoUrl && (
        <div
          className={`
            relative transition-all duration-1000 ease-out
            ${revealed ? "opacity-100 scale-100" : "opacity-0 scale-90"}
          `}
        >
          {/* Gold shimmer ring */}
          <div
            className="
              absolute -inset-1.5 rounded-2xl
              bg-gradient-to-tr from-amber-400 via-yellow-300 to-amber-500
              animate-[shimmer_2s_ease-in-out_infinite]
              opacity-80
            "
          />
          <div className="relative overflow-hidden rounded-2xl shadow-2xl">
            <Image
              src={winnerPhotoUrl}
              alt={`Winning photo by ${winnerGuestName ?? "the winner"}`}
              width={320}
              height={320}
              unoptimized
              className="h-64 w-64 object-cover sm:h-80 sm:w-80"
            />
          </div>
        </div>
      )}

      {/* Winner name */}
      {winnerGuestName && (
        <div
          className={`
            space-y-1 transition-all duration-700 delay-300 ease-out
            ${revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
          `}
        >
          <p className="text-sm text-charcoal-light uppercase tracking-widest">
            Congratulations
          </p>
          <h1 className="font-heading text-3xl text-charcoal sm:text-4xl">
            {winnerGuestName}
          </h1>
        </div>
      )}
    </div>
  );
}
