import { notFound } from "next/navigation";
import { db } from "@/db";
import { events } from "@/db/schema";
import { eq } from "drizzle-orm";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { EventStreamProvider } from "@/components/providers/EventStreamProvider";
import GuestHeaderName from "@/components/guest/GuestHeaderName";

interface GuestLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function GuestLayout({ children, params }: GuestLayoutProps) {
  const { slug } = await params;

  const event = await db
    .select({
      id: events.id,
      name: events.name,
      slug: events.slug,
      status: events.status,
    })
    .from(events)
    .where(eq(events.slug, slug))
    .get();

  if (!event) {
    notFound();
  }

  return (
    <SessionProvider slug={slug}>
      <EventStreamProvider slug={slug} initialStatus={event.status}>
        <div className="flex min-h-dvh flex-col bg-cream">
          {/* Minimal header */}
          <header className="flex flex-col items-center justify-center px-4 py-3 border-b border-beige">
            <h1 className="font-heading text-lg text-rose-dust tracking-wide">
              {event.name}
            </h1>
            <GuestHeaderName />
          </header>

          {/* Page content */}
          <main className="flex flex-1 flex-col">
            {children}
          </main>
        </div>
      </EventStreamProvider>
    </SessionProvider>
  );
}
