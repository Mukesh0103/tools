import "server-only";
import { timingSafeEqual } from "node:crypto";
import NextAuth, { type NextAuthConfig } from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "./db/client";
import { findOrCreateUserByEmail, getUserWithSettings } from "./db/queries/users";
import { accounts, sessions, users, verificationTokens } from "./db/schema";

declare module "next-auth" {
  interface Session {
    user: { id: string; name?: string | null; email?: string | null; image?: string | null };
  }
}

export type AuthProviderId = "github" | "google" | "resend" | "test-login";

/** Which sign-in methods are configured. The login page renders only these. */
export function enabledProviders(): AuthProviderId[] {
  const ids: AuthProviderId[] = [];
  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) ids.push("github");
  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) ids.push("google");
  if (process.env.RESEND_API_KEY || process.env.NODE_ENV !== "production") ids.push("resend");
  if (process.env.AUTH_TEST_LOGIN_SECRET) ids.push("test-login");
  return ids;
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function buildProviders(): Provider[] {
  const enabled = enabledProviders();
  const providers: Provider[] = [];

  if (enabled.includes("github")) {
    providers.push(
      GitHub({
        clientId: process.env.AUTH_GITHUB_ID,
        clientSecret: process.env.AUTH_GITHUB_SECRET,
      }),
    );
  }
  if (enabled.includes("google")) {
    providers.push(
      Google({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
      }),
    );
  }
  if (enabled.includes("resend")) {
    const apiKey = process.env.RESEND_API_KEY;
    providers.push(
      Resend({
        apiKey: apiKey ?? "dev-no-key",
        from: process.env.EMAIL_FROM ?? "Worklog <onboarding@resend.dev>",
        // No key in development: print the link instead of sending it.
        ...(apiKey
          ? {}
          : {
              sendVerificationRequest: async ({ identifier, url }) => {
                console.info(`\n[worklog] Magic sign-in link for ${identifier}:\n${url}\n`);
              },
            }),
      }),
    );
  }
  if (enabled.includes("test-login")) {
    // Password-less login for Playwright. Only enabled while AUTH_TEST_LOGIN_SECRET is set.
    providers.push(
      Credentials({
        id: "test-login",
        name: "Test login",
        credentials: { email: {}, secret: {} },
        authorize: async (raw) => {
          const parsed = z.object({ email: z.email(), secret: z.string() }).safeParse(raw);
          const expected = process.env.AUTH_TEST_LOGIN_SECRET;
          if (!parsed.success || !expected || !safeEqual(parsed.data.secret, expected)) return null;
          const user = await findOrCreateUserByEmail(parsed.data.email);
          return { id: user.id, email: user.email, name: user.name };
        },
      }),
    );
  }
  return providers;
}

function buildConfig(): NextAuthConfig {
  return {
    adapter: DrizzleAdapter(getDb(), {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    }),
    // JWT sessions: no database round trip on each request, and they work with the Credentials test provider.
    session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
    providers: buildProviders(),
    pages: { signIn: "/login", verifyRequest: "/login?sent=1", error: "/login" },
    trustHost: true,
    callbacks: {
      jwt({ token, user }) {
        if (user?.id) token.sub = user.id;
        return token;
      },
      session({ session, token }) {
        if (token.sub) session.user.id = token.sub;
        return session;
      },
    },
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => buildConfig());

/** Session user id, or a redirect to /login. Use in every page, action and route that reads user data. */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) redirect("/login");
  return id;
}

/** Like `requireUserId`, but returns null instead of redirecting. For route handlers that answer 401. */
export async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/**
 * True only when the session's user still exists. A valid JWT can outlive its
 * row (a DB reset, or an account deleted on another device). Checking here
 * stops /login and the app shell from redirecting to each other forever.
 */
export async function hasLiveSession(): Promise<boolean> {
  const id = await currentUserId();
  return Boolean(id && (await getUserWithSettings(id)));
}
