"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Download, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Avatar } from "@/components/app/sidebar";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { settingsSchema, type SettingsInput } from "@/lib/validators";
import { deleteAccount, saveSettings, signOutAction } from "@/server/actions/settings";

type Account = { name: string; email: string; initial: string; method: string };

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60px] flex-col gap-3 border-t border-divider px-4 py-3 first:border-t-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      {children}
    </div>
  );
}

function RowLabel({
  htmlFor,
  id,
  title,
  description,
}: {
  htmlFor?: string;
  id?: string;
  title: string;
  description?: string;
}) {
  const Title = htmlFor ? "label" : "span";
  return (
    <div className="flex flex-col gap-0.5">
      <Title htmlFor={htmlFor} id={id} className="text-sm font-medium">
        {title}
      </Title>
      {description ? <span className="text-xs text-muted-foreground">{description}</span> : null}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[13px] font-medium text-subtle-foreground">{title}</h2>
      <div className="flex flex-col rounded-lg border border-border bg-surface">{children}</div>
    </section>
  );
}

export function SettingsForm({
  account,
  timeZones,
  defaults,
}: {
  account: Account;
  timeZones: { value: string; label: string }[];
  defaults: SettingsInput;
}) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [, startTransition] = useTransition();
  const form = useForm<SettingsInput>({
    resolver: zodResolver(settingsSchema),
    defaultValues: defaults,
    mode: "onChange",
  });
  const values = useWatch({ control: form.control });
  const first = useRef(true);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      void form.handleSubmit((data) => {
        setStatus("saving");
        startTransition(async () => {
          const res = await saveSettings(data);
          if (res.ok) setStatus("saved");
          else {
            setStatus("idle");
            toast.error(res.error);
          }
        });
      })();
    }, 500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(values)]);

  return (
    <div className="flex w-full max-w-[720px] flex-col gap-[22px] px-5 pt-12 pb-10 md:px-0">
      <div className="flex items-baseline justify-between">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] md:text-[28px]">Settings</h1>
        <span
          className="flex items-center gap-1 text-xs text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          {status === "saving" ? (
            "Saving…"
          ) : status === "saved" ? (
            <>
              <Check className="size-3.5 text-primary" strokeWidth={2.25} aria-hidden /> Saved
            </>
          ) : null}
        </span>
      </div>

      <Card title="Account">
        <Row>
          <div className="flex items-center gap-3">
            <Avatar
              user={{ name: account.name, initial: account.initial, timezone: "" }}
              size={36}
            />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium">{account.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                Signed in with {account.method}
                {account.email ? ` · ${account.email}` : ""}
              </span>
            </div>
          </div>
          <form action={signOutAction}>
            <Button type="submit" size="sm" className="h-[34px]">
              <LogOut className="size-[15px]" strokeWidth={1.75} aria-hidden />
              Sign out
            </Button>
          </form>
        </Row>
      </Card>

      <Card title="Preferences">
        <Row>
          <RowLabel
            htmlFor="tz"
            title="Time zone"
            description="Decides where “today” starts and ends"
          />
          <select
            id="tz"
            {...form.register("timezone")}
            className="h-9 min-w-[200px] rounded-lg border border-border bg-surface px-2.5 text-[13px] sm:max-w-[280px]"
          >
            {timeZones.map((z) => (
              <option key={z.value} value={z.value}>
                {z.label}
              </option>
            ))}
          </select>
        </Row>
        <Row>
          <RowLabel
            htmlFor="rem"
            title="Daily reminder"
            description="An email nudge if you haven’t logged anything by then"
          />
          <div className="flex items-center gap-3">
            <input
              id="rem"
              type="time"
              {...form.register("reminderTime")}
              aria-invalid={Boolean(form.formState.errors.reminderTime)}
              className="h-9 w-[110px] rounded-lg border border-border bg-surface px-2.5 text-[13px]"
            />
            <Controller
              control={form.control}
              name="reminderEnabled"
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  aria-label={field.value ? "Daily reminder on" : "Daily reminder off"}
                />
              )}
            />
          </div>
        </Row>
        <Row>
          <RowLabel
            id="fmt-l"
            title="Default standup format"
            description="Used for every standup you generate"
          />
          <Controller
            control={form.control}
            name="standupFormat"
            render={({ field }) => (
              <Segmented
                size="sm"
                labelledBy="fmt-l"
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: "ytb", label: "Y / T / B" },
                  { value: "bullets", label: "Bullets" },
                  { value: "paragraph", label: "Paragraph" },
                ]}
              />
            )}
          />
        </Row>
        <Row>
          <RowLabel
            id="tone-l"
            title="Default tone"
            description="Where generators start; you can switch per output"
          />
          <Controller
            control={form.control}
            name="defaultTone"
            render={({ field }) => (
              <Segmented
                size="sm"
                labelledBy="tone-l"
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: "concise", label: "Concise" },
                  { value: "detailed", label: "Detailed" },
                ]}
              />
            )}
          />
        </Row>
        <Row>
          <RowLabel id="th-l" title="Theme" description="Saved on this device" />
          <Segmented
            size="sm"
            labelledBy="th-l"
            value={mounted ? ((theme as "system" | "light" | "dark") ?? "system") : "system"}
            onChange={setTheme}
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        </Row>
      </Card>

      <Card title="Your data">
        <Row>
          <RowLabel
            title="Export entries"
            description="Everything you’ve logged, with dates and tags"
          />
          <div className="flex gap-2">
            <Button asChild size="sm" className="h-[34px]">
              <a href="/api/export?format=md" download>
                <Download className="size-[15px]" strokeWidth={1.75} aria-hidden />
                Markdown
              </a>
            </Button>
            <Button asChild size="sm" className="h-[34px]">
              <a href="/api/export?format=csv" download>
                <Download className="size-[15px]" strokeWidth={1.75} aria-hidden />
                CSV
              </a>
            </Button>
          </div>
        </Row>
        <Row>
          <RowLabel
            title="Delete account"
            description="Permanently removes all entries and saved outputs"
          />
          <DeleteAccount />
        </Row>
      </Card>
    </div>
  );
}

function DeleteAccount() {
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <AlertDialog onOpenChange={() => setConfirm("")}>
      <AlertDialogTrigger asChild>
        <Button variant="danger" size="sm" className="h-[34px]">
          Delete account…
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>Delete your account?</AlertDialogTitle>
        <AlertDialogDescription>
          This permanently deletes every entry and saved output. It can’t be undone. Export your
          entries first if you want a copy.
        </AlertDialogDescription>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-subtle-foreground">
          Type “delete” to confirm
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="off"
            className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-blocker focus:ring-3 focus:ring-blocker-ring"
          />
        </label>
        <div className="flex justify-end gap-2">
          <AlertDialogCancel asChild>
            <Button size="sm">Cancel</Button>
          </AlertDialogCancel>
          <Button
            variant="destructive"
            size="sm"
            disabled={confirm !== "delete" || pending}
            onClick={() =>
              startTransition(async () => {
                const res = await deleteAccount(confirm);
                if (res && !res.ok) toast.error(res.error);
              })
            }
          >
            {pending ? "Deleting…" : "Delete account"}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
