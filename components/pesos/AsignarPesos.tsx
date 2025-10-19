"use client"

import type React from "react"
import { useState, useEffect } from "react"
import type { Nodo } from "@/types/modelo"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle2, RotateCcw } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface AsignarPesosProps {
  nodos: Nodo[]
  onSave: (weights: Record<number, number>) => void
}

const AsignarPesos: React.FC<AsignarPesosProps> = ({ nodos, onSave }) => {
  const [weights, setWeights] = useState<Record<number, number>>({})
  const [errors, setErrors] = useState<Record<number, string>>({})

  // Inicializar pesos uniformemente distribuidos
  useEffect(() => {
    const initialWeights: Record<number, number> = {}
    const equalWeight = nodos.length > 0 ? 1 / nodos.length : 0

    nodos.forEach((nodo) => {
      initialWeights[nodo.idnodo] = nodo.peso || Number.parseFloat(equalWeight.toFixed(6))
    })

    setWeights(initialWeights)
  }, [nodos])

  // Calcular suma total de pesos
  const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0)
  const isValidSum = Math.abs(totalWeight - 1) < 1e-6 + Number.EPSILON // Usamos 6 decimales

  // Manejar cambio de peso
  const handleWeightChange = (nodeId: number, value: string) => {
    const numValue = Number.parseFloat(value)

    // Verificamos que estamos colocando algo correcto
    if (value === "" || isNaN(numValue)) {//no puede esta rvacio
      setWeights((prev) => ({ ...prev, [nodeId]: 0 }))
      setErrors((prev) => ({ ...prev, [nodeId]: "Valor inválido" }))
      return
    }

    if (numValue < 0) {//No podemos meter negativos
      setErrors((prev) => ({ ...prev, [nodeId]: "El peso no puede ser negativo" }))
      return
    }

    if (numValue > 1) { //Ni un número mayor a 1
      setErrors((prev) => ({ ...prev, [nodeId]: "El peso no puede ser mayor a 1" }))
      return
    }

    // Verificar decimales (máximo 6)
    const decimalPlaces = (value.split(".")[1] || "").length
    if (decimalPlaces > 6) {
      setErrors((prev) => ({ ...prev, [nodeId]: "Máximo 6 decimales permitidos" }))
      return
    }

    setWeights((prev) => ({ ...prev, [nodeId]: numValue }))//guardamos los pesos
    setErrors((prev) => {//
      const newErrors = { ...prev }
      delete newErrors[nodeId]
      return newErrors
    })
  }

  // Redistribuir pesos uniformemente
  const redistributeWeights = () => {
    const equalWeight = Number.parseFloat((1 / nodos.length).toFixed(6))//1/para el total de nodos... 
    const newWeights: Record<number, number> = {}//Estructura para los pesos

    nodos.forEach((nodo) => {//Recoremos los nodos
      newWeights[nodo.idnodo] = equalWeight // a cada nodo le asignamos un peso
    })

    setWeights(newWeights)//guardamos los pesos
    setErrors({})
  }

  // Normalizar pesos para que sumen 1
  const normalizeWeights = () => {
    if (totalWeight === 0) return//Prevenimos para no dividir entre cero

    const normalizedWeights: Record<number, number> = {}//Estructura para los nodos
    Object.entries(weights).forEach(([nodeId, weight]) => {//Recorremos los pesos
      normalizedWeights[Number.parseInt(nodeId)] = Number.parseFloat((weight / totalWeight).toFixed(6))//Peso actual/para la suma de los pesos
    })

    setWeights(normalizedWeights)//guardamos nuevos pesos
    setErrors({})
  }

  // Guardar pesos
  const handleSave = () => {
    if ( Object.keys(errors).length === 0) {
      onSave(weights)//Enviamos los nuevos pesos
    }
  }

  // Obtener color para la barra de progreso
  const getProgressColor = (weight: number) => {//Logica de color para distinguir los mas pesados
    const percentage = weight * 100
    if (percentage < 10) return "bg-red-500"
    if (percentage < 25) return "bg-orange-500"
    if (percentage < 50) return "bg-yellow-500"
    return "bg-green-500"
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            
            Suma total:{" "}
            <span className={`font-mono ${isValidSum ? "text-green-600" : "text-red-600"}`}>
              {totalWeight.toFixed(6)}
              
            </span>
            
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={redistributeWeights}
              className="flex items-center gap-1 bg-transparent"
            >
              <RotateCcw className="h-4 w-4" />
              Redistribuir
            </Button>
            <Button variant="outline" size="sm" onClick={normalizeWeights} disabled={totalWeight === 0}>
              Normalizar
            </Button>
          </div>
        </div>

        {!isValidSum && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>La suma de los pesos debe ser exactamente 1.000000</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {nodos.map((nodo) => {
            const weight = weights[nodo.idnodo] || 0
            const percentage = weight * 100
            const hasError = errors[nodo.idnodo]

            return (
              <div key={nodo.idnodo} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`peso-${nodo.idnodo}`} className="font-medium">
                    {nodo.titulo}
                  </Label>
                  <span className="text-sm text-muted-foreground font-mono">{percentage.toFixed(2)}%</span>
                </div>

                <div className="flex items-center gap-3">
                  <Input
                    id={`peso-${nodo.idnodo}`}
                    type="number"
                    step="0.000001"
                    min="0"
                    max="1"
                    value={weight.toString()}
                    onChange={(e) => handleWeightChange(nodo.idnodo, e.target.value)}
                    className={`w-32 font-mono ${hasError ? "border-red-500" : ""}`}
                    placeholder="0.000000"
                  />

                  <div className="flex-1">
                    <div className="w-full bg-muted rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all duration-300 ${getProgressColor(weight)}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </div>

                {hasError && <p className="text-sm text-red-500">{hasError}</p>}
              </div>
            )
          })}
        </div>

        <div className="flex justify-end pt-4">
          <Button
            onClick={handleSave}
            className="min-w-[120px]"
          >
            Guardar Pesos
          </Button>
        </div>
    </div>
  )
}

export default AsignarPesos
