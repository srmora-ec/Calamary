"use client"

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from "next/navigation"
import { useTranslation } from 'react-i18next'
import Image from "next/image"

export default function ActualizarPassword() {
  const { t } = useTranslation()
  const router = useRouter()
  
  const [nuevaPassword, setNuevaPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  useEffect(() => {
    // Verificamos si la sesión existe (el link mágico de correo debería haber creado la sesión automáticamente)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setMensaje({ 
          type: 'error', 
          text: t('reset_password.no_session_error') || "No se detectó sesión. El link puede haber expirado." 
        })
      }
    })
  }, [t])

  const handleGuardarPassword = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMensaje(null)

    // Lógica original: updateUser funciona porque el usuario ya tiene una sesión activa por el link
    const { error } = await supabase.auth.updateUser({
      password: nuevaPassword
    })

    if (error) {
      setMensaje({ type: 'error', text: error.message })
      setLoading(false)
    } else {
      setMensaje({ 
        type: 'success', 
        text: t('reset_password.success_msg') || "¡Contraseña actualizada! Redirigiendo..." 
      })
      
      // Redirección después de 2 segundos
      setTimeout(() => {
         router.push('/login') 
      }, 2000)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--surface-color)" }}>
      <div className="card" style={{ width: "100%", maxWidth: "400px" }}>
        
        {/* --- Header con Logo --- */}
        <div className="card-header text-center">
          <div className="flex justify-center mb-4">
            <Image
              src="/logo.png"
              alt="Calamary Logo"
              width={60}
              height={60}
              priority
            />
          </div>
          <h1 className="text-2xl font-bold text-primary">Calamary</h1>
          <p className="text-secondary mt-2">
            {t('reset_password.title') || "Establecer nueva contraseña"}
          </p>
        </div>

        <div className="card-body">
          {/* --- Manejo de Mensajes (Error y Éxito) --- */}
          {mensaje && (
            <div
              className="mb-4 p-4 text-sm"
              style={{ 
                backgroundColor: mensaje.type === 'error' ? "#fef2f2" : "#f0fdf4", 
                color: mensaje.type === 'error' ? "#dc2626" : "#166534", 
                borderRadius: "var(--border-radius)",
                border: `1px solid ${mensaje.type === 'error' ? "#fecaca" : "#bbf7d0"}`
              }}
            >
              {mensaje.text}
            </div>
          )}

          <form onSubmit={handleGuardarPassword}>
            <div className="form-group">
              <label className="form-label">
                {t('reset_password.new_password_label') || "Nueva contraseña"}
              </label>
              <input
                type="password"
                className="form-input"
                placeholder="********"
                value={nuevaPassword}
                onChange={(e) => setNuevaPassword(e.target.value)}
                required
                minLength={6}
                disabled={loading || (mensaje?.type === 'success')}
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary w-full mt-4" 
              disabled={loading || (mensaje?.type === 'success')}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="spinner"></div>
                  {t('common.saving') || "Guardando..."}
                </div>
              ) : (
                t('reset_password.submit_btn') || "Cambiar contraseña"
              )}
            </button>
          </form>
        </div>

        {/* --- Footer opcional para volver al login si se arrepienten --- */}
        <div className="card-footer text-center mt-4">
            <button
              onClick={() => router.push('/login')}
              className="text-secondary text-sm hover:text-primary underline bg-transparent border-none cursor-pointer"
            >
              {t('common.back_to_login') || "Volver al inicio de sesión"}
            </button>
        </div>

      </div>
    </div>
  )
}