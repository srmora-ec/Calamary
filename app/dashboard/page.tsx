"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Header from "@/components/Header"
import ModelCard from "@/components/ModelCard"
import CreateModelModal from "@/components/CreateModelModal"
import { useAuthContext } from "@/context/AuthProvider"
import { Row, Col, Input, Button, Space, Tabs } from "antd"
import { PlusOutlined, SearchOutlined } from "@ant-design/icons"
import ModelosPublicosPage from "@/components/ModelosPublicosPage"

interface Modelo {
  id: string
  nombre: string
  descripcion: string
  orientacion: "h" | "v"
  linea: number
  publico: boolean
  created_at: string
  updated_at: string
}

export default function DashboardPage() {
  const { user, loading } = useAuthContext()
  const router = useRouter()
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [totalModelos, setTotalModelos] = useState(0)
  const [loadingLocal, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.push("/login")
  }, [loading, user])

  useEffect(() => {
    if (user) {
      verificarAdmin()
      loadModelos()
      loadTotalModelos()
    }
  }, [user, currentPage, searchTerm])

  const verificarAdmin = async () => {
    const { data, error } = await supabase
      .from("administradores")
      .select("id")
      .eq("usuario", user?.id)
      .maybeSingle()

    if (!error) setIsAdmin(!!data)
  }

  const loadTotalModelos = async () => {
    if (!user) return
    const { data } = await supabase.rpc("contar_modelos_usuario", {
      p_idusuario: user.id,
    })
    setTotalModelos(data || 0)
  }

  const loadModelos = async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase.rpc("get_modelos_paginados", {
      p_idusuario: user.id,
      p_pagina: currentPage,
      p_tamano: 10,
      p_busqueda: searchTerm,
    })
    console.log("¿?Que paso?",data)
    if (!error) setModelos(data || [])
    setLoading(false)
  }


  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    loadModelos()
  }


  const handleModelCreated = () => {
    loadModelos()
    loadTotalModelos()
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" style={{ width: "40px", height: "40px" }}></div>
      </div>
    )
  }

  const totalPages = Math.ceil(totalModelos / 10)

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--surface-color)" }}>
      <Header />

      <main className="container py-6">
        <Tabs
          defaultActiveKey="1"
          type="card"
          items={[
            {
              key: "1",
              label: "Mis Modelos",
              children: (
                <>
                  {/* 🔹 Sección de estadísticas */}
                  <div className="mb-6">
                    <div className="card">
                      <div className="card-body">
                        <h2 className="text-3xl font-bold text-primary mb-2">{totalModelos}</h2>
                        <p className="text-secondary">Modelos Creados</p>
                      </div>
                    </div>
                  </div>

                  {/* 🔹 Buscador y botones */}
                  <Row gutter={[16, 16]} align="middle" className="mb-6">
                    <Col xs={24} md={12} lg={8}>
                      <form onSubmit={handleSearch}>
                        <Input
                          placeholder="Buscar modelos..."
                          prefix={<SearchOutlined />}
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          allowClear
                        />
                      </form>
                    </Col>

                    <Col xs={24} md={12} lg={16}>
                      <Space wrap>
                        <Button
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={() => setIsCreateModalOpen(true)}
                        >
                          Crear Modelo
                        </Button>
                        {isAdmin && (
                          <Button type="default" onClick={() => router.push("/metodos")}>
                            Métodos
                          </Button>
                        )}
                      </Space>
                    </Col>
                  </Row>

                  {/* 🔹 Grid de modelos */}
                  {loadingLocal ? (
                    <div className="flex justify-center py-8">
                      <div className="spinner" style={{ width: "40px", height: "40px" }}></div>
                    </div>
                  ) : modelos.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-secondary">
                        {searchTerm
                          ? "No se encontraron modelos con ese término."
                          : "No tienes modelos creados aún."}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {modelos.map((modelo) => (
                        <ModelCard key={modelo.id} modelo={modelo} />
                      ))}
                    </div>
                  )}

                  {/* 🔹 Paginación */}
                  {totalPages > 1 && (
                    <div className="pagination">
                      <button
                        className="pagination-btn"
                        onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                      >
                        Anterior
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          className={`pagination-btn ${currentPage === page ? "active" : ""}`}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        className="pagination-btn"
                        onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                      >
                        Siguiente
                      </button>
                    </div>
                  )}
                </>
              ),
            },
            {
              key: "2",
              label: "Buscar Modelos Públicos",
              children: (
                <ModelosPublicosPage/>
              ),
            },
          ]}
        />
      </main>

      <CreateModelModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onModelCreated={handleModelCreated}
      />
    </div>
  )
}
