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
  const [loading, SetLoading] = useState(false);
  const router = useRouter()
  return (
    <div className="card">
      <Spinner visible={loading} />
      <div className="card-header">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="text-xl font-bold mb-2">{modelo.nombre}</h3>
            <p className="text-secondary mb-4">{modelo.descripcion}</p>
          </div>
          <div className="flex items-center gap-2">
            <span title={modelo.publico ? "Público" : "Privado"}>{modelo.publico ? "🔓" : "🔒"}</span>
            <Image
              src={modelo.orientacion === "h" ? "/horizontal.png" : "/vertical.png"}
              alt={modelo.orientacion === "h" ? "Horizontal" : "Vertical"}
              width={100}
              height={100}
            />
          </div>
        </div>
      </div>

      <div className="card-footer">
        <div className="flex justify-between items-center">
          <span className="text-secondary">Línea: {getLineaText(modelo.linea)}</span>

          <span className="text-secondary">{new Date(modelo.updated_at || modelo.created_at).toLocaleDateString()}</span>
          <button
            onClick={() => {
              SetLoading(true);
              // router.push("/tablero/" + modelo.id)
                            window.location.href = "/tablero/" + modelo.id

            }}
            className="focus:outline-none cursor-pointer"
          >
            <Image
              src="/editar.png"
              alt="Botón de editar"
              width={40}
              height={40}
            />
          </button>
          <button
            onClick={() => {
              SetLoading(true);
              // router.push("/evaluacion/" + modelo.id)
              window.location.href = "/evaluacion/" + modelo.id

            }}
            className="focus:outline-none cursor-pointer"
          >
            <Image
              src="/play.png"
              alt="Botón de play"
              width={40}
              height={40}
            />
          </button>
        </div>
      </div>
    </div>
  )
}
