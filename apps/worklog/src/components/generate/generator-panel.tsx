"use client";

import { CalendarX2, Check, CircleAlert, Copy, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { GenerateResult } from "@/app/api/generate/route";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { GENERATE_EVENT, useWindowKeydown, type GenerateShortcutType } from "@/hooks/use-shortcuts";
import { track } from "@/lib/analytics";
import { formatRangeLabel, type DateRange } from "@/lib/dates";
import type { GenerationType, StandupFormat } from "@/lib/db/schema";
import { cn, pluralize } from "@/lib/utils";
import { saveGenerationEdit } from "@/server/actions/settings";
import { copyOutput } from "./output-format";
import { OutputPanel, type OutputPanelHandle } from "./output-panel";
import { RangePicker, type RangePreset } from "./range-picker";

const TYPES: { value: GenerationType; label: string; title: string }[] = [
  { value: "standup", label: "Standup", title: "Standup update" },
  { value: "weekly", label: "Weekly", title: "Weekly summary" },
  { value: "appraisal", label: "Appraisal", title: "Appraisal notes" },
];

type Status = "idle" | "loading" | "done" | "empty" | "error";

export type SavedGeneration = {
  id: string;
  type: GenerationType;
  range: DateRange;
  output: string;
  savedLabel: string;
};

export function GeneratorPanel({
  initialType,
  defaultRanges,
  presets,
  today,
  standupFormat,
  autoStart,
  saved,
}: {
  initialType: GenerationType;
  defaultRanges: Record<GenerationType, DateRange>;
  presets: Record<GenerationType, RangePreset[]>;
  today: string;
  standupFormat: StandupFormat;
  autoStart: boolean;
  saved?: SavedGeneration;
}) {
  const router = useRouter();
  const [type, setType] = useState<GenerationType>(saved?.type ?? initialType);
  const [ranges, setRanges] = useState<Record<GenerationType, DateRange>>(() =>
    saved ? { ...defaultRanges, [saved.type]: saved.range } : defaultRanges,
  );
  const [status, setStatus] = useState<Status>(saved ? "done" : "idle");
  const [text, setText] = useState(saved?.output ?? "");
  const [meta, setMeta] = useState(saved ? saved.savedLabel : "");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [version, setVersion] = useState(0);

  const generationId = useRef<string | null>(saved?.id ?? null);
  const abortRef = useRef<AbortController | null>(null);
  const panelRef = useRef<OutputPanelHandle>(null);
  const copiedTimer = useRef<number | undefined>(undefined);
  const lastRequest = useRef<{ type: GenerationType; range: DateRange } | null>(
    saved ? { type: saved.type, range: saved.range } : null,
  );

  const current = TYPES.find((t) => t.value === type)!;
  const range = ranges[type];
  const loading = status === "loading";
  const hasOutput = status === "done" && text.length > 0;

  const generate = useCallback(
    async (opts: { type?: GenerationType } = {}) => {
      const t = opts.type ?? type;
      const r = ranges[t];
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setType(t);
      setStatus("loading");
      setText("");
      setError(null);
      setCopied(false);
      setMeta("");
      setVersion((v) => v + 1);
      generationId.current = null;
      lastRequest.current = { type: t, range: r };
      track("generation_started", { type: t });

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: t, range: r, format: standupFormat }),
          signal: controller.signal,
        });
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
          if (body.code === "EMPTY_RANGE") {
            setStatus("empty");
            return;
          }
          track("generation_failed", { type: t, code: body.code ?? String(res.status) });
          setStatus("error");
          setError(body.message ?? "Something went wrong. Try again.");
          return;
        }
        const result = (await res.json()) as GenerateResult;
        generationId.current = result.id;
        setText(result.output);
        setMeta(`From ${pluralize(result.entryCount, "entry", "entries")}`);
        setStatus("done");
        track("generation_completed", { type: t });
      } catch (e) {
        if (controller.signal.aborted) return;
        console.error(e);
        track("generation_failed", { type: t, code: "NETWORK" });
        setStatus("error");
        setError("Check your connection and try again.");
      }
    },
    [type, ranges, standupFormat, router],
  );

  const copy = useCallback(async () => {
    const value = panelRef.current?.getText() ?? text;
    if (!value) return;
    try {
      await copyOutput(value);
    } catch {
      toast.error("Couldn’t copy. Select the text and copy it manually.");
      return;
    }
    setCopied(true);
    window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopied(false), 1800);
    toast.success(`${current.label} copied to clipboard`);
    track("output_copied", { type, edited: Boolean(panelRef.current?.isEdited()) });
    if (generationId.current && panelRef.current?.isEdited()) {
      void saveGenerationEdit({ id: generationId.current, output: value });
    }
  }, [text, current.label, type]);

  const onKeydown = useCallback(
    (event: KeyboardEvent) => {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== "c" ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const selection = window.getSelection()?.toString() ?? "";
      if (selection.length > 0 || !hasOutput) return;
      event.preventDefault();
      void copy();
    },
    [copy, hasOutput],
  );
  useWindowKeydown(onKeydown);

  useEffect(() => {
    const onShortcut = (e: Event) =>
      void generate({ type: (e as CustomEvent<GenerateShortcutType>).detail });
    window.addEventListener(GENERATE_EVENT, onShortcut);
    return () => window.removeEventListener(GENERATE_EVENT, onShortcut);
  }, [generate]);

  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStart && !autoStarted.current) {
      autoStarted.current = true;
      router.replace(`/generate?type=${initialType}`, { scroll: false });
      void generate({ type: initialType });
    }
  }, [autoStart, initialType, generate, router]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const requested = TYPES.find((t) => t.value === (lastRequest.current?.type ?? type))!;
  const outputTitle = requested.title;

  const copyButton = (
    <Button
      size="sm"
      onClick={() => void copy()}
      disabled={!hasOutput}
      variant={copied ? "soft" : "ghost"}
      className="max-md:h-11"
    >
      {copied ? (
        <>
          <Check className="size-[15px]" strokeWidth={2.25} aria-hidden />
          Copied
        </>
      ) : (
        <>
          <Copy className="size-[15px]" strokeWidth={1.75} aria-hidden />
          Copy
        </>
      )}
    </Button>
  );

  return (
    <div className="flex w-full max-w-[720px] flex-col gap-4 px-5 pt-14 pb-10 md:gap-6 md:px-0">
      <h1 className="text-[26px] font-semibold tracking-[-0.02em] md:text-[28px]">Generate</h1>

      <section
        aria-label="Generator"
        className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:gap-4 md:rounded-lg md:border md:border-border md:bg-surface md:p-5"
      >
        <div className="flex flex-col gap-1.5">
          <span
            id="type-label"
            className="hidden text-xs font-medium text-subtle-foreground md:block"
          >
            Output
          </span>
          <Segmented
            labelledBy="type-label"
            label="Output type"
            options={TYPES}
            value={type}
            onChange={(v) => {
              setType(v);
              setCopied(false);
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="hidden text-xs font-medium text-subtle-foreground md:block">
            Date range
          </span>
          <RangePicker
            value={range}
            presets={presets[type]}
            today={today}
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            onChange={(r) => setRanges((prev) => ({ ...prev, [type]: r }))}
            className="w-full md:w-auto"
          />
        </div>
        <Button
          variant="primary"
          size="md"
          className="h-[38px] gap-2.5 px-4 max-md:h-11 md:ml-auto"
          onClick={() => void generate()}
          disabled={loading}
        >
          <Sparkles className="size-4" strokeWidth={1.75} aria-hidden />
          Generate
        </Button>
      </section>

      <section
        aria-label="Output"
        className="flex min-h-[320px] flex-col rounded-lg border border-border bg-surface"
      >
        <div className="flex items-center gap-2.5 border-b border-divider py-2.5 pr-3 pl-4 md:pl-5">
          <span className="text-[13px] font-medium">
            {status === "idle" ? current.title : outputTitle}
          </span>
          {meta ? <span className="text-xs text-muted-foreground">{meta}</span> : null}
          {loading ? (
            <span className="text-xs text-muted-foreground max-md:ml-auto" role="status">
              Generating…
            </span>
          ) : null}
          <div className="ml-auto hidden gap-2 md:flex">
            <Button
              size="sm"
              onClick={() => void generate()}
              disabled={status === "idle" || loading}
            >
              <RefreshCw className="size-[15px]" strokeWidth={1.75} aria-hidden />
              Regenerate
            </Button>
            {copyButton}
          </div>
        </div>

        <div className="flex grow flex-col px-4 pt-4 pb-5 md:px-5 md:pt-[18px] md:pb-[22px]">
          {status === "idle" ? (
            <p className="text-sm text-muted-foreground">
              Pick an output and a date range, then press Generate. The text lands here and you can
              edit it before copying.
            </p>
          ) : status === "empty" ? (
            <EmptyRange
              range={lastRequest.current?.range ?? range}
              onChangeRange={() => setPickerOpen(true)}
            />
          ) : status === "error" && error ? (
            <div role="alert" className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="flex items-center gap-2 text-sm font-semibold text-blocker-soft-foreground">
                  <CircleAlert className="size-4" aria-hidden />
                  Couldn’t create your {requested.label.toLowerCase()}
                </span>
                <span className="text-[13px] leading-normal text-subtle-foreground">{error}</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => void generate()}>
                  Retry
                </Button>
              </div>
            </div>
          ) : (
            <OutputPanel
              ref={panelRef}
              text={text}
              version={version}
              label={`Generated ${outputTitle.toLowerCase()}, editable`}
            />
          )}
        </div>
      </section>

      {status === "done" ? (
        <div className="grid grid-cols-2 gap-2 md:hidden">
          <Button className="h-11" onClick={() => void generate()}>
            <RefreshCw className="size-[15px]" aria-hidden />
            Regenerate
          </Button>
          <Button
            variant={copied ? "soft" : "primary"}
            className="h-11"
            disabled={!hasOutput}
            onClick={() => void copy()}
          >
            {copied ? (
              <Check className="size-[15px]" aria-hidden />
            ) : (
              <Copy className="size-[15px]" aria-hidden />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function EmptyRange({ range, onChangeRange }: { range: DateRange; onChangeRange: () => void }) {
  return (
    <div className={cn("flex grow flex-col items-center justify-center gap-3 py-8 text-center")}>
      <CalendarX2 className="size-6 text-muted-foreground" strokeWidth={1.5} aria-hidden />
      <span className="text-sm font-semibold">No entries from {formatRangeLabel(range)}</span>
      <span className="max-w-[260px] text-[13px] leading-normal text-subtle-foreground">
        Widen the range, or log what you did and come back.
      </span>
      <div className="mt-1 flex gap-2">
        <Button size="sm" onClick={onChangeRange}>
          Change range
        </Button>
        <Button asChild variant="primary" size="sm">
          <Link href="/today">Log an entry</Link>
        </Button>
      </div>
    </div>
  );
}
