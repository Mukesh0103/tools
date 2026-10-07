"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { deleteIntegration, upsertIntegration } from "@/lib/db/queries/integrations";
import { IntegrationError } from "@/lib/integrations/activity";
import { encryptSecret } from "@/lib/integrations/crypto";
import { verifyGitHubToken } from "@/lib/integrations/github";
import { normalizeJiraSite, verifyJira } from "@/lib/integrations/jira";
import { githubConnectSchema, jiraConnectSchema } from "@/lib/validators";
import type { ActionResult } from "./entries";

function revalidateIntegrations() {
  revalidatePath("/settings");
  revalidatePath("/today");
}

function failure(error: unknown, fallback: string): { ok: false; error: string } {
  if (error instanceof IntegrationError) return { ok: false, error: error.message };
  console.error("[integrations]", error);
  return { ok: false, error: fallback };
}

/** Checks the token against GitHub before saving it, so a typo fails here and not on the first sync. */
export async function connectGitHub(
  input: unknown,
): Promise<ActionResult<{ displayName: string }>> {
  const userId = await requireUserId();
  const parsed = githubConnectSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid token" };

  try {
    const viewer = await verifyGitHubToken(parsed.data.token);
    const displayName = `@${viewer.login}`;
    await upsertIntegration({
      userId,
      provider: "github",
      accountId: viewer.login,
      displayName,
      siteUrl: null,
      email: null,
      apiUrl: null,
      secret: encryptSecret(parsed.data.token),
    });
    revalidateIntegrations();
    return { ok: true, data: { displayName } };
  } catch (error) {
    return failure(error, "Couldn't connect to GitHub. Try again.");
  }
}

export async function connectJira(input: unknown): Promise<ActionResult<{ displayName: string }>> {
  const userId = await requireUserId();
  const parsed = jiraConnectSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid details" };

  const siteUrl = normalizeJiraSite(parsed.data.site);
  if (!siteUrl) {
    return { ok: false, error: "Use your Jira Cloud address, like acme.atlassian.net." };
  }
  const creds = { siteUrl, email: parsed.data.email, token: parsed.data.token };

  try {
    const me = await verifyJira(creds);
    await upsertIntegration({
      userId,
      provider: "jira",
      accountId: me.accountId,
      displayName: me.displayName,
      siteUrl,
      email: creds.email,
      apiUrl: me.apiUrl,
      secret: encryptSecret(creds.token),
    });
    revalidateIntegrations();
    return { ok: true, data: { displayName: me.displayName } };
  } catch (error) {
    return failure(error, "Couldn't connect to Jira. Try again.");
  }
}

/** Forgets the token. Entries already imported stay in the log. */
export async function disconnectIntegration(provider: unknown): Promise<ActionResult<null>> {
  const userId = await requireUserId();
  if (provider !== "github" && provider !== "jira")
    return { ok: false, error: "Unknown integration" };
  await deleteIntegration(userId, provider);
  revalidateIntegrations();
  return { ok: true, data: null };
}
