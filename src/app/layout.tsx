import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { RootProviders } from "@/components/providers/root-providers";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Havyn",
  description: "Property management and leasing hub",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/*
          Plain <script src> in the root Server Component: runs as the document is parsed
          (before client hydration) without next/script, which triggers React 19 console
          warnings when the layout tree is reconciled on the client.
        */}
        <script src="/havyn-theme-boot.js" />
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}
