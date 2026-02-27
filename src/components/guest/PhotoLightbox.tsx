"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";

interface Photo {
  id: number | string;
  url?: string;
  fullUrl?: string;
  thumbnailUrl?: string;
  alt?: string;
  capturedAt?: string;
}

interface PhotoLightboxProps {
  photos: Photo[];
  onClose: () => void;
  /** Used together with isOpen for controlled open/close */
  currentIndex?: number;
  /** Used together with currentIndex for controlled open/close */
  isOpen?: boolean;
  /** Used when the lightbox is rendered conditionally (always open when mounted) */
  initialIndex?: number;
}

export default function PhotoLightbox({
  photos,
  onClose,
  currentIndex,
  isOpen,
  initialIndex,
}: PhotoLightboxProps) {
  // Support both API styles:
  // 1. controlled: currentIndex + isOpen
  // 2. conditional mount: initialIndex (always visible when rendered)
  const startIndex = currentIndex ?? initialIndex ?? 0;
  const visible = isOpen ?? true;

  const [index, setIndex] = useState(startIndex);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchDelta, setTouchDelta] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIndex(currentIndex ?? initialIndex ?? 0);
  }, [currentIndex, initialIndex]);

  const goTo = useCallback(
    (direction: -1 | 1) => {
      if (isAnimating) return;
      setIsAnimating(true);
      setIndex((prev) => {
        const next = prev + direction;
        if (next < 0) return 0;
        if (next >= photos.length) return photos.length - 1;
        return next;
      });
      setTimeout(() => setIsAnimating(false), 300);
    },
    [photos.length, isAnimating]
  );

  // Keyboard controls
  useEffect(() => {
    if (!visible) return;

    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowLeft":
          goTo(-1);
          break;
        case "ArrowRight":
          goTo(1);
          break;
      }
    };

    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [visible, onClose, goTo]);

  // Touch handlers for swipe
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (touchStart === null) return;
      setTouchDelta(e.touches[0].clientX - touchStart);
    },
    [touchStart]
  );

  const handleTouchEnd = useCallback(() => {
    if (touchStart === null) return;
    const threshold = 60;
    if (touchDelta > threshold) {
      goTo(-1);
    } else if (touchDelta < -threshold) {
      goTo(1);
    }
    setTouchStart(null);
    setTouchDelta(0);
  }, [touchStart, touchDelta, goTo]);

  if (!visible || photos.length === 0) return null;

  const photo = photos[index];
  if (!photo) return null;

  // Support both url styles
  const imageUrl = photo.url ?? photo.fullUrl ?? "";

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 animate-[fadeIn_200ms_ease-out]"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={(e) => {
        if (imageRef.current && !imageRef.current.contains(e.target as Node)) onClose();
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="
          absolute top-4 right-4 z-20
          flex h-10 w-10 items-center justify-center
          rounded-full bg-white/10 text-white
          backdrop-blur-sm
          transition-colors hover:bg-white/20
        "
        aria-label="Close"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Photo counter */}
      <div className="absolute top-4 left-4 z-20 text-sm text-white/60">
        {index + 1} / {photos.length}
      </div>

      {/* Previous button (desktop) */}
      {index > 0 && (
        <button
          onClick={() => goTo(-1)}
          className="
            absolute left-3 z-20 hidden sm:flex
            h-10 w-10 items-center justify-center
            rounded-full bg-white/10 text-white
            backdrop-blur-sm
            transition-colors hover:bg-white/20
          "
          aria-label="Previous photo"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}

      {/* Next button (desktop) */}
      {index < photos.length - 1 && (
        <button
          onClick={() => goTo(1)}
          className="
            absolute right-3 z-20 hidden sm:flex
            h-10 w-10 items-center justify-center
            rounded-full bg-white/10 text-white
            backdrop-blur-sm
            transition-colors hover:bg-white/20
          "
          aria-label="Next photo"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}

      {/* Image */}
      <div ref={imageRef} className="relative h-[85dvh] w-[95vw] pointer-events-none">
        <Image
          key={String(photo.id)}
          src={imageUrl}
          alt={photo.alt ?? `Photo ${index + 1}`}
          fill
          unoptimized
          sizes="95vw"
          className="
            object-contain
            select-none
            transition-all duration-300 ease-out
            animate-[fadeIn_200ms_ease-out]
          "
          style={{
            transform:
              touchDelta !== 0 ? `translateX(${touchDelta * 0.4}px)` : undefined,
          }}
          draggable={false}
        />
      </div>
    </div>
  );
}
