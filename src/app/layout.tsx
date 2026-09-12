import type { Metadata, Viewport } from "next";
import { Exo_2, Orbitron, Share_Tech_Mono } from "next/font/google";
import "./globals.css";

const exo = Exo_2({
  variable: "--font-exo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["500", "700"],
});

const share = Share_Tech_Mono({
  variable: "--font-share",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "DON'T KILL THE ASTRONAUT",
  description: "A 2–4 player co-op Mars survival game. Rescue in 7 minutes.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#07040a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${exo.variable} ${orbitron.variable} ${share.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
