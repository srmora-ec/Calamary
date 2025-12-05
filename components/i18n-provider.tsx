// src/components/i18n-provider.tsx
"use client";

import { I18nextProvider } from "react-i18next"; // <--- OJO AQUÍ
import i18n from "@/i18n"; 
import { ReactNode } from "react";

// Puedes llamarlo como quieras, ej: "TranslationProvider" para evitar confusiones
export default function TranslationProvider({ children }: { children: ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}