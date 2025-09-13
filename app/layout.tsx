import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import "./globals.css"
import { AuthProvider } from "@/context/AuthProvider";


export const metadata: Metadata = {
  title: "Calamary - Gestión de Modelos",
  description: "Aplicación para gestionar modelos con Supabase",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
       <link rel="icon" href="/logo.png" /> 
      <body className={`${GeistSans.variable} ${GeistMono.variable}`}> <AuthProvider>{children}</AuthProvider></body>
    </html>
  )
}
