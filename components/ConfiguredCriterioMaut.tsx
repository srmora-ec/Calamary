"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import Modal from "./Modal"
import type { Nodo, MAUTConfig } from "@/types/modelo"
import { Tabs } from "antd"
import LinearFunctionConfig from "../app/tablero/[idmodelo]/configvallineal"
// 💡 IMPORTACIÓN AÑADIDA
import DiscreteValuesConfig from "../app/tablero/[idmodelo]/configvaldiscretos"

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

  const configRef = useRef<any>(null)


  const handleConfigChange = (config: MAUTConfig) => {
    // Esta función actualiza el estado mautConfig del componente padre
    console.log("Esto funciona?", config)
    try {
      setMautConfig(config)
      const nodoActualizado = {
        ...formData,
        MAUT: config,
      }

      // Llama a la función de actualización
      onNodoUpdated(nodoActualizado)
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
          {formData.beneficio}
          <LinearFunctionConfig
            min={formData.min || 0}
            max={formData.max || 100}
            beneficio={formData.beneficio}
            unidadMedida={formData.unidadmedida || "Unidad"}
            initialConfig={mautConfig}
            onConfigChange={handleConfigChange}
            nodeId={formData.idnodo}
          />

          {error && <div className="mt-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
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