import { useEffect, useId, useRef, useState } from "react";
import { FileText, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { cn } from "@/lib/utils";

interface PasswordPromptProps {
  fileName: string;
  error?: string;
  busy?: boolean;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}

export function PasswordPrompt({
  fileName,
  error,
  busy,
  onSubmit,
  onCancel,
}: PasswordPromptProps) {
  const [password, setPassword] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();

  useEffect(() => {
    if (error) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [error]);

  return (
    <form
      className="mx-auto flex w-full max-w-md flex-col gap-5 rounded-2xl border bg-card p-6 shadow-xs"
      onSubmit={(event) => {
        event.preventDefault();
        if (password.trim()) onSubmit(password);
      }}
    >
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Lock className="size-4" />
          <h2 className="text-base font-semibold text-foreground">
            Password protected PDF
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Decrypts on this device only — nothing is uploaded.
        </p>
      </header>

      <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <p className="truncate text-sm" title={fileName}>
          {fileName}
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="pdf-password" className="text-sm font-medium">
          Password
        </label>
        <PasswordInput
          id="pdf-password"
          ref={inputRef}
          value={password}
          autoFocus
          autoComplete="off"
          disabled={busy}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={cn(error && "border-destructive")}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error && (
          <p id={errorId} role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={!password.trim() || busy}>
          {busy ? "Unlocking…" : "Unlock"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
