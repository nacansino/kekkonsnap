"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import PhotoLightbox from "@/components/guest/PhotoLightbox";
import { QRCodeSVG } from "qrcode.react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Stats {
  totalPhotos: number;
  totalGuests: number;
  participatingGuests: number;
  photosPerGuest: number;
  eventStatus: "active" | "locked" | "announced";
  scheduledLockAt: string | null;
}

interface Photo {
  id: number;
  thumbnailUrl: string;
  fullUrl: string;
  guestName: string;
  guestId: number;
  isWinner: boolean;
  capturedAt: string;
  fileSize: number;
}

// ---------------------------------------------------------------------------
// Status badge colors
// ---------------------------------------------------------------------------
const statusStyles: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 border-emerald-200",
  locked: "bg-amber-100 text-amber-800 border-amber-200",
  announced: "bg-rose-dust/10 text-rose-dust border-rose-dust/20",
};

const statusLabels: Record<string, string> = {
  active: "Active",
  locked: "Locked",
  announced: "Winner Announced",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function AdminDashboardPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [stats, setStats] = useState<Stats | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<"lock" | "announce" | "reopen" | "unlock" | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleLockInput, setScheduleLockInput] = useState("");
  const [error, setError] = useState("");
  const [origin, setOrigin] = useState("");
  const qrCodeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const loc = window.location;
    const host = loc.hostname.replace(/^admin\./, "");
    setOrigin(`${loc.protocol}//${host}${loc.port ? `:${loc.port}` : ""}`);
  }, []);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/${slug}/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // Silently fail for polling
    }
  }, [slug]);

  const fetchPhotos = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/${slug}/photos`);
      if (res.ok) {
        const data = await res.json();
        setPhotos(data.photos);
      }
    } catch {
      // Silently fail for polling
    }
  }, [slug]);

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchStats(), fetchPhotos()]);
  }, [fetchStats, fetchPhotos]);

  // Initial load
  useEffect(() => {
    fetchAll().then(() => setLoading(false));
  }, [fetchAll]);

  // Auto-refresh every 10 seconds when event is active
  useEffect(() => {
    if (stats?.eventStatus === "active") {
      pollRef.current = setInterval(fetchAll, 10_000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [stats?.eventStatus, fetchAll]);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------
  async function handleLock() {
    setConfirmAction(null);
    setActionLoading("lock");
    setError("");
    try {
      const res = await fetch(`/api/admin/${slug}/lock`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to lock event.");
        return;
      }
      await fetchAll();
    } catch {
      setError("Network error while locking event.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePickWinner(photoId: number) {
    setActionLoading(`pick-${photoId}`);
    setError("");
    try {
      const res = await fetch(`/api/admin/${slug}/pick-winner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to select winner.");
        return;
      }
      await fetchAll();
    } catch {
      setError("Network error while selecting winner.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleAnnounce() {
    setConfirmAction(null);
    setActionLoading("announce");
    setError("");
    try {
      const res = await fetch(`/api/admin/${slug}/announce`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to announce winner.");
        return;
      }
      await fetchAll();
    } catch {
      setError("Network error while announcing winner.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleChangeStatus(newStatus: "active" | "locked") {
    setConfirmAction(null);
    setActionLoading(`status-${newStatus}`);
    setError("");
    try {
      const res = await fetch(`/api/admin/${slug}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || `Failed to change status to ${newStatus}.`);
        return;
      }
      await fetchAll();
    } catch {
      setError(`Network error while changing status.`);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleScheduleLock() {
    if (!scheduleLockInput) return;
    setActionLoading("schedule");
    setError("");
    try {
      const res = await fetch(`/api/admin/${slug}/schedule-lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lockAt: new Date(scheduleLockInput).toISOString() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to schedule lock.");
        return;
      }
      setShowScheduleModal(false);
      setScheduleLockInput("");
      await fetchStats();
    } catch {
      setError("Network error while scheduling lock.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleClearSchedule() {
    setActionLoading("schedule");
    setError("");
    try {
      const res = await fetch(`/api/admin/${slug}/schedule-lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lockAt: null }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to clear schedule.");
        return;
      }
      await fetchStats();
    } catch {
      setError("Network error while clearing schedule.");
    } finally {
      setActionLoading(null);
    }
  }

  function handleDownloadAll() {
    window.open(`/api/admin/${slug}/download`, "_blank");
  }

  function handleDownloadQr() {
    const svg = qrCodeRef.current?.querySelector("svg");
    if (!svg) {
      setError("QR code is not ready to download yet.");
      return;
    }

    try {
      const serialized = new XMLSerializer().serializeToString(svg);
      const svgMarkup = serialized.includes('xmlns="http://www.w3.org/2000/svg"')
        ? serialized
        : serialized.replace(
          "<svg",
          '<svg xmlns="http://www.w3.org/2000/svg"',
        );

      const blob = new Blob([svgMarkup], {
        type: "image/svg+xml;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `kekkonsnap-${slug}-qr.svg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to download QR code.");
    }
  }

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const hasWinner = photos.some((p) => p.isWinner);
  const winnerPhoto = photos.find((p) => p.isWinner);

  return (
    <div className="space-y-6">
      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          {error}
          <button
            onClick={() => setError("")}
            className="ml-2 font-medium underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Stats panel */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card padding="md">
          <div className="text-center">
            <div className="text-2xl font-heading font-semibold text-charcoal">
              {stats?.totalPhotos ?? 0}
            </div>
            <div className="text-xs text-charcoal-light mt-1 font-body">
              Total Photos
            </div>
          </div>
        </Card>
        <Card padding="md">
          <div className="text-center">
            <div className="text-2xl font-heading font-semibold text-charcoal">
              {stats?.totalGuests ?? 0}
            </div>
            <div className="text-xs text-charcoal-light mt-1 font-body">
              Total Guests
            </div>
          </div>
        </Card>
        <Card padding="md">
          <div className="text-center">
            <div className="text-2xl font-heading font-semibold text-charcoal">
              {stats?.participatingGuests ?? 0}
            </div>
            <div className="text-xs text-charcoal-light mt-1 font-body">
              Participating
            </div>
          </div>
        </Card>
        <Card padding="md">
          <div className="text-center">
            <div className="text-2xl font-heading font-semibold text-charcoal">
              {stats?.photosPerGuest?.toFixed(1) ?? "0"}
            </div>
            <div className="text-xs text-charcoal-light mt-1 font-body">
              Avg Photos/Guest
            </div>
          </div>
        </Card>
      </div>

      {/* QR Code and link */}
      {origin && (
        <Card padding="md">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="group relative shrink-0">
              <div
                ref={qrCodeRef}
                className="bg-white p-2 text-charcoal rounded-xl shadow-sm border border-beige"
              >
                <QRCodeSVG value={`${origin}/${slug}`} size={120} />
              </div>
              <button
                type="button"
                onClick={handleDownloadQr}
                className="absolute top-1 right-1 inline-flex h-7 w-7 items-center justify-center rounded-full border border-beige bg-cream/95 text-charcoal-light shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:text-charcoal hover:bg-cream focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-dust focus-visible:ring-offset-2"
                aria-label="Download QR code"
                title="Download QR code"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3v11" />
                  <path d="m8 10 4 4 4-4" />
                  <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                </svg>
              </button>
            </div>
            <div>
              <h3 className="font-heading text-lg font-semibold text-charcoal">
                Guest Link
              </h3>
              <p className="text-sm text-charcoal-light font-body mt-1 mb-2">
                Have guests scan this QR code to join the event, or share the link below:
              </p>
              <a
                href={`${origin}/${slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-rose-dust font-medium underline hover:text-rose-dust-dark transition-colors"
              >
                {`${origin}/${slug}`}
              </a>
            </div>
          </div>
        </Card>
      )}

      {/* Status + Actions */}
      <Card padding="md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-charcoal-light font-body">
              Event Status:
            </span>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${statusStyles[stats?.eventStatus ?? "active"]
                }`}
            >
              {statusLabels[stats?.eventStatus ?? "active"]}
            </span>
            {stats?.scheduledLockAt && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border bg-blue-50 text-blue-700 border-blue-200">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Auto-locks at{" "}
                {new Date(stats.scheduledLockAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                <button
                  className="ml-1 text-blue-500 hover:text-blue-700 underline"
                  onClick={handleClearSchedule}
                >
                  Cancel
                </button>
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {stats?.eventStatus === "active" && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={actionLoading === "lock"}
                  onClick={() => setConfirmAction("lock")}
                >
                  Lock Event
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowScheduleModal(true)}
                >
                  Schedule Lock
                </Button>
              </>
            )}

            {stats?.eventStatus === "locked" && (
              <Button
                variant="ghost"
                size="sm"
                loading={actionLoading === "status-active"}
                onClick={() => setConfirmAction("reopen")}
              >
                Reopen Event
              </Button>
            )}

            {stats?.eventStatus === "locked" && hasWinner && (
              <Button
                variant="primary"
                size="sm"
                loading={actionLoading === "announce"}
                onClick={() => setConfirmAction("announce")}
              >
                Announce Winner
              </Button>
            )}

            {stats?.eventStatus === "announced" && (
              <Button
                variant="ghost"
                size="sm"
                loading={actionLoading === "status-locked"}
                onClick={() => setConfirmAction("unlock")}
              >
                Revert to Locked
              </Button>
            )}

            <Button variant="ghost" size="sm" onClick={handleDownloadAll}>
              Download All Photos
            </Button>
          </div>
        </div>
      </Card>

      {/* Winner display */}
      {winnerPhoto && (
        <Card padding="md">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Image
                src={winnerPhoto.thumbnailUrl}
                alt={`Winner photo by ${winnerPhoto.guestName}`}
                width={80}
                height={80}
                unoptimized
                className="w-20 h-20 rounded-xl object-cover border-2 border-amber-400 shadow-md"
              />
              <span className="absolute -top-2 -right-2 bg-amber-400 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow">
                Winner
              </span>
            </div>
            <div>
              <p className="font-heading text-lg font-semibold text-charcoal">
                {winnerPhoto.guestName}
              </p>
              <p className="text-xs text-charcoal-light font-body">
                Selected as the winning photo
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Photo grid */}
      <div>
        <h2 className="font-heading text-xl font-semibold text-charcoal mb-4">
          All Photos ({photos.length})
        </h2>

        {photos.length === 0 ? (
          <Card padding="lg">
            <p className="text-center text-charcoal-light font-body">
              No photos have been submitted yet.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {photos.map((photo, idx) => (
              <div
                key={photo.id}
                className={`group relative rounded-xl overflow-hidden shadow-sm transition-shadow hover:shadow-md cursor-pointer ${photo.isWinner
                  ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-cream"
                  : ""
                  }`}
                onClick={() => setSelectedPhotoIndex(idx)}
              >
                {/* Thumbnail */}
                <div className="relative aspect-square bg-beige">
                  <Image
                    src={photo.thumbnailUrl}
                    alt={`Photo by ${photo.guestName}`}
                    fill
                    unoptimized
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Winner badge */}
                {photo.isWinner && (
                  <div className="absolute top-2 left-2 bg-amber-400 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow">
                    Winner
                  </div>
                )}

                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-charcoal/0 group-hover:bg-charcoal/40 transition-colors flex items-end">
                  <div className="w-full p-2 bg-gradient-to-t from-charcoal/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-white text-xs font-medium truncate">
                      {photo.guestName}
                    </p>
                    <p className="text-white/70 text-[10px]">
                      {new Date(photo.capturedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>

                {/* Select as winner button (locked event only) */}
                {stats?.eventStatus === "locked" && !photo.isWinner && (
                  <button
                    className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm text-charcoal text-xs font-medium px-2 py-1 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePickWinner(photo.id);
                    }}
                  >
                    {actionLoading === `pick-${photo.id}`
                      ? "Selecting..."
                      : "Select Winner"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full-size photo lightbox with swipe */}
      <PhotoLightbox
        photos={photos.map((p) => ({
          id: p.id,
          fullUrl: p.fullUrl,
          thumbnailUrl: p.thumbnailUrl,
          alt: `Photo by ${p.guestName}`,
          capturedAt: p.capturedAt,
        }))}
        isOpen={selectedPhotoIndex !== null}
        currentIndex={selectedPhotoIndex ?? 0}
        onClose={() => setSelectedPhotoIndex(null)}
        renderFooter={(photo, _idx) => {
          const p = photos[_idx];
          if (!p) return null;
          return (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 space-y-2">
              <div className="flex items-center justify-between text-sm text-white/80">
                <span className="font-medium text-white">{p.guestName}</span>
                <span>{(p.fileSize / 1024).toFixed(0)} KB</span>
              </div>
              <div className="flex items-center justify-between text-xs text-white/60">
                <span>{new Date(p.capturedAt).toLocaleString()}</span>
              </div>
              <div className="flex gap-3 pt-1">
                <a
                  href={`/api/admin/${slug}/download/${p.id}`}
                  className="inline-flex items-center gap-1.5 text-sm text-white hover:text-white/80 font-medium transition-colors"
                  download
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v11"/><path d="m8 10 4 4 4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>
                  Download
                </a>
                {stats?.eventStatus === "locked" && !p.isWinner && (
                  <button
                    className="text-sm text-amber-400 hover:text-amber-300 font-medium ml-auto transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePickWinner(p.id);
                      setSelectedPhotoIndex(null);
                    }}
                  >
                    Select as Winner
                  </button>
                )}
                {p.isWinner && (
                  <span className="text-sm text-amber-400 font-medium ml-auto">
                    Winner
                  </span>
                )}
              </div>
            </div>
          );
        }}
      />

      {/* Confirm lock modal */}
      <Modal
        isOpen={confirmAction === "lock"}
        onClose={() => setConfirmAction(null)}
        title="Lock Event?"
      >
        <div className="space-y-4">
          <p className="text-sm text-charcoal-light font-body">
            Locking the event will prevent guests from submitting new photos.
            You can then review all submissions and pick a winner. This action
            cannot be undone.
          </p>
          <div className="flex gap-3 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmAction(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={actionLoading === "lock"}
              onClick={handleLock}
            >
              Lock Event
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm announce modal */}
      <Modal
        isOpen={confirmAction === "announce"}
        onClose={() => setConfirmAction(null)}
        title="Announce Winner?"
      >
        <div className="space-y-4">
          <p className="text-sm text-charcoal-light font-body">
            This will publicly announce the winning photo to all guests. This
            action cannot be undone.
          </p>
          {winnerPhoto && (
            <div className="flex items-center gap-3 bg-cream rounded-xl p-3">
              <Image
                src={winnerPhoto.thumbnailUrl}
                alt="Winner"
                width={48}
                height={48}
                unoptimized
                className="w-12 h-12 rounded-lg object-cover"
              />
              <span className="text-sm font-medium text-charcoal">
                {winnerPhoto.guestName}
              </span>
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmAction(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={actionLoading === "announce"}
              onClick={handleAnnounce}
            >
              Announce Winner
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm reopen (locked → active) */}
      <Modal
        isOpen={confirmAction === "reopen"}
        onClose={() => setConfirmAction(null)}
        title="Reopen Event?"
      >
        <div className="space-y-4">
          <p className="text-sm text-charcoal-light font-body">
            This will reopen the event, allowing guests to submit new photos
            again. The winner selection will be cleared.
          </p>
          <div className="flex gap-3 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmAction(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={actionLoading === "status-active"}
              onClick={() => handleChangeStatus("active")}
            >
              Reopen Event
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm unlock (announced → locked) */}
      <Modal
        isOpen={confirmAction === "unlock"}
        onClose={() => setConfirmAction(null)}
        title="Revert to Locked?"
      >
        <div className="space-y-4">
          <p className="text-sm text-charcoal-light font-body">
            This will hide the winner announcement from guests and revert the
            event back to the locked state. The winner selection will be kept.
          </p>
          <div className="flex gap-3 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmAction(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={actionLoading === "status-locked"}
              onClick={() => handleChangeStatus("locked")}
            >
              Revert to Locked
            </Button>
          </div>
        </div>
      </Modal>

      {/* Schedule lock modal */}
      <Modal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        title="Schedule Auto-Lock"
      >
        <div className="space-y-4">
          <p className="text-sm text-charcoal-light font-body">
            Set a time to automatically lock the event. Guests will no longer be
            able to submit photos after this time.
          </p>
          <input
            type="datetime-local"
            value={scheduleLockInput}
            onChange={(e) => setScheduleLockInput(e.target.value)}
            className="w-full rounded-xl border border-beige bg-cream px-4 py-2.5 text-sm text-charcoal font-body focus:outline-none focus:ring-2 focus:ring-rose-dust focus:border-transparent"
          />
          <div className="flex gap-3 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowScheduleModal(false);
                setScheduleLockInput("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={actionLoading === "schedule"}
              onClick={handleScheduleLock}
              disabled={!scheduleLockInput}
            >
              Set Schedule
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
