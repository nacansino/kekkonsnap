import { describe, it, expect } from "vitest";
import { createGuestMatcher, findMatchingGuests } from "@/lib/fuzzy-match";

const sampleGuests = [
  { id: 1, name: "John Smith", tableNumber: "A1" },
  { id: 2, name: "Jane Doe", tableNumber: "B2" },
  { id: 3, name: "Tanaka Yuki", tableNumber: "C3" },
  { id: 4, name: "Suzuki Haruki", tableNumber: null },
  { id: 5, name: "Emily Johnson", tableNumber: "A2" },
  { id: 6, name: "Jonathan Rivers", tableNumber: "D1" },
  { id: 7, name: "Johann Sebastian", tableNumber: "E5" },
  { id: 8, name: "Joanna Smith", tableNumber: "A1" },
];

describe("fuzzy-match", () => {
  describe("createGuestMatcher", () => {
    it("should create a Fuse instance from a guest list", () => {
      const matcher = createGuestMatcher(sampleGuests);
      expect(matcher).toBeDefined();
      // Fuse instances have a search method
      expect(typeof matcher.search).toBe("function");
    });

    it("should handle an empty guest list", () => {
      const matcher = createGuestMatcher([]);
      const results = findMatchingGuests(matcher, "John");
      expect(results).toEqual([]);
    });
  });

  describe("findMatchingGuests", () => {
    const matcher = createGuestMatcher(sampleGuests);

    it("should return an exact name match", () => {
      const results = findMatchingGuests(matcher, "John Smith");
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].name).toBe("John Smith");
      expect(results[0].id).toBe(1);
      expect(results[0].tableNumber).toBe("A1");
    });

    it("should match on partial name input", () => {
      const results = findMatchingGuests(matcher, "Joh");
      expect(results.length).toBeGreaterThanOrEqual(1);
      const names = results.map((r) => r.name);
      // "Joh" should match John Smith, Jonathan Rivers, Johann Sebastian, or Joanna
      expect(
        names.some(
          (n) =>
            n === "John Smith" ||
            n === "Jonathan Rivers" ||
            n === "Johann Sebastian"
        )
      ).toBe(true);
    });

    it("should match with a typo (fuzzy matching)", () => {
      const results = findMatchingGuests(matcher, "Jonh Smith");
      expect(results.length).toBeGreaterThanOrEqual(1);
      const names = results.map((r) => r.name);
      expect(names).toContain("John Smith");
    });

    it("should respect the limit parameter", () => {
      const results = findMatchingGuests(matcher, "John", 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it("should default to at most 5 results", () => {
      // "Jo" is broad enough to match multiple guests
      const results = findMatchingGuests(matcher, "Jo");
      expect(results.length).toBeLessThanOrEqual(5);
    });

    it("should return no results for a single-character query", () => {
      const results = findMatchingGuests(matcher, "J");
      expect(results).toEqual([]);
    });

    it("should return no results for an empty query", () => {
      const results = findMatchingGuests(matcher, "");
      expect(results).toEqual([]);
    });

    it("should match Japanese names", () => {
      const results = findMatchingGuests(matcher, "Tanaka");
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].name).toBe("Tanaka Yuki");
      expect(results[0].tableNumber).toBe("C3");
    });

    it("should handle accented and unusual characters", () => {
      const accentedGuests = [
        { id: 10, name: "Jose Garcia", tableNumber: "F1" },
        { id: 11, name: "Rene Dupont", tableNumber: "F2" },
        { id: 12, name: "Bjork Gudmundsdottir", tableNumber: null },
      ];
      const accentMatcher = createGuestMatcher(accentedGuests);

      const results = findMatchingGuests(accentMatcher, "Jose");
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].name).toBe("Jose Garcia");
    });

    it("should return guests with null tableNumber correctly", () => {
      const results = findMatchingGuests(matcher, "Suzuki");
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].name).toBe("Suzuki Haruki");
      expect(results[0].tableNumber).toBeNull();
    });

    it("should not match completely unrelated queries", () => {
      const results = findMatchingGuests(matcher, "Xyzzy Plugh");
      expect(results).toEqual([]);
    });
  });
});
