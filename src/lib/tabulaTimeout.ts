const EXTRACT_BASE_MS = 90_000;
const EXTRACT_MS_PER_AREA = 3_000;
const GUESS_MIN_MS = 120_000;
const GUESS_MS_PER_PAGE = 2_000;
const MAX_TIMEOUT_MS = 60 * 60_000;

export function tabulaTimeoutMs(kind: "extract" | "guess", workItems = 1): number {
  const items = Math.max(1, workItems);
  if (kind === "guess") {
    return Math.min(MAX_TIMEOUT_MS, Math.max(GUESS_MIN_MS, items * GUESS_MS_PER_PAGE));
  }
  return Math.min(MAX_TIMEOUT_MS, EXTRACT_BASE_MS + Math.max(0, items - 1) * EXTRACT_MS_PER_AREA);
}
