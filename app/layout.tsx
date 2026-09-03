import type { Metadata, Viewport } from "next";
import { Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";

import { PWARegister } from "@/components/PWARegister";

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KROMA Coffee & Bakehouse",
  description: "Specialty Roastery & Micro-Bakehouse",
  appleWebApp: {
    capable: true,
    title: "KROMA",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#1A1816",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-surface-canvas text-text-primary" suppressHydrationWarning>
        <PWARegister />
        {children}
      </body>
    </html>
  );
}
