"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { CircleAlert, ExternalLink, GitPullRequest, RefreshCw, SquareKanban } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useSync } from "@/lib/integrations/client";
import {
  PROVIDER_NAMES,
  type IntegrationProviderId,
  type IntegrationStatus,
} from "@/lib/integrations/types";
import { cn } from "@/lib/utils";
import { connectGitHub, connectJira, disconnectIntegration } from "@/server/actions/integrations";
import { Card, Row, RowLabel } from "./layout";

/** Days imported right after connecting, so the log isn't empty on day one. */
const BACKFILL_DAYS = 7;

const ICONS = { github: GitPullRequest, jira: SquareKanban } as const;

const ABOUT: Record<IntegrationProviderId, string> = {
  github: "Pull requests you open, merge and review",
  jira: "Issues you move across the board",
};

export function IntegrationsCard({
  integrations,
  aiSetting,
}: {
  integrations: IntegrationStatus[];
  /** The "Summarise pull requests with AI" row, owned by the settings form. */
  aiSetting: React.ReactNode;
}) {
  const byProvider = new Map(integrations.map((i) => [i.provider, i]));
  return (
    <Card title="Integrations">
      {(["github", "jira"] as const).map((provider) => (
        <IntegrationRow key={provider} provider={provider} status={byProvider.get(provider)} />
      ))}
      {aiSetting}
    </Card>
  );
}

function IntegrationRow({
  provider,
  status,
}: {
  provider: IntegrationProviderId;
  status: IntegrationStatus | undefined;
}) {
  const Icon = ICONS[provider];
  const name = PROVIDER_NAMES[provider];
  const { sync, syncing } = useSync();

  function backfill() {
    void sync({ days: BACKFILL_DAYS, force: true });
  }

  let description: React.ReactNode = ABOUT[provider];
  if (status?.lastError) {
    description = (
      <span className="inline-flex items-start gap-1 text-blocker-soft-foreground">
        <CircleAlert className="mt-px size-3.5 shrink-0" strokeWidth={2} aria-hidden />
        {status.lastError}
      </span>
    );
  } else if (status) {
    const synced = status.lastSyncedAt
      ? `synced ${formatDistanceToNowStrict(new Date(status.lastSyncedAt), { addSuffix: true })}`
      : "not synced yet";
    description = `${status.displayName}${status.siteUrl ? ` · ${new URL(status.siteUrl).host}` : ""} · ${synced}`;
  }

  return (
    <Row>
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-background">
          <Icon className="size-[18px] text-subtle-foreground" strokeWidth={1.75} aria-hidden />
        </span>
        <RowLabel title={name} description={description} />
      </div>
      <div className="flex shrink-0 gap-2">
        {status ? (
          <>
            <Button size="sm" className="h-[34px]" disabled={syncing} onClick={backfill}>
              <RefreshCw
                className={cn("size-[15px]", syncing && "animate-spin")}
                strokeWidth={1.75}
                aria-hidden
              />
              {syncing ? "Syncing…" : "Sync now"}
            </Button>
            {status.lastError ? (
              <ConnectDialog provider={provider} label="Reconnect" onConnected={backfill} />
            ) : null}
            <DisconnectButton provider={provider} />
          </>
        ) : (
          <ConnectDialog provider={provider} label="Connect" onConnected={backfill} />
        )}
      </div>
    </Row>
  );
}

function ConnectDialog({
  provider,
  label,
  onConnected,
}: {
  provider: IntegrationProviderId;
  label: string;
  onConnected: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const name = PROVIDER_NAMES[provider];
  const errorId = useId();

  function submit(form: FormData) {
    setError(null);
    startTransition(async () => {
      const values = Object.fromEntries(form.entries());
      const res = provider === "github" ? await connectGitHub(values) : await connectJira(values);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      toast.success(
        `Connected ${name} as ${res.data.displayName}. Importing your last ${BACKFILL_DAYS} days…`,
      );
      router.refresh();
      onConnected();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant={label === "Connect" ? "primary" : "ghost"} size="sm" className="h-[34px]">
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Connect {name}</DialogTitle>
        <DialogDescription>
          {provider === "github"
            ? "Worklog adds a line for each pull request you open, merge or review. It only reads."
            : "Worklog adds a line each time you move an issue to another status. It only reads."}
        </DialogDescription>
        <form
          action={submit}
          className="flex flex-col gap-3.5"
          aria-describedby={error ? errorId : undefined}
        >
          {provider === "github" ? <GitHubFields /> : <JiraFields />}
          {error ? (
            <p
              id={errorId}
              role="alert"
              className="flex items-start gap-2 text-[13px] text-blocker-soft-foreground"
            >
              <CircleAlert className="mt-px size-4 shrink-0" aria-hidden />
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={pending}>
              {pending ? "Checking…" : "Connect"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const field =
  "h-10 rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-3 focus:ring-primary-ring";
const fieldLabel = "flex flex-col gap-1.5 text-xs font-medium text-subtle-foreground";

function HelpLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 font-medium text-primary hover:text-primary-hover"
    >
      {children}
      <ExternalLink className="size-3" aria-hidden />
    </a>
  );
}

function GitHubFields() {
  return (
    <>
      <label className={fieldLabel}>
        Personal access token
        <input
          name="token"
          type="password"
          required
          autoComplete="off"
          spellCheck={false}
          className={field}
        />
      </label>
      <p className="text-xs leading-relaxed text-muted-foreground">
        <HelpLink href="https://github.com/settings/personal-access-tokens/new">
          Create a fine-grained token
        </HelpLink>{" "}
        with read-only access to <span className="font-medium">Pull requests</span> on the
        repositories you work in. A classic token with the <code className="font-mono">repo</code>{" "}
        scope also works.
      </p>
    </>
  );
}

function JiraFields() {
  return (
    <>
      <label className={fieldLabel}>
        Jira site
        <input
          name="site"
          required
          placeholder="acme.atlassian.net"
          autoComplete="off"
          spellCheck={false}
          className={field}
        />
      </label>
      <label className={fieldLabel}>
        Atlassian email
        <input name="email" type="email" required autoComplete="email" className={field} />
      </label>
      <label className={fieldLabel}>
        API token
        <input
          name="token"
          type="password"
          required
          autoComplete="off"
          spellCheck={false}
          className={field}
        />
      </label>
      <p className="text-xs leading-relaxed text-muted-foreground">
        <HelpLink href="https://id.atlassian.com/manage-profile/security/api-tokens">
          Create an API token
        </HelpLink>{" "}
        for the account you use in Jira. Either kind works. For one with scopes, choose Jira, then{" "}
        <code className="font-mono">read:jira-work</code> and{" "}
        <code className="font-mono">read:jira-user</code>. Jira Cloud only.
      </p>
    </>
  );
}

function DisconnectButton({ provider }: { provider: IntegrationProviderId }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const name = PROVIDER_NAMES[provider];
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" className="h-[34px]">
          Disconnect
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>Disconnect {name}?</AlertDialogTitle>
        <AlertDialogDescription>
          Worklog forgets the token and stops importing. Entries it already added stay in your log.
        </AlertDialogDescription>
        <div className="flex justify-end gap-2">
          <AlertDialogCancel asChild>
            <Button size="sm">Cancel</Button>
          </AlertDialogCancel>
          <Button
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await disconnectIntegration(provider);
                if (!res.ok) toast.error(res.error);
                else router.refresh();
              })
            }
          >
            {pending ? "Disconnecting…" : "Disconnect"}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
