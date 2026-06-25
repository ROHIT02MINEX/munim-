import type { Metadata, Viewport } from "next";
import { Outfit, Inter } from "next/font/google";
import ServiceWorkerRegister from "@/components/sw-register";
import { SyncProvider } from "@/lib/sync";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Munim by Rohit | AI Financial Ledger",
  description: "India's first AI-powered digital Munim that works offline, online, on mobile, tablet, and desktop.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Munim",
    startupImage: [
      {
        url: "/icon.svg",
      },
    ],
  },
  applicationName: "Munim",
};

export const viewport: Viewport = {
  themeColor: "#07090e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${inter.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-brand-bg text-slate-100 font-sans"
      >
        <ServiceWorkerRegister />
        <SyncProvider>
          {children}
        </SyncProvider>
      </body>
    </html>
  );
}
