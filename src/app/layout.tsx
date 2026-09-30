import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["500", "700"], variable: "--f-display" });
const body = Figtree({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--f-body" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--f-mono" });

export const metadata: Metadata = {
  title: "QuoteHanger",
  description: "Hang lights on your own house, see it at night, get a price.",
};

export const viewport: Viewport = {
  themeColor: "#0c1220",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
