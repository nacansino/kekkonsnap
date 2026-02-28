import type { ReactNode } from "react";
import Link from "next/link";

interface AdminLayoutProps {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function AdminLayout({
  children,
  params,
}: AdminLayoutProps) {
  const { slug } = await params;

  return (
    <div className="min-h-screen bg-cream">
      {/* Admin nav header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-beige sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <span className="font-heading text-lg font-semibold text-charcoal">
                Kekkonsnap
              </span>
              <span className="text-charcoal-light/40 font-body text-sm">/</span>
              <span className="text-charcoal-light font-body text-sm">
                {slug}
              </span>
            </div>

            <nav className="flex items-center gap-1">
              <Link
                href="/admin"
                className="px-3 py-1.5 rounded-full text-sm font-medium text-charcoal-light hover:text-charcoal hover:bg-charcoal/5 transition-colors inline-flex items-center gap-1"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                Events
              </Link>
              <a
                href={`/admin/${slug}/dashboard`}
                className="px-3 py-1.5 rounded-full text-sm font-medium text-charcoal-light hover:text-charcoal hover:bg-charcoal/5 transition-colors"
              >
                Dashboard
              </a>
              <a
                href={`/admin/${slug}/guests`}
                className="px-3 py-1.5 rounded-full text-sm font-medium text-charcoal-light hover:text-charcoal hover:bg-charcoal/5 transition-colors"
              >
                Guests
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}
