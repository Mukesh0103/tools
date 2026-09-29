import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <Logo />
      <h1 className="text-xl font-semibold tracking-tight">Page not found</h1>
      <Link href="/today" className="text-sm font-medium text-primary hover:text-primary-hover">
        Back to today →
      </Link>
    </main>
  );
}
