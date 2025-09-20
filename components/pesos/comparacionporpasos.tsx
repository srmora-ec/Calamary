"use client"

import type React from "react"
import { useState, useEffect } from "react"
import type { Nodo } from "@/types/modelo"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { calculateAHP } from "./metodos/pesosComPares"

interface ComparacionPorPasosProps {
  nodos: Nodo[]
  onSave: (weights: Record<number, number>) => void
}

const SAATY_OPTIONS = [
  { value: 9, label: "Extremadamente más importante", position: -8 },
  { value: 8, label: "", position: -7 },
  { value: 7, label: "Muy fuertemente más importante", position: -6 },
  { value: 6, label: "", position: -5 },
  { value: 5, label: "Fuertemente más importante", position: -4 },
  { value: 4, label: "", position: -3 },
  { value: 3, label: "Moderadamente más importante", position: -2 },
  { value: 2, label: "", position: -1 },
  { value: 1, label: "Igual importancia", position: 0 },
  { value: 1 / 2, label: "", position: 1 },
  { value: 1 / 3, label: "Moderadamente más importante", position: 2 },
  { value: 1 / 4, label: "", position: 3 },
  { value: 1 / 5, label: "Fuertemente más importante", position: 4 },
  { value: 1 / 6, label: "", position: 5 },
  { value: 1 / 7, label: "Muy fuertemente más importante", position: 6 },
  { value: 1 / 8, label: "", position: 7 },
  { value: 1 / 9, label: "Extremadamente más importante", position: 8 },
]

interface Comparison {
  nodeId1: number
  nodeId2: number
  node1Title: string
  node2Title: string
}

interface InconsistentComparison {
  comparison: Comparison
  index: number
  deviation: number
  suggestedValue?: number
  impactScore?: number
}

