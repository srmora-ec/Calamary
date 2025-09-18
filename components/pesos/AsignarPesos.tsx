"use client"
import React, { useState, useEffect } from "react"
import { Nodo } from "@/types/modelo"

interface AsignarPesosProps {
  nodos: Nodo[]
  onSave: (weights: Record<number, number>) => void
}

const AsignarPesos: React.FC<AsignarPesosProps> = ({ nodos, onSave }) => {
  const [weights, setWeights] = useState<Record<number, number>>({})
  const [selectedView, setSelectedView] = useState<"lower" | "average" | "upper">("average")
  const [error, setError] = useState<string | null>(null)

  // Obtener todos los nodos padres (idpadre === null)
  const padres = nodos.filter(n => n.idpadre === null)

  // Hacer un mapa padreId -> hijos
  const hijosPorPadre: Record<number, Nodo[]> = {}
  padres.forEach(p => {
    hijosPorPadre[p.idnodo] = nodos.filter(n => n.idpadre === p.idnodo)
  })

  useEffect(() => {
    const initialWeights: Record<number, number> = {}
    Object.values(hijosPorPadre).forEach(hijos => {
      const defaultWeight = hijos.length > 0 ? 1 / hijos.length : 0
      hijos.forEach(h => {
        initialWeights[h.idnodo] = h.peso ?? defaultWeight
      })
    })
    setWeights(initialWeights)
  }, [nodos])

  const handleWeightChange = (nodeId: number, value: string) => {
    const numValue = parseFloat(value) || 0
    setWeights(prev => ({ ...prev, [nodeId]: numValue }))
  }

  const validateWeights = () => {
    for (const hijos of Object.values(hijosPorPadre)) {
      const sum = hijos.reduce((acc, h) => acc + (weights[h.idnodo] ?? 0), 0)
      if (Math.abs(sum - 1) > 0.000001) {
        setError("La suma de los pesos de cada conjunto de hijos debe ser 1")
        return false
      }
    }
    setError(null)
    return true
  }

  const handleSave = () => {
    if (validateWeights()) {
      onSave(weights)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 w-full">
      {/* Radios */}
      <div className="flex space-x-6 mb-4">
        {["lower", "average", "upper"].map(val => (
          <label key={val} className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              value={val}
              checked={selectedView === val}
              onChange={e => setSelectedView(e.target.value as any)}
              className="text-blue-600"
            />
            <span className="capitalize">{val}</span>
          </label>
        ))}
      </div>

      {/* Contenido */}
      {padres.map(padre => {
        const hijos = hijosPorPadre[padre.idnodo]
        return (
          <div key={padre.idnodo} className="mb-6">
            <div className="text-center font-semibold mb-2">{padre.titulo}</div>
            <div className="flex gap-6">
              <div className="w-2/5 border rounded-lg p-4 flex flex-col items-center">
                {hijos.map(hijo => (
                  <div key={hijo.idnodo} className="flex items-center mb-2">
                    <div className="mr-2 text-sm">{weights[hijo.idnodo]?.toFixed(6)}</div>
                    <div className="border px-3 py-1">{hijo.titulo}</div>
                  </div>
                ))}
              </div>
              <div className="w-3/5 border rounded-lg p-4 space-y-4">
                {hijos.map(hijo => (
                  <div key={hijo.idnodo} className="flex items-center gap-4">
                    <input
                      type="number"
                      value={weights[hijo.idnodo]}
                      onChange={e => handleWeightChange(hijo.idnodo, e.target.value)}
                      step="0.000001"
                      className="w-28 px-2 py-1 border rounded"
                    />
                    <div className="flex-1 h-8 border rounded overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${weights[hijo.idnodo] * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })}

      {error && <div className="text-red-500 mb-2">{error}</div>}

      <div className="flex justify-end gap-4 mt-4">
        <button
          onClick={handleSave}
          className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          Guardar
        </button>
      </div>
    </div>
  )
}

export default AsignarPesos
