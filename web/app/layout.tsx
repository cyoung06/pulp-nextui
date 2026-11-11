import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@fontsource-variable/inter";
import "@fontsource-variable/geist-mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pulp",
  description: "Repositories, distributions and tasks of a Pulp server.",
  referrer: "no-referrer",
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="flex h-full min-h-full flex-col overflow-hidden">{children}</body>
    </html>
  );
}
