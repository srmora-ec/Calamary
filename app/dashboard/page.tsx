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
import type { TabsProps } from 'antd';


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
  const { user, loading } = useAuthContext() //Esto para verificar que aun estamos con la sesión activa
  const router = useRouter() //Para movernos entre rutas
  const [modelos, setModelos] = useState<Modelo[]>([]) //PAra guardar los modelos cargados en la paginación
  const [totalModelos, setTotalModelos] = useState(0)//Para guardar  el numero total de modelos
  const [loadingLocal, setLoading] = useState(true)//Para activar el loading 
  const [searchTerm, setSearchTerm] = useState("")//Para guardar ell termino de busqueda
  const [currentPage, setCurrentPage] = useState(1)//Para la página actual de la paginación
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)//Para abrir el componente modal de crear modelo
  const [isAdmin, setIsAdmin] = useState(false)//Para guardar el estado del usuario si es admin o no. De esa forma 

  useEffect(() => {
    if (!loading && !user) router.push("/login") //Si no hay usuario logeado enviamos a login
  }, [loading, user])//El useEffect se usará cada que cambie loading o user

  useEffect(() => {
    if (user) {
      verificarAdmin()
      loadModelos()
      loadTotalModelos()
    }
  }, [user, currentPage, searchTerm])//Si cambiamos la busqueda o la pagina actual o el usuario. Verificamos el admin, y recargamos los modelos

  const verificarAdmin = async () => {
    const { data, error } = await supabase //Llamada a supabase
      .from("administradores")//Tabla administradores
      .select("id")//buscar el id
      .eq("usuario", user?.id) //Si el usuario es igual al que tenemos actualmente
      .maybeSingle()//Selección simple

    if (!error) setIsAdmin(!!data)//Si hay error no es admin
  }

  const loadTotalModelos = async () => {//Para cargar los modelos
    if (!user) return//Si no hay usuario no hacemos nada
    const { data } = await supabase.rpc("contar_modelos_usuario", {//Funcion que cuenta todos los modelos de un usario
      p_idusuario: user.id,//Necesita el id del usuario
    })
    setTotalModelos(data || 0)//Establecemos el total o 0
  }

  const loadModelos = async () => {//Para cargar los modelos en la paginación actual
    if (!user) return//Si no hay usuario nohacemos nada
    setLoading(true)//Establecemos loading para ver el spinner
    const { data, error } = await supabase.rpc("get_modelos_paginados", {//función para obtener losmodelos paginados de un usuario
      p_idusuario: user.id,//Necesitamos el id del usuario
      p_pagina: currentPage,//La pagina actual
      p_tamano: 12,//El tamaño de items por pagina
      p_busqueda: searchTerm,//el termino de busqueda
    })
    if (!error) setModelos(data || []) //Establecemos los modelos o nada
    setLoading(false)
  }


  const handleSearch = (e: React.FormEvent) => {//Para cada vez que escribo algo
    e.preventDefault()// Evita el envío automático del formulario
    setCurrentPage(1)//Establecemos la paginación en 1. Puesto que es una nueva busqueda
    loadModelos()
  }


  const handleModelCreated = () => {//Para después de crear un modelos
    loadModelos()//Recargar los modelos 
    loadTotalModelos()//Recargar el total de modelo
  }

  if (loading || !user) {//si no hay usuario mostramos el spinner mientras verificamos la sessión
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" style={{ width: "40px", height: "40px" }}></div>
      </div>
    )
  }

  const totalPages = Math.ceil(totalModelos / 12)//El númeor totaldepaginas quese mostraránen la paginación. La cantidad total sobre la cantidad que se muestra porpagina

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--surface-color)" }}>
      <Header /> {/* El compopnente header que tiene el logo y el botón de cerrar sesción*/}

      <main className="container py-6">{/*Contenedor main */}
        <br />
        <Tabs
          defaultActiveKey="1"
          type="card"
          items={[
            {
              key: "1",
              label: "Mis modelos",
              children: (
                <>
                  {/* Sección de estadísticas mostrará la cantidad de modelos creados */}
                  <div className="mb-6">
                    <div className="card">
                      <div className="card-body">
                        <h2 className="text-3xl font-bold text-primary mb-2">{totalModelos}</h2>{/*La total*/}
                        <p className="text-secondary">Modelos creados</p>
                      </div>
                    </div>
                  </div>

                  {/* Buscador y botones */}
                  
                  <Row gutter={[16, 16]} align="middle" className="mb-6">
                    <Col xs={24} md={12} lg={8}>
                      <form onSubmit={handleSearch}>{/*La busqueda*/}
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
                          Crear modelo
                        </Button>
                        {isAdmin && (
                          <Button type="default" onClick={() => router.push("/metodos")}>{/*Si somos administradores tendremos opcion de crear métodos*/}
                            Métodos
                          </Button>
                        )}
                      </Space>
                    </Col>
                  </Row>

                  {/* Grid de modelos */}
                  {loadingLocal ? (
                    <div className="flex justify-center py-8">
                      <div className="spinner" style={{ width: "40px", height: "40px" }}></div>{/*Loading si esta cargando*/}
                    </div>
                  ) : modelos.length === 0 ? (
                    <div className="text-center py-8">{/*Si no hay modelos un aviso*/}
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

                  {/* Paginación */}
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
              label: "Buscar modelos",
              children: (
                <ModelosPublicosPage />
              ),
            },
          ] as TabsProps['items'] }
        />
        <br />

      </main>

      <CreateModelModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onModelCreated={handleModelCreated}
      />
    </div>
  )
}
