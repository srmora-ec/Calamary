"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Header from "@/components/Header"
import { Row, Col, Input, Button, Space, Card, Popover, message } from "antd"
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from "@ant-design/icons"
import { useAuthContext } from "@/context/AuthProvider"
import { useTranslation } from "react-i18next"
import "@/i18n";

interface Metodo {
  id: number
  nombre: string
  descripcion: string
  created_at: string
}

export default function MetodosPage() {
  const { t } = useTranslation() // Inicialización del hook
  const { user, loading } = useAuthContext()
  const router = useRouter()

  const [metodos, setMetodos] = useState<Metodo[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [loadingLocal, setLoadingLocal] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [openPopoverId, setOpenPopoverId] = useState<number | null>(null)

  // Redirigir si no está logueado
  useEffect(() => {
    if (!loading && !user) router.push("/login")
  }, [loading, user, router])

  useEffect(() => {
    if (user) {
      verificarAdmin()
      loadMetodos()
    }
  }, [user, searchTerm])

  // Verificar si es administrador
  const verificarAdmin = async () => {
    try {
      const { data, error } = await supabase.from("administradores").select("id").eq("usuario", user?.id).maybeSingle()

      if (error) throw error
      setIsAdmin(!!data)
    } catch (err) {
      console.error("Error al verificar administrador:", err)
      setIsAdmin(false)
    }
  }

  // Cargar métodos
  const loadMetodos = async () => {
    setLoadingLocal(true)
    try {
      const { data, error } = await supabase
        .from("metodos")
        .select("*")
        .ilike("nombre", `%${searchTerm}%`)
        .eq("estado", true)
        .order("created_at", { ascending: false })

      if (error) throw error
      setMetodos(data || [])
    } catch (error) {
      console.error("Error al cargar métodos:", error)
    } finally {
      setLoadingLocal(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    loadMetodos()
  }

  const eliminarMetodo = async (id: number) => {
    try {
      const { error } = await supabase.from("metodos").update({ estado: false }).eq("id", id)

      if (error) throw error

      message.success(t('metodos_page.msg_exito_eliminar')) // Traducción aplicada
      setOpenPopoverId(null) // Close popover after deletion
      loadMetodos()
    } catch (err: any) {
      console.error(err)
      message.error(t('metodos_page.msg_error_eliminar')) // Traducción aplicada
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" style={{ width: "40px", height: "40px" }}></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--surface-color)" }}>
      <Header />

      <main className="container py-6">
        {/* Encabezado */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">{t('metodos_page.titulo')}</h1> {/* Traducción aplicada */}
          <p className="text-secondary">{t('metodos_page.descripcion')}</p> {/* Traducción aplicada */}
        </div>

        {/* Buscador y botón crear */}
        <Row gutter={[16, 16]} align="middle" className="mb-6">
          <Col xs={24} md={12} lg={8}>
            <form onSubmit={handleSearch}>
              <Input
                placeholder={t('metodos_page.buscar_ph')} // Traducción aplicada
                prefix={<SearchOutlined />}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                allowClear
              />
            </form>
          </Col>

          {isAdmin && (
            <Col xs={24} md={12} lg={16}>
              <Space wrap>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => router.push("/metodos/ingresar/crear")}>
                  {t('metodos_page.btn_crear')} {/* Traducción aplicada */}
                </Button>
              </Space>
            </Col>
          )}
        </Row>

        {/* Lista de métodos */}
        {loadingLocal ? (
          <div className="flex justify-center py-8">
            <div className="spinner" style={{ width: "40px", height: "40px" }}></div>
          </div>
        ) : metodos.length === 0 ? (
          <div className="text-center py-8 text-secondary">{t('metodos_page.sin_metodos')}</div> // Traducción aplicada
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {metodos.map((m) => (
              <Card key={m.id} title={m.nombre} bordered>
                <p className="text-secondary mb-4">{m.descripcion}</p>
                <small className="text-gray-500">
                  {t('metodos_page.creado_el')} {new Date(m.created_at).toLocaleDateString()} {/* Traducción aplicada */}
                </small>

                {isAdmin && (
                  <div className="mt-4 flex justify-end gap-2">
                    <Button
                      icon={<EditOutlined />}
                      type="default"
                      onClick={() => router.push("/metodos/ingresar/" + m.id)}
                    >
                      {t('metodos_page.btn_editar')} {/* Traducción aplicada */}
                    </Button>
                    <Popover
                      content={
                        <div style={{ maxWidth: 250 }}>
                          <p className="mb-3">{t('metodos_page.confirm_eliminar_texto')}</p> {/* Traducción aplicada */}
                          <div className="flex justify-end gap-2">
                            <Button size="small" onClick={() => setOpenPopoverId(null)}>
                              {t('botones.cancelar')} {/* Reutilizado */}
                            </Button>
                            <Button size="small" type="primary" danger onClick={() => eliminarMetodo(m.id)}>
                              {t('generic.del')} {/* Reutilizado */}
                            </Button>
                          </div>
                        </div>
                      }
                      title={t('metodos_page.confirm_eliminar_titulo')} // Traducción aplicada
                      trigger="click"
                      open={openPopoverId === m.id}
                      onOpenChange={(visible) => setOpenPopoverId(visible ? m.id : null)}
                    >
                      <Button icon={<DeleteOutlined />} type="primary" danger>
                        {t('generic.del')} {/* Reutilizado */}
                      </Button>
                    </Popover>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}