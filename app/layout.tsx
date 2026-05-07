import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const displayFont = localFont({
  src: "../public/fonts/Bookman ITC Std Demi/Bookman ITC Std Demi.otf",
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mildred Pierce",
  description: "Fractal Agreement — Coming Soon",
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
