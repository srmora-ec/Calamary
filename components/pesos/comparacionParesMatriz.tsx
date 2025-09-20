"use client"

import type React from "react"
import { useState, useEffect } from "react"
import type { Nodo } from "@/types/modelo"
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle2, RotateCcw, Calculator } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { calculateAHP } from "./metodos/pesosComPares"

interface ComparacionPorParesProps {
  nodos: Nodo[]
  onSave: (weights: Record<number, number>) => void
}

// Escala de Saaty
const SAATY_SCALE = [
  { value: 9, label: "9 - Extremadamente más importante" },
  { value: 7, label: "7 - Muy fuertemente más importante" },
  { value: 5, label: "5 - Fuertemente más importante" },
  { value: 3, label: "3 - Moderadamente más importante" },
  { value: 1, label: "1 - Igual importancia" },
  { value: 1 / 3, label: "1/3 - Moderadamente menos importante" },
  { value: 1 / 5, label: "1/5 - Fuertemente menos importante" },
  { value: 1 / 7, label: "1/7 - Muy fuertemente menos importante" },
  { value: 1 / 9, label: "1/9 - Extremadamente menos importante" },
]

const parseFraction = (input: string): number => {
  const trimmed = input.trim()

  // Check if it's a fraction like "1/5"
  if (trimmed.includes("/")) {
    const parts = trimmed.split("/")
    if (parts.length === 2) {
      const numerator = Number.parseFloat(parts[0])
      const denominator = Number.parseFloat(parts[1])
      if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
        return numerator / denominator
      }
    }
  }

  // Otherwise try to parse as regular number
  return Number.parseFloat(trimmed)
}

const formatValue = (value: number): string => {
  // Check for common fractions
  if (Math.abs(value - 1 / 3) < 0.001) return "1/3"
  if (Math.abs(value - 1 / 5) < 0.001) return "1/5"
  if (Math.abs(value - 1 / 7) < 0.001) return "1/7"
  if (Math.abs(value - 1 / 9) < 0.001) return "1/9"
  if (Math.abs(value - 2 / 3) < 0.001) return "2/3"
  if (Math.abs(value - 2 / 5) < 0.001) return "2/5"
  if (Math.abs(value - 2 / 7) < 0.001) return "2/7"
  if (Math.abs(value - 2 / 9) < 0.001) return "2/9"

  // For whole numbers or close to whole numbers
  if (Math.abs(value - Math.round(value)) < 0.001) {
    return Math.round(value).toString()
  }

  // Otherwise return decimal with 2 places
  return value.toFixed(2)
}

const validateInput = (value: string): string => {
  // Only allow numbers, decimal point, and forward slash
  return value.replace(/[^0-9./]/g, "")
}

