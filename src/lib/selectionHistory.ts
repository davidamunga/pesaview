import type { Selection } from "@/types";

const MAX_ENTRIES = 40;

export interface SelectionHistory {
  entries: Selection[][];
  index: number;
}

export function emptyHistory(): SelectionHistory {
  return { entries: [[]], index: 0 };
}

export function present(history: SelectionHistory): Selection[] {
  return history.entries[history.index] ?? [];
}

export function canUndo(history: SelectionHistory): boolean {
  return history.index > 0;
}

export function canRedo(history: SelectionHistory): boolean {
  return history.index < history.entries.length - 1;
}

export function sameSelections(a: Selection[], b: Selection[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function cloneSelections(items: Selection[]): Selection[] {
  return items.map((item) => ({ ...item }));
}

export function commitHistory(history: SelectionHistory, next: Selection[]): SelectionHistory {
  if (sameSelections(present(history), next)) return history;
  let entries = [...history.entries.slice(0, history.index + 1), cloneSelections(next)];
  let index = entries.length - 1;
  if (entries.length > MAX_ENTRIES) {
    const drop = entries.length - MAX_ENTRIES;
    entries = entries.slice(drop);
    index -= drop;
  }
  return { entries, index };
}

export function undoHistory(history: SelectionHistory): SelectionHistory {
  if (!canUndo(history)) return history;
  return { ...history, index: history.index - 1 };
}

export function redoHistory(history: SelectionHistory): SelectionHistory {
  if (!canRedo(history)) return history;
  return { ...history, index: history.index + 1 };
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;
  const el = target as { tagName?: string; isContentEditable?: boolean };
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || Boolean(el.isContentEditable);
}

export function selectionHistoryAction(event: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  target: EventTarget | null;
}): "undo" | "redo" | null {
  if (event.altKey || isTypingTarget(event.target)) return null;
  const mod = event.metaKey || event.ctrlKey;
  if (!mod) return null;
  const key = event.key.toLowerCase();
  if (key === "z" && event.shiftKey) return "redo";
  if (key === "z") return "undo";
  if (key === "y" && event.ctrlKey && !event.metaKey) return "redo";
  return null;
}
