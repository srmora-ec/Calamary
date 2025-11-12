"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { useState } from "react"
import Spinner from "./pesos/Spinner"

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

interface ModelCardProps {
  modelo: Modelo
}

const getLineaText = (linea: number) => {
  switch (linea) {
    case 1:
      return "Directa"
    case 2:
      return "Escalonada"
    case 3:
      return "Escalonada Suave"
    case 4:
      return "Bézier"
    default:
      return "Directa"
  }
}

export default function ModelCard({ modelo }: ModelCardProps) {
  const [loading, SetLoading] = useState(false)
  const router = useRouter()

  return (
    <div className="card h-[240px] flex flex-col justify-between">
      <Spinner visible={loading} />

      {/* Contenido principal */}
      <div className="card-header flex-1">
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            {/* Título con truncamiento */}
            <h3
              className="text-xl font-bold mb-2 truncate"
              title={modelo.nombre}
            >
              {modelo.nombre}
            </h3>

            {/* Descripción truncada a 2 líneas */}
            <p
              className="text-secondary mb-4 overflow-hidden text-ellipsis line-clamp-4"
              title={modelo.descripcion}
            >
              {modelo.descripcion}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span title={modelo.publico ? "Público" : "Privado"}>
              {modelo.publico ? "🔓" : "🔒"}
            </span>
            <Image
              src={modelo.orientacion === "h" ? "/horizontal.png" : "/vertical.png"}
              alt={modelo.orientacion === "h" ? "Horizontal" : "Vertical"}
              width={60}
              height={60}
            />
          </div>
        </div>
      </div>

      {/* Pie fijo abajo */}
      <div className="card-footer mt-auto pt-2 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <span className="text-secondary block">
              Línea: {getLineaText(modelo.linea)}
            </span>
            <span className="text-secondary text-sm">
              {new Date(modelo.updated_at || modelo.created_at).toLocaleDateString()}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                SetLoading(true)
                window.location.href = "/tablero/" + modelo.id
              }}
              className="focus:outline-none cursor-pointer"
              title="Editar"
            >
              <Image
                src="/editar.png"
                alt="Editar modelo"
                width={35}
                height={35}
              />
            </button>
            <button
              onClick={() => {
                SetLoading(true)
                window.location.href = "/evaluacion/" + modelo.id
              }}
              className="focus:outline-none cursor-pointer"
              title="Evaluar"
            >
              <Image
                src="/play.png"
                alt="Ejecutar modelo"
                width={35}
                height={35}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