const ComparacionPorPasos: React.FC<ComparacionPorPasosProps> = ({ nodos, onSave }) => {
  const [comparisons, setComparisons] = useState<Comparison[]>([])
  const [matrix, setMatrix] = useState<Record<string, number>>({})
  const [weights, setWeights] = useState<Record<number, number>>({})
  const [consistencyRatio, setConsistencyRatio] = useState<number>(0)
  const [showResults, setShowResults] = useState(false)
  const [inconsistentComparisons, setInconsistentComparisons] = useState<InconsistentComparison[]>([])

  useEffect(() => {
    const allComparisons: Comparison[] = []

    for (let i = 0; i < nodos.length; i++) {
      for (let j = i + 1; j < nodos.length; j++) {
        allComparisons.push({
          nodeId1: nodos[i].idnodo,
          nodeId2: nodos[j].idnodo,
          node1Title: nodos[i].titulo,
          node2Title: nodos[j].titulo,
        })
      }
    }

    setComparisons(allComparisons)

    const initialMatrix: Record<string, number> = {}
    for (let i = 0; i < nodos.length; i++) {
      for (let j = 0; j < nodos.length; j++) {
        const key = `${nodos[i].idnodo}-${nodos[j].idnodo}`
        if (i === j) {
          initialMatrix[key] = 1
        } else {
          const reverseKey = `${nodos[j].idnodo}-${nodos[i].idnodo}`
          if (!initialMatrix[key] && !initialMatrix[reverseKey]) {
            initialMatrix[key] = 1
          }
        }
      }
    }
    setMatrix(initialMatrix)
  }, [nodos])

  const handleComparisonChange = (nodeId1: number, nodeId2: number, value: number) => {
    const key = `${nodeId1}-${nodeId2}`
    setMatrix((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

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

  const detectInconsistentComparisons = (
    matrizCompleta: number[][],
    ahpWeights: number[],
  ): InconsistentComparison[] => {
    const inconsistent: InconsistentComparison[] = []

    for (let i = 0; i < comparisons.length; i++) {
      const comp = comparisons[i]
      const nodeIndex1 = nodos.findIndex((n) => n.idnodo === comp.nodeId1)
      const nodeIndex2 = nodos.findIndex((n) => n.idnodo === comp.nodeId2)

      if (nodeIndex1 === -1 || nodeIndex2 === -1) continue

      const currentValue = matrizCompleta[nodeIndex1][nodeIndex2]
      const theoreticalValue = ahpWeights[nodeIndex1] / ahpWeights[nodeIndex2]
      const deviation = Math.abs(Math.log(currentValue) - Math.log(theoreticalValue))

      if (deviation > 0.5) {
        const suggestedValue = theoreticalValue
        const impactScore = deviation * (ahpWeights[nodeIndex1] + ahpWeights[nodeIndex2])
        inconsistent.push({
          comparison: comp,
          index: i,
          deviation,
          suggestedValue,
          impactScore,
        })
      }
    }

    return inconsistent
      .sort((a, b) => (b.impactScore || b.deviation) - (a.impactScore || a.deviation))
      .slice(0, Math.min(3, Math.ceil(inconsistent.length * 0.3)))
  }

  const calcularPesos = () => {
    const n = nodos.length
    const matrizCompleta: number[][] = []

    for (let i = 0; i < n; i++) {
      matrizCompleta[i] = []
      for (let j = 0; j < n; j++) {
        matrizCompleta[i][j] = getMatrixValue(nodos[i].idnodo, nodos[j].idnodo)
      }
    }

    const ahpResult = calculateAHP(matrizCompleta)

    const pesosCalculados: Record<number, number> = {}
    nodos.forEach((nodo, index) => {
      pesosCalculados[nodo.idnodo] = ahpResult.weights[index]
    })

    setWeights(pesosCalculados)
    setConsistencyRatio(ahpResult.CR)
    if (ahpResult.CR >= 0.1) {
      const inconsistent = detectInconsistentComparisons(matrizCompleta, ahpResult.weights)
      setInconsistentComparisons(inconsistent)
    } else {
      setInconsistentComparisons([])
    }
  }

  const handleCalculate = () => {
    calcularPesos()
  }

  const handleRestart = () => {
    setWeights({})
    setConsistencyRatio(0)
    setInconsistentComparisons([])
    setShowResults(false)

    const initialMatrix: Record<string, number> = {}
    for (let i = 0; i < nodos.length; i++) {
      for (let j = 0; j < nodos.length; j++) {
        const key = `${nodos[i].idnodo}-${nodos[j].idnodo}`
        if (i === j) {
          initialMatrix[key] = 1
        } else {
          const reverseKey = `${nodos[j].idnodo}-${nodos[i].idnodo}`
          if (!initialMatrix[key] && !initialMatrix[reverseKey]) {
            initialMatrix[key] = 1
          }
        }
      }
    }
    setMatrix(initialMatrix)
  }

  const applySuggestedValue = (comparison: Comparison, suggestedValue: number) => {
    handleComparisonChange(comparison.nodeId1, comparison.nodeId2, suggestedValue)
  }

  const handleSave = () => {
    onSave(weights)
  }

  const isConsistent = consistencyRatio < 0.1
  const consistencyPercentage = (consistencyRatio * 100).toFixed(1)

  const findNearestSaatyValue = (decimalValue: number): { value: number; display: string } => {
    const saatyValues = [9, 8, 7, 6, 5, 4, 3, 2, 1, 1 / 2, 1 / 3, 1 / 4, 1 / 5, 1 / 6, 1 / 7, 1 / 8, 1 / 9]

    let closest = saatyValues[0]
    let minDifference = Math.abs(Math.log(decimalValue) - Math.log(closest))

    for (const value of saatyValues) {
      const difference = Math.abs(Math.log(decimalValue) - Math.log(value))
      if (difference < minDifference) {
        minDifference = difference
        closest = value
      }
    }

    const display = closest < 1 ? `1/${Math.round(1 / closest)}` : closest.toString()
    return { value: closest, display }
  }

  if (comparisons.length === 0) {
    return <div>Cargando comparaciones...</div>
  }

  return (
    <div className="w-full space-y-4">
      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="text-base font-semibold text-blue-800 dark:text-blue-200 mb-2">
          ¿Qué es el Proceso de Análisis Jerárquico (AHP)?
        </h3>
        <div className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
          <p>
            El AHP es un método de toma de decisiones que permite comparar criterios de forma sistemática usando la
            escala de Saaty (1-9).
          </p>
          <p>
            <strong>Escala de valores:</strong> 1 = Igual importancia, 3 = Moderadamente más importante, 5 = Fuertemente
            más importante, 7 = Muy fuertemente más importante, 9 = Extremadamente más importante. Los valores 2, 4, 6,
            8 son intermedios. Para indicar que un criterio es menos importante, use fracciones: 1/3, 1/5, 1/7, 1/9.
          </p>
          <p>
            <strong>Consistencia:</strong> El método verifica que sus comparaciones sean lógicamente coherentes. Un
            ratio de consistencia menor al 10% es aceptable.
          </p>
        </div>
      </div>

      <div className="bg-background border rounded-lg p-3 sm:p-4">
        <h2 className="text-center text-base font-semibold mb-4">Comparación por Pares - Todas las Comparaciones</h2>

        <div className="space-y-4">
          {comparisons.map((comparison, index) => {
            const currentValue = getMatrixValue(comparison.nodeId1, comparison.nodeId2)
            const isInconsistent = inconsistentComparisons.some((inc) => inc.index === index)

            return (
              <div
                key={`${comparison.nodeId1}-${comparison.nodeId2}`}
                className={`border rounded-lg p-3 ${isInconsistent ? "border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-700" : "border-border"}`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="px-3 py-2 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800">
                        <h3
                          className="font-medium text-sm text-blue-700 dark:text-blue-300 truncate"
                          title={comparison.node1Title}
                        >
                          {comparison.node1Title}
                        </h3>
                      </div>
                    </div>

                    <div className="px-2">
                      <span className="text-sm font-bold text-muted-foreground">VS</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="px-3 py-2 bg-green-50 dark:bg-green-950 rounded border border-green-200 dark:border-green-800">
                        <h3
                          className="font-medium text-sm text-green-700 dark:text-green-300 truncate text-right"
                          title={comparison.node2Title}
                        >
                          {comparison.node2Title}
                        </h3>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-5 sm:grid-cols-9 md:grid-cols-13 lg:grid-cols-17 gap-1">
                    {SAATY_OPTIONS.map((option) => {
                      const isSelected = Math.abs(currentValue - option.value) < 0.001
                      const isLeftSide = option.position < 0
                      const isCenter = option.position === 0
                      const isRightSide = option.position > 0

                      return (
                        <button
                          key={`${option.value}-${option.position}`}
                          onClick={() => handleComparisonChange(comparison.nodeId1, comparison.nodeId2, option.value)}
                          className={`p-1 rounded border transition-all text-center min-h-[35px] flex flex-col items-center justify-center ${
                            isSelected
                              ? isCenter
                                ? "bg-gray-100 dark:bg-gray-800 border-gray-400 dark:border-gray-600"
                                : isLeftSide
                                  ? "bg-blue-100 dark:bg-blue-900 border-blue-400 dark:border-blue-600"
                                  : "bg-green-100 dark:bg-green-950 border-green-400 dark:border-green-600"
                              : "bg-background border-border hover:bg-muted"
                          }`}
                        >
                          <span className="font-mono text-xs font-bold">
                            {option.value === 1 / 2
                              ? "1/2"
                              : option.value === 1 / 3
                                ? "1/3"
                                : option.value === 1 / 4
                                  ? "1/4"
                                  : option.value === 1 / 5
                                    ? "1/5"
                                    : option.value === 1 / 6
                                      ? "1/6"
                                      : option.value === 1 / 7
                                        ? "1/7"
                                        : option.value === 1 / 8
                                          ? "1/8"
                                          : option.value === 1 / 9
                                            ? "1/9"
                                            : option.value}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {isInconsistent &&
                    (() => {
                      const inconsistentComp = inconsistentComparisons.find((inc) => inc.index === index)
                      if (inconsistentComp?.suggestedValue) {
                        const nearestSaaty = findNearestSaatyValue(inconsistentComp.suggestedValue)
                        return (
                          <div className="p-2 bg-yellow-50 dark:bg-yellow-950 rounded border border-yellow-200 dark:border-yellow-800">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs text-yellow-700 dark:text-yellow-300">
                                💡 <strong>Cambio sugerido:</strong> {nearestSaaty.display}
                                <span className="block text-xs text-muted-foreground mt-1">
                                  Este cambio tendrá alto impacto en la consistencia
                                </span>
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => applySuggestedValue(comparison, nearestSaaty.value)}
                                className="text-xs px-2 py-1 h-auto"
                              >
                                Aplicar
                              </Button>
                            </div>
                          </div>
                        )
                      }
                      return null
                    })()}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-4 text-center">
          <Button onClick={handleCalculate} className="min-w-[120px]">
            Calcular
          </Button>
        </div>
      </div>

      {Object.keys(weights).length > 0 && (
        <>
          {showResults && (
            <div className="bg-background border rounded-lg p-3 sm:p-4">
              <h2 className="text-base font-semibold mb-3">Matriz de Comparación Generada</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr>
                      <th className="border p-2 bg-muted font-medium text-left">Criterio</th>
                      {nodos.map((nodo) => (
                        <th key={nodo.idnodo} className="border p-2 bg-muted font-medium text-center min-w-[80px]">
                          <div className="truncate" title={nodo.titulo}>
                            {nodo.titulo}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {nodos.map((nodoFila) => (
                      <tr key={nodoFila.idnodo}>
                        <td className="border p-2 bg-muted font-medium">
                          <div className="truncate" title={nodoFila.titulo}>
                            {nodoFila.titulo}
                          </div>
                        </td>
                        {nodos.map((nodoColumna) => (
                          <td key={nodoColumna.idnodo} className="border p-2 text-center">
                            <span className="font-mono">
                              {getMatrixValue(nodoFila.idnodo, nodoColumna.idnodo).toFixed(2)}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-background border rounded-lg p-3 sm:p-4">
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Resultados del Análisis
            </h2>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 rounded-lg border gap-2">
                <div className="flex items-center gap-2">
                  {isConsistent ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span className="text-sm font-medium">Ratio de Consistencia:</span>
                </div>
                <div className="text-left sm:text-right">
                  <span className={`font-mono text-base ${isConsistent ? "text-green-600" : "text-red-600"}`}>
                    {consistencyPercentage}%
                  </span>
                  <div className="text-xs text-muted-foreground">
                    {isConsistent ? "Aceptable (< 10%)" : "Revisar comparaciones (≥ 10%)"}
                  </div>
                </div>
              </div>

              {!isConsistent && inconsistentComparisons.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Consistencia mejorable:</strong> Se sugieren {inconsistentComparisons.length} cambios
                    estratégicos (de {comparisons.length} comparaciones) para optimizar la coherencia. Estos cambios
                    tendrán el mayor impacto positivo.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Pesos Calculados:</h4>
                {nodos.map((nodo) => {
                  const peso = weights[nodo.idnodo] || 0
                  const porcentaje = (peso * 100).toFixed(2)

                  return (
                    <div
                      key={nodo.idnodo}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 rounded border gap-1"
                    >
                      <span className="text-sm font-medium truncate" title={nodo.titulo}>
                        {nodo.titulo}
                      </span>
                      <div className="text-left sm:text-right">
                        <span className="font-mono text-xs">{peso.toFixed(6)}</span>
                        <span className="text-xs text-muted-foreground ml-2">({porcentaje}%)</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between pt-3 gap-2">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowResults(!showResults)}>
                    {showResults ? "Ocultar" : "Ver"} Matriz
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleRestart}>
                    Reiniciar
                  </Button>
                </div>

                <Button size="sm" onClick={handleSave} disabled={!isConsistent} className="min-w-[100px]">
                  Guardar Pesos
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default ComparacionPorPasos
