"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

interface EventItem {
    id: number;
    name: string;
    slug: string;
    status: string;
    shotLimit: number;
    createdAt: string;
}

const statusStyles: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-800 border-emerald-200",
    locked: "bg-amber-100 text-amber-800 border-amber-200",
    announced: "bg-rose-dust/10 text-rose-dust border-rose-dust/20",
};

const statusLabels: Record<string, string> = {
    active: "Active",
    locked: "Locked",
    announced: "Announced",
};

export default function AdminEventsPage() {
    const router = useRouter();
    const [masterPassword, setMasterPassword] = useState("");
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [events, setEvents] = useState<EventItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [authError, setAuthError] = useState("");
    const [error, setError] = useState("");

    // Create event form
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState("");
    const [newSlug, setNewSlug] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [newShotLimit, setNewShotLimit] = useState("5");
    const [creating, setCreating] = useState(false);

    // Delete confirmation
    const [deleteTarget, setDeleteTarget] = useState<EventItem | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Auto-generate slug from name
    useEffect(() => {
        const slug = newName
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");
        setNewSlug(slug);
    }, [newName]);

    async function fetchEvents() {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/admin/events", {
                headers: { "x-admin-password": masterPassword },
            });
            if (!res.ok) {
                if (res.status === 401) {
                    setIsAuthenticated(false);
                    setAuthError("Invalid master password.");
                    return;
                }
                throw new Error("Failed to fetch events");
            }
            const data = await res.json();
            setEvents(data.events ?? []);
            setIsAuthenticated(true);
        } catch {
            setError("Failed to load events.");
        } finally {
            setLoading(false);
        }
    }

    async function handleAuth(e: FormEvent) {
        e.preventDefault();
        setAuthError("");
        await fetchEvents();
    }

    async function handleCreate(e: FormEvent) {
        e.preventDefault();
        setCreating(true);
        setError("");
        try {
            const res = await fetch("/api/admin/events", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-admin-password": masterPassword,
                },
                body: JSON.stringify({
                    name: newName,
                    slug: newSlug,
                    password: newPassword,
                    shotLimit: parseInt(newShotLimit) || 5,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Failed to create event.");
                return;
            }
            // Reset form and refresh
            setNewName("");
            setNewSlug("");
            setNewPassword("");
            setNewShotLimit("5");
            setShowCreate(false);
            await fetchEvents();
        } catch {
            setError("Network error while creating event.");
        } finally {
            setCreating(false);
        }
    }

    async function handleDelete() {
        if (!deleteTarget) return;
        setDeleting(true);
        setError("");
        try {
            const res = await fetch("/api/admin/events", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    "x-admin-password": masterPassword,
                },
                body: JSON.stringify({ slug: deleteTarget.slug }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Failed to delete event.");
                return;
            }
            setDeleteTarget(null);
            await fetchEvents();
        } catch {
            setError("Network error while deleting event.");
        } finally {
            setDeleting(false);
        }
    }

    // Auth screen
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-cream flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <div className="text-center mb-8">
                        <h1 className="font-heading text-3xl font-semibold text-charcoal mb-2">
                            Event Management
                        </h1>
                        <p className="text-charcoal-light font-body text-sm">
                            Enter the master admin password to manage events.
                        </p>
                    </div>

                    <Card padding="lg">
                        <form onSubmit={handleAuth} className="space-y-6">
                            <Input
                                label="Master Password"
                                type="password"
                                value={masterPassword}
                                onChange={(e) => setMasterPassword(e.target.value)}
                                placeholder="Enter master admin password"
                                autoFocus
                                required
                            />

                            {authError && (
                                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3" role="alert">
                                    {authError}
                                </div>
                            )}

                            <Button
                                type="submit"
                                loading={loading}
                                disabled={!masterPassword.trim()}
                                className="w-full"
                                size="lg"
                            >
                                Sign In
                            </Button>
                        </form>
                    </Card>

                    <p className="text-center mt-6 text-charcoal-light/60 text-xs font-body">
                        Kekkonsnap &mdash; Wedding Photo Contest
                    </p>
                </div>
            </div>
        );
    }

    // Events management
    return (
        <div className="min-h-screen bg-cream">
            <div className="max-w-4xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="font-heading text-3xl font-semibold text-charcoal">
                            Events
                        </h1>
                        <p className="text-charcoal-light font-body text-sm mt-1">
                            {events.length} event{events.length !== 1 ? "s" : ""}
                        </p>
                    </div>
                    <Button
                        variant="primary"
                        size="md"
                        onClick={() => setShowCreate(true)}
                    >
                        + New Event
                    </Button>
                </div>

                {/* Error banner */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-6">
                        {error}
                        <button
                            onClick={() => setError("")}
                            className="ml-2 font-medium underline hover:no-underline"
                        >
                            Dismiss
                        </button>
                    </div>
                )}

                {/* Loading */}
                {loading ? (
                    <div className="flex justify-center py-12">
                        <LoadingSpinner size="lg" />
                    </div>
                ) : events.length === 0 ? (
                    <Card padding="lg">
                        <div className="text-center py-8">
                            <p className="text-charcoal-light font-body mb-4">
                                No events yet. Create your first event to get started.
                            </p>
                            <Button
                                variant="primary"
                                size="md"
                                onClick={() => setShowCreate(true)}
                            >
                                Create Event
                            </Button>
                        </div>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {events.map((event) => (
                            <Card key={event.id} padding="md">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3">
                                            <h2 className="font-heading text-lg font-semibold text-charcoal truncate">
                                                {event.name}
                                            </h2>
                                            <span
                                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusStyles[event.status] ?? statusStyles.active
                                                    }`}
                                            >
                                                {statusLabels[event.status] ?? event.status}
                                            </span>
                                        </div>
                                        <p className="text-xs text-charcoal-light/60 font-body mt-1">
                                            /{event.slug} &middot; {event.shotLimit} shots &middot; Admin: /admin/{event.slug}
                                        </p>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => router.push(`/admin/${event.slug}`)}
                                        >
                                            Manage
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setDeleteTarget(event)}
                                        >
                                            Delete
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Create event modal */}
                <Modal
                    isOpen={showCreate}
                    onClose={() => setShowCreate(false)}
                    title="Create New Event"
                >
                    <form onSubmit={handleCreate} className="space-y-4">
                        <Input
                            label="Event Name"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Our Wedding"
                            required
                        />
                        <Input
                            label="URL Slug"
                            value={newSlug}
                            onChange={(e) => setNewSlug(e.target.value)}
                            placeholder="our-wedding"
                            required
                        />
                        <Input
                            label="Admin Password"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Set a password for this event"
                            required
                        />
                        <Input
                            label="Shot Limit (per guest)"
                            type="number"
                            value={newShotLimit}
                            onChange={(e) => setNewShotLimit(e.target.value)}
                            placeholder="5"
                            min="1"
                            max="50"
                        />
                        <div className="flex gap-3 justify-end pt-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                type="button"
                                onClick={() => setShowCreate(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                size="sm"
                                type="submit"
                                loading={creating}
                                disabled={!newName.trim() || !newSlug.trim() || !newPassword.trim()}
                            >
                                Create Event
                            </Button>
                        </div>
                    </form>
                </Modal>

                {/* Delete confirmation modal */}
                <Modal
                    isOpen={!!deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    title="Delete Event?"
                >
                    <div className="space-y-4">
                        <p className="text-sm text-charcoal-light font-body">
                            Are you sure you want to delete{" "}
                            <strong className="text-charcoal">{deleteTarget?.name}</strong>? This
                            will permanently delete all guests, sessions, and photos associated
                            with this event. This action cannot be undone.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteTarget(null)}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                size="sm"
                                loading={deleting}
                                onClick={handleDelete}
                            >
                                Delete Event
                            </Button>
                        </div>
                    </div>
                </Modal>
            </div>
        </div>
    );
}
