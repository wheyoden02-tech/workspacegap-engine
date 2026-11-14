import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WorkspaceGap // Workbench",
  description:
    "A domain-owned Google Workspace automation sandbox. Explore tool overlap, safe quote processing, and human-reviewed Gmail drafts.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
