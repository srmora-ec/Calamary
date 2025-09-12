"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { supabase } from "@/lib/supabase"
import Header from "@/components/Header"
import ModelCard from "@/components/ModelCard"
import CreateModelModal from "@/components/CreateModelModal"

interface Modelo {
  id: string
  nombre: string
  descripcion: string
  orientacion: "h" | "v"
  linea: number
  publico: boolean
  created_at: string,
  updated_at:string
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [totalModelos, setTotalModelos] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) {
      loadModelos()
      loadTotalModelos()
    }
  }, [user, currentPage, searchTerm])

  const loadTotalModelos = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase.rpc("contar_modelos_usuario", {
        p_idusuario: user.id,
      })
      if (error) throw error
      setTotalModelos(data || 0)
    } catch (error) {
      console.error("Error loading total models:", error)
    }
  }

  const loadModelos = async () => {
    if (!user) return

    setLoading(true)
    try {
      console.log(user.id)
      const { data, error } = await supabase.rpc("get_modelos_paginados", {
        p_idusuario: user.id,
        p_pagina: currentPage,
        p_tamano: 10,
        p_busqueda: searchTerm,

      })

      if (error) throw error
      setModelos(data || [])
    } catch (error) {
      console.error("Error loading models:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleModelCreated = () => {
    loadModelos()
    loadTotalModelos()
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    loadModelos()
  }

  if (authLoading || !user) {
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
        {/* Stats */}
        <div className="mb-6 ">
          <div className="card">
            <div className="card-body">
              <h2 className="text-3xl font-bold text-primary mb-2">{totalModelos}</h2>
              <p className="text-secondary">Modelos Creados</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6 items-start md:items-center">
          <form
            onSubmit={handleSearch}
            className="w-full md:w-auto"
            style={{ marginBottom: 0 }}
          >
            <div className="relative w-full md:w-10"> {/* 👈 buscador más corto en desktop */}
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Buscar modelos..."
                className="search-input w-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </form>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="btn btn-primary"
          >
            + Crear Modelo
          </button>
        </div>
        {/* Models Grid */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="spinner" style={{ width: "40px", height: "40px" }}></div>
          </div>
        ) : modelos.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-secondary">
              {searchTerm ? "No se encontraron modelos con ese término de búsqueda." : "No tienes modelos creados aún."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {modelos.map((modelo) => (
              <ModelCard key={modelo.id} modelo={modelo} />
            ))}
          </div>
        )}

        {/* Pagination */}
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
      </main>

      <CreateModelModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onModelCreated={handleModelCreated}
      />
    </div>
  )
}
