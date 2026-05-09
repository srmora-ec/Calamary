"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import Modal from "@/components/Modal"
import type { Nodo, MAUTConfig } from "@/types/modelo"
import { Tabs } from "antd"
import LinearFunctionConfig from "./configvallineal"
import DiscreteValuesConfig from "./configvaldiscretos"
import ProgrammedFunctionConfig from "./configvalprogramada"
import { useTranslation } from "react-i18next"

interface ConfigureModalNodoProps {
  isOpen: boolean
  onClose: () => void
  nodo: Nodo
  tipo: string | null
  onNodoUpdated: (nodoActualizado: Nodo) => void
}

export default function ConfigureMautNodo({ isOpen, onClose, nodo, tipo, onNodoUpdated }: ConfigureModalNodoProps) {
  const [formData, setFormData] = useState<Nodo>(nodo)
  const [mautConfig, setMautConfig] = useState<MAUTConfig | undefined>(nodo.MAUT)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const { t } = useTranslation()

  // Cuando cambie el nodo recibido, refresca el form
  useEffect(() => {
    if (nodo) {
      console.log("veamos", nodo.MAUT)
      setFormData(nodo)
      setMautConfig(nodo.MAUT)
    }
  }, [nodo])

  const handleConfigChange = (config: MAUTConfig) => {
    try {
      setMautConfig(config)
      const nodoActualizado = {
        ...formData,
        MAUT: config,
      }
      onNodoUpdated(nodoActualizado)
    } catch (err: any) {
      setError(err.message || t('lineal.errornodo'))
    } finally {
      setLoading(false)
    }
  }

  // Determinar la pestaña activa por defecto según el tipo guardado
  const defaultTab = () => {
    if (tipo === "discreta") return "2"
    if (tipo === "programada") return "3"
    return "1"
  }

  const items = [
    {
      key: "1",
      label: t('lineal.flineal'),
      children: (
        <div className="p-4">
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
      label: t('discretos.label'),
      children: (
        <div className="p-4">
          <DiscreteValuesConfig
            initialConfig={mautConfig}
            onConfigChange={handleConfigChange}
            nodeId={formData.idnodo}
          />
          {error && <div className="mt-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
        </div>
      ),
    },
    {
      key: "3",
      label: t('programada.label', 'Programación'),
      children: (
        <div className="p-4">
          <ProgrammedFunctionConfig
            min={formData.min ?? 0}
            max={formData.max ?? 100}
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
    <Modal isOpen={isOpen} onClose={onClose} title={`${t('lineal.config')}: ${formData.titulo}`} width="800px">
      <Tabs type="card" defaultActiveKey={defaultTab()} items={items} />
    </Modal>
  )
}