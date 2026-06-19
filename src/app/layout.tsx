import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SuperHRD",
    template: "%s | SuperHRD",
  },
  applicationName: "SuperHRD",
  description: "Upload candidate CVs and get AI-powered screening scores",
  icons: {
    icon: "/superhrd-logo-mark.svg",
    shortcut: "/superhrd-logo-mark.svg",
    apple: "/superhrd-logo-mark.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
