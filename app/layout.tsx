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

export const metadata: Metadata = {
  title: "Good Game: Parkaden Quest",
  description: "Ett NFC-baserat livespel under Good Game LAN i Parkaden, Härnösand.",
  openGraph: {
    title: "Good Game: Parkaden Quest",
    description: "Hitta signaler. Samla laget. Lös NFC-uppdragen.",
    images: [{ url: "/good-game-logo.jpg" }],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
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
