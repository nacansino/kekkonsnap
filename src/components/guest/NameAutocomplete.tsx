"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import Fuse from "fuse.js";

interface Guest {
  id: number;
  name: string;
  tableNumber?: string | number | null;
}

interface NameAutocompleteProps {
  slug: string;
  onSelect: (guest: Guest) => void;
  placeholder?: string;
  className?: string;
}

export default function NameAutocomplete({
  slug,
  onSelect,
  placeholder = "Search your name...",
  className = "",
}: NameAutocompleteProps) {
  const listboxId = "guest-autocomplete-listbox";
  const [guests, setGuests] = useState<Guest[]>([]);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Fetch guest list from API
  useEffect(() => {
    let cancelled = false;

    async function fetchGuests() {
      try {
        const res = await fetch(`/api/events/${slug}/guests`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setGuests(Array.isArray(data) ? data : data.guests ?? []);
          }
        }
      } catch {
        // Silently fail; user can still type
      }
    }

    fetchGuests();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const fuse = useMemo(
    () =>
      new Fuse(guests, {
        keys: ["name"],
        threshold: 0.35,
        distance: 100,
      }),
    [guests]
  );

  const results = useMemo(() => {
    if (query.length < 2) return [];
    return fuse.search(query).slice(0, 8);
  }, [fuse, query]);

  useEffect(() => {
    setIsOpen(results.length > 0);
    setActiveIndex(-1);
  }, [results]);

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.children[activeIndex] as HTMLElement;
      activeEl?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  const selectGuest = useCallback(
    (guest: Guest) => {
      setQuery(guest.name);
      setIsOpen(false);
      onSelect(guest);
      inputRef.current?.blur();
    },
    [onSelect]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((prev) =>
            prev < results.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((prev) =>
            prev > 0 ? prev - 1 : results.length - 1
          );
          break;
        case "Enter":
          e.preventDefault();
          if (activeIndex >= 0 && results[activeIndex]) {
            selectGuest(results[activeIndex].item);
          }
          break;
        case "Escape":
          setIsOpen(false);
          setActiveIndex(-1);
          break;
      }
    },
    [isOpen, activeIndex, results, selectGuest]
  );

  // Highlight matching text
  const highlightMatch = (name: string) => {
    if (!query) return name;
    const lowerName = name.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const idx = lowerName.indexOf(lowerQuery);
    if (idx === -1) return name;

    return (
      <>
        {name.slice(0, idx)}
        <span className="font-semibold text-rose-dust">
          {name.slice(idx, idx + query.length)}
        </span>
        {name.slice(idx + query.length)}
      </>
    );
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        {/* Search icon */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="absolute left-4 top-1/2 -translate-y-1/2 text-charcoal-light/40 pointer-events-none"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          onBlur={() => {
            // Delay to allow click on dropdown item
            setTimeout(() => setIsOpen(false), 200);
          }}
          placeholder={placeholder}
          role="combobox"
          aria-controls={listboxId}
          aria-expanded={isOpen}
          aria-activedescendant={
            activeIndex >= 0 ? `guest-option-${activeIndex}` : undefined
          }
          aria-autocomplete="list"
          autoComplete="off"
          className="
            w-full rounded-xl bg-cream pl-11 pr-4 py-3.5
            text-charcoal placeholder:text-charcoal-light/50
            border-2 border-beige
            transition-all duration-200 ease-out
            focus:outline-none focus:border-rose-dust focus:ring-2 focus:ring-rose-dust/20
            font-body text-base
          "
        />
      </div>

      {/* Dropdown */}
      {isOpen && results.length > 0 && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          className="
            absolute inset-x-0 top-full z-20 mt-2
            max-h-64 overflow-y-auto
            rounded-xl bg-white/95 backdrop-blur-md
            shadow-lg shadow-black/10
            border border-beige
            py-1
          "
        >
          {results.map((result, index) => (
            <li
              key={result.item.id}
              id={`guest-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                selectGuest(result.item);
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={`
                flex items-center justify-between
                cursor-pointer px-4 py-3
                transition-colors duration-100
                ${
                  index === activeIndex
                    ? "bg-rose-dust/5"
                    : "hover:bg-beige/50"
                }
              `}
            >
              <span className="text-charcoal text-base">
                {highlightMatch(result.item.name)}
              </span>
              {result.item.tableNumber != null && (
                <span className="shrink-0 ml-3 text-xs font-medium text-charcoal-light/60 bg-beige rounded-full px-2.5 py-0.5">
                  Table {result.item.tableNumber}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
