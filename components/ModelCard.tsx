"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { useState } from "react"
import Spinner from "./pesos/Spinner"
import { supabase } from "@/lib/supabase"
import { useTranslation } from 'react-i18next';

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


export default function ModelCard({ modelo }: ModelCardProps) {
  const [loading, SetLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isDeleted, setIsDeleted] = useState(false) // Nuevo estado para la vista de eliminado
  const router = useRouter()
  const { t } = useTranslation() // Inicialización del de traducción

  const getLineaText = (linea: number) => {
    switch (linea) {
      case 1: return t("modelcard.direct")
      case 2: return t("modelcard.escalo")
      case 3: return t("modelcard.escalosu")
      case 4: return t("modelcard.bezier")
      default: return t("modelcard.direct")
    }
  }

  const handleDesactivarModelo = async () => {
    SetLoading(true)
    setShowConfirm(false)
    try {
      const { error } = await supabase
        .rpc('desactivar_modelo', {
          modelo_id: modelo.id
        })

      if (error) {
        alert('No se pudo desactivar el modelo: ' + error.message)
      } else {
        setIsDeleted(true) // Activamos el mensaje de éxito
        // Opcional: Refrescar los datos en segundo plano
        router.refresh()
      }
    } catch (err) {
      console.error('Error inesperado:', err)
    } finally {
      SetLoading(false)
    }
  }

  // VISTA SI EL MODELO FUE ELIMINADO
  if (isDeleted) {
    return (
      <div className="card h-[240px] flex items-center justify-center bg-gray-50 border border-dashed border-gray-300 rounded-lg animate-in fade-in zoom-in duration-300">
        <div className="text-center p-6">
          <div className="inline-flex items-center justify-center w-12 h-12 mb-3 bg-red-100 rounded-full">
            <Image src="/borrar.png" alt="Eliminado" width={24} height={24} className="opacity-60" />
          </div>
          <p className="text-gray-500 font-medium">
            {t('modelcard.seelimin')} <span className="text-gray-800 block font-bold">"{modelo.nombre}"</span>
          </p>
        </div>
      </div>
    )
  }

  // VISTA NORMAL DE LA CARD
  return (
    <div className="card h-[240px] flex flex-col justify-between relative overflow-hidden bg-white shadow-md rounded-lg border border-gray-200">
      <Spinner visible={loading} />

      {/* OVERLAY DE CONFIRMACIÓN (MODAL) */}
      {showConfirm && (
        <div className="absolute inset-0 z-50 bg-white/95 flex flex-col items-center justify-center p-4 text-center animate-in fade-in duration-200">
          <p className="text-gray-800 font-semibold mb-4">
            ¿{t('modelcard.conelimin')} "{modelo.nombre}"?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowConfirm(false)}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md transition-colors text-sm font-medium"
            >
              {t("generic.cancelar")}
            </button>
            <button
              onClick={handleDesactivarModelo}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors text-sm font-medium"
            >
              {t("modelcard.sielimin")}
            </button>
          </div>
        </div>
      )}

      {/* Contenido principal */}
      <div className="card-header flex-1 p-4">
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold mb-2 truncate text-gray-800" title={modelo.nombre}>
              {modelo.nombre}
            </h3>
            <p className="text-gray-600 text-sm mb-4 line-clamp-3" title={modelo.descripcion}>
              {modelo.descripcion}
            </p>
          </div>

          <div className="flex items-center gap-2 ml-2">
            <Image
              src={modelo.orientacion === "h" ? "/horizontal.png" : "/vertical.png"}
              alt="Orientación"
              width={50}
              height={50}
            />
          </div>
        </div>
      </div>

      {/* Pie fijo abajo */}
      <div className="card-footer mt-auto p-4 border-t border-gray-100 bg-gray-50/50">
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-xs text-gray-500 font-medium">
              {t("modelcard.linea")}: {getLineaText(modelo.linea)}
            </span>
            <span className="text-[10px] text-gray-400">
              {new Date(modelo.updated_at || modelo.created_at).toLocaleDateString()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Image
              src={modelo.publico ? "/public.png" : "/privado.png"}
              alt="Visibilidad"
              width={24}
              height={24}
              title={modelo.publico ? "Público" : "Privado"}
            />

            <div className="flex gap-1 ml-2">
              <button
                onClick={() => setShowConfirm(true)}
                className="p-1 hover:bg-red-50 rounded-full transition-colors cursor-pointer"
                title={t("generic.del")}
              >
                <Image src="/borrar.png" alt="Borrar" width={30} height={30} />
              </button>

              <button
                onClick={() => {
                  SetLoading(true)
                  router.push("/tablero/" + modelo.id)
                }}
                className="p-1 hover:bg-blue-50 rounded-full transition-colors cursor-pointer"
                title="Editar"
              >
                <Image src="/editar.png" alt="Editar" width={30} height={30} />
              </button>

              <button
                onClick={() => window.open("/evaluacion/" + modelo.id, "_blank")}
                className="p-1 hover:bg-green-50 rounded-full transition-colors cursor-pointer"
                title="Evaluar"
              >
                <Image src="/play.png" alt="Play" width={30} height={30} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}