import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const displayFont = localFont({
  src: "../public/fonts/Bookman ITC Std Demi/Bookman ITC Std Demi.otf",
  variable: "--font-display",
  display: "swap",
});

const BASE_URL = "https://mildred-pierce.vercel.app";

export const metadata: Metadata = {
  title: "Mildred Pierce",
  description: "Fractal Agreement — Coming Soon",
  metadataBase: new URL(BASE_URL),
  openGraph: {
    title: "Mildred Pierce — Fractal Agreement",
    description: "Pre-save now. Out May 15.",
    url: BASE_URL,
    siteName: "Mildred Pierce",
    images: [
      {
        url: "/og-image.jpg",
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
    description: "Pre-save now. Out May 15.",
    images: ["/og-image.jpg"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={displayFont.variable}>
      <body>{children}</body>
    </html>
  );
}
