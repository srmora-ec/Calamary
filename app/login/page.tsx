"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import Image from "next/image"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const { user, signIn } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user) {
      // Redirigir al dashboard si ya hay un usuario logueado
      router.push("/dashboard")
    }
  }, [user, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    // Asegúrate de que tu función signIn maneje la autenticación de Supabase correctamente.
    const { error } = await signIn(email, password)

    if (error) {
      setError(error.message)
    } else {
      // Si el inicio de sesión es exitoso, redirigir
      router.push("/dashboard")
    }

    setLoading(false)
  }

  // Si ya hay un usuario, no renderizar nada mientras se redirige
  if (user) {
    return null
  }

  const handleGoToRegister = () => {
    // Redirigir a la página de registro
    router.push("/register")
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--surface-color)" }}>
      <div className="card" style={{ width: "100%", maxWidth: "400px" }}>
        <div className="card-header text-center">
          <div className="flex justify-center mb-4">
            <Image
              src="/logo.png"
              alt="Calamary Logo"
              width={60}
              height={60}
              // Agregar priority para mejor rendimiento en imágenes importantes como logos
              priority
            />
          </div>
          <h1 className="text-2xl font-bold text-primary">Calamary</h1>
          <p className="text-secondary mt-2">Inicia sesión en tu cuenta</p>
        </div>

        <div className="card-body">
          {error && (
            <div
              className="mb-4 p-4"
              style={{ backgroundColor: "#fef2f2", color: "#dc2626", borderRadius: "var(--border-radius)" }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <button type="submit" className="btn btn-primary w-full mt-4" disabled={loading}>
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="spinner"></div>
                  Iniciando sesión...
                </div>
              ) : (
                "Iniciar Sesión"
              )}
            </button>
          </form>
        </div>

        {/* --- Nuevo Bloque para Registrarse --- */}
        <div className="card-footer text-center mt-4">
          <p className="text-secondary text-sm">
            ¿No tienes una cuenta?{" "}
            <button
              onClick={handleGoToRegister}
              className="font-medium text-primary hover:text-primary-dark cursor-pointer p-0 m-0 border-none bg-transparent underline"
              disabled={loading}
            >
              Regístrate aquí
            </button>
          </p>
        </div>
        {/* ------------------------------------- */}
      </div>
    </div>
  )
}