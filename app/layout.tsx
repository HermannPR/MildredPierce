import type { Metadata } from "next";
import localFont from "next/font/local";
import { Cormorant_Garamond } from "next/font/google";
import "./globals.css";

const serifFont = Cormorant_Garamond({
  weight: ["300", "400", "600"],
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const displayFont = localFont({
  src: "../public/fonts/Bookman ITC Std Demi/Bookman ITC Std Demi.otf",
  variable: "--font-display",
  display: "swap",
});

const BASE_URL = "https://mildred-pierce.vercel.app";

export const metadata: Metadata = {
  title: "Mildred Pierce — Fractal Agreement",
  description: "Debut single out now. Listen on Spotify and YouTube.",
  metadataBase: new URL(BASE_URL),
  openGraph: {
    title: "Mildred Pierce — Fractal Agreement",
    description: "Debut single out now. Listen on Spotify and YouTube.",
    url: BASE_URL,
    siteName: "Mildred Pierce",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "Mildred Pierce — Fractal Agreement",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mildred Pierce — Fractal Agreement",
    description: "Debut single out now. Listen on Spotify and YouTube.",
    images: ["/api/og"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${displayFont.variable} ${serifFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
