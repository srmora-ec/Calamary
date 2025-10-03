"use client"

import type React from "react"
import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import type { Nodo } from "@/types/modelo"
import { calculateAHP } from "./metodos/pesosComPares"
import { Button } from "@/components/ui/button"
import { CheckCircle2, AlertCircle, HelpCircle, ArrowLeft, ArrowRight } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import HelpButton from "../HelpButton"
import Modal from "../Modal"
import NodoInfo from "../NodoInfo"
import Spinner from "./Spinner"
import { TourProps } from "antd"
import { Tour } from "antd"

interface CuestionarioExpertosProps {
  nodos: Nodo[]
  onSave: (matrix: Record<string, number>, weights: Record<number, number>) => void
}


const SAATY_OPTIONS = [
  { value: 9, label: "Extremadamente más importante", position: -8 },
  { value: 8, label: "Muy, muy fuertemente más importante", position: -7 },
  { value: 7, label: "Muy fuertemente más importante", position: -6 },
  { value: 6, label: "Entre muy fuertemente y fuertemente más importante", position: -5 },
  { value: 5, label: "Fuertemente más importante", position: -4 },
  { value: 4, label: "Entre fuertemente y moderadamente más importante", position: -3 },
  { value: 3, label: "Moderadamente más importante", position: -2 },
  { value: 2, label: "Entre moderadamente y ligeramente más importante", position: -1 },
  { value: 1, label: "Igual importancia", position: 0 },
  { value: 1 / 2, label: "Entre ligeramente y moderadamente menos importante", position: 1 },
  { value: 1 / 3, label: "Moderadamente menos importante", position: 2 },
  { value: 1 / 4, label: "Entre fuertemente y moderadamente menos importante", position: 3 },
  { value: 1 / 5, label: "Fuertemente menos importante", position: 4 },
  { value: 1 / 6, label: "Entre muy fuertemente y fuertemente menos importante", position: 5 },
  { value: 1 / 7, label: "Muy fuertemente menos importante", position: 6 },
  { value: 1 / 8, label: "Muy, muy fuertemente menos importante", position: 7 },
  { value: 1 / 9, label: "Extremadamente menos importante", position: 8 },
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

const CuestionarioExpertos: React.FC<CuestionarioExpertosProps> = ({ nodos = [], onSave }) => {
  const [comparisons, setComparisons] = useState<Comparison[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [matrix, setMatrix] = useState<Record<string, number>>({})
  const [weights, setWeights] = useState<Record<number, number>>({})
  const [consistencyRatio, setConsistencyRatio] = useState<number>(0)
  const [showResults, setShowResults] = useState(false)
  const [inconsistentComparisons, setInconsistentComparisons] = useState<InconsistentComparison[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedNodoId, setSelectedNodoId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [tourOpen, setTourOpen] = useState<boolean>(false)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [questionsCompleted, setQuestionsCompleted] = useState(false)

  // Referencias para el tour
  const ref1 = useRef(null) // Pregunta actual
  const ref2 = useRef(null) // Criterios
  const ref3 = useRef(null) // Opciones de respuesta
  const ref4 = useRef(null) // Botón siguiente
  const ref5 = useRef(null) // Progreso
  const ref6 = useRef(null) // Resultados
  const ref7 = useRef(null) // Botón guardar

  // Memoizar el nodo seleccionado para evitar re-renders innecesarios
  const selectedNodo = useMemo(() => {
    if (!selectedNodoId || !nodos || nodos.length === 0) return null
    return nodos.find((n) => n.idnodo === selectedNodoId) || null
  }, [selectedNodoId, nodos])

  // Memoizar las comparaciones para evitar recálculos
  const memoizedComparisons = useMemo(() => {
    if (!nodos || nodos.length === 0) return []

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
    return allComparisons
  }, [nodos])

  useEffect(() => {
    setComparisons(memoizedComparisons)

    if (!nodos || nodos.length === 0) {
      setMatrix({})
      return
    }

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
  }, [memoizedComparisons, nodos])

  // Configuración del tour
  const tourSteps: TourProps["steps"] = [
    {
      title: "Pregunta actual",
      description:
        "Aquí se muestra la pregunta actual que compara dos criterios. Lee cuidadosamente ambos criterios antes de responder.",
      target: () => ref1.current,
    },
    {
      title: "Criterios a comparar",
      description:
        "Estos son los dos criterios que debes evaluar. Puedes hacer clic en el botón de ayuda para obtener más información sobre cada criterio.",
      target: () => ref2.current,
    },
    {
      title: "Opciones de respuesta",
      description:
        'Selecciona una de estas 17 opciones según qué tan importante consideres un criterio sobre el otro. Desde "Extremadamente más importante" hasta "Extremadamente menos importante".',
      target: () => ref3.current,
    },
    {
      title: "Navegación",
      description:
        "Usa estos botones para navegar entre preguntas. Solo puedes avanzar después de seleccionar una respuesta.",
      target: () => ref4.current,
    },
    {
      title: "Progreso",
      description: "Aquí puedes ver tu progreso en el cuestionario y cuántas preguntas faltan por responder.",
      target: () => ref5.current,
    },
    {
      title: "Resultados",
      description:
        "Una vez completadas todas las preguntas, aquí aparecerán los resultados del análisis con los pesos calculados.",
      target: () => ref6.current,
    },
    {
      title: "Guardar",
      description: "Cuando estés satisfecho con la consistencia de tus respuestas, guarda los pesos calculados.",
      target: () => ref7.current,
    },
  ]

  // Optimizar el manejo del modal con useCallback
  const handleHelpClick = useCallback(
    (nodoId: number) => {
      if (nodoId && nodos.some((n) => n.idnodo === nodoId)) {
        setSelectedNodoId(nodoId)
        setModalOpen(true)
      }
    },
    [nodos],
  )

  const handleCloseModal = useCallback(() => {
    setModalOpen(false)
    setTimeout(() => {
      setSelectedNodoId(null)
    }, 200)
  }, [])

  const handleAnswerSelect = useCallback(
    (optionIndex: number) => {
      setSelectedAnswer(optionIndex)

      if (comparisons.length > 0 && currentQuestionIndex < comparisons.length) {
        const currentComparison = comparisons[currentQuestionIndex]
        const saatyValue = SAATY_OPTIONS[optionIndex].value

        const key = `${currentComparison.nodeId1}-${currentComparison.nodeId2}`
        setMatrix((prev) => ({
          ...prev,
          [key]: saatyValue,
        }))
      }
    },
    [comparisons, currentQuestionIndex],
  )

  const handleNextQuestion = useCallback(() => {
    if (currentQuestionIndex < comparisons.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1)
      setSelectedAnswer(null)
    } else {
      setQuestionsCompleted(true)
      calcularPesos()
    }
  }, [currentQuestionIndex, comparisons.length])

  const handlePreviousQuestion = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1)
      const prevComparison = comparisons[currentQuestionIndex - 1]
      const key = `${prevComparison.nodeId1}-${prevComparison.nodeId2}`
      const existingValue = matrix[key]
      if (existingValue !== undefined) {
        const optionIndex = SAATY_OPTIONS.findIndex((option) => Math.abs(option.value - existingValue) < 0.001)
        setSelectedAnswer(optionIndex !== -1 ? optionIndex : null)
      } else {
        setSelectedAnswer(null)
      }
    }
  }, [currentQuestionIndex, comparisons, matrix])

  const getMatrixValue = useCallback(
    (nodeId1: number, nodeId2: number): number => {
      if (nodeId1 === nodeId2) return 1

      const key1 = `${nodeId1}-${nodeId2}`
      const key2 = `${nodeId2}-${nodeId1}`

      if (matrix[key1] !== undefined) {
        return matrix[key1]
      } else if (matrix[key2] !== undefined) {
        return 1 / matrix[key2]
      }

      return 1
    },
    [matrix],
  )

  const detectInconsistentComparisons = useCallback(
    (matrizCompleta: number[][], ahpWeights: number[]): InconsistentComparison[] => {
      if (!comparisons || comparisons.length === 0 || !nodos || nodos.length === 0) {
        return []
      }

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
    },
    [comparisons, nodos],
  )

  const calcularPesos = useCallback(async () => {
    setLoading(true)

    if (!nodos || nodos.length === 0) {
      console.error("No hay nodos para calcular")
      setLoading(false)
      return
    }

    const n = nodos.length
    const matrizCompleta: number[][] = []

    for (let i = 0; i < n; i++) {
      matrizCompleta[i] = []
      for (let j = 0; j < n; j++) {
        matrizCompleta[i][j] = getMatrixValue(nodos[i].idnodo, nodos[j].idnodo)
      }
    }

    try {
      const ahpResult = await calculateAHP(matrizCompleta)

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
    } catch (error) {
      console.error("Error al calcular AHP:", error)
    } finally {
      setLoading(false)
    }
  }, [nodos, getMatrixValue, detectInconsistentComparisons])

  const handleRestart = useCallback(() => {
    setCurrentQuestionIndex(0)
    setSelectedAnswer(null)
    setQuestionsCompleted(false)
    setWeights({})
    setConsistencyRatio(0)
    setInconsistentComparisons([])
    setShowResults(false)

    if (!nodos || nodos.length === 0) {
      setMatrix({})
      return
    }

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

const handleSave = useCallback(() => {
  onSave(matrix, weights)
}, [onSave, matrix, weights])

  // Memoizar valores calculados
  const isConsistent = useMemo(() => consistencyRatio < 0.1, [consistencyRatio])
  const consistencyPercentage = useMemo(() => (consistencyRatio * 100).toFixed(1), [consistencyRatio])
  const progress = useMemo(
    () => ((currentQuestionIndex + (questionsCompleted ? 1 : 0)) / comparisons.length) * 100,
    [currentQuestionIndex, questionsCompleted, comparisons.length],
  )

  const currentComparison = useMemo(() => {
    if (comparisons.length === 0 || currentQuestionIndex >= comparisons.length) return null
    return comparisons[currentQuestionIndex]
  }, [comparisons, currentQuestionIndex])

  const currentNodo1 = useMemo(() => {
    if (!currentComparison) return null
    return nodos.find((n) => n.idnodo === currentComparison.nodeId1) || null
  }, [currentComparison, nodos])

  const currentNodo2 = useMemo(() => {
    if (!currentComparison) return null
    return nodos.find((n) => n.idnodo === currentComparison.nodeId2) || null
  }, [currentComparison, nodos])

  if (!nodos || nodos.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">
          No hay criterios para comparar. Por favor, agregue al menos 2 criterios.
        </p>
      </div>
    )
  }

  if (nodos.length === 1) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">Se necesitan al menos 2 criterios para realizar comparaciones.</p>
      </div>
    )
  }

  if (comparisons.length === 0) {
    return <div>Cargando comparaciones...</div>
  }

  return (
    <div className="w-full space-y-4">
      {/* Botón para iniciar el tour */}
      <div className="text-center mb-4">
        <Button
          type="default"
          onClick={() => setTourOpen(true)}
          className="bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700"
        >
          <HelpCircle className="w-4 h-4 mr-2" />
          ¿Cómo usar esta herramienta?
        </Button>
      </div>

      {/* Instrucciones */}
      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="text-base font-semibold text-blue-800 dark:text-blue-200 mb-2">
          Cuestionario de Comparación por Pares
        </h3>
        <div className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
          <p>
            Este cuestionario te ayudará a determinar la importancia relativa de cada criterio mediante comparaciones
            por pares.
          </p>
          <p>
            <strong>Instrucciones:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Se te presentarán {comparisons.length} preguntas, una a la vez</li>
            <li>Para cada pregunta, selecciona qué tan importante es un criterio comparado con el otro</li>
            <li>Puedes navegar hacia atrás para revisar tus respuestas anteriores</li>
            <li>Al final se calculará automáticamente la consistencia de tus respuestas</li>
          </ul>
        </div>
      </div>

      {/* Barra de progreso */}
      <div ref={ref5} className="bg-background border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Progreso del cuestionario</span>
          <span className="text-sm text-muted-foreground">
            {questionsCompleted ? comparisons.length : currentQuestionIndex + 1} de {comparisons.length}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* Pregunta actual */}
      {!questionsCompleted && currentComparison && (
        <div className="bg-background border rounded-lg p-6">
          <div ref={ref1} className="text-center mb-6">
            <h2 className="text-lg font-semibold mb-2">
              Pregunta {currentQuestionIndex + 1} de {comparisons.length}
            </h2>
            <p className="text-base text-muted-foreground">
              ¿Qué criterio te parece más importante a considerar entre <strong>{currentComparison.node1Title}</strong>{" "}
              y <strong>{currentComparison.node2Title}</strong>?
            </p>
          </div>

          {/* Criterios a comparar */}
          <div ref={ref2} className="flex items-center justify-center gap-4 mb-6">
            <div className="flex-1 max-w-sm">
              <div className="px-4 py-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2">
                  {currentNodo1 && <HelpButton onClick={() => handleHelpClick(currentNodo1.idnodo)} />}
                  <div className="flex-1">
                    <h3 className="font-medium text-blue-700 dark:text-blue-300">{currentComparison.node1Title}</h3>
                    {currentNodo1?.descripcion && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{currentNodo1.descripcion}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-3">
              <span className="text-lg font-bold text-muted-foreground">VS</span>
            </div>

            <div className="flex-1 max-w-sm">
              <div className="px-4 py-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <h3 className="font-medium text-green-700 dark:text-green-300">{currentComparison.node2Title}</h3>
                    {currentNodo2?.descripcion && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">{currentNodo2.descripcion}</p>
                    )}
                  </div>
                  {currentNodo2 && <HelpButton onClick={() => handleHelpClick(currentNodo2.idnodo)} />}
                </div>
              </div>
            </div>
          </div>

          {/* Opciones de respuesta */}
          <div ref={ref3} className="space-y-2 mb-6">
            <h4 className="text-sm font-medium text-center mb-4">Selecciona tu respuesta:</h4>
            <div className="grid gap-2">
              {SAATY_OPTIONS.map((option, index) => {
                const isSelected = selectedAnswer === index
                const isEqualImportance = option.value === 1
                const favorsCriterion1 = option.value > 1

                let displayText = ""
                if (isEqualImportance) {
                  displayText = "Son igual de importantes"
                } else if (favorsCriterion1) {
                  displayText = `${currentComparison.node1Title} es ${option.label.toLowerCase()} que ${currentComparison.node2Title}`
                } else {
                  const invertedLabel = option.label.replace("menos importante", "más importante")
                  displayText = `${currentComparison.node2Title} es ${invertedLabel.toLowerCase()} que ${currentComparison.node1Title}`
                }

                return (
                  <button
                    key={index}
                    onClick={() => handleAnswerSelect(index)}
                    className={`p-3 text-left rounded-lg border transition-all ${isSelected
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-4 h-4 rounded-full border-2 ${isSelected ? "border-blue-500 bg-blue-500" : "border-gray-300"
                          }`}
                      >
                        {isSelected && <div className="w-3 h-3 bg-white rounded-full" style={{ margin: "auto" }}></div>}
                      </div>
                      <span className="text-sm">{displayText}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        (
                        {option.value === 1
                          ? "1"
                          : option.value < 1
                            ? `1/${Math.round(1 / option.value)}`
                            : option.value.toString()}
                        )
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Navegación */}
          <div ref={ref4} className="flex justify-between items-center">
            <Button
              variant="outline"
              onClick={handlePreviousQuestion}
              disabled={currentQuestionIndex === 0}
              className="flex items-center gap-2 bg-transparent"
            >
              <ArrowLeft className="w-4 h-4" />
              Anterior
            </Button>

            <Button onClick={handleNextQuestion} disabled={selectedAnswer === null} className="flex items-center gap-2">
              {currentQuestionIndex === comparisons.length - 1 ? "Finalizar" : "Siguiente"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Resultados */}
      {questionsCompleted && Object.keys(weights).length > 0 && (
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

          <div ref={ref6} className="bg-background border rounded-lg p-3 sm:p-4">
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
                    <strong>Consistencia mejorable:</strong> Se detectaron {inconsistentComparisons.length}{" "}
                    comparaciones inconsistentes. Considera revisar tus respuestas para mejorar la coherencia del
                    análisis.
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
                {!isConsistent && (
                  <>
                  <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <h3 className="text-base font-semibold text-blue-800 dark:text-blue-200 mb-2">
                      Conseguiste un ratio de consistencia baja
                    </h3>
                    <div className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
                      <p>
                        Sí obtuviste un ratio de consistencia mejor al 10% podría significar que tus respuestas no fueron muy coherentes. Podría ser buena idea repetir el cuestionario si consideras que cometiste un error.
                      </p>
                    </div>
                  </div>
                  <Button ref={ref7} size="sm" onClick={handleRestart} className="min-w-[100px] bg-green-800 hover:bg-green-900 text-white">
                  Repetir cuestionario
                </Button>
                  </>
                )}
                <Button ref={ref7} size="sm" onClick={handleSave} className="min-w-[100px]">
                  {isConsistent?"Enviar pesos":"Enviar pesos igualmente"}
                </Button>

              </div>
            </div>
          </div>
        </>
      )}

      <Spinner visible={loading} />

      {/* Tour Component */}
      <Tour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={tourSteps}
        indicatorsRender={(current, total) => (
          <span className="text-sm text-gray-500">
            {current + 1} de {total}
          </span>
        )}
      />

      {/* Modal optimizado - solo renderiza el contenido cuando está abierto y hay un nodo seleccionado */}
      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={selectedNodo ? `Información del Criterio: ${selectedNodo.titulo}` : "Información del Criterio"}
        width="600px"
      >
        {selectedNodo && (
          <NodoInfo nodo={selectedNodo} />
        )}
      </Modal>
    </div>
  )
}

export default CuestionarioExpertos
