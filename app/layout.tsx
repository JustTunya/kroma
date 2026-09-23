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
        <div aria-hidden className="pointer-events-none fixed inset-0 z-[9999] opacity-[0.032] mix-blend-multiply">
          <svg className="h-full w-full">
            <filter id="grain-filter">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.8"
                numOctaves="3"
                stitchTiles="stitch"
              />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter="url(#grain-filter)" />
          </svg>
        </div>
        <PWARegister />
        {children}
      </body>
    </html>
  );
}
