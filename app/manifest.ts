import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KROMA Coffee & Bakehouse",
    short_name: "KROMA",
    description: "Specialty Roastery & Micro-Bakehouse",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F8F6F0",
    theme_color: "#1A1816",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
