import { describe, expect, it } from "vitest";
import type { Selection } from "@/types";
import {
  canRedo,
  canUndo,
  commitHistory,
  emptyHistory,
  present,
  redoHistory,
  selectionHistoryAction,
  undoHistory,
} from "./selectionHistory";

const box = (id: string): Selection => ({
  id,
  page: 1,
  top: 10,
  left: 10,
  bottom: 100,
  right: 200,
  method: "stream",
});

describe("selection history", () => {
  it("starts with no boxes", () => {
    expect(present(emptyHistory())).toEqual([]);
    expect(canUndo(emptyHistory())).toBe(false);
    expect(canRedo(emptyHistory())).toBe(false);
  });

  it("undoes a drawn box back to empty", () => {
    const drawn = commitHistory(emptyHistory(), [box("a")]);
    expect(present(drawn)).toEqual([box("a")]);
    const undone = undoHistory(drawn);
    expect(present(undone)).toEqual([]);
    expect(canUndo(undone)).toBe(false);
    expect(canRedo(undone)).toBe(true);
  });

  it("redoes the box after undo", () => {
    const drawn = commitHistory(emptyHistory(), [box("a")]);
    const redone = redoHistory(undoHistory(drawn));
    expect(present(redone)).toEqual([box("a")]);
    expect(canRedo(redone)).toBe(false);
  });

  it("ignores a commit that did not change the boxes", () => {
    const drawn = commitHistory(emptyHistory(), [box("a")]);
    expect(commitHistory(drawn, [box("a")])).toBe(drawn);
  });

  it("drops the redo branch after a new commit", () => {
    const first = commitHistory(emptyHistory(), [box("a")]);
    const second = commitHistory(first, [box("a"), box("b")]);
    const undone = undoHistory(second);
    const branched = commitHistory(undone, [box("c")]);
    expect(present(branched)).toEqual([box("c")]);
    expect(canRedo(branched)).toBe(false);
  });
});

describe("selectionHistoryAction", () => {
  const base = {
    key: "z",
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    target: null as EventTarget | null,
  };

  it("maps modifier-Z to undo and shift-modifier-Z to redo", () => {
    expect(selectionHistoryAction({ ...base, metaKey: true })).toBe("undo");
    expect(selectionHistoryAction({ ...base, ctrlKey: true, shiftKey: true })).toBe("redo");
    expect(selectionHistoryAction({ ...base, ctrlKey: true, key: "y" })).toBe("redo");
  });

  it("leaves typing in fields alone", () => {
    const input = { tagName: "INPUT" } as unknown as EventTarget;
    expect(selectionHistoryAction({ ...base, metaKey: true, target: input })).toBeNull();
  });
});
