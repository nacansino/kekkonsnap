"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Guest {
  id: number;
  name: string;
  tableNumber: string | null;
  photoCount: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function AdminGuestsPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Individual add form
  const [addName, setAddName] = useState("");
  const [addTable, setAddTable] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  // Bulk import form
  const [importText, setImportText] = useState("");
  const [importLoading, setImportLoading] = useState(false);

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------
  const fetchGuests = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/${slug}/guests`);
      if (res.ok) {
        const data = await res.json();
        setGuests(data.guests);
      }
    } catch {
      setError("Failed to load guests.");
    }
  }, [slug]);

  useEffect(() => {
    fetchGuests().then(() => setLoading(false));
  }, [fetchGuests]);

  // -----------------------------------------------------------------------
  // Add single guest
  // -----------------------------------------------------------------------
  async function handleAddGuest(e: FormEvent) {
    e.preventDefault();
    if (!addName.trim()) return;

    setAddLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/admin/${slug}/guests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guests: [{ name: addName.trim(), tableNumber: addTable.trim() || undefined }],
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to add guest.");
        return;
      }

      setSuccess(`Added "${addName.trim()}" to the guest list.`);
      setAddName("");
      setAddTable("");
      await fetchGuests();
    } catch {
      setError("Network error while adding guest.");
    } finally {
      setAddLoading(false);
    }
  }

  // -----------------------------------------------------------------------
  // Bulk import
  // -----------------------------------------------------------------------
  function parseImportText(text: string): Array<{ name: string; tableNumber?: string }> | null {
    const trimmed = text.trim();

    // Try parsing as JSON first
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => {
          if (typeof item === "string") return { name: item };
          if (typeof item === "object" && item.name) return { name: item.name, tableNumber: item.tableNumber };
          return null;
        }).filter(Boolean) as Array<{ name: string; tableNumber?: string }>;
      }
    } catch {
      // Not JSON, try CSV
    }

    // Try CSV: "name,table" per line
    const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return null;

    return lines.map((line) => {
      const parts = line.split(",").map((p) => p.trim());
      return {
        name: parts[0],
        tableNumber: parts[1] || undefined,
      };
    }).filter((g) => g.name.length > 0);
  }

  async function handleBulkImport(e: FormEvent) {
    e.preventDefault();
    setImportLoading(true);
    setError("");
    setSuccess("");

    const parsed = parseImportText(importText);
    if (!parsed || parsed.length === 0) {
      setError("Could not parse guest list. Use JSON array or CSV (name,table per line).");
      setImportLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/admin/${slug}/guests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guests: parsed }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to import guests.");
        return;
      }

      const data = await res.json();
      setSuccess(`Successfully imported ${data.imported} guest(s).`);
      setImportText("");
      await fetchGuests();
    } catch {
      setError("Network error while importing guests.");
    } finally {
      setImportLoading(false);
    }
  }

  // -----------------------------------------------------------------------
  // Delete guest
  // -----------------------------------------------------------------------
  async function handleDeleteGuest(guestId: number, guestName: string) {
    if (!confirm(`Remove "${guestName}" from the guest list?`)) return;

    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/admin/${slug}/guests`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestId }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to delete guest.");
        return;
      }

      setSuccess(`Removed "${guestName}" from the guest list.`);
      await fetchGuests();
    } catch {
      setError("Network error while deleting guest.");
    }
  }

  // -----------------------------------------------------------------------
  // Loading
  // -----------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-charcoal">
        Guest Management
      </h1>

      {/* Error / Success banners */}
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
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3">
          {success}
          <button
            onClick={() => setSuccess("")}
            className="ml-2 font-medium underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Add single guest form */}
      <Card padding="md">
        <h2 className="font-heading text-lg font-semibold text-charcoal mb-4">
          Add Guest
        </h2>
        <form onSubmit={handleAddGuest} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Guest name"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              required
            />
          </div>
          <div className="w-full sm:w-32">
            <Input
              placeholder="Table #"
              value={addTable}
              onChange={(e) => setAddTable(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            size="md"
            loading={addLoading}
            disabled={!addName.trim()}
          >
            Add
          </Button>
        </form>
      </Card>

      {/* Bulk import form */}
      <Card padding="md">
        <h2 className="font-heading text-lg font-semibold text-charcoal mb-2">
          Bulk Import
        </h2>
        <p className="text-xs text-charcoal-light mb-3 font-body">
          Paste a JSON array (e.g.{" "}
          <code className="bg-beige px-1 rounded">
            [{"{"}&quot;name&quot;:&quot;Alice&quot;, &quot;tableNumber&quot;:&quot;1&quot;{"}"}]
          </code>
          ) or CSV lines (name,table per line).
        </p>
        <form onSubmit={handleBulkImport} className="space-y-3">
          <textarea
            className="w-full rounded-xl bg-cream px-4 py-3 text-charcoal placeholder:text-charcoal-light/50 border-2 border-beige focus:outline-none focus:border-rose-dust focus:ring-2 focus:ring-rose-dust/20 font-body text-sm min-h-[120px] resize-y"
            placeholder={`Alice,1\nBob,2\nCharlie,3`}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          />
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            loading={importLoading}
            disabled={!importText.trim()}
          >
            Import Guests
          </Button>
        </form>
      </Card>

      {/* Guest list table */}
      <Card padding="sm">
        <div className="px-3 py-2 border-b border-beige">
          <h2 className="font-heading text-lg font-semibold text-charcoal">
            Guests ({guests.length})
          </h2>
        </div>

        {guests.length === 0 ? (
          <div className="px-3 py-8 text-center text-charcoal-light font-body text-sm">
            No guests added yet. Add guests individually or use bulk import above.
          </div>
        ) : (
          <div className="divide-y divide-beige">
            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-charcoal-light uppercase tracking-wide font-body">
              <div className="col-span-5">Name</div>
              <div className="col-span-2">Table</div>
              <div className="col-span-2 text-center">Photos</div>
              <div className="col-span-3 text-right">Actions</div>
            </div>

            {/* Guest rows */}
            {guests.map((guest) => (
              <div
                key={guest.id}
                className="grid grid-cols-12 gap-2 px-3 py-2.5 items-center text-sm hover:bg-cream/50 transition-colors"
              >
                <div className="col-span-5 font-medium text-charcoal truncate">
                  {guest.name}
                </div>
                <div className="col-span-2 text-charcoal-light">
                  {guest.tableNumber || "-"}
                </div>
                <div className="col-span-2 text-center">
                  <span
                    className={`inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded-full text-xs font-medium ${
                      guest.photoCount > 0
                        ? "bg-rose-dust/10 text-rose-dust"
                        : "bg-beige text-charcoal-light"
                    }`}
                  >
                    {guest.photoCount}
                  </span>
                </div>
                <div className="col-span-3 text-right">
                  {guest.photoCount === 0 && (
                    <button
                      className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                      onClick={() => handleDeleteGuest(guest.id, guest.name)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
