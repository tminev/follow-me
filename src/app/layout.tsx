import type { Metadata } from "next";
import type { ReactNode } from "react";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import "./login/login.css";

export const metadata: Metadata = {
  title: "Follow Me",
  description: "Доброволно и безопасно свързване с хора",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Follow Me",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="bg">
      <head>
        <link rel="preload" href="/login-pin-star-underline.png" as="image" />
        <link rel="preload" href="/login-pin-star.png" as="image" />
      </head>
      <body>{children}</body>
    </html>
  );
}
