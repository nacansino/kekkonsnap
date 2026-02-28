import { describe, it, expect } from "vitest";
import { execSync } from "child_process";

describe("ESLint", () => {
  it("should pass next lint with no errors", () => {
    try {
      execSync("npx next lint --quiet", {
        cwd: process.cwd(),
        encoding: "utf-8",
        stdio: "pipe",
        timeout: 60_000,
      });
    } catch (err) {
      const error = err as { stdout?: string; stderr?: string };
      const output = [error.stdout, error.stderr].filter(Boolean).join("\n");
      expect.fail(`ESLint errors found:\n${output}`);
    }
  });
});
