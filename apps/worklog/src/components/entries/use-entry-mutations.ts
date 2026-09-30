"use client";

import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { track } from "@/lib/analytics";
import type { EntryView } from "@/lib/entry-view";
import { parseEntry } from "@/lib/parse-entry";
import { createEntry, deleteEntry, restoreEntry, updateEntry } from "@/server/actions/entries";

type Action =
  | { type: "add"; entry: EntryView }
  | { type: "update"; entry: EntryView }
  | { type: "remove"; id: string };

export type SubmitResult = { ok: true } | { ok: false; error: string };

function reducer(state: EntryView[], action: Action): EntryView[] {
  switch (action.type) {
    case "add":
      return [action.entry, ...state.filter((e) => e.id !== action.entry.id)];
    case "update":
      return state.map((e) => (e.id === action.entry.id ? action.entry : e));
    case "remove":
      return state.filter((e) => e.id !== action.id);
  }
}

function localTime(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const NETWORK_ERROR = "Couldn't save. Your text is still here.";

/**
 * Optimistic create, update and delete for a list of entries. The server
 * re-renders the list through revalidatePath, and once that lands the
 * optimistic layer drops away.
 */
export function useEntryMutations(entries: EntryView[]) {
  const [items, apply] = useOptimistic(entries, reducer);
  const [freshId, setFreshId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function add(raw: string, entryDate: string): Promise<SubmitResult> {
    const parsed = parseEntry(raw);
    const id = crypto.randomUUID();
    const now = new Date();
    const entry: EntryView = {
      id,
      entryDate,
      ...parsed,
      createdAt: now.toISOString(),
      time: localTime(now),
    };
    return new Promise((resolve) => {
      startTransition(async () => {
        apply({ type: "add", entry });
        try {
          const res = await createEntry({ raw, entryDate, id });
          if (res.ok) {
            setFreshId(id);
            track("entry_created", { blocker: parsed.isBlocker });
            resolve({ ok: true });
          } else {
            track("entry_failed");
            resolve({ ok: false, error: res.error });
          }
        } catch {
          track("entry_failed");
          resolve({ ok: false, error: NETWORK_ERROR });
        }
      });
    });
  }

  function update(original: EntryView, raw: string): Promise<SubmitResult> {
    const parsed = parseEntry(raw);
    return new Promise((resolve) => {
      startTransition(async () => {
        apply({ type: "update", entry: { ...original, ...parsed } });
        try {
          const res = await updateEntry({ id: original.id, raw });
          if (!res.ok) toast.error(res.error);
          resolve(res.ok ? { ok: true } : { ok: false, error: res.error });
        } catch {
          toast.error("Couldn't save that edit.");
          resolve({ ok: false, error: "Couldn't save that edit." });
        }
      });
    });
  }

  function remove(entry: EntryView) {
    startTransition(async () => {
      apply({ type: "remove", id: entry.id });
      try {
        const res = await deleteEntry({ id: entry.id });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast("Entry deleted", {
          action: {
            label: "Undo",
            onClick: () => {
              void restoreEntry({ ...res.data, createdAt: res.data.createdAt }).then((r) => {
                if (!r.ok) toast.error(r.error);
              });
            },
          },
        });
      } catch {
        toast.error("Couldn't delete that entry.");
      }
    });
  }

  return { items, freshId, add, update, remove };
}
