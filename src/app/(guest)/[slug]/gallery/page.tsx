"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter, useParams } from "next/navigation";
import { useEventStream } from "@/components/providers/EventStreamProvider";
import PhotoLightbox from "@/components/guest/PhotoLightbox";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

interface GalleryPhoto {
  id: number;
  thumbnailUrl: string;
  fullUrl: string;
  guestName: string;
  isWinner: boolean;
  capturedAt: string;
}

export default function GalleryPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const eventState = useEventStream();

  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Redirect if not yet announced
  useEffect(() => {
    if (eventState.status !== "announced") {
      router.replace(`/${slug}/winner`);
    }
  }, [eventState.status, slug, router]);

  // Fetch all photos
  useEffect(() => {
    let cancelled = false;

    async function fetchAllPhotos() {
      try {
        const res = await fetch(`/api/events/${slug}/photos/all`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setPhotos(data.photos ?? []);
            setIsLoading(false);
          }
        }
      } catch {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    if (eventState.status === "announced") {
      fetchAllPhotos();
    }

    return () => {
      cancelled = true;
    };
  }, [slug, eventState.status]);

  if (eventState.status !== "announced") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Separate winner photo from the rest
  const winnerPhoto = photos.find((p) => p.isWinner);
  const otherPhotos = photos.filter((p) => !p.isWinner);

  // Combined list for lightbox: winner first, then others
  const orderedPhotos = winnerPhoto
    ? [winnerPhoto, ...otherPhotos]
    : otherPhotos;

  // Convert to lightbox-compatible format (matches PhotoLightbox's Photo interface)
  const lightboxPhotos = orderedPhotos.map((p) => ({
    id: p.id,
    thumbnailUrl: p.thumbnailUrl,
    fullUrl: p.fullUrl,
    capturedAt: p.capturedAt,
  }));

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      {/* Page header */}
      <div className="mb-6 text-center">
        <h2 className="font-heading text-2xl font-semibold text-charcoal">
          Snap Gallery
        </h2>
        <p className="mt-1 text-sm text-charcoal-light/70">
          {photos.length} snaps captured at this event
        </p>
      </div>

      {/* Winner photo -- pinned at top with gold highlight */}
      {winnerPhoto && (
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-2">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="text-amber-500"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span className="text-sm font-medium text-amber-700">
              Winning Photo
            </span>
          </div>
          <button
            onClick={() => setLightboxIndex(0)}
            className="group relative w-full overflow-hidden rounded-2xl ring-2 ring-amber-400 ring-offset-2 ring-offset-cream shadow-lg"
          >
            <div className="relative aspect-[4/3] w-full">
              <Image
                src={winnerPhoto.thumbnailUrl}
                alt={`Winning photo by ${winnerPhoto.guestName}`}
                fill
                unoptimized
                priority
                sizes="100vw"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 pb-3 pt-8">
              <p className="font-heading text-base text-white">
                {winnerPhoto.guestName}
              </p>
            </div>
          </button>
        </div>
      )}

      {/* All other photos grid */}
      {otherPhotos.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {otherPhotos.map((photo, idx) => {
            // Index offset for lightbox: +1 if winner photo exists
            const lightboxIdx = winnerPhoto ? idx + 1 : idx;

            return (
              <button
                key={photo.id}
                onClick={() => setLightboxIndex(lightboxIdx)}
                className="group relative aspect-square overflow-hidden rounded-xl"
              >
                <Image
                  src={photo.thumbnailUrl}
                  alt={`Photo by ${photo.guestName}`}
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 50vw, 33vw"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent px-2 pb-2 pt-6">
                  <p className="text-xs text-white/90 truncate">
                    {photo.guestName}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {photos.length === 0 && (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-charcoal-light/70 text-sm">
            No snaps have been uploaded yet.
          </p>
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={lightboxPhotos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
