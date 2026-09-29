"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { outputToHtml } from "@/lib/ai/output";
import { cn } from "@/lib/utils";
import { domToOutput } from "./output-format";

export type OutputPanelHandle = {
  /** The current text, including the user's edits. */
  getText: () => string;
  isEdited: () => boolean;
  focus: () => void;
};

const CURSOR =
  '<span class="ml-0.5 inline-block h-[18px] w-2 animate-blink bg-primary align-[-3px]" aria-hidden="true"></span>';

/**
 * The generated text. It streams in read-only, then becomes editable in place
 * as soon as streaming ends. It is never a read-only view.
 *
 * The contentEditable node is uncontrolled: React writes it only while
 * streaming, or when a new generation replaces it, so the caret never jumps
 * while the user edits.
 */
export const OutputPanel = forwardRef<
  OutputPanelHandle,
  { text: string; streaming: boolean; version: number; label: string; className?: string }
>(function OutputPanel({ text, streaming, version, label, className }, ref) {
  const el = useRef<HTMLDivElement>(null);
  const edited = useRef(false);
  const lastVersion = useRef(version);

  useEffect(() => {
    if (lastVersion.current !== version) {
      lastVersion.current = version;
      edited.current = false;
    }
    if (!el.current || edited.current) return;
    el.current.innerHTML = outputToHtml(text) + (streaming ? CURSOR : "");
  }, [text, streaming, version]);

  useImperativeHandle(ref, () => ({
    getText: () => (el.current ? domToOutput(el.current) : text),
    isEdited: () => edited.current,
    focus: () => el.current?.focus(),
  }));

  return (
    <div
      ref={el}
      role="textbox"
      aria-multiline="true"
      aria-label={label}
      aria-readonly={streaming}
      aria-busy={streaming}
      contentEditable={!streaming}
      suppressContentEditableWarning
      spellCheck={!streaming}
      onInput={() => {
        edited.current = true;
      }}
      className={cn(
        "min-h-[230px] text-[15px] leading-[1.65] whitespace-pre-line text-foreground outline-none [&_strong]:font-semibold",
        className,
      )}
    />
  );
});
