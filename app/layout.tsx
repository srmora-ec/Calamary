import type { Metadata } from "next";
import "./globals.css";

import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

import { AuthProvider } from "@/context/AuthProvider";
import NotificationProvider from "@/components/NotificationProvider";
import I18nProvider from "@/components/I18nProvider";
import "@/i18n";

export const metadata: Metadata = {
  title: "Calamary - Gestión de Modelos",
  description: "Aplicación para gestionar modelos con Supabase",
  generator: "v0.app",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <link rel="icon" href="/logo.png" />
      <body className={`${GeistSans.variable} ${GeistMono.variable}`}>
        <NotificationProvider>
          <AuthProvider>
            <I18nProvider>
              {children}
            </I18nProvider>
          </AuthProvider>
        </NotificationProvider>
      </body>
    </html>
  );
}
