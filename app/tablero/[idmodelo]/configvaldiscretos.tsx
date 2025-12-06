"use client"

import { useState, useEffect, useMemo, useRef, useImperativeHandle, forwardRef } from "react"
import type { MAUTConfig, ValorDiscretoMAUT } from "@/types/modelo"
import { useTranslation } from "react-i18next"
import { useNotification } from "@/components/NotificationProvider"

interface DiscreteValuesConfigProps {
  initialConfig?: MAUTConfig
  onConfigChange: (config: MAUTConfig) => void
  nodeId: number // Para controlar la recarga al cambiar de nodo
}

export default forwardRef(function DiscreteValuesConfig({
  initialConfig,
  onConfigChange,
  nodeId,
}: DiscreteValuesConfigProps, ref) {

  // Refs para controlar el ciclo de vida del componente y el cambio de nodo
  const isInitialLoad = useRef(true)
  const lastNodeId = useRef<number | null>(null)

  // Inicializa con los valores discretos si el tipo de función es 'discreta'
  const initialValues = useMemo(() => {
    return initialConfig?.tipoFuncion === "discreta" && initialConfig.funcionDiscreta?.valores
      ? initialConfig.funcionDiscreta.valores
      : []
  }, [nodeId, initialConfig]) // Dependencia de nodeId y initialConfig

  const [valores, setValores] = useState<ValorDiscretoMAUT[]>(initialValues)

  // Estados para el nuevo valor... (Ya me cansé de comentar)
  const [newNombre, setNewNombre] = useState("")
  const [newUtilidadMin, setNewUtilidadMin] = useState(0.8)
  const [newUtilidadMax, setNewUtilidadMax] = useState(1.0)
  const { t } = useTranslation()
  const { notify } = useNotification()


  // Sincronizo el estado interno cuando cambia la configuración inicial del nodo
  useEffect(() => {
    // Reseteamos elcosodel nodo.
    if (lastNodeId.current !== nodeId) {
      isInitialLoad.current = true
      lastNodeId.current = nodeId
    }
    // Actualizamos siempre con la configuración entrante
    setValores(initialValues)
  }, [nodeId, initialValues])

  //  Llama a onConfigChange SÓLO cuando los valores cambian activamente por el usuario
  useEffect(() => {
    // PREVENIMOs EL BUCLE INFINITO EN LA CARGA INICIAL
    // Si es la carga inicial o si el nodo acaba de cambiar, evitamos llamar a onConfigChange.
    if (isInitialLoad.current) {
      isInitialLoad.current = false
      return
    }

    // Si se llega aquí, entendemos que los valores fueron modificadoa por una acción del usuario.
    const newConfig: MAUTConfig = {
      tipoFuncion: "discreta",
      funcionDiscreta: {
        valores: valores,
      },
      // Aseguramos que las funciones se limpien para no generar conflictos
      funcionSimple: undefined,
      funcionDual: undefined,
    }
    // Notificamosal padre para que actualize el resto de cosos
    onConfigChange(newConfig)

  }, [valores])

  const guardar = () => {
    // Si se llega aquí, 'valores' ha sido modificado por una acción del usuario.
    const newConfig: MAUTConfig = {
      tipoFuncion: "discreta",
      funcionDiscreta: {
        valores: valores,
      },
      // Limpiamos las otras acciones
      funcionSimple: undefined,
      funcionDual: undefined,
    }
    // Notificamos al padre para que actualice su estado mautConfig
    onConfigChange(newConfig)
  }
  useImperativeHandle(ref, () => ({
    guardar,
  }))

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
      id: Date.now().toString(), // se usa el id
      nombre: newNombre.trim(),
      utilidadMin: min,
      utilidadMax: max,
    }

    setValores([...valores, nuevoValor])
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

      // Lógica de validación cruzada para Min/Max
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
    // Se mantiene tu estructura de retorno
    <div className="space-y-6 border rounded-lg bg-white shadow">
      <h3 className="text-lg font-semibold text-gray-700 p-4">{t('discretos.definir')}</h3>
      <p className="text-sm text-gray-500 px-4">
        {t('discretos.indicacions')}
      </p>

      {/* Formulario para añadir nuevo valor */}
      <div className="p-4 border rounded-md bg-gray-50 space-y-3 mx-4">
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
              <li key={valor.id} className="flex flex-wrap items-center justify-between p-3 bg-white border rounded-md shadow-sm">
                <div className="flex items-center gap-4">
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
                  className="px-3 py-1 bg-red-500 text-white text-xs rounded-md hover:bg-red-600 transition-colors"
                >
                  {t('generic.del')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
)