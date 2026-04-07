import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";

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
          External src avoids React 19 warning on inline <script> in the layout tree.
          beforeInteractive runs before Next.js chunks (see next/script docs).
        */}
        <Script id="havyn-theme-boot" src="/havyn-theme-boot.js" strategy="beforeInteractive" />
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}
