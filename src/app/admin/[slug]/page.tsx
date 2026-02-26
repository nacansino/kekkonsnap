"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useParams } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";

export default function AdminLoginPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/${slug}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed. Please try again.");
        return;
      }

      router.push(`/admin/${slug}/dashboard`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-heading text-3xl font-semibold text-charcoal mb-2">
            Admin Login
          </h1>
          <p className="text-charcoal-light font-body text-sm">
            Enter the admin password to manage your event.
          </p>
        </div>

        <Card padding="lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Admin Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your admin password"
              autoFocus
              required
            />

            {error && (
              <div
                className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3"
                role="alert"
              >
                {error}
              </div>
            )}

            <Button
              type="submit"
              loading={loading}
              disabled={!password.trim()}
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
