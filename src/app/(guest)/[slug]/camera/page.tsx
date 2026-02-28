"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "@/components/providers/SessionProvider";
import { useEventStream } from "@/components/providers/EventStreamProvider";
import CameraViewfinder from "@/components/camera/CameraViewfinder";
import CapturedPhotoStrip from "@/components/camera/CapturedPhotoStrip";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

interface CapturedPhoto {
  id: string;
  thumbnailUrl: string;
  uploading: boolean;
}

export default function CameraPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const session = useSession();
  const eventState = useEventStream();

  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
  const [photosCount, setPhotosCount] = useState<number | null>(null);
  const [shotLimit, setShotLimit] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLastShotToast, setShowLastShotToast] = useState(false);
  const uploadCounterRef = useRef(0);
  const lastShotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Redirect if event is locked or announced
  useEffect(() => {
    if (eventState.status === "locked" || eventState.status === "announced") {
      router.replace(`/${slug}/winner`);
    }
  }, [eventState.status, slug, router]);

  // Redirect if no session or terms not agreed
  useEffect(() => {
    if (session === null) return; // still loading
    if (!session.agreedToTerms) {
      router.replace(`/${slug}/terms`);
    }
  }, [session, slug, router]);

  // Fetch remaining shots
  useEffect(() => {
    let cancelled = false;

    async function fetchMyPhotos() {
      try {
        const res = await fetch(`/api/events/${slug}/photos/mine`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setPhotosCount(data.count ?? data.photos?.length ?? 0);
            setShotLimit(data.shotLimit ?? session?.shotLimit ?? 5);

            // Pre-populate captured strip with existing photos
            if (data.photos && Array.isArray(data.photos)) {
              setCapturedPhotos(
                data.photos.map((p: { id: number; thumbnailUrl: string }) => ({
                  id: String(p.id),
                  thumbnailUrl: p.thumbnailUrl,
                  uploading: false,
                }))
              );
            }

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
      fetchMyPhotos();
    }

    return () => {
      cancelled = true;
    };
  }, [slug, session]);

  const handleCapture = useCallback(
    async (blob: Blob) => {
      if (photosCount === null || shotLimit === null) return;
      if (photosCount >= shotLimit) return;

      const tempId = `upload-${++uploadCounterRef.current}`;
      const tempUrl = URL.createObjectURL(blob);

      // Add to strip immediately as uploading
      setCapturedPhotos((prev) => [
        ...prev,
        { id: tempId, thumbnailUrl: tempUrl, uploading: true },
      ]);

      // Optimistically increment count
      setPhotosCount((prev) => (prev !== null ? prev + 1 : prev));

      try {
        const formData = new FormData();
        formData.append("photo", blob, `photo-${Date.now()}.jpg`);

        const res = await fetch(`/api/events/${slug}/photos`, {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          setCapturedPhotos((prev) =>
            prev.map((p) =>
              p.id === tempId
                ? {
                    id: String(data.id ?? tempId),
                    thumbnailUrl: data.thumbnailUrl ?? tempUrl,
                    uploading: false,
                  }
                : p
            )
          );

          // Show last shot toast when 1 remaining after this upload
          const newRemaining = shotLimit !== null ? shotLimit - (photosCount! + 1) : null;
          if (newRemaining === 1) {
            if (lastShotTimerRef.current) clearTimeout(lastShotTimerRef.current);
            setShowLastShotToast(true);
            lastShotTimerRef.current = setTimeout(() => setShowLastShotToast(false), 3000);
          }
        } else {
          // Upload failed — remove from strip and decrement count
          setCapturedPhotos((prev) => prev.filter((p) => p.id !== tempId));
          setPhotosCount((prev) => (prev !== null ? prev - 1 : prev));
          URL.revokeObjectURL(tempUrl);
        }
      } catch {
        // Network error — remove from strip and decrement count
        setCapturedPhotos((prev) => prev.filter((p) => p.id !== tempId));
        setPhotosCount((prev) => (prev !== null ? prev - 1 : prev));
        URL.revokeObjectURL(tempUrl);
      }
    },
    [slug, photosCount, shotLimit]
  );

  // Loading state
  if (isLoading || session === null) {
    return (
      <div className="flex flex-1 items-center justify-center bg-charcoal">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const remaining =
    photosCount !== null && shotLimit !== null
      ? Math.max(0, shotLimit - photosCount)
      : 0;
  const allShotsUsed = remaining <= 0;

  return (
    <div className="relative flex flex-1 flex-col bg-black">
      {/* Camera viewfinder fills the screen */}
      <div className="flex-1">
        <CameraViewfinder
          onCapture={handleCapture}
          disabled={allShotsUsed}
          remainingShots={remaining}
          totalShots={shotLimit ?? 5}
        />
      </div>

      {/* Last shot toast warning */}
      {showLastShotToast && (
        <div className="absolute bottom-44 inset-x-0 z-25 flex justify-center pointer-events-none animate-[slideUp_300ms_ease-out,fadeOut_300ms_ease-in_2700ms_forwards]">
          <div className="bg-amber-500 text-white px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            Last snap — make it count!
          </div>
        </div>
      )}

      {/* Captured photo strip overlay at bottom */}
      {capturedPhotos.length > 0 && (
        <div className="absolute bottom-24 inset-x-0 z-20 pb-[env(safe-area-inset-bottom)]">
          <CapturedPhotoStrip photos={capturedPhotos} />
        </div>
      )}

      {/* All shots used overlay with navigation */}
      {allShotsUsed && (
        <div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-16">
          <div className="flex flex-col items-center gap-3">
            <p className="font-heading text-lg text-white text-center">
              All snaps captured!
            </p>
            <p className="text-sm text-white/60 text-center mb-2">
              View your snaps or head to the winner reveal.
            </p>
            <div className="flex gap-3 w-full max-w-xs">
              <Button
                variant="secondary"
                size="md"
                className="flex-1 !border-white/30 !text-white hover:!bg-white/10"
                onClick={() => router.push(`/${slug}/photos`)}
              >
                Your Snaps
              </Button>
              <Button
                variant="primary"
                size="md"
                className="flex-1"
                onClick={() => router.push(`/${slug}/winner`)}
              >
                Winner
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
