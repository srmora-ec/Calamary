"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import type { MAUTConfig, ValorDiscretoMAUT } from "@/types/modelo"
import { useTranslation } from "react-i18next"
import { useNotification } from "@/components/NotificationProvider"
import { Trash2 } from "lucide-react";
import BotonAyuda from "@/components/BotonAyuda"

interface DiscreteValuesConfigProps {
  initialConfig?: MAUTConfig
  onConfigChange: (config: MAUTConfig) => void
  nodeId: number
}

export default function DiscreteValuesConfig({
  initialConfig,
  onConfigChange,
  nodeId
}: DiscreteValuesConfigProps) {

  // Refs para controlar el ciclo de vida del componente y el cambio de nodo
  const isInitialLoad = useRef(true)
  const lastNodeId = useRef<number | null>(null)

  // Inicializa con los valores discretos si el tipo de función es 'discreta'
  const initialValues = useMemo(() => {
    return initialConfig?.tipoFuncion === "discreta" && initialConfig.funcionDiscreta?.valores
      ? initialConfig.funcionDiscreta.valores
      : []
  }, [nodeId, initialConfig])

  // Estado local (este cambiará libremente sin notificar al padre todavía)
  const [valores, setValores] = useState<ValorDiscretoMAUT[]>(initialValues)

  // Estados para el formulario de nuevo valor
  const [newNombre, setNewNombre] = useState("")
  const [newUtilidadMin, setNewUtilidadMin] = useState(0.8)
  const [newUtilidadMax, setNewUtilidadMax] = useState(1.0)

  const { t } = useTranslation()
  const { notify } = useNotification()

  // Sincronizo el estado interno cuando cambia el NODO o la CONFIG INICIAL
  useEffect(() => {
    if (lastNodeId.current !== nodeId) {
      isInitialLoad.current = true
      lastNodeId.current = nodeId
    }
    setValores(initialValues)
  }, [nodeId, initialValues])


  const handleGuardar = (e: React.FormEvent) => {
    // Construimos la configuración final
    const newConfig: MAUTConfig = {
      tipoFuncion: "discreta",
      funcionDiscreta: {
        valores: valores,
      },
      // Limpiamos las otras configuraciones para evitar conflictos
      funcionSimple: undefined,
      funcionDual: undefined,
    }

    // Actualizamos el estado en el Padre (Modelo)
    onConfigChange(newConfig)
    notify(t('alertas.exito'), "success", t('generic.cguardad'))
  }


  const handleAddValue = () => {
    if (newNombre.trim() === "") {
      notify(t('alertas.cuidado'), "warning", t('discretos.adver1'))
      return
    }
    const min = Number.parseFloat(newUtilidadMin.toFixed(2));
    const max = Number.parseFloat(newUtilidadMax.toFixed(2));

    if (min < 0 || min > 1 || max < 0 || max > 1 || min > max) {
      notify(t('alertas.cuidado'), "warning", t('discretos.adver2'))
      return
    }

    const nuevoValor: ValorDiscretoMAUT = {
      id: Date.now().toString(),
      nombre: newNombre.trim(),
      utilidadMin: min,
      utilidadMax: max,
    }

    setValores([...valores, nuevoValor])

    // Reset inputs
    setNewNombre("")
    setNewUtilidadMin(0.8)
    setNewUtilidadMax(1.0)
  }

  const handleUpdateValue = (index: number, field: keyof ValorDiscretoMAUT, value: string | number) => {
    const updatedValores = [...valores]
    const updatedValue = updatedValores[index]

    if (field === 'utilidadMin' || field === 'utilidadMax') {
      const numValue = typeof value === 'string' ? Number.parseFloat(value) : value
      if (numValue < 0 || numValue > 1) return

      if (field === 'utilidadMin' && numValue > updatedValue.utilidadMax) return
      if (field === 'utilidadMax' && numValue < updatedValue.utilidadMin) return

      updatedValue[field] = numValue
    } else if (field === 'nombre') {
      updatedValue[field] = value as string
    }

    setValores(updatedValores)
  }

  const handleDeleteValue = (id: string) => {
    setValores(valores.filter((v) => v.id !== id))
  }

  return (
    <div>
      <div className="flex items-center p-4">
        <h3 className="text-lg font-semibold text-gray-700">
          {t('discretos.definir')}
        </h3>

        {/* Este contenedor ocupa el espacio restante y alinea su contenido a la derecha */}
        <div className="flex-1 flex justify-end items-center relative">
          <BotonAyuda route="/docs/discretevalues#crear-discretos">
            {t('discretos.ayuda')}          </BotonAyuda>
        </div>
      </div>




      <p className="text-sm text-gray-500 px-4">
        {t('discretos.indicacions')}
      </p>
      <div className="p-4 border bg-gray-50 space-y-3 mx-4">
        <h4 className="text-md font-medium">{t('discretos.anuevovalor')}</h4>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col text-sm font-medium">
            {t('discretos.nombrev')}
            <input
              type="text"
              value={newNombre}
              onChange={(e) => setNewNombre(e.target.value)}
              className="mt-1 p-2 border rounded-md w-48"
              placeholder={t('discretos.ejemplo')}
            />
          </label>
          <label className="flex flex-col text-sm font-medium">
            {t('discretos.umin')}
            <input
              type="number"
              value={newUtilidadMin}
              onChange={(e) => setNewUtilidadMin(Number.parseFloat(e.target.value))}
              step="0.01"
              min="0"
              max="1"
              className="mt-1 p-2 border rounded-md w-28"
            />
          </label>
          <label className="flex flex-col text-sm font-medium">
            {t('discretos.umax')}
            <input
              type="number"
              value={newUtilidadMax}
              onChange={(e) => setNewUtilidadMax(Number.parseFloat(e.target.value))}
              step="0.01"
              min="0"
              max="1"
              className="mt-1 p-2 border rounded-md w-28"
            />
          </label>
          <button
            onClick={handleAddValue}
            className="px-4 py-2 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 self-end"
          >
            {t('generic.anadir')}
          </button>
        </div>
      </div>

      {/* Lista de Valores Discretos */}
      <div className="space-y-3 px-4 pb-4">
        <h4 className="text-md font-medium">{t('generic.vdefinidos')} ({valores.length})</h4>
        {valores.length === 0 ? (
          <p className="text-sm text-gray-500 italic">{t('discretos.nohay')}</p>
        ) : (
          <ul className="space-y-2">
            {valores.map((valor, index) => (
              <li
                key={valor.id}
                className="flex items-stretch justify-between bg-white border rounded-md rounded-l-none shadow-sm overflow-hidden"
              >
                <div className="flex flex-wrap items-center gap-4 p-3 flex-grow">
                  <label className="flex flex-col text-sm font-medium">
                    {t('generic.nombre')}:
                    <input
                      type="text"
                      value={valor.nombre}
                      onChange={(e) => handleUpdateValue(index, 'nombre', e.target.value)}
                      className="mt-1 p-1 border rounded-md text-sm w-36"
                    />
                  </label>
                  <label className="flex flex-col text-sm font-medium">
                    {t('discretos.umina')}:
                    <input
                      type="number"
                      value={valor.utilidadMin.toFixed(2)}
                      onChange={(e) => handleUpdateValue(index, 'utilidadMin', e.target.value)}
                      step="0.01"
                      min="0"
                      max="1"
                      className="mt-1 p-1 border rounded-md text-sm w-20"
                    />
                  </label>
                  <label className="flex flex-col text-sm font-medium">
                    {t('discretos.umaxa')}:
                    <input
                      type="number"
                      value={valor.utilidadMax.toFixed(2)}
                      onChange={(e) => handleUpdateValue(index, 'utilidadMax', e.target.value)}
                      step="0.01"
                      min="0"
                      max="1"
                      className="mt-1 p-1 border rounded-md text-sm w-20"
                    />
                  </label>
                </div>


                <button
                  onClick={() => handleDeleteValue(valor.id)}
                  className="flex items-center justify-center bg-red-500 hover:bg-red-600 text-white w-14 transition-colors shrink-0 cursor-pointer"
                >
                  <Trash2 className="h-6 w-6" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="p-4 border-t border-gray-200">
        <button
          onClick={(e) => handleGuardar(e)}
          className="w-full sm:w-auto px-4 py-2 bg-blue-500 text-white rounded font-medium hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 cursor-pointer"
        >
          {t('botones.guardar')}
        </button>
      </div>
    </div>
  )
}