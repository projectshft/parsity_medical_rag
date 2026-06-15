import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "Medical Records Assistant",
  description: "AI-powered assistant for querying medical records",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // ClerkProvider at the root only makes auth context available; it does
  // not force sign-in. The medical-rag app (/, /upload, /api/*) stays
  // public — only /learn and /admin are gated, in middleware.ts.
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
