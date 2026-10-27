import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TOLG Content Generator",
  description:
    "Turn a rough idea into a ready-to-post draft for Instagram, LinkedIn, X, email and blogs. Runs entirely in your browser.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
