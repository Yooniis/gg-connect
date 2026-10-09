import type { Metadata } from "next";
import "./globals.css";
import "./branding.css";
import "./core-games.css";
import "./mic-flow.css";
import "./silent-answer.css";
import "./venue.css";
import "./admin.css";
import "./live-quests.css";
import "./community.css";
import "./live-screen.css";
import "./finishing.css";

/** Prevent CDN/App Hosting from serving stale prerendered HTML for a year. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Good Game: Parkaden Quest",
  description: "Ett NFC-baserat livespel under Good Game LAN i Parkaden, Härnösand.",
  openGraph: {
    title: "Good Game: Parkaden Quest",
    description: "Hitta signaler. Hjälp communityn. Lös NFC-uppdragen.",
    images: [{ url: "/gg-logo.png" }],
  },
  icons: {
    icon: "/gg-logo.png",
    shortcut: "/gg-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv">
      <body className="antialiased">{children}</body>
    </html>
  );
}
