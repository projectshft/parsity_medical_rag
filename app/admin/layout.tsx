import Link from "next/link";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { isAdmin } from "@/lib/lms/admin";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Gate the whole /admin segment. Middleware guarantees authentication;
  // this enforces the admin allowlist. Every action re-checks too.
  if (!(await isAdmin())) redirect("/learn");

  return (
    <div className="min-h-screen bg-copilot-bg text-copilot-text">
      <header className="flex items-center justify-between border-b border-copilot-border bg-copilot-sidebar px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-white">Admin</span>
          <Link
            href="/learn"
            className="text-sm text-copilot-accent hover:underline"
          >
            ← Course
          </Link>
        </div>
        <UserButton />
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
