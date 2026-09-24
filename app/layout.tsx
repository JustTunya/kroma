import type { Metadata, Viewport } from "next";
import { Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next"
import "./globals.css";

import { PWARegister } from "@/components/PWARegister";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

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
  metadataBase: new URL(SITE_URL),
  title: { default: "KROMA Coffee & Bakehouse — Cluj-Napoca", template: "%s | KROMA" },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  robots:
    process.env.VERCEL_ENV === "production" || !process.env.VERCEL_ENV
      ? { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } }
      : { index: false, follow: false },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "KROMA Coffee & Bakehouse — Cluj-Napoca",
    description: SITE_DESCRIPTION,
    url: "/",
    locale: "en_GB",
  },
  twitter: { card: "summary_large_image", title: "KROMA Coffee & Bakehouse", description: SITE_DESCRIPTION },
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
        <div aria-hidden className="pointer-events-none fixed inset-0 z-9999 opacity-[0.032] mix-blend-multiply">
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
        <Analytics />
        {children}
      </body>
    </html>
  );
}
