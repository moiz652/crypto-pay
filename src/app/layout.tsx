import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { InstallPrompt } from "@/components/InstallPrompt";
import { OfflineBanner } from "@/components/OfflineBanner";
import { Providers } from "@/components/Providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Crypto Pay",
  description: "Send and request USDC with usernames.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ffffff",
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full max-w-full overflow-x-hidden antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full max-w-full flex-col overflow-x-hidden" suppressHydrationWarning>
        <OfflineBanner />
        <ErrorBoundary>
          <Providers>{children}</Providers>
        </ErrorBoundary>
        <InstallPrompt />
      </body>
    </html>
  );
}
