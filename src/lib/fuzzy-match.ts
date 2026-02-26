import Fuse, { type IFuseOptions } from "fuse.js";

interface GuestMatch {
  id: number;
  name: string;
  tableNumber?: string | null;
}

const fuseOptions: IFuseOptions<GuestMatch> = {
  keys: ["name"],
  threshold: 0.4,
  includeScore: true,
  minMatchCharLength: 2,
};

export function createGuestMatcher(guests: GuestMatch[]): Fuse<GuestMatch> {
  return new Fuse(guests, fuseOptions);
}

export function findMatchingGuests(
  matcher: Fuse<GuestMatch>,
  query: string,
  limit: number = 5
): GuestMatch[] {
  if (!query || query.length < 2) {
    return [];
  }

  const results = matcher.search(query, { limit });
  return results.map((result) => result.item);
}
