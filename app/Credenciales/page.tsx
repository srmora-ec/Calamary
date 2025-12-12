"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Header from "@/components/Header"
import { Card, Button, Space, message, Alert } from "antd"
import { CopyOutlined, KeyOutlined } from "@ant-design/icons"
import { useAuthContext } from "@/context/AuthProvider"
import { useTranslation } from "react-i18next"

interface Token {
  id: number
  token: string
  created_at: string
}

export default function TokensPage() {
  const { t } = useTranslation()
  const { user, loading } = useAuthContext()
  const router = useRouter()

  const [token, setToken] = useState<Token | null>(null)
  const [loadingLocal, setLoadingLocal] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [generatingToken, setGeneratingToken] = useState(false)

  // Redirigir si no está logueado
  useEffect(() => {
    if (!loading && !user) router.push("/login")
  }, [loading, user, router])

  useEffect(() => {
    if (user) {
      verificarAdmin()
      loadToken()
    }
  }, [user])

  // Verificar si es administrador
  const verificarAdmin = async () => {
    try {
      const { data, error } = await supabase
        .from("administradores")
        .select("id")
        .eq("usuario", user?.id)
        .maybeSingle()

      if (error) throw error
      setIsAdmin(!!data)
    } catch (err) {
      console.error("Error al verificar administrador:", err)
      setIsAdmin(false)
    }
  }

  // Cargar token existente
  const loadToken = async () => {
    setLoadingLocal(true)
    try {
      const { data, error } = await supabase
        .from("tokens")
        .select("*")
        .eq("user", user?.id)
        .maybeSingle()

      if (error && error.code !== "PGRST116") throw error
      setToken(data)
    } catch (error) {
      console.error("Error al cargar token:", error)
    } finally {
      setLoadingLocal(false)
    }
  }

  // Generar token único
  const generateUniqueToken = () => {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 15)
    const userId = user?.id.substring(0, 8)
    return `sdm_${userId}_${timestamp}_${random}`
  }

  // Crear nuevo token
  const crearToken = async () => {
    setGeneratingToken(true)
    try {
      const nuevoToken = generateUniqueToken()

      const { data, error } = await supabase
        .from("tokens")
        .insert([{ user: user?.id, token: nuevoToken }])
        .select()
        .single()

      if (error) throw error

      setToken(data)
      
      // Copiar automáticamente al crear
      await navigator.clipboard.writeText(nuevoToken)
      message.success(t('tokens_page.msg_exito_crear'))
    } catch (err: any) {
      console.error(err)
      message.error(t('tokens_page.msg_error_crear'))
    } finally {
      setGeneratingToken(false)
    }
  }

  // Copiar token al portapapeles
  const copiarToken = async () => {
    if (!token?.token) return

    try {
      await navigator.clipboard.writeText(token.token)
      message.success(t('tokens_page.msg_exito_copiar'))
    } catch (err) {
      console.error(err)
      message.error(t('tokens_page.msg_error_copiar'))
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" style={{ width: "40px", height: "40px" }}></div>
      </div>
    )
  }

  // Si no es admin, mostrar mensaje
  if (!loadingLocal && !isAdmin) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "var(--surface-color)" }}>
        <Header />
        <main className="container py-6">
          <Alert
            message={t('tokens_page.no_autorizado_titulo')}
            description={t('tokens_page.no_autorizado_desc')}
            type="warning"
            showIcon
          />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--surface-color)" }}>
      <Header />

      <main className="container py-6">
        {/* Encabezado */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">{t('tokens_page.titulo')}</h1>
          <p className="text-secondary">{t('tokens_page.descripcion')}</p>
        </div>

        {loadingLocal ? (
          <div className="flex justify-center py-8">
            <div className="spinner" style={{ width: "40px", height: "40px" }}></div>
          </div>
        ) : (
          <div className="max-w-3xl">
            {/* Información */}
            <Alert
              message={t('tokens_page.info_titulo')}
              description={
                <div>
                  <p className="mb-2">{t('tokens_page.info_desc1')}</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>{t('tokens_page.info_item1')}</li>
                    <li>{t('tokens_page.info_item2')}</li>
                    <li>{t('tokens_page.info_item3')}</li>
                  </ul>
                </div>
              }
              type="info"
              showIcon
              className="mb-6"
            />

            {/* Card del token */}
            <Card
              title={
                <Space>
                  <KeyOutlined />
                  {t('tokens_page.card_titulo')}
                </Space>
              }
              bordered
            >
              {token ? (
                <div>
                  <div className="mb-4">
                    <p className="text-secondary mb-2">{t('tokens_page.token_existente')}</p>
                    <div className="bg-gray-100 p-3 rounded border border-gray-300">
                      <code className="text-sm font-mono">••••••••••••••••••••••••••••</code>
                    </div>
                    <small className="text-gray-500 mt-2 block">
                      {t('tokens_page.creado_el')} {new Date(token.created_at).toLocaleString()}
                    </small>
                  </div>

                  <Button
                    type="primary"
                    icon={<CopyOutlined />}
                    onClick={copiarToken}
                    block
                  >
                    {t('tokens_page.btn_copiar')}
                  </Button>
                </div>
              ) : (
                <div>
                  <p className="text-secondary mb-4">{t('tokens_page.sin_token')}</p>

                  <Button
                    type="primary"
                    icon={<KeyOutlined />}
                    onClick={crearToken}
                    loading={generatingToken}
                    block
                  >
                    {t('tokens_page.btn_generar')}
                  </Button>
                </div>
              )}
            </Card>

            {/* Advertencia de seguridad */}
            <Alert
              message={t('tokens_page.seguridad_titulo')}
              description={t('tokens_page.seguridad_desc')}
              type="warning"
              showIcon
              className="mt-6"
            />
          </div>
        )}
      </main>
    </div>
  )
}