"use client";

import { CalendarX2, Check, CircleAlert, Copy, RefreshCw, Sparkles, Square } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Segmented } from "@/components/ui/segmented";
import { GENERATE_EVENT, useWindowKeydown, type GenerateShortcutType } from "@/hooks/use-shortcuts";
import { track } from "@/lib/analytics";
import { formatRangeLabel, type DateRange } from "@/lib/dates";
import type { GenerationType, StandupFormat, Tone } from "@/lib/db/schema";
import { cn, pluralize } from "@/lib/utils";
import { saveGenerationEdit } from "@/server/actions/settings";
import { copyOutput } from "./output-format";
import { OutputPanel, type OutputPanelHandle } from "./output-panel";
import { RangePicker, type RangePreset } from "./range-picker";

const TYPES: { value: GenerationType; label: string; title: string; shortcut?: string }[] = [
  { value: "standup", label: "Standup", title: "Standup update" },
  { value: "weekly", label: "Weekly", title: "Weekly summary", shortcut: "G W" },
  { value: "appraisal", label: "Appraisal", title: "Appraisal notes", shortcut: "G A" },
];

const TONES: { value: Tone; label: string }[] = [
  { value: "concise", label: "Concise" },
  { value: "detailed", label: "Detailed" },
];

type Status = "idle" | "streaming" | "done" | "empty" | "error";

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
  defaultTone,
  standupFormat,
  autoStart,
  saved,
}: {
  initialType: GenerationType;
  defaultRanges: Record<GenerationType, DateRange>;
  presets: Record<GenerationType, RangePreset[]>;
  today: string;
  defaultTone: Tone;
  standupFormat: StandupFormat;
  autoStart: boolean;
  saved?: SavedGeneration;
}) {
  const router = useRouter();
  const [type, setType] = useState<GenerationType>(saved?.type ?? initialType);
  const [ranges, setRanges] = useState<Record<GenerationType, DateRange>>(() =>
    saved ? { ...defaultRanges, [saved.type]: saved.range } : defaultRanges,
  );
  const [tone, setTone] = useState<Tone>(defaultTone);
  const [status, setStatus] = useState<Status>(saved ? "done" : "idle");
  const [text, setText] = useState(saved?.output ?? "");
  const [meta, setMeta] = useState(saved ? saved.savedLabel : "");
  const [error, setError] = useState<{ title: string; body: string; canUsePlain: boolean } | null>(
    null,
  );
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
  const streaming = status === "streaming";
  const hasOutput = (status === "done" || status === "streaming") && text.length > 0;

  const generate = useCallback(
    async (opts: { type?: GenerationType; mode?: "ai" | "plain" } = {}) => {
      const t = opts.type ?? type;
      const mode = opts.mode ?? "ai";
      const r = ranges[t];
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setType(t);
      setStatus("streaming");
      setText("");
      setError(null);
      setCopied(false);
      setMeta("");
      setVersion((v) => v + 1);
      generationId.current = null;
      lastRequest.current = { type: t, range: r };
      track(mode === "plain" ? "plain_format_used" : "generation_started", { type: t });
      const started = performance.now();

      let res: Response;
      try {
        res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: t, range: r, tone, format: standupFormat, mode }),
          signal: controller.signal,
        });
      } catch (e) {
        if (controller.signal.aborted) return;
        console.error(e);
        setStatus("error");
        setError({
          title: `Couldn’t write your ${TYPES.find((x) => x.value === t)!.label.toLowerCase()}`,
          body: "Check your connection and retry, or use the plain format.",
          canUsePlain: true,
        });
        return;
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (body.code === "EMPTY_RANGE") {
          setStatus("empty");
          return;
        }
        track("generation_failed", { type: t, code: body.code ?? String(res.status) });
        setStatus("error");
        setError({
          title:
            body.code === "RATE_LIMITED"
              ? "You’ve hit the generation limit"
              : `Couldn’t write your ${TYPES.find((x) => x.value === t)!.label.toLowerCase()}`,
          body:
            body.code === "RATE_LIMITED"
              ? "Try again in a little while, or use the plain format now."
              : body.code === "AI_UNAVAILABLE"
                ? "AI writing isn’t set up here. Use the plain format: your entries listed as written."
                : "You can retry, or use the plain format: your entries listed under each section as written.",
          canUsePlain: mode === "ai",
        });
        return;
      }

      generationId.current = res.headers.get("X-Generation-Id");
      const count = Number(res.headers.get("X-Entry-Count") || 0);
      setMeta(`From ${pluralize(count, "entry", "entries")}`);

      const reader = res.body?.getReader();
      if (!reader) {
        setStatus("done");
        return;
      }
      const decoder = new TextDecoder();
      let acc = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setText(acc);
        }
        acc += decoder.decode();
        setText(acc.trim());
        setStatus("done");
        track("generation_completed", {
          type: t,
          mode,
          ms: Math.round(performance.now() - started),
        });
      } catch (e) {
        if (controller.signal.aborted) return;
        console.error(e);
        track("generation_failed", { type: t, code: "STREAM" });
        setStatus("error");
        setError({
          title: `Couldn’t finish your ${TYPES.find((x) => x.value === t)!.label.toLowerCase()}`,
          body: "The connection dropped mid-way. Retry, or use the plain format.",
          canUsePlain: true,
        });
      }
    },
    [type, ranges, tone, standupFormat, router],
  );

  function stop() {
    abortRef.current?.abort();
    setStatus("done");
    setText((t) => t.trim());
  }

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

  const outputTitle = TYPES.find((t) => t.value === (lastRequest.current?.type ?? type))!.title;

  const copyButton = (
    <Button
      size="sm"
      onClick={() => void copy()}
      disabled={!hasOutput || streaming}
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
          <Kbd className="hidden md:inline-flex" aria-hidden>
            ⌘C
          </Kbd>
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
        <div className="grid grid-cols-2 gap-2 md:contents">
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
          <div className="flex flex-col gap-1.5">
            <span
              id="tone-label"
              className="hidden text-xs font-medium text-subtle-foreground md:block"
            >
              Tone
            </span>
            <Segmented
              labelledBy="tone-label"
              options={TONES}
              value={tone}
              onChange={setTone}
              className="hidden md:flex"
            />
            <label className="sr-only" htmlFor="tone-select">
              Tone
            </label>
            <select
              id="tone-select"
              value={tone}
              onChange={(e) => setTone(e.target.value as Tone)}
              className="h-9 rounded-lg border border-border bg-surface px-3 text-[13px] md:hidden"
            >
              {TONES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Button
          variant="primary"
          size="md"
          className="h-[38px] gap-2.5 px-4 max-md:h-11 md:ml-auto"
          onClick={() => void generate()}
          disabled={streaming}
        >
          <Sparkles className="size-4" strokeWidth={1.75} aria-hidden />
          Generate
          {current.shortcut ? (
            <Kbd className="hidden md:inline-flex" aria-hidden>
              {current.shortcut}
            </Kbd>
          ) : null}
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
          {streaming ? (
            <span
              className="flex items-center gap-1.5 text-xs text-primary max-md:ml-auto"
              role="status"
            >
              <span className="size-1.5 rounded-full bg-primary" aria-hidden />
              Writing…
            </span>
          ) : null}
          <div className="ml-auto hidden gap-2 md:flex">
            {streaming ? (
              <Button size="sm" onClick={stop}>
                <Square className="size-3.5" strokeWidth={2} aria-hidden />
                Stop
              </Button>
            ) : (
              <Button size="sm" onClick={() => void generate()} disabled={status === "idle"}>
                <RefreshCw className="size-[15px]" strokeWidth={1.75} aria-hidden />
                Regenerate
              </Button>
            )}
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
                  {error.title}
                </span>
                <span className="text-[13px] leading-normal text-subtle-foreground">
                  {error.body}
                </span>
              </div>
              <div className="flex gap-2">
                {error.canUsePlain ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void generate({ mode: "plain" })}
                  >
                    Use plain format
                  </Button>
                ) : null}
                <Button size="sm" onClick={() => void generate()}>
                  Retry
                </Button>
              </div>
            </div>
          ) : (
            <OutputPanel
              ref={panelRef}
              text={text}
              streaming={streaming}
              version={version}
              label={`Generated ${outputTitle.toLowerCase()}, editable`}
            />
          )}
        </div>
      </section>

      {status === "done" || status === "streaming" ? (
        <div className="grid grid-cols-2 gap-2 md:hidden">
          {streaming ? (
            <Button className="h-11" onClick={stop}>
              <Square className="size-3.5" aria-hidden />
              Stop
            </Button>
          ) : (
            <Button className="h-11" onClick={() => void generate()}>
              <RefreshCw className="size-[15px]" aria-hidden />
              Regenerate
            </Button>
          )}
          <Button
            variant={copied ? "soft" : "primary"}
            className="h-11"
            disabled={!hasOutput || streaming}
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
