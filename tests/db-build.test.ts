import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("database bootstrap during production builds", () => {
  it("uses an isolated in-memory database for Next.js build workers", async () => {
    const { databasePathForPhase } = await import("@/lib/db-path");

    expect(
      databasePathForPhase(
        "phase-production-build",
        "/data/sendthen.db",
        "/app",
      ),
    ).toBe(":memory:");
  });

  it("keeps the configured database path outside the build phase", async () => {
    const { databasePathForPhase } = await import("@/lib/db-path");

    expect(
      databasePathForPhase(undefined, "/data/sendthen.db", "/app"),
    ).toBe("/data/sendthen.db");
  });

  it("wires the build-safe path into the database bootstrap", () => {
    const source = readFileSync(
      new URL("../lib/db/index.ts", import.meta.url),
      "utf8",
    );

    expect(source).toContain("databasePathForPhase(");
    expect(source).toContain("process.env.NEXT_PHASE");
  });
});
