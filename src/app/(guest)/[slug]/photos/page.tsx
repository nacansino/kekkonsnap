"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "@/components/providers/SessionProvider";
import PhotoGrid from "@/components/guest/PhotoGrid";
import PhotoLightbox from "@/components/guest/PhotoLightbox";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

interface Photo {
  id: number;
  thumbnailUrl: string;
  fullUrl: string;
  capturedAt: string;
}

export default function MyPhotosPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const session = useSession();

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [shotLimit, setShotLimit] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchPhotos() {
      try {
        const res = await fetch(`/api/events/${slug}/photos/mine`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setPhotos(data.photos ?? []);
            setShotLimit(data.shotLimit ?? 0);
            setIsLoading(false);
          }
        }
      } catch {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    if (session) {
      fetchPhotos();
    }

    return () => {
      cancelled = true;
    };
  }, [slug, session]);

  if (session === null || isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const remaining = Math.max(0, shotLimit - photos.length);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Page header */}
      <div className="shrink-0 px-4 pt-6 pb-4 text-center">
        <h2 className="font-heading text-2xl font-semibold text-charcoal">
          Your Snaps
        </h2>
        <p className="mt-1 text-sm text-charcoal-light/70">
          {photos.length} of {shotLimit} snaps taken
        </p>
      </div>

      {/* Photo grid — scrollable */}
      <div className="flex-1 overflow-y-auto px-4">
        {photos.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-beige">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-rose-dust/60"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <p className="text-charcoal-light/70 text-sm max-w-xs">
              You haven&apos;t taken any snaps yet. Head to the camera to start capturing!
            </p>
            <Button onClick={() => router.push(`/${slug}/camera`)} size="md">
              Open Camera
            </Button>
          </div>
        ) : (
          <PhotoGrid
            photos={photos}
            onPhotoClick={(index) => setLightboxIndex(index)}
          />
        )}
      </div>

      {/* Bottom navigation — pinned */}
      <div className="shrink-0 flex flex-col items-center gap-3 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {remaining > 0 && (
          <Button
            variant="primary"
            size="md"
            onClick={() => router.push(`/${slug}/camera`)}
          >
            Back to Camera ({remaining} snaps left)
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/${slug}/winner`)}
        >
          Go to Winner Reveal
        </Button>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={photos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
