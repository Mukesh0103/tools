/** Shapes shared by the sync API and the client. Safe to import from client components. */

export type IntegrationProviderId = "github" | "jira";

export const PROVIDER_NAMES: Record<IntegrationProviderId, string> = {
  github: "GitHub",
  jira: "Jira",
};

/** What Settings and Today know about a connection. The token never leaves the server. */
export type IntegrationStatus = {
  provider: IntegrationProviderId;
  displayName: string;
  siteUrl: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
};

export type ProviderSyncResult = {
  provider: IntegrationProviderId;
  status: "ok" | "skipped" | "error";
  imported: number;
  error?: string;
};

export type SyncResult = { imported: number; providers: ProviderSyncResult[] };
