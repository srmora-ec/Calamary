// /app/register/page.tsx
"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { supabase } from "@/lib/supabase"

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.")
      setLoading(false)
      return
    }

    // Supabase.js v2 utiliza 'signUp' para crear el usuario.
    // Con la configuración de Supabase por defecto, esto envía un OTP/código de verificación
    // si el 'Confirm email' está configurado como 'OTP' en el panel de control.
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Campos adicionales para el perfil de usuario (opcional, se guarda en el 'user_metadata')
        data: {
          display_name: displayName,
          phone_number: phone,
          emailRedirectTo: "https://calamary.vercel.app",
        },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
    } else {
      // Redirigir a una página para ingresar el código de verificación
      router.push(`/verify`)
    }

    setLoading(false)
  }

  // ... (El resto del JSX para el formulario de registro, similar al Login)

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--surface-color)" }}>
      <div className="card" style={{ width: "100%", maxWidth: "400px" }}>
        <div className="card-header text-center">
          <h1 className="text-2xl font-bold text-primary">Crea tu cuenta</h1>
          <p className="text-secondary mt-2">Completa el formulario para registrarte.</p>
        </div>

        <div className="card-body">
          {error && (
            <div className="mb-4 p-4" style={{ backgroundColor: "#fef2f2", color: "#dc2626", borderRadius: "var(--border-radius)" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Nombre de usuario</label>
              <input type="text" className="form-input" maxLength={10} value={displayName} onChange={(e) => setDisplayName(e.target.value)} required disabled={loading} />
            </div>

            <div className="form-group">
              <label className="form-label">Número de teléfono</label>
              <input type="tel" className="form-input" value={phone} maxLength={10} onChange={(e) => setPhone(e.target.value)} required disabled={loading} />
            </div>

            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" className="form-input" value={email} maxLength={30} onChange={(e) => setEmail(e.target.value)} required disabled={loading} />
            </div>

            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <input type="password" className="form-input" value={password} maxLength={12} onChange={(e) => setPassword(e.target.value)} required disabled={loading} />
            </div>

            <div className="form-group">
              <label className="form-label">Verificar Contraseña</label>
              <input type="password" className="form-input" value={confirmPassword} maxLength={12} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={loading} />
            </div>

            <button type="submit" className="btn btn-primary w-full mt-4" disabled={loading}>
              {loading ? "Registrando..." : "Registrarme"}
            </button>
          </form>
        </div>

        <div className="card-footer text-center mt-4">
          <p className="text-secondary text-sm">
            ¿Ya tienes una cuenta? {"  "}
            <button
              onClick={() => router.push("/")}
              className="font-medium text-primary hover:text-primary-dark cursor-pointer p-0 m-0 border-none bg-transparent underline"
              disabled={loading}
            >
              Iniciar sesión
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}