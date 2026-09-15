export type ExtractProgress = {
  done: number;
  total: number;
  pageFrom: number;
  pageTo: number;
};

export function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 8) return "";
  if (seconds < 60) return `${seconds} seconds so far`;
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  if (rem === 0) return minutes === 1 ? "1 min so far" : `${minutes} min so far`;
  return `${minutes} min ${rem}s so far`;
}

export function readingHeadline(boxCount: number): string {
  const n = Math.max(0, boxCount);
  return `Reading ${n} box${n === 1 ? "" : "es"}`;
}

export function readingDetail(progress: ExtractProgress | null, boxCount: number): string {
  if (progress && progress.total > 0 && progress.pageFrom > 0) {
    const range =
      progress.pageFrom === progress.pageTo
        ? `Page ${progress.pageFrom}`
        : `Pages ${progress.pageFrom}–${progress.pageTo}`;
    const of = Math.max(boxCount, progress.pageTo);
    if (of > 1) return `${range} of ${of}`;
    return `Working through ${range.toLowerCase()}.`;
  }
  if (boxCount >= 80) {
    return "Working through the statement, a batch of pages at a time.";
  }
  return "Pulling rows out of the boxes you marked.";
}

export function readingHint(boxCount: number): string {
  if (boxCount >= 80) return "A long statement takes a few minutes. Stay on this step.";
  if (boxCount >= 12) return "This usually takes under a minute.";
  return "This is usually quick.";
}

/** Fraction of the wait rule to fill. Null means an indeterminate sweep. */
export function readingRatio(progress: ExtractProgress | null): number | null {
  if (!progress || progress.total <= 1) return null;
  return Math.min(0.94, (progress.done + 0.28) / progress.total);
}
