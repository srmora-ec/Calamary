"use client"

import { useState } from "react"
import Image from "next/image"
import { Button, Collapse, message } from "antd"
import { CopyOutlined } from "@ant-design/icons"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

const { Panel } = Collapse

interface PublicModelCardProps {
  modelo: {
    id: number
    nombre: string
    descripcion: string
    fecha: string
    publico?: boolean
    citas: Array<{
      autor: string
      año: number | null
      titulo: string
      fuente: string | null
      doi: string | null
      url: string | null
      tipo: string | null
    }>
  }
}

export default function PublicModelCard({ modelo }: PublicModelCardProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleCopy = async () => {
    try {
      const { data, error } = await supabase.rpc("copiar_modelo", { modelo_id: modelo.id })
      if (error) throw error
      message.success("Modelo copiado exitosamente")
      router.push(`/modelos/${data.id}`)
    } catch (err: any) {
      console.error(err)
      message.error("Error al copiar el modelo")
    }
  }

  return (
    <div className="card flex flex-col justify-between transition-all duration-200 hover:shadow-md">
      {/* Contenido principal */}
      <div className="card-header flex-1">
        <div className="flex justify-between items-start">
          {/* Nombre y descripción */}
          <div className="flex-1 min-w-0">
            <h3
              className="text-xl font-bold mb-2 truncate"
              title={modelo.nombre}
            >
              {modelo.nombre}
            </h3>

            <p
              className="text-secondary mb-3 overflow-hidden text-ellipsis line-clamp-2"
              title={modelo.descripcion || "Sin descripción"}
            >
              {modelo.descripcion || "Sin descripción"}
            </p>
          </div>

          {/* Íconos */}
          <div className="flex items-center gap-2">
            {modelo.publico !== undefined && (
              <span title={modelo.publico ? "Público" : "Privado"}>
                {modelo.publico ? "🔓" : "🔒"}
              </span>
            )}
          </div>
        </div>

        {/* Fecha */}
        <span className="text-secondary text-sm block mb-2">
          Creado: {new Date(modelo.fecha).toLocaleDateString()}
        </span>

        {/* Citas */}
        {modelo.citas && modelo.citas.length > 0 && (
          <Collapse
            bordered={false}
            size="small"
            className="bg-transparent mt-2"
          >
            <Panel
              header={`Citas (${modelo.citas.length})`}
              key="1"
              className="p-0"
            >
              {/* Contenedor con scroll si hay muchas citas */}
              <div className="max-h-40 overflow-y-auto pr-1">
                {modelo.citas.map((cita, idx) => {
                  const citationText = `${cita.autor}${cita.año ? `, ${cita.año}` : ""}. *${cita.titulo}*. ${cita.fuente ? cita.fuente + "." : ""} ${cita.doi ? `doi: ${cita.doi}.` : ""}`
                  const url = cita.url || (cita.doi ? `https://doi.org/${cita.doi}` : null)
                  return (
                    <div key={idx} className="mb-1">
                      <p className="text-xs text-gray-600">
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-700 underline"
                          >
                            {citationText}
                          </a>
                        ) : (
                          citationText
                        )}
                      </p>
                    </div>
                  )
                })}
              </div>
            </Panel>
          </Collapse>
        )}
      </div>

      {/* Pie inferior */}
      <div className="card-footer mt-auto pt-2 border-t border-gray-200 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Button
            type="link"
            icon={<CopyOutlined />}
            onClick={handleCopy}
            className="text-gray-600 hover:text-blue-500 p-0"
          >
            Copiar modelo
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setLoading(true)
              window.open(`/evaluacion/${modelo.id}`, "_blank")
            }}
            className="focus:outline-none cursor-pointer"
            title="Usar Modelo"
          >
            <Image
              src="/play.png"
              alt="Evaluar modelo"
              width={35}
              height={35}
              className="transition-transform transform hover:scale-105"
            />
          </button>
        </div>
      </div>
    </div>
  )
}
