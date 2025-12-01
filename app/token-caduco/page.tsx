"use client"

import { useTranslation } from "react-i18next";

export default function TokenExpiradoPage() {
  const {t}=useTranslation();
  return (
    <div className="flex flex-col items-center justify-center h-screen text-center px-6">
      <h1 className="text-2xl font-bold text-red-600 mb-4">{t('expertos.invitacion')} {t('expertos.novalid')}</h1>
      <p className="text-gray-700 max-w-md">
       {t('expertos.indicaducar')}
      </p>
    </div>
  );
}
