import { describe, expect, it } from "vitest";
import {
  applyTemplateArea,
  cssToPdf,
  moveRect,
  normalizeRect,
  pdfToCss,
  resizeRect,
} from "./coordinates";

const page = {
  renderWidth: 600,
  renderHeight: 800,
  pdfWidth: 612,
  pdfHeight: 792,
};

describe("coordinates", () => {
  it("round-trips a selection between CSS and PDF points", () => {
    const css = { x: 60, y: 80, width: 300, height: 400 };
    const pdf = cssToPdf(css, page);
    const back = pdfToCss(pdf, page);
    expect(pdf.left).toBeCloseTo(61.2);
    expect(pdf.top).toBeCloseTo(79.2);
    expect(back.x).toBeCloseTo(css.x);
    expect(back.width).toBeCloseTo(css.width);
  });

  it("normalizes inverted drag rectangles", () => {
    expect(normalizeRect(40, 50, 10, 20)).toEqual({
      x: 10,
      y: 20,
      width: 30,
      height: 30,
    });
  });

  it("applies a normalized template to the current page size", () => {
    const selection = applyTemplateArea(
      {
        page: 0,
        top: 0.2,
        left: 0.1,
        bottom: 0.9,
        right: 0.95,
        method: "stream",
      },
      3,
      page,
      { normalized: true },
    );
    expect(selection.page).toBe(3);
    expect(selection.top).toBeCloseTo(158.4);
    expect(selection.left).toBeCloseTo(61.2);
    expect(selection.bottom).toBeCloseTo(712.8);
    expect(selection.right).toBeCloseTo(581.4);
  });

  it("moves a box without changing size and stays on the page", () => {
    const moved = moveRect({ x: 10, y: 20, width: 40, height: 30 }, 8, -4, {
      width: 100,
      height: 80,
    });
    expect(moved).toEqual({ x: 18, y: 16, width: 40, height: 30 });
    const clamped = moveRect({ x: 10, y: 20, width: 40, height: 30 }, 100, 100, {
      width: 100,
      height: 80,
    });
    expect(clamped).toEqual({ x: 60, y: 50, width: 40, height: 30 });
  });

  it("resizes from a corner and ignores drags that would collapse the box", () => {
    const start = { x: 20, y: 20, width: 40, height: 40 };
    const bounds = { width: 200, height: 200 };
    expect(resizeRect(start, "se", { x: 80, y: 90 }, bounds)).toEqual({
      x: 20,
      y: 20,
      width: 60,
      height: 70,
    });
    expect(resizeRect(start, "nw", { x: 30, y: 25 }, bounds)).toEqual({
      x: 30,
      y: 25,
      width: 30,
      height: 35,
    });
    expect(resizeRect(start, "se", { x: 22, y: 22 }, bounds, 8)).toEqual(start);
  });
});
