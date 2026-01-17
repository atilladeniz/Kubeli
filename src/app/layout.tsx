import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { I18nProvider } from "@/components/providers/I18nProvider";
import { Toaster } from "@/components/ui/sonner";
import { UpdateChecker } from "@/components/features/updater/UpdateChecker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kubeli - Kubernetes Management",
  description: "Kubeli - Modern Kubernetes Management Desktop Application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="classic-dark overscroll-none" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background overscroll-none`}
      >
        <ThemeProvider>
          <I18nProvider>
            {children}
            <Toaster />
            <UpdateChecker />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
