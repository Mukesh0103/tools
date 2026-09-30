"use client";

import { ArrowUp, CircleAlert } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { prefersAutofocus } from "@/hooks/use-shortcuts";
import { parseEntry } from "@/lib/parse-entry";
import { cn } from "@/lib/utils";
import { MAX_ENTRY_LENGTH } from "@/lib/validators";
import type { SubmitResult } from "./use-entry-mutations";

export type EntryInputProps = {
  onSubmit: (raw: string) => Promise<SubmitResult>;
  autoFocus?: boolean;
  placeholder?: string;
  className?: string;
};

export function EntryInput({
  onSubmit,
  autoFocus = true,
  placeholder = "What did you work on?",
  className,
}: EntryInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [failedRaw, setFailedRaw] = useState<string | null>(null);

  useEffect(() => {
    if (autoFocus && prefersAutofocus()) inputRef.current?.focus();
  }, [autoFocus]);

  async function submit(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    if (!parseEntry(trimmed).text) {
      setError("Add a few words besides !blocker.");
      return;
    }
    setError(null);
    setFailedRaw(null);
    setValue("");
    inputRef.current?.focus();
    const res = await onSubmit(trimmed);
    if (!res.ok) {
      setError(res.error);
      setFailedRaw(trimmed);
      // Bring the text back, unless the user has already started typing a new line.
      setValue((current) => (current ? current : trimmed));
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit(value);
      return;
    }
    if (event.key === "Escape") {
      if (value) {
        event.preventDefault();
        setValue("");
        setError(null);
      } else {
        inputRef.current?.blur();
      }
    }
  }

  return (
    <div className={cn("relative flex flex-col gap-2.5", className)}>
      <label htmlFor="entry-input" className="sr-only">
        New entry
      </label>
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border border-border bg-surface pr-1 pl-4 shadow-[0_1px_2px_rgb(28_25_23/0.04)] transition-shadow md:pr-3",
          "focus-within:border-primary focus-within:ring-3 focus-within:ring-primary-ring",
          error &&
            "border-blocker ring-3 ring-blocker-ring focus-within:border-blocker focus-within:ring-blocker-ring",
        )}
      >
        <input
          ref={inputRef}
          id="entry-input"
          type="text"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          autoComplete="off"
          autoCapitalize="sentences"
          enterKeyHint="done"
          spellCheck
          maxLength={MAX_ENTRY_LENGTH}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error && !failedRaw) setError(null);
          }}
          onKeyDown={onKeyDown}
          className="h-12 min-w-0 grow bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground md:h-[52px]"
        />
        <Button
          variant="primary"
          size="icon"
          className="size-10 md:hidden"
          aria-label="Save entry"
          onClick={() => void submit(value)}
        >
          <ArrowUp className="size-[18px]" strokeWidth={2} />
        </Button>
      </div>

      {error ? (
        <div
          id={errorId}
          role="alert"
          className="flex items-center gap-2.5 text-[13px] text-blocker-soft-foreground"
        >
          <CircleAlert className="size-4 shrink-0" aria-hidden />
          <span className="grow">{error}</span>
          {failedRaw ? (
            <Button size="sm" className="h-7" onClick={() => void submit(value || failedRaw)}>
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
