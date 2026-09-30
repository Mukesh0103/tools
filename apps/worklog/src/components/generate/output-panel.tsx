"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { outputToHtml } from "@/lib/generate/output";
import { cn } from "@/lib/utils";
import { domToOutput } from "./output-format";

export type OutputPanelHandle = {
  getText: () => string;
  isEdited: () => boolean;
  focus: () => void;
};

/**
 * The generated text, editable in place.
 *
 * The contentEditable node is uncontrolled: React writes it only when a new
 * generation replaces it, so the caret never jumps while the user edits.
 */
export const OutputPanel = forwardRef<
  OutputPanelHandle,
  { text: string; version: number; label: string; className?: string }
>(function OutputPanel({ text, version, label, className }, ref) {
  const el = useRef<HTMLDivElement>(null);
  const edited = useRef(false);
  const lastVersion = useRef(version);

  useEffect(() => {
    if (lastVersion.current !== version) {
      lastVersion.current = version;
      edited.current = false;
    }
    if (!el.current || edited.current) return;
    el.current.innerHTML = outputToHtml(text);
  }, [text, version]);

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
      contentEditable
      suppressContentEditableWarning
      spellCheck
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
