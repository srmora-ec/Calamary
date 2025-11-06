"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Nodo {
  idnodo: number
  titulo: string
  peso?: number
}

interface AsignarPesosProps {
  nodos: Nodo[]
  onSave: (weights: Record<number, number>) => void
}

const AsignarIgual: React.FC<AsignarPesosProps> = ({ nodos, onSave }) => {
  const [weights, setWeights] = useState<Record<number, number>>({})
  const [errors, setErrors] = useState<Record<number, string>>({})
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [tempValue, setTempValue] = useState<string>("")

  useEffect(() => {
    const initialWeights: Record<number, number> = {}
    const equalWeight = nodos.length > 0 ? 1 / nodos.length : 0
    nodos.forEach((nodo) => {
      initialWeights[nodo.idnodo] = nodo.peso ?? Number.parseFloat(equalWeight.toFixed(6))
    })
    setWeights(initialWeights)
  }, [nodos])

  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0)
  const isValidSum = Math.abs(totalWeight - 1) < 1e-6

  // --- Lógica de Equal Apportionment ---
  const redistributeEqualApportion = (changedId: number, newValue: number) => {
    const n = Object.keys(weights).length
    if (n <= 1) {
      setWeights({ [changedId]: 1 })
      return
    }

    const oldValue = weights[changedId]
    const delta = oldValue - newValue
    const newWeights: Record<number, number> = {}
    const otherIds = Object.keys(weights)
      .map(Number)
      .filter((id) => id !== changedId)

    const changePerOther = delta / otherIds.length
    Object.entries(weights).forEach(([idStr, w]) => {
      const id = Number(idStr)
      if (id === changedId) {
        newWeights[id] = newValue
      } else {
        newWeights[id] = Math.max(0, w + changePerOther)
      }
    })

    // Normalizar
    const sumNew = Object.values(newWeights).reduce((s, w) => s + w, 0)
    Object.keys(newWeights).forEach((idStr) => {
      newWeights[Number(idStr)] = parseFloat((newWeights[Number(idStr)] / sumNew).toFixed(6))
    })

    setWeights(newWeights)
    setSelectedId(null)
    setTempValue("")
  }

  const handleInputSelect = (nodeId: number, value: string) => {
    setSelectedId(nodeId)
    setTempValue(value)
  }

  const handleRunSA = () => {
    if (selectedId === null) return
    const numValue = parseFloat(tempValue)
    if (isNaN(numValue) || numValue < 0 || numValue > 1) {
      setErrors((prev) => ({ ...prev, [selectedId]: "Valor inválido entre 0 y 1" }))
      return
    }
    setErrors((prev) => {
      const copy = { ...prev }
      delete copy[selectedId]
      return copy
    })
    redistributeEqualApportion(selectedId, numValue)
  }

  const handleSave = () => {
    if (Object.keys(errors).length === 0 && isValidSum) {
      onSave(weights)
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {nodos.map((nodo) => {
        const weight = weights[nodo.idnodo] ?? 0
        const percentage = (weight * 100).toFixed(2)
        const hasError = errors[nodo.idnodo]

        return (
          <div key={nodo.idnodo} className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={`peso-${nodo.idnodo}`} className="font-medium">
                {nodo.titulo}
              </Label>
              <span className="text-sm font-mono">{percentage}%</span>
            </div>
            <div className="flex items-center gap-3">
              <Input
                id={`peso-${nodo.idnodo}`}
                type="number"
                step="0.000001"
                min="0"
                max="1"
                value={
                  selectedId === nodo.idnodo ? tempValue : weight.toString()
                }
                onChange={(e) => handleInputSelect(nodo.idnodo, e.target.value)}
                className={`w-32 font-mono ${hasError ? "border-red-500" : ""}`}
              />
              <div className="flex-1">
                <div className="w-full bg-muted rounded-full h-3">
                  <div
                    className="h-3 rounded-full transition-all duration-300 bg-green-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            </div>
            {hasError && <p className="text-sm text-red-500">{hasError}</p>}
          </div>
        )
      })}

      <div className="flex justify-end gap-3 pt-4">
        <Button onClick={handleRunSA} disabled={selectedId === null}>
          SA
        </Button>
        <Button onClick={handleSave} className="min-w-[120px]">
          Guardar Pesos
        </Button>
      </div>

      {!isValidSum && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            La suma de los pesos debe ser exactamente 1.000000
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

export default AsignarIgual
