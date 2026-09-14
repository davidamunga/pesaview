export const WINDOW_ROW_HEIGHT = 36;
export const WINDOW_OVERSCAN = 24;
const WINDOW_MIN_ROWS = 80;

export function windowedRange(
  count: number,
  scrollTop: number,
  viewportHeight: number,
  rowHeight = WINDOW_ROW_HEIGHT,
  overscan = WINDOW_OVERSCAN,
): { start: number; end: number; padTop: number; padBottom: number } {
  if (count <= 0) return { start: 0, end: 0, padTop: 0, padBottom: 0 };
  if (count <= WINDOW_MIN_ROWS) {
    return { start: 0, end: count, padTop: 0, padBottom: 0 };
  }
  const height = Math.max(viewportHeight, rowHeight);
  const start = Math.max(0, Math.floor(Math.max(0, scrollTop) / rowHeight) - overscan);
  const visible = Math.ceil(height / rowHeight) + overscan * 2;
  const end = Math.min(count, start + visible);
  return {
    start,
    end,
    padTop: start * rowHeight,
    padBottom: Math.max(0, (count - end) * rowHeight),
  };
}
