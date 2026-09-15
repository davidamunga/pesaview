import type { RefObject } from "react";
import { Check, CircleX, Copy, Minus, Plus, Redo2, Undo2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TemplatesMenu } from "@/components/templates-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import type { ExtractionMethod, StatementTemplate } from "@/types";

const apple =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
const undoShortcut = apple ? "⌘Z" : "Ctrl+Z";
const redoShortcut = apple ? "⌘⇧Z" : "Ctrl+Y";

interface SelectToolbarProps {
  selectionCount: number;
  busy?: boolean;
  canAutodetect: boolean;
  method: ExtractionMethod;
  templates: StatementTemplate[];
  continueHint: string;
  canContinue: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onMethodChange: (method: ExtractionMethod) => void;
  onApplyTemplate: (template: StatementTemplate) => void;
  onSaveTemplate: (name: string) => void;
  onClear: () => void;
  canRepeat?: boolean;
  onRepeat?: () => void;
  onAutodetect: () => void;
  onContinue: () => void;
  onChangePdf: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  headingRef?: RefObject<HTMLHeadingElement | null>;
}

export function SelectToolbar({
  selectionCount,
  busy,
  canAutodetect,
  method,
  templates,
  continueHint,
  canContinue,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onMethodChange,
  onApplyTemplate,
  onSaveTemplate,
  onClear,
  canRepeat,
  onRepeat,
  onAutodetect,
  onContinue,
  onChangePdf,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  headingRef,
}: SelectToolbarProps) {
  return (
    <div className="flex shrink-0 items-center gap-2 bg-background px-3 py-1.5">
      {headingRef ? (
        <h1 ref={headingRef} tabIndex={-1} className="sr-only outline-none">
          Select tables
        </h1>
      ) : null}
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        <Button variant="ghost" size="xs" disabled={busy} onClick={onChangePdf}>
          Change PDF
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={busy || !canUndo}
          title={`Undo box (${undoShortcut})`}
          aria-label={`Undo box (${undoShortcut})`}
          aria-keyshortcuts={undoShortcut}
          onClick={onUndo}
        >
          <Undo2 />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={busy || !canRedo}
          title={`Redo box (${redoShortcut})`}
          aria-label={`Redo box (${redoShortcut})`}
          aria-keyshortcuts={redoShortcut}
          onClick={onRedo}
        >
          <Redo2 />
        </Button>
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={zoom <= 0.5}
            title="Zoom out"
            aria-label="Zoom out"
            onClick={onZoomOut}
          >
            <Minus />
          </Button>
          <button
            type="button"
            title="Fit page"
            aria-label={zoom === 1 ? "Page is fitted" : "Fit page"}
            className="h-7 min-w-9 rounded-md px-1 text-xs tabular-nums text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            onClick={onZoomFit}
          >
            {Math.round(zoom * 100) === 100 ? "Fit" : `${Math.round(zoom * 100)}%`}
          </button>
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={zoom >= 4}
            title="Zoom in"
            aria-label="Zoom in"
            onClick={onZoomIn}
          >
            <Plus />
          </Button>
        </div>
        {method === "lattice" && (
          <p className="hidden text-xs text-muted-foreground sm:inline">Ruled lines</p>
        )}
        <div className="ml-auto flex items-center gap-1">
          <TemplatesMenu
            templates={templates}
            disabled={busy}
            canSave={selectionCount > 0}
            onApply={onApplyTemplate}
            onSave={onSaveTemplate}
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="xs" disabled={busy} title="If columns look wrong">
                  Columns
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>How text is read</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => onMethodChange("stream")}>
                  {method === "stream" ? <Check /> : <span className="size-4" />}
                  Stream — flowing text
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onMethodChange("lattice")}>
                  {method === "lattice" ? <Check /> : <span className="size-4" />}
                  Lattice — ruled lines
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {canAutodetect && (
            <Button variant="ghost" size="xs" disabled={busy} onClick={onAutodetect}>
              <Zap />
              {busy ? "Finding…" : "Autodetect"}
            </Button>
          )}
          {canRepeat && onRepeat && (
            <Button
              variant="ghost"
              size="xs"
              disabled={busy}
              title="Copy this page’s box onto the other pages"
              onClick={onRepeat}
            >
              <Copy />
              All pages
            </Button>
          )}
          {selectionCount > 0 && (
            <Button
              variant="ghost"
              size="icon-xs"
              disabled={busy}
              title="Clear boxes"
              aria-label="Clear boxes"
              onClick={onClear}
            >
              <CircleX />
            </Button>
          )}
        </div>
      </div>
      {!canContinue && (
        <p id="continue-hint" className="sr-only">
          {continueHint}
        </p>
      )}
      <Button
        className="shrink-0"
        disabled={!canContinue}
        aria-describedby={!canContinue ? "continue-hint" : undefined}
        title={!canContinue ? continueHint : undefined}
        size="xs"
        onClick={onContinue}
      >
        Continue
      </Button>
    </div>
  );
}
