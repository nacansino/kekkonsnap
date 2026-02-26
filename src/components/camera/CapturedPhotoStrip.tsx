"use client";

import Image from "next/image";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

interface CapturedPhoto {
  id: string;
  thumbnailUrl: string;
  uploading: boolean;
}

interface CapturedPhotoStripProps {
  photos: CapturedPhoto[];
  className?: string;
}

export default function CapturedPhotoStrip({
  photos,
  className = "",
}: CapturedPhotoStripProps) {
  if (photos.length === 0) return null;

  return (
    <div
      className={`flex gap-2 overflow-x-auto px-4 py-2 scrollbar-none ${className}`}
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      {photos.map((photo) => (
        <div
          key={photo.id}
          className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl shadow-md"
        >
          <Image
            src={photo.thumbnailUrl}
            alt="Captured photo"
            fill
            unoptimized
            sizes="56px"
            className="h-full w-full object-cover"
          />
          {photo.uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
              <LoadingSpinner size="sm" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
