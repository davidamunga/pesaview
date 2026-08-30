import { CircleX, List, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TemplatesMenu } from "@/components/templates-menu";
import type { ExtractionMethod, StatementTemplate } from "@/types";

interface WorkspaceToolbarProps {
  fileName: string;
  selectionCount: number;
  busy?: boolean;
  method: ExtractionMethod;
  templates: StatementTemplate[];
  onMethodChange: (method: ExtractionMethod) => void;
  onApplyTemplate: (template: StatementTemplate) => void;
  onSaveTemplate: (name: string) => void;
  onClear: () => void;
  onAutodetect: () => void;
  onPreview: () => void;
  onClose: () => void;
}

export function WorkspaceToolbar({
  fileName,
  selectionCount,
  busy,
  method,
  templates,
  onMethodChange,
  onApplyTemplate,
  onSaveTemplate,
  onClear,
  onAutodetect,
  onPreview,
  onClose,
}: WorkspaceToolbarProps) {
  return (
    <header className="flex shrink-0 items-center gap-3 border-b bg-sky-100/80 px-3 py-2">
      <button
        type="button"
        className="min-w-0 truncate text-left text-sm font-medium hover:underline"
        title="Open another PDF"
        onClick={onClose}
      >
        {fileName}
      </button>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Method
          <select
            className="h-8 rounded-md border bg-background px-2 text-foreground"
            value={method}
            disabled={busy}
            onChange={(event) => onMethodChange(event.target.value as ExtractionMethod)}
          >
            <option value="stream">Stream</option>
            <option value="lattice">Lattice</option>
          </select>
        </label>
        <TemplatesMenu
          templates={templates}
          disabled={busy}
          canSave={selectionCount > 0}
          onApply={onApplyTemplate}
          onSave={onSaveTemplate}
        />
        <Button variant="outline" disabled={busy || selectionCount === 0} onClick={onClear}>
          <CircleX />
          Clear All Selections
        </Button>
        <Button variant="outline" disabled={busy} onClick={onAutodetect}>
          <Zap />
          Autodetect Tables
        </Button>
        <Button disabled={busy || selectionCount === 0} onClick={onPreview}>
          <List />
          Preview & Export Extracted Data
        </Button>
      </div>
    </header>
  );
}
