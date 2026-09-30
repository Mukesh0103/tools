"use client";

import { Check, Pencil, Trash } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BlockerBadge } from "@/components/ui/chips";
import { Button } from "@/components/ui/button";
import type { EntryView } from "@/lib/entry-view";
import { serializeEntry } from "@/lib/parse-entry";
import { cn } from "@/lib/utils";
import { MAX_ENTRY_LENGTH } from "@/lib/validators";

export type EntryItemProps = {
  entry: EntryView;
  fresh?: boolean;
  onUpdate: (entry: EntryView, raw: string) => Promise<unknown>;
  onDelete: (entry: EntryView) => void;
};

export function EntryItem({ entry, fresh, onUpdate, onDelete }: EntryItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [showSaved, setShowSaved] = useState(Boolean(fresh));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!fresh) {
      setShowSaved(false);
      return;
    }
    setShowSaved(true);
    const t = window.setTimeout(() => setShowSaved(false), 2400);
    return () => window.clearTimeout(t);
  }, [fresh]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function startEdit() {
    setDraft(serializeEntry(entry));
    setEditing(true);
  }

  function commit() {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== serializeEntry(entry)) void onUpdate(entry, next);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-3.5 rounded-lg bg-surface px-3 py-2 shadow-[0_0_0_1px_var(--primary),0_0_0_4px_var(--primary-ring)]">
        <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">{entry.time}</span>
        <label htmlFor={`edit-${entry.id}`} className="sr-only">
          Edit entry
        </label>
        <input
          ref={inputRef}
          id={`edit-${entry.id}`}
          value={draft}
          maxLength={MAX_ENTRY_LENGTH}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setEditing(false);
            }
          }}
          onBlur={commit}
          className="h-7 min-w-0 grow bg-transparent text-[15px] outline-none"
        />
      </div>
    );
  }

  return (
    <div
      tabIndex={-1}
      data-entry-id={entry.id}
      className={cn(
        "group flex items-start gap-3.5 rounded-lg px-3 py-2.5 outline-none focus-within:bg-surface focus-within:shadow-[0_0_0_1px_var(--border)] hover:bg-surface hover:shadow-[0_0_0_1px_var(--border)] max-md:rounded-none max-md:border-b max-md:border-divider max-md:px-0 max-md:py-3 max-md:focus-within:shadow-none max-md:hover:shadow-none",
        fresh && "animate-fresh",
      )}
    >
      <span className="w-10 shrink-0 font-mono text-xs leading-[22px] text-muted-foreground max-md:w-[38px]">
        {entry.time}
      </span>
      <div className="flex min-w-0 grow flex-wrap items-center gap-x-2 gap-y-1.5 leading-[22px]">
        <span className="text-[15px] break-words">{entry.text}</span>
        {entry.isBlocker ? <BlockerBadge /> : null}
        {showSaved ? (
          <span className="inline-flex items-center gap-1 text-xs text-primary" role="status">
            <Check className="size-3.5" strokeWidth={2.25} aria-hidden />
            Saved
          </span>
        ) : null}
      </div>
      <div className="-mt-[5px] flex gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-md:hidden max-md:opacity-100 max-md:group-focus-within:flex">
        <Button variant="icon" size="icon" aria-label="Edit entry" onClick={startEdit}>
          <Pencil className="size-4" strokeWidth={1.75} />
        </Button>
        <Button
          variant="icon"
          size="icon"
          aria-label="Delete entry"
          onClick={() => onDelete(entry)}
        >
          <Trash className="size-4" strokeWidth={1.75} />
        </Button>
      </div>
    </div>
  );
}
