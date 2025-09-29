"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import Image from "next/image"
import { Drawer, Button } from "antd"
import { MenuOutlined } from "@ant-design/icons"
import Link from "next/link"

export default function Header() {
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
              Inicio
            </Link>
            <Link href="/expertos" className="hover:text-primary">
              Expertos
            </Link>
            <span className="text-secondary">{user?.email || "cargando..."}</span>
            <button
              onClick={handleSignOut}
              className="btn btn-secondary px-3 py-1 rounded-md"
            >
              Cerrar Sesión
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
        title="Menú"
        placement="right"
        onClose={() => setOpen(false)}
        open={open}
      >
        <nav className="flex flex-col gap-4">
          <Link href="/" onClick={() => setOpen(false)}>
            Inicio
          </Link>
          <Link href="/expertos" onClick={() => setOpen(false)}>
            Expertos
          </Link>
          <span className="text-secondary">{user?.email || "cargando..."}</span>
          <button
            onClick={handleSignOut}
            className="btn btn-secondary px-3 py-1 rounded-md"
          >
            Cerrar Sesión
          </button>
        </nav>
      </Drawer>
    </header>
  )
}