"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";
import { enabledProviders, signIn } from "@/lib/auth";

const AFTER_LOGIN = "/today";

async function run(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (error) {
    // Successful sign-ins throw Next's redirect. Only Auth.js errors are handled here.
    if (error instanceof AuthError) redirect(`/login?error=${encodeURIComponent(error.type)}`);
    throw error;
  }
}

export async function signInWithProvider(provider: "github" | "google") {
  if (!enabledProviders().includes(provider)) redirect("/login?error=Configuration");
  await run(() => signIn(provider, { redirectTo: AFTER_LOGIN }));
}

export async function signInWithEmail(formData: FormData) {
  const email = z.email().safeParse(String(formData.get("email") ?? "").trim());
  if (!email.success) redirect("/login?error=InvalidEmail");
  await run(() => signIn("resend", { email: email.data, redirectTo: AFTER_LOGIN }));
}

export async function signInForTests(formData: FormData) {
  if (!enabledProviders().includes("test-login")) redirect("/login");
  await run(() =>
    signIn("test-login", {
      email: formData.get("email"),
      secret: formData.get("secret"),
      redirectTo: AFTER_LOGIN,
    }),
  );
}
