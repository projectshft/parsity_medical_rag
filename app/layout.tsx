import type { Metadata } from "next";
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
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
