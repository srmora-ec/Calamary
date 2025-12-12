"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import Image from "next/image"
import { Drawer, Button } from "antd"
import { MenuOutlined } from "@ant-design/icons"
import Link from "next/link"
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useTranslation } from 'react-i18next';

export default function Header() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)

    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  const handleSignOut = async () => {
    await signOut()
    setOpen(false) // también cerramos el drawer al cerrar sesión
  }

  return (
    <header className="header shadow-sm border-b">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Calamary Logo"
              width={40}
              height={40}
              className="cursor-pointer"
            />
            <h1 className="text-xl font-bold text-primary">Calamary</h1>
          </div>

          {/* Menú Desktop */}
          <div
            className="flex items-center gap-6"
            style={{ display: isMobile ? 'none' : 'flex' }}
          >
            <Link href="/" className="hover:text-primary">
              {t('header.home')}
            </Link>
            {/* <Link href="/expertos" className="hover:text-primary">
              {t('header.expertos')}
            </Link> */}
            <span className="text-secondary">{user?.email || "cargando..."}</span>
            <LanguageSwitcher />
            <button
              onClick={handleSignOut}
              className="btn btn-secondary px-3 py-1 rounded-md"
            >
              {t('header.btn_cerrarsesion')}
            </button>
          </div>

          {/* Botón menú móvil */}
          <div style={{ display: isMobile ? 'block' : 'none' }}>
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setOpen(true)}
            />
          </div>
        </div>
      </div>

      {/* Drawer móvil */}
      <Drawer
        title={t('generic.menu')}
        placement="right"
        onClose={() => setOpen(false)}
        open={open}
      >
        <nav className="flex flex-col gap-4">
          <Link href="/" onClick={() => setOpen(false)}>
             {t('header.home')}
          </Link>
          {/* <Link href="/expertos" onClick={() => setOpen(false)}>
              {t('header.expertos')}
          </Link> */}
          <span className="text-secondary">{user?.email || "cargando..."}</span>
          <LanguageSwitcher />

          <button
            onClick={handleSignOut}
            className="btn btn-secondary px-3 py-1 rounded-md"
          >
              {t('header.btn_cerrarsesion')}
          </button>
        </nav>
      </Drawer>
    </header>
  )
}