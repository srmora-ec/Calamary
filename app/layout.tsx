import type { Metadata } from "next";
import "./globals.css";

import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

import { AuthProvider } from "@/context/AuthProvider";
import NotificationProvider from "@/components/NotificationProvider";
import i18n from "@/i18n";
import { I18nextProvider } from "react-i18next";


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
            <I18nextProvider i18n={i18n}>
              {children}
            </I18nextProvider>
          </AuthProvider>
        </NotificationProvider>
      </body>
    </html>
  );
}
