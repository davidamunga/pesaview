import { useState } from "react";
import { LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import type { StatementTemplate } from "@/types";

interface TemplatesMenuProps {
  templates: StatementTemplate[];
  disabled?: boolean;
  canSave: boolean;
  onApply: (template: StatementTemplate) => void;
  onSave: (name: string) => void;
}

export function TemplatesMenu({
  templates,
  disabled,
  canSave,
  onApply,
  onSave,
}: TemplatesMenuProps) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const bundled = templates.filter((template) => template.source === "bundled");
  const saved = templates.filter((template) => template.source === "saved");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" disabled={disabled} className="bg-sky-50 text-sky-800">
              <LayoutTemplate />
              Templates
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-64">
          {bundled.length > 0 && (
            <DropdownMenuGroup>
              <DropdownMenuLabel>Example layouts</DropdownMenuLabel>
              {bundled.map((template) => (
                <DropdownMenuItem key={template.id} onClick={() => onApply(template)}>
                  {template.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          )}
          {saved.length > 0 && (
            <>
              {bundled.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuGroup>
                <DropdownMenuLabel>Saved</DropdownMenuLabel>
                {saved.map((template) => (
                  <DropdownMenuItem key={template.id} onClick={() => onApply(template)}>
                    {template.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!canSave} onClick={() => setSaveOpen(true)}>
            Save current selections…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save template</DialogTitle>
            <DialogDescription>
              Reuse these regions on later statements with the same layout.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-2">
            <Input
              placeholder="e.g. My bank layout"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                if (!name.trim()) return;
                onSave(name.trim());
                setName("");
                setSaveOpen(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
