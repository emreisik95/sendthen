import path from "node:path";

export const NEXT_PRODUCTION_BUILD_PHASE = "phase-production-build";

export function databasePathForPhase(
  nextPhase: string | undefined,
  configuredPath: string | undefined,
  cwd: string,
): string {
  if (nextPhase === NEXT_PRODUCTION_BUILD_PHASE) return ":memory:";
  return configuredPath ?? path.join(cwd, "data", "sendthen.db");
}
