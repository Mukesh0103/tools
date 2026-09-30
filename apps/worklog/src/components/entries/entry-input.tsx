"use client";

import { ArrowUp, CircleAlert } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { prefersAutofocus } from "@/hooks/use-shortcuts";
import { parseEntry, tagQueryAt } from "@/lib/parse-entry";
import { cn } from "@/lib/utils";
import { MAX_ENTRY_LENGTH } from "@/lib/validators";
import type { SubmitResult } from "./use-entry-mutations";

type Suggestion = { value: string; label: string; create?: boolean };

export type EntryInputProps = {
  onSubmit: (raw: string) => Promise<SubmitResult>;
  knownTags?: string[];
  autoFocus?: boolean;
  placeholder?: string;
  className?: string;
};

export function EntryInput({
  onSubmit,
  knownTags = [],
  autoFocus = true,
  placeholder = "What did you work on?",
  className,
}: EntryInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [value, setValue] = useState("");
  const [caret, setCaret] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [failedRaw, setFailedRaw] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (autoFocus && prefersAutofocus()) inputRef.current?.focus();
  }, [autoFocus]);

  const tagQuery = useMemo(() => tagQueryAt(value, caret), [value, caret]);

  const suggestions = useMemo<Suggestion[]>(() => {
    if (!tagQuery || dismissed) return [];
    const q = tagQuery.query;
    const matches = knownTags
      .filter((t) => t.slice(1).startsWith(q) && t !== `#${q}`)
      .slice(0, 5)
      .map((t): Suggestion => ({ value: t, label: t }));
    if (q && !knownTags.includes(`#${q}`))
      matches.push({ value: `#${q}`, label: `Create “#${q}”`, create: true });
    return matches;
  }, [tagQuery, knownTags, dismissed]);

  const open = suggestions.length > 0;

  function syncCaret() {
    setCaret(inputRef.current?.selectionStart ?? value.length);
  }

  function accept(s: Suggestion) {
    if (!tagQuery) return;
    const before = value.slice(0, tagQuery.start);
    const after = value.slice(caret).replace(/^\S*/, "");
    const next = `${before}${s.value} ${after.trimStart()}`;
    const pos = before.length + s.value.length + 1;
    setValue(next);
    setActive(0);
    requestAnimationFrame(() => {
      inputRef.current?.setSelectionRange(pos, pos);
      setCaret(pos);
    });
  }

  async function submit(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    if (!parseEntry(trimmed).text) {
      setError("Add a few words besides tags.");
      return;
    }
    setError(null);
    setFailedRaw(null);
    setValue("");
    setCaret(0);
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
    if (open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + delta + suggestions.length) % suggestions.length);
      return;
    }
    if (open && event.key === "Tab" && !event.shiftKey) {
      event.preventDefault();
      accept(suggestions[active] ?? suggestions[0]!);
      return;
    }
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit(value);
      return;
    }
    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setDismissed(true);
      } else if (value) {
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
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open ? `${listId}-${active}` : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${listId}-error` : undefined}
          autoComplete="off"
          autoCapitalize="sentences"
          enterKeyHint="done"
          spellCheck
          maxLength={MAX_ENTRY_LENGTH}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setCaret(e.target.selectionStart ?? e.target.value.length);
            setDismissed(false);
            setActive(0);
            if (error && !failedRaw) setError(null);
          }}
          onKeyDown={onKeyDown}
          onKeyUp={syncCaret}
          onClick={syncCaret}
          onBlur={() => setDismissed(true)}
          onFocus={() => setDismissed(false)}
          className="h-12 min-w-0 grow bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground md:h-[52px]"
        />
        <div
          className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex"
          aria-hidden
        >
          <Kbd>↵</Kbd>
          <span>to save</span>
        </div>
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

      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-label="Tag suggestions"
          className="absolute top-[58px] left-4 z-20 flex w-[190px] flex-col gap-0.5 rounded-lg border border-border bg-surface p-1 shadow-[0_8px_24px_rgb(28_25_23/0.10)] max-md:top-auto max-md:bottom-[calc(100%+6px)]"
        >
          {suggestions.map((s, i) => (
            <div
              key={s.value + String(s.create)}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                accept(s);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "flex h-8 cursor-pointer items-center justify-between rounded-md px-2 text-[13px]",
                i === active && "bg-primary-soft text-primary-soft-foreground",
                s.create && i !== active && "text-subtle-foreground",
              )}
            >
              {s.label}
              {i === active ? <Kbd>Tab</Kbd> : null}
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <div
          id={`${listId}-error`}
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