const ComparacionPorPares: React.FC<ComparacionPorParesProps> = ({ nodos, onSave }) => {
  const [matrix, setMatrix] = useState<Record<string, number>>({})
  const [displayValues, setDisplayValues] = useState<Record<string, string>>({})
  const [weights, setWeights] = useState<Record<number, number>>({})
  const [consistencyRatio, setConsistencyRatio] = useState<number>(0)
  const [errors, setErrors] = useState<string[]>([])
  const [isCalculated, setIsCalculated] = useState(false)

  // Inicializar matriz con valores por defecto (1 para comparaciones iguales)
  useEffect(() => {
    const initialMatrix: Record<string, number> = {}
    const initialDisplayValues: Record<string, string> = {}

    for (let i = 0; i < nodos.length; i++) {
      for (let j = 0; j < nodos.length; j++) {
        const key = `${nodos[i].idnodo}-${nodos[j].idnodo}`
        if (i === j) {
          initialMatrix[key] = 1 // Diagonal principal siempre es 1
          initialDisplayValues[key] = "1"
        } else if (i < j) {
          initialMatrix[key] = 1 // Valor por defecto para comparaciones
          initialDisplayValues[key] = "1"
        }
      }
    }

    setMatrix(initialMatrix)
    setDisplayValues(initialDisplayValues)
  }, [nodos])

  // Obtener valor de la matriz
  const getMatrixValue = (nodeId1: number, nodeId2: number): number => {
    if (nodeId1 === nodeId2) return 1

    const key1 = `${nodeId1}-${nodeId2}`
    const key2 = `${nodeId2}-${nodeId1}`

    if (matrix[key1] !== undefined) {
      return matrix[key1]
    } else if (matrix[key2] !== undefined) {
      return 1 / matrix[key2]
    }

    return 1
  }

  const updateMatrixValue = (nodeId1: number, nodeId2: number, value: string) => {
    const cleanValue = validateInput(value)
    const numValue = parseFraction(cleanValue)

    if (isNaN(numValue) || numValue <= 0) {
      setErrors((prev) => [...prev, "Los valores deben ser números positivos o fracciones válidas (ej: 1/5)"])
      return
    }

    // Validar que esté en la escala de Saaty (1/9 a 9)
    if (numValue < 1 / 9 || numValue > 9) {
      setErrors((prev) => [...prev, "Los valores deben estar entre 1/9 y 9"])
      return
    }

    const key = `${nodeId1}-${nodeId2}`
    setMatrix((prev) => ({
      ...prev,
      [key]: numValue,
    }))

    setDisplayValues((prev) => ({
      ...prev,
      [key]: cleanValue,
    }))

    setErrors([])
    setIsCalculated(false)
  }

  // Verificar coherencia de inversos
  const verificarCoherencia = (): boolean => {
    const erroresCoherencia: string[] = []

    for (let i = 0; i < nodos.length; i++) {
      for (let j = i + 1; j < nodos.length; j++) {
        const nodeId1 = nodos[i].idnodo
        const nodeId2 = nodos[j].idnodo

        const valor = getMatrixValue(nodeId1, nodeId2)
        const inverso = getMatrixValue(nodeId2, nodeId1)

        // Verificar que sean inversos (con tolerancia para decimales)
        const producto = valor * inverso
        if (Math.abs(producto - 1) > 0.001) {
          erroresCoherencia.push(`Incoherencia entre ${nodos[i].titulo} y ${nodos[j].titulo}`)
        }
      }
    }

    setErrors(erroresCoherencia)
    return erroresCoherencia.length === 0
  }

  // Calcular pesos usando el método del eigenvector principal

  const calcularPesos = async () => {
    if (!verificarCoherencia()) {
      return;
    }

    const n = nodos.length;
    const matrizCompleta: number[][] = [];

    // Construir matriz completa
    for (let i = 0; i < n; i++) {
      matrizCompleta[i] = [];
      for (let j = 0; j < n; j++) {
        matrizCompleta[i][j] = getMatrixValue(nodos[i].idnodo, nodos[j].idnodo);
      }
    }

    try {
      const result = await calculateAHP(matrizCompleta); // Llama al FastAPI

      // Asignar pesos en orden de llegada
      const newWeights: Record<number, number> = {};
      nodos.forEach((nodo, index) => {
        newWeights[nodo.idnodo] = result.weights[index];
      });

      setWeights(newWeights);
      setConsistencyRatio(result.CR);
      setIsCalculated(true);
      setErrors([]);
    } catch (err) {
      console.error("Error al calcular AHP:", err);
      setErrors(["No se pudo calcular los pesos desde el servidor."]);
    }
  };

  const resetearMatriz = () => {
    const resetMatrix: Record<string, number> = {}
    const resetDisplayValues: Record<string, string> = {}

    for (let i = 0; i < nodos.length; i++) {
      for (let j = 0; j < nodos.length; j++) {
        const key = `${nodos[i].idnodo}-${nodos[j].idnodo}`
        if (i === j) {
          resetMatrix[key] = 1
          resetDisplayValues[key] = "1"
        } else if (i < j) {
          resetMatrix[key] = 1
          resetDisplayValues[key] = "1"
        }
      }
    }

    setMatrix(resetMatrix)
    setDisplayValues(resetDisplayValues)
    setWeights({})
    setConsistencyRatio(0)
    setErrors([])
    setIsCalculated(false)
  }

  // Guardar pesos
  const handleSave = () => {
    if (isCalculated && errors.length === 0) {
      onSave(weights)
    }
  }

  const isConsistent = consistencyRatio < 0.1
  const consistencyPercentage = (consistencyRatio * 100).toFixed(1)

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Escala de Saaty</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
          {SAATY_SCALE.map((item) => (
            <div key={item.value} className="flex items-center gap-2">
              <span className="font-mono w-8 text-right">{formatValue(item.value)}</span>
              <span className="text-muted-foreground">{item.label.split(" - ")[1]}</span>
            </div>
          ))}
        </div>
      </CardContent>
      <br />
      {/* Matriz de comparación */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border p-2 bg-muted font-medium text-left min-w-[150px]">Criterio</th>
              {nodos.map((nodo) => (
                <th key={nodo.idnodo} className="border p-2 bg-muted font-medium text-center min-w-[120px]">
                  <div className="text-xs">{nodo.titulo}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {nodos.map((nodoFila, i) => (
              <tr key={nodoFila.idnodo}>
                <td className="border p-2 bg-muted font-medium">{nodoFila.titulo}</td>
                {nodos.map((nodoColumna, j) => (
                  <td key={nodoColumna.idnodo} className="border p-0 text-center">
                    {i === j ? (
                      <div className="p-2">
                        <span className="font-mono text-muted-foreground">1.00</span>
                      </div>
                    ) : i < j ? (
                      <Input
                        type="text"
                        value={displayValues[`${nodoFila.idnodo}-${nodoColumna.idnodo}`] || "1"}
                        onChange={(e) => {
                          const cleanValue = validateInput(e.target.value)
                          e.target.value = cleanValue
                          updateMatrixValue(nodoFila.idnodo, nodoColumna.idnodo, cleanValue)
                        }}
                        className="w-full h-full border-0 rounded-none text-center font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="1 o 1/5"
                      />
                    ) : (
                      <div className="p-2">
                        <span className="font-mono text-muted-foreground">
                          {formatValue(1 / getMatrixValue(nodoColumna.idnodo, nodoFila.idnodo))}
                        </span>
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
        <strong>Tip:</strong> Puedes ingresar valores como números decimales (0.2) o como fracciones (1/5). Ambos
        formatos son equivalentes y válidos.
      </div>

      {/* Errores */}
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Botones de acción */}
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={resetearMatriz} className="flex items-center gap-2 bg-transparent">
          <RotateCcw className="h-4 w-4" />
          Resetear Matriz
        </Button>

        <Button onClick={calcularPesos} disabled={errors.length > 0} className="flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          Calcular Pesos
        </Button>
      </div>

      {/* Resultados */}
      {isCalculated && (
        <>
          <CardHeader>
            <CardTitle className="text-lg">Resultados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Consistencia */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-2">
                {isConsistent ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                )}
                <span className="font-medium">Ratio de Consistencia:</span>
              </div>
              <div className="text-right">
                <span className={`font-mono text-lg ${isConsistent ? "text-green-600" : "text-red-600"}`}>
                  {consistencyPercentage}%
                </span>
                <div className="text-xs text-muted-foreground">
                  {isConsistent ? "Aceptable (< 10%)" : "Revisar matriz (≥ 10%)"}
                </div>
              </div>
            </div>
            <br />

            {/* Pesos calculados */}
            <div className="space-y-3">
              <h4 className="font-medium">Pesos Calculados:</h4>
              {nodos.map((nodo) => {
                const peso = weights[nodo.idnodo] || 0
                const porcentaje = (peso * 100).toFixed(2)

                return (
                  <div key={nodo.idnodo} className="flex items-center justify-between p-2 rounded border">
                    <span className="font-medium">{nodo.titulo}</span>
                    <div className="text-right">
                      <span className="font-mono text-xs">{peso.toFixed(6)}</span>
                      <span className="text-xs text-muted-foreground ml-2">({porcentaje}%)</span>
                    </div>
                  </div>
                )
              })}
            </div>

            <br />

            {/* Botón guardar */}
            <div className="flex justify-end pt-4">
              <Button onClick={handleSave} disabled={!isConsistent} className="min-w-[120px]">
                Guardar Pesos
              </Button>
            </div>
          </CardContent>
        </>
      )}
    </div>
  )
}

export default ComparacionPorPares
