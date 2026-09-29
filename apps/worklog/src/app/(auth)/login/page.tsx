import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/ui/logo";
import { enabledProviders, hasLiveSession } from "@/lib/auth";
import { signInForTests, signInWithEmail, signInWithProvider } from "@/server/actions/auth";
import { SubmitButton } from "./submit-button";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  InvalidEmail: "Enter a valid email address.",
  Verification: "That sign-in link has expired or was already used. Request a new one.",
  OAuthAccountNotLinked:
    "That email is already linked to another sign-in method. Use the one you signed up with.",
  AccessDenied: "Access was denied.",
  Configuration: "Sign-in isn’t configured correctly. Check the server settings.",
  CredentialsSignin: "Test login failed.",
};

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden fill="currentColor">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56V6.61H1.28a12 12 0 0 0 0 10.78l4.01-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.97 11.97 0 0 0 1.28 6.61l4.01 3.11C6.23 6.88 8.88 4.77 12 4.77Z"
      />
    </svg>
  );
}

const oauthClass =
  "flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-surface text-sm font-medium text-foreground hover:bg-hover";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string; deleted?: string }>;
}) {
  if (await hasLiveSession()) redirect("/today");
  const params = await searchParams;
  const providers = enabledProviders();
  const error = params.error ? (ERRORS[params.error] ?? "Couldn’t sign you in. Try again.") : null;
  const hasOauth = providers.includes("github") || providers.includes("google");

  return (
    <main className="grid min-h-dvh md:grid-cols-2">
      <div className="hidden flex-col justify-center gap-7 border-r border-border px-24 md:flex">
        <div className="flex items-center gap-2.5">
          <LogoMark size={28} className="rounded-[7px]" />
          <span className="text-[17px] font-semibold tracking-[-0.01em]">Worklog</span>
        </div>
        <p className="text-[44px] leading-[1.1] font-semibold tracking-[-0.03em] text-balance">
          One line per task. Your standup writes itself.
        </p>
        <div className="flex max-w-[440px] flex-col gap-0.5 rounded-lg border border-border bg-surface px-[18px] py-4 font-mono text-[13px] text-subtle-foreground">
          <span>
            <span className="text-muted-foreground">10:20</span> Sprint planning{" "}
            <span className="text-primary-soft-foreground">#planning</span>
          </span>
          <span>
            <span className="text-muted-foreground">13:05</span> Fixed invoices pagination{" "}
            <span className="text-primary-soft-foreground">#billing</span>
          </span>
          <span>
            <span className="text-muted-foreground">15:32</span> Waiting on DB creds{" "}
            <span className="text-blocker-soft-foreground">!blocker</span>
          </span>
        </div>
      </div>

      <div className="flex items-center justify-center px-4 py-10">
        <div className="flex w-full max-w-[360px] flex-col gap-4">
          <div className="mb-6 flex items-center gap-2.5 md:hidden">
            <LogoMark size={28} className="rounded-[7px]" />
            <span className="text-[17px] font-semibold">Worklog</span>
          </div>
          <div className="mb-2 flex flex-col gap-1.5">
            <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
              {params.sent ? "Check your email" : "Sign in"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {params.sent
                ? "We sent you a sign-in link. It works once and expires in 24 hours."
                : params.deleted
                  ? "Your account and all its data were deleted."
                  : "Your entries are saved to your account."}
            </p>
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-lg bg-blocker-soft px-3 py-2 text-[13px] text-blocker-soft-foreground"
            >
              {error}
            </p>
          ) : null}

          {params.sent ? null : (
            <>
              {providers.includes("github") ? (
                <form action={signInWithProvider.bind(null, "github")}>
                  <SubmitButton className={oauthClass}>
                    <GitHubIcon /> Continue with GitHub
                  </SubmitButton>
                </form>
              ) : null}
              {providers.includes("google") ? (
                <form action={signInWithProvider.bind(null, "google")}>
                  <SubmitButton className={oauthClass}>
                    <GoogleIcon /> Continue with Google
                  </SubmitButton>
                </form>
              ) : null}

              {providers.includes("resend") ? (
                <>
                  {hasOauth ? (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="h-px grow bg-border" />
                      or
                      <div className="h-px grow bg-border" />
                    </div>
                  ) : null}
                  <form action={signInWithEmail} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="email" className="text-xs font-medium text-subtle-foreground">
                        Work email
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                        placeholder="you@company.com"
                        className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-3 focus:ring-primary-ring"
                      />
                    </div>
                    <SubmitButton
                      pendingLabel="Sending…"
                      className="flex h-11 items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:bg-primary-hover"
                    >
                      Email me a sign-in link
                    </SubmitButton>
                  </form>
                  <p className="mt-1 text-center text-xs text-muted-foreground">
                    No password needed. We’ll email you a one-time link.
                  </p>
                </>
              ) : null}

              {providers.length === 0 ? (
                <p className="text-sm text-subtle-foreground">
                  No sign-in method is configured. Set GitHub, Google or Resend keys in the
                  environment.
                </p>
              ) : null}

              {providers.includes("test-login") ? (
                <form
                  action={signInForTests}
                  className="mt-4 flex flex-col gap-2 border-t border-dashed border-border-strong pt-4"
                  data-testid="test-login"
                >
                  <span className="text-xs font-medium text-subtle-foreground">
                    Test login (AUTH_TEST_LOGIN_SECRET is set)
                  </span>
                  <input
                    name="email"
                    type="email"
                    aria-label="Test email"
                    defaultValue="e2e@worklog.test"
                    className="h-9 rounded-lg border border-border bg-surface px-3 text-sm"
                  />
                  <input
                    name="secret"
                    type="password"
                    aria-label="Test secret"
                    className="h-9 rounded-lg border border-border bg-surface px-3 text-sm"
                  />
                  <SubmitButton className="h-9 rounded-lg border border-border bg-surface text-sm hover:bg-hover">
                    Test sign in
                  </SubmitButton>
                </form>
              ) : null}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
