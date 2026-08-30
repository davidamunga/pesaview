import { useRef, useState, type PointerEvent } from "react";
import { X } from "lucide-react";
import {
  cssToPdf,
  moveRect,
  normalizeRect,
  pdfToCss,
  resizeRect,
  selectionFromCss,
  type ResizeHandle,
} from "@/lib/coordinates";
import { createId } from "@/lib/utils";
import type { CssRect, ExtractionMethod, PageMetrics, Selection } from "@/types";

interface SelectionOverlayProps {
  page: number;
  metrics: PageMetrics;
  selections: Selection[];
  defaultMethod: ExtractionMethod;
  onChange: (selections: Selection[]) => void;
}

const HANDLES: { id: ResizeHandle; className: string }[] = [
  { id: "n", className: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize" },
  { id: "s", className: "left-1/2 top-full -translate-x-1/2 -translate-y-1/2 cursor-ns-resize" },
  { id: "e", className: "left-full top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize" },
  { id: "w", className: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize" },
  { id: "ne", className: "left-full top-0 -translate-x-1/2 -translate-y-1/2 cursor-nesw-resize" },
  { id: "nw", className: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize" },
  { id: "se", className: "left-full top-full -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize" },
  { id: "sw", className: "left-0 top-full -translate-x-1/2 -translate-y-1/2 cursor-nesw-resize" },
];

type Gesture =
  | { type: "draw"; origin: { x: number; y: number } }
  | { type: "move"; id: string; origin: { x: number; y: number }; start: CssRect }
  | { type: "resize"; id: string; handle: ResizeHandle; start: CssRect };

export function SelectionOverlay({
  page,
  metrics,
  selections,
  defaultMethod,
  onChange,
}: SelectionOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [draft, setDraft] = useState<CssRect | null>(null);

  const pageSelections = selections.filter((selection) => selection.page === page);
  const bounds = { width: metrics.renderWidth, height: metrics.renderHeight };

  const pointFromEvent = (event: PointerEvent) => {
    const box = rootRef.current?.getBoundingClientRect();
    if (!box) return { x: 0, y: 0 };
    return {
      x: Math.min(Math.max(event.clientX - box.left, 0), box.width),
      y: Math.min(Math.max(event.clientY - box.top, 0), box.height),
    };
  };

  const replaceBox = (id: string, rect: CssRect) => {
    const current = selections.find((selection) => selection.id === id);
    if (!current) return;
    onChange(
      selections.map((selection) =>
        selection.id === id ? selectionFromCss(rect, metrics, current) : selection,
      ),
    );
  };

  const capture = (event: PointerEvent<HTMLElement>) => {
    rootRef.current?.setPointerCapture(event.pointerId);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("[data-box-ui]")) return;
    capture(event);
    const point = pointFromEvent(event);
    gesture.current = { type: "draw", origin: point };
    setDraft({ x: point.x, y: point.y, width: 0, height: 0 });
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const active = gesture.current;
    if (!active) return;
    const point = pointFromEvent(event);
    if (active.type === "draw") {
      setDraft(normalizeRect(active.origin.x, active.origin.y, point.x, point.y));
      return;
    }
    if (active.type === "move") {
      replaceBox(
        active.id,
        moveRect(active.start, point.x - active.origin.x, point.y - active.origin.y, bounds),
      );
      return;
    }
    replaceBox(active.id, resizeRect(active.start, active.handle, point, bounds));
  };

  const onPointerUp = () => {
    const active = gesture.current;
    if (active?.type === "draw" && draft && draft.width > 8 && draft.height > 8) {
      const pdf = cssToPdf(draft, metrics);
      onChange([
        ...selections,
        {
          id: createId(),
          page,
          top: pdf.top,
          left: pdf.left,
          bottom: pdf.bottom,
          right: pdf.right,
          method: defaultMethod,
        },
      ]);
    }
    gesture.current = null;
    setDraft(null);
  };

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 z-10 touch-none cursor-crosshair"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {pageSelections.map((selection) => {
        const box = pdfToCss(selection, metrics);
        return (
          <div
            key={selection.id}
            data-box-ui
            className="selection-box absolute cursor-move"
            style={{
              left: box.x,
              top: box.y,
              width: box.width,
              height: box.height,
            }}
            onPointerDown={(event) => {
              if ((event.target as HTMLElement).closest("button, [data-resize]")) return;
              event.stopPropagation();
              capture(event);
              gesture.current = {
                type: "move",
                id: selection.id,
                origin: pointFromEvent(event),
                start: box,
              };
            }}
          >
            <button
              type="button"
              className="absolute -top-2 -right-2 z-20 flex size-5 items-center justify-center rounded-full border border-red-400 bg-white text-red-600 shadow-sm"
              aria-label="Delete selection"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onChange(selections.filter((item) => item.id !== selection.id));
              }}
            >
              <X className="size-3" />
            </button>
            {HANDLES.map((handle) => (
              <button
                key={handle.id}
                type="button"
                data-resize={handle.id}
                aria-label={`Resize ${handle.id}`}
                className={`absolute z-10 size-2.5 rounded-[1px] border border-red-500 bg-white shadow-sm ${handle.className}`}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  capture(event);
                  gesture.current = {
                    type: "resize",
                    id: selection.id,
                    handle: handle.id,
                    start: box,
                  };
                }}
              />
            ))}
          </div>
        );
      })}
      {draft && draft.width > 2 && draft.height > 2 && (
        <div
          className="selection-box pointer-events-none absolute"
          style={{
            left: draft.x,
            top: draft.y,
            width: draft.width,
            height: draft.height,
          }}
        />
      )}
    </div>
  );
}
