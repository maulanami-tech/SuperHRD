import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/components/i18n-provider";
import { getRequestLocale } from "@/lib/i18n/server";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();

  return (
    <html lang={locale} className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <I18nProvider locale={locale}>
          {children}
          <Toaster />
        </I18nProvider>
      </body>
    </html>
  );
}