"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Modal from "./Modal"
import type { Nodo, MAUTConfig } from "@/types/modelo"
import { Tabs } from "antd"
import LinearFunctionConfig from "./MAUT/LinearFunctionModal"
// 💡 IMPORTACIÓN AÑADIDA
import DiscreteValuesConfig from "./MAUT/DiscreteValuesConfig" 

interface ConfigureModalNodoProps {
  isOpen: boolean
  onClose: () => void
  nodo: Nodo
  onNodoUpdated: (nodoActualizado: Nodo) => void
}

export default function ConfigureMautNodo({ isOpen, onClose, nodo, onNodoUpdated }: ConfigureModalNodoProps) {
  const [formData, setFormData] = useState<Nodo>(nodo)
  const [mautConfig, setMautConfig] = useState<MAUTConfig | undefined>(nodo.MAUT)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Cuando cambie el nodo recibido, refresca el form
  useEffect(() => {
    if (nodo) {
      setFormData(nodo)
      setMautConfig(nodo.MAUT)
    }
  }, [nodo])

  const handleConfigChange = (config: MAUTConfig) => {
    // Esta función actualiza el estado mautConfig del componente padre
    setMautConfig(config)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const nodoActualizado = {
        ...formData,
        MAUT: mautConfig,
      }

      // Llama a la función de actualización (aquí va tu lógica de API)
      onNodoUpdated(nodoActualizado)
      onClose()
    } catch (err: any) {
      setError(err.message || "Error al actualizar el nodo")
    } finally {
      setLoading(false)
    }
  }

  const items = [
    {
      key: "1",
      label: "Función Lineal/Dual (Continua)", // Etiqueta actualizada
      children: (
        <div className="p-4">
          <div className="mb-4 p-3 bg-blue-50 rounded">
            <h3 className="font-semibold text-sm mb-2">Información del criterio:</h3>
            <p className="text-xs">
              <strong>Título:</strong> {formData.titulo}
            </p>
            <p className="text-xs">
              <strong>Rango:</strong> {formData.min} - {formData.max} {formData.unidadmedida}
            </p>
            <p className="text-xs">
              <strong>Tipo:</strong> {formData.beneficio ? "Beneficio (mayor es mejor)" : "Costo (menor es mejor)"}
            </p>
          </div>

          <LinearFunctionConfig
            min={formData.min || 0}
            max={formData.max || 100}
            beneficio={formData.beneficio || true}
            unidadMedida={formData.unidadmedida || "Unidad"}
            initialConfig={mautConfig}
            onConfigChange={handleConfigChange}
            nodeId={formData.idnodo}
          />

          {error && <div className="mt-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}

          {/* 💡 BLOQUE DE BOTONES EN PESTAÑA 1 */}
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
              disabled={loading}
            >
              {loading ? "Guardando..." : "Guardar configuración"}
            </button>
          </div>
        </div>
      ),
    },
    {
      key: "2",
      label: "Valores Discretos (Categórica)", // Nueva pestaña
      children: (
        <div className="p-4">
          <p className="text-sm text-gray-600 mb-4">
            Configuración de utilidad para criterios con **valores discretos** o categóricos (Ej: Calidad, Nivel de Riesgo).
          </p>

          <DiscreteValuesConfig
            initialConfig={mautConfig}
            onConfigChange={handleConfigChange}
            nodeId={formData.idnodo}
          />
          
          {error && <div className="mt-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}

          {/* 💡 BLOQUE DE BOTONES EN PESTAÑA 2 (Copiado) */}
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
              disabled={loading}
            >
              {loading ? "Guardando..." : "Guardar configuración"}
            </button>
          </div>
        </div>
      ),
    },
  ]

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Configuración de utilidad: ${formData.titulo}`} width="800px">
      <Tabs type="card" defaultActiveKey="1" items={items} />
    </Modal>
  )
}