"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import PublicModelCard from "./PublicModelCard"
import { Row, Col, Input, Select, Button, Space } from "antd"
import { SearchOutlined } from "@ant-design/icons"

interface Modelo {
  id: number
  nombre: string
  descripcion: string
  fecha: string
  citas: Array<{
    autor: string
    año: number | null
    titulo: string
    fuente: string | null
    doi: string | null
    url: string | null
    tipo: string | null
  }>
  metodo: number
}


interface Metodo {
  id: number
  nombre: string
}

export default function ModelosPublicosPage() {
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [metodos, setMetodos] = useState<Metodo[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedMetodo, setSelectedMetodo] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [total, setTotal] = useState(0)

  const pageSize = 12

  useEffect(() => {
    loadMetodos()
    loadModelos()
  }, [searchTerm, selectedMetodo, currentPage])

  //  Cargar métodos disponibles para el filtro
  const loadMetodos = async () => {
    try {
      const { data, error } = await supabase
        .from("metodos")
        .select("id, nombre")
        .eq("estado", true)
        .order("nombre", { ascending: true })
      if (error) throw error
      setMetodos(data || [])
    } catch (error) {
      console.error("Error cargando métodos:", error)
    }
  }

  //  Cargar modelos públicos (usa tu función RPC)
  const loadModelos = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc("get_modelos_publicos", {
        p_metodo: selectedMetodo,
        p_busqueda: searchTerm,
        p_pagina: currentPage,
        p_tamano: pageSize,
      })
      if (error) throw error

      setModelos(data?.modelos || [])
      setTotal(data?.total || 0)
    } catch (error) {
      console.error("Error cargando modelos públicos:", error)
    } finally {
      setLoading(false)
    }
  }

  // 🔍 Buscar
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    loadModelos()
  }

  //  Paginación
  const totalPages = Math.ceil(total / pageSize)

  return (

    <main className="container py-6">
      <h1 className="text-2xl font-bold mb-4">Modelos públicos</h1>

      {/* Buscador y Filtros */}
      <Row gutter={[16, 16]} align="middle" className="mb-6">
        <Col xs={24} md={12} lg={8}>
          <form onSubmit={handleSearch}>
            <Input
              placeholder="Buscar modelos por nombre o descripción..."
              prefix={<SearchOutlined />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              allowClear
            />
          </form>
        </Col>

        <Col xs={24} md={12} lg={8}>
          <Select
            placeholder="Filtrar por método"
            style={{ width: "100%" }}
            allowClear
            value={selectedMetodo ?? undefined}
            onChange={(value) => setSelectedMetodo(value || null)}
            options={metodos.map((m) => ({
              label: m.nombre,
              value: m.id,
            }))}
          />
        </Col>

        <Col xs={24} md={24} lg={8}>
          <Space>
            <Button onClick={() => { setSearchTerm(""); setSelectedMetodo(null); setCurrentPage(1) }}>
              Limpiar filtros
            </Button>
            <Button type="primary" onClick={loadModelos}>Buscar</Button>
          </Space>
        </Col>
      </Row>

      {/* Lista de modelos */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="spinner" style={{ width: 40, height: 40 }}></div>
        </div>
      ) : modelos.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          No se encontraron modelos públicos.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {modelos.map((modelo) => (
            <PublicModelCard key={modelo.id} modelo={modelo} />
          ))}
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="pagination mt-8">
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
    </main>
  )
}
