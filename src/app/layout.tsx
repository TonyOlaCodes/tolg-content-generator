import type { Metadata, Viewport } from "next";
import { Outfit, Syne } from "next/font/google";
import { Toaster } from "sonner";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

const body = Outfit({
  subsets: ["latin"],
  variable: "--font-body",
});

const display = Syne({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Freestyle Lab",
  description: "Train elite off-the-top freestyle skills — association, rhyme chains, references, flow, and endurance.",
  applicationName: "Freestyle Lab",
  appleWebApp: {
    capable: true,
    title: "Freestyle Lab",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#070708",
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} h-full`}>
      <body className="min-h-full antialiased">
        <AppProviders>
          {children}
          <Toaster theme="dark" position="top-center" richColors />
        </AppProviders>
      </body>
    </html>
  );
}
