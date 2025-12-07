"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import Modal from "@/components/Modal"
import type { Nodo, MAUTConfig } from "@/types/modelo"
import { Tabs } from "antd"
import LinearFunctionConfig from "./configvallineal"
import DiscreteValuesConfig from "./configvaldiscretos"
import { useTranslation } from "react-i18next"

interface ConfigureModalNodoProps {
  isOpen: boolean
  onClose: () => void
  nodo: Nodo,
  tipo:string|null,
  onNodoUpdated: (nodoActualizado: Nodo) => void
}

export default function ConfigureMautNodo({ isOpen, onClose, nodo, tipo, onNodoUpdated }: ConfigureModalNodoProps) {
  const [formData, setFormData] = useState<Nodo>(nodo)
  const [mautConfig, setMautConfig] = useState<MAUTConfig | undefined>(nodo.MAUT)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const {t} = useTranslation()

  // Cuando cambie el nodo recibido, refresca el form
  useEffect(() => {
    if (nodo) {
      console.log("veamos",nodo.MAUT)
      setFormData(nodo)
      setMautConfig(nodo.MAUT)
    }
  }, [nodo])


  const handleConfigChange = (config: MAUTConfig) => {
    // Esta función actualiza el estado mautConfig del componente padre
    try {
      setMautConfig(config)
      const nodoActualizado = {
        ...formData,
        MAUT: config,
      }

      // Llama a la función de actualización
      onNodoUpdated(nodoActualizado)
    } catch (err: any) {
      setError(err.message || t('lineal.errornodo'))
    } finally {
      setLoading(false)
    }

  }


  const items = [
    {
      key: "1",
      label: t('lineal.flineal'), // Etiqueta actualizada
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
      label: t('discretos.label'), // Nueva pestaña
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
  ]

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${t('lineal.config')}: ${formData.titulo}`} width="800px">
      <Tabs type="card" defaultActiveKey={tipo=="discreta"?"2":"1"} items={items} />
    </Modal>
  )
}