import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import { Toaster } from "sonner";
import { SessionProvider } from "@/components/providers/session-provider";
import "./globals.css";

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });
const display = Fraunces({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: {
    default: "DetailFlow — Turn enquiries into bookings",
    template: "%s · DetailFlow",
  },
  description:
    "DetailFlow helps service businesses organise customer enquiries, manage appointments and automate follow-ups from one simple dashboard.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IE" className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-dvh antialiased">
        <SessionProvider>
          {children}
          <Toaster theme="dark" position="top-center" richColors />
        </SessionProvider>
      </body>
    </html>
  );
}
