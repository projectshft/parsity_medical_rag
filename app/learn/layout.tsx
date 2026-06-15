import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { isAdmin } from "@/lib/lms/admin";

export default async function LearnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await isAdmin();

  return (
    <div className="min-h-screen bg-copilot-bg text-copilot-text">
      <header className="flex items-center justify-between border-b border-copilot-border bg-copilot-sidebar px-6 py-3">
        <Link href="/learn" className="font-semibold text-white">
          RAG &amp; AI Agents
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {admin && (
            <Link href="/admin" className="text-copilot-accent hover:underline">
              Admin
            </Link>
          )}
          <UserButton />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </div>
  );
}
