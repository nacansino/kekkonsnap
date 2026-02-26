"use client";

import Image from "next/image";

interface Photo {
  id: number | string;
  url?: string;
  fullUrl?: string;
  thumbnailUrl?: string;
  alt?: string;
  capturedAt?: string;
}

interface PhotoGridProps {
  photos: Photo[];
  onPhotoClick: (index: number) => void;
  className?: string;
}

export default function PhotoGrid({
  photos,
  onPhotoClick,
  className = "",
}: PhotoGridProps) {
  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="text-charcoal-light/30"
        >
          <rect x="2" y="6" width="20" height="14" rx="2" />
          <circle cx="12" cy="13" r="4" />
          <path d="M17 2l3 4H4l3-4" />
        </svg>
        <p className="text-sm text-charcoal-light/50">No photos yet</p>
      </div>
    );
  }

  return (
    <div
      className={`
        grid grid-cols-2 gap-2
        sm:grid-cols-3
        ${className}
      `}
    >
      {photos.map((photo, index) => {
        const imgSrc = photo.thumbnailUrl ?? photo.url ?? photo.fullUrl ?? "";

        return (
          <button
            key={photo.id}
            onClick={() => onPhotoClick(index)}
            className="
              group relative aspect-square overflow-hidden rounded-xl
              bg-beige
              transition-all duration-200
              hover:shadow-lg
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-dust focus-visible:ring-offset-2
              active:scale-[0.97]
            "
          >
            <Image
              src={imgSrc}
              alt={photo.alt ?? (photo.capturedAt ? `Photo taken at ${photo.capturedAt}` : "Photo")}
              fill
              unoptimized
              sizes="(max-width: 640px) 50vw, 33vw"
              className="
                h-full w-full object-cover
                transition-transform duration-300
                group-hover:scale-105
              "
            />
            {/* Subtle hover overlay */}
            <div className="absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/5" />
          </button>
        );
      })}
    </div>
  );
}
