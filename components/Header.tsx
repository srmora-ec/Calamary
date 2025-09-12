"use client"

import { useAuth } from "@/hooks/useAuth"
import Image from "next/image"

export default function Header() {
  const { user, signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
  }

  // if (!user) return null

  

  return (
    <header className="header">
      <div className="container">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center gap-4">
            <Image src="/logo.png" alt="Calamary Logo" width={40} height={40} className="cursor-pointer" />
            <h1 className="text-xl font-bold text-primary">Calamary</h1>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-secondary">{user?.email || "cargando"}</span>
            <button onClick={handleSignOut} className="btn btn-secondary">
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
