"use client";

import { useSession } from "@/components/providers/SessionProvider";

export default function GuestHeaderName() {
    const session = useSession();

    if (!session) return null;

    return (
        <span className="text-xs text-charcoal-light/60 font-body">
            {session.guestName}
        </span>
    );
}
