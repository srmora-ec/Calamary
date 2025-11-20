"use client"

import type React from "react"
import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import type { Nodo } from "@/types/modelo"
import { calculateAHP } from "./metodos/pesosComPares"
import { Button } from "@/components/ui/button"
import { CheckCircle2, AlertCircle, HelpCircle, ArrowLeft, ArrowRight, Lightbulb, ClipboardList } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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

// Opciones de Saaty para el lado "más importante" (de 1 a 9)
const SAATY_PREFERENCE_OPTIONS = [
  { value: 1, label: "Igual importancia", position: 0, scaleLabel: "1" },
  { value: 2, label: "Entre moderadamente y ligeramente más importante", position: -1, scaleLabel: "2" },
  { value: 3, label: "Moderadamente más importante", position: -2, scaleLabel: "3" },
  { value: 4, label: "Entre fuertemente y moderadamente más importante", position: -3, scaleLabel: "4" },
  { value: 5, label: "Fuertemente más importante", position: -4, scaleLabel: "5" },
  { value: 6, label: "Entre muy fuertemente y fuertemente más importante", position: -5, scaleLabel: "6" },
  { value: 7, label: "Muy fuertemente más importante", position: -6, scaleLabel: "7" },
  { value: 8, label: "Muy, muy fuertemente más importante", position: -7, scaleLabel: "8" },
  { value: 9, label: "Extremadamente más importante", position: -8, scaleLabel: "9" },
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

interface Recommendation {
  text: string
  direction: "node1" | "node2" | "equal"
  suggestedValue: number
  label: string
  path?: string
}

// Definición para el estado de la respuesta en 2 pasos
type PreferredCriterion = "none" | "node1" | "node2" | "equal"

// Helper para obtener la etiqueta más cercana
const getClosestSaatyLabel = (value: number): string => {
  const val = Math.abs(value)
  if (val < 1.1) return "Igual importancia"

  // Buscamos la opción con la diferencia mínima
  const closest = SAATY_PREFERENCE_OPTIONS.reduce((prev, curr) => {
    return Math.abs(curr.value - val) < Math.abs(prev.value - val) ? curr : prev
  })

  return closest.label
}

const CuestionarioExpertos: React.FC<CuestionarioExpertosProps> = ({ nodos = [], onSave }) => {
  const [comparisons, setComparisons] = useState<Comparison[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [matrix, setMatrix] = useState<Record<string, number>>({})
  const [weights, setWeights] = useState<Record<number, number>>({})
  const [consistencyRatio, setConsistencyRatio] = useState<number>(0)
  const [showResults, setShowResults] = useState(false)
  const [inconsistentComparisons, setInconsistentComparisons] = useState<InconsistentComparison[]>([])

  // Modales
  const [modalOpen, setModalOpen] = useState(false) // Modal de ayuda de nodo
  const [introModalOpen, setIntroModalOpen] = useState(true) // NUEVO: Modal de bienvenida

  const [selectedNodoId, setSelectedNodoId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [tourOpen, setTourOpen] = useState<boolean>(false)

  // NUEVOS ESTADOS para el flujo de 2 pasos y recomendaciones
  const [preferredCriterion, setPreferredCriterion] = useState<PreferredCriterion>("none")
  const [selectedPreferenceIndex, setSelectedPreferenceIndex] = useState<number | null>(null)
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null)

  const [questionsCompleted, setQuestionsCompleted] = useState(false)

  // Referencias para el tour y scroll
  const ref1 = useRef(null) // Pregunta actual
  const ref2 = useRef(null) // Criterios
  const ref3 = useRef(null) // Opciones de respuesta
  const ref4 = useRef(null) // Botón siguiente
  const ref5 = useRef(null) // Progreso
  const ref6 = useRef(null) // Resultados
  const ref7 = useRef(null) // Botón guardar
  const recommendationRef = useRef<HTMLDivElement>(null) // Referencia para el scroll de recomendación

  const selectedNodo = useMemo(() => {
    if (!selectedNodoId || !nodos || nodos.length === 0) return null
    return nodos.find((n) => n.idnodo === selectedNodoId) || null
  }, [selectedNodoId, nodos])

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

  // Inicialización de la matriz
  useEffect(() => {
    setComparisons(memoizedComparisons)

    if (!nodos || nodos.length === 0) {
      setMatrix({})
      return
    }

    setMatrix((prevMatrix) => {
      if (Object.keys(prevMatrix).length > 0) return prevMatrix

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
      return initialMatrix
    })
  }, [memoizedComparisons, nodos])

  const getMatrixValue = useCallback(
    (nodeId1: number, nodeId2: number, currentMatrix?: Record<string, number>): number => {
      const m = currentMatrix || matrix
      if (nodeId1 === nodeId2) return 1

      const key1 = `${nodeId1}-${nodeId2}`
      const key2 = `${nodeId2}-${nodeId1}`

      if (m[key1] !== undefined) {
        return m[key1]
      } else if (m[key2] !== undefined) {
        return 1 / m[key2]
      }

      return 1
    },
    [matrix],
  )

  // --- LÓGICA DE RECOMENDACIÓN ACTUALIZADA (SOPORTA IGUALDADES) ---
  const generateRecommendation = useCallback(() => {
    if (!comparisons[currentQuestionIndex]) {
      setRecommendation(null)
      return
    }

    const { nodeId1, nodeId2, node1Title, node2Title } = comparisons[currentQuestionIndex]

    let accumulatedValue = 0
    let pathFound = false
    let bestPathDescription = ""

    // Buscamos un "pivote" o nodo intermedio K
    for (const nodoK of nodos) {
      const kId = nodoK.idnodo
      if (kId === nodeId1 || kId === nodeId2) continue

      // Verificar valores A->K y K->B
      const valA_K = getMatrixValue(nodeId1, kId)
      const valK_B = getMatrixValue(kId, nodeId2)

      // Calculamos la transitividad matemática: A->B = (A->K) * (K->B)
      // Ejemplo: Si A=K (1) y K>B (5), entonces A>B (1*5 = 5).
      const impliedValue = valA_K * valK_B

      // CRITERIO DE FILTRADO:
      // Recomendamos solo si el valor resultante implica una preferencia clara (desviación de la neutralidad 1).
      // Esto filtra automáticamente el caso donde ambos son 1 (1*1=1) o valores que se cancelan (3 * 0.33 = 1).
      // Pero permite casos como 1 * 5 = 5.
      const isSignificant = Math.abs(impliedValue - 1) > 0.2

      if (isSignificant) {
        accumulatedValue = impliedValue

        // Generar explicación del camino manejando desigualdades e igualdades
        let rel1 = ""
        if (valA_K > 1.1) rel1 = `${node1Title} > ${nodoK.titulo}`
        else if (valA_K < 0.9) rel1 = `${nodoK.titulo} > ${node1Title}`
        else rel1 = `${node1Title} ≈ ${nodoK.titulo}` // Usamos aproximado para igualdades

        let rel2 = ""
        if (valK_B > 1.1) rel2 = `${nodoK.titulo} > ${node2Title}`
        else if (valK_B < 0.9) rel2 = `${node2Title} > ${nodoK.titulo}`
        else rel2 = `${nodoK.titulo} ≈ ${node2Title}`

        bestPathDescription = `(Deducido de: ${rel1} y ${rel2})`
        pathFound = true
        break // Nos quedamos con el primer camino lógico encontrado
      }
    }

    if (pathFound) {
      let direction: "node1" | "node2" | "equal" = "equal"
      let text = ""
      let suggestedVal = 1
      let saatyLabel = "Igual importancia"

      if (accumulatedValue > 1.1) {
        direction = "node1"
        suggestedVal = Math.min(accumulatedValue, 9)
        saatyLabel = getClosestSaatyLabel(suggestedVal)
        text = `Para mantener la consistencia lógica, se sugiere que ${node1Title} sea valorado como "${saatyLabel}" respecto a ${node2Title}.`
      } else if (accumulatedValue < 0.9) {
        direction = "node2"
        suggestedVal = Math.min(1 / accumulatedValue, 9)
        saatyLabel = getClosestSaatyLabel(suggestedVal)
        text = `Para mantener la consistencia lógica, se sugiere que ${node2Title} sea valorado como "${saatyLabel}" respecto a ${node1Title}.`
      }

      setRecommendation({
        direction,
        text,
        suggestedValue: suggestedVal,
        label: saatyLabel,
        path: bestPathDescription
      })
    } else {
      setRecommendation(null)
    }

  }, [comparisons, currentQuestionIndex, nodos, getMatrixValue])

  useEffect(() => {
    generateRecommendation()
  }, [currentQuestionIndex, generateRecommendation])

  // Scroll automático a la recomendación
  useEffect(() => {
    if (recommendation && recommendationRef.current) {
      setTimeout(() => {
        recommendationRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      }, 300)
    }
  }, [currentQuestionIndex, recommendation])

  // Cargar respuesta anterior
  useEffect(() => {
    if (comparisons.length > 0 && currentQuestionIndex < comparisons.length) {
      const currentComparison = comparisons[currentQuestionIndex]
      const key = `${currentComparison.nodeId1}-${currentComparison.nodeId2}`
      const existingValue = matrix[key]

      if (existingValue === undefined || existingValue === 1) {
        setSelectedPreferenceIndex(0)
        setPreferredCriterion("equal")
      } else {
        const optionIndex = SAATY_PREFERENCE_OPTIONS.findIndex((option) => Math.abs(option.value - existingValue) < 0.001)

        if (optionIndex !== -1) {
          setSelectedPreferenceIndex(optionIndex)
          setPreferredCriterion("node1")
        } else {
          const reverseValue = 1 / existingValue
          const reverseOptionIndex = SAATY_PREFERENCE_OPTIONS.findIndex(
            (option) => Math.abs(option.value - reverseValue) < 0.001,
          )

          if (reverseOptionIndex !== -1) {
            setSelectedPreferenceIndex(reverseOptionIndex)
            setPreferredCriterion("node2")
          } else {
            setSelectedPreferenceIndex(null)
            setPreferredCriterion("none")
          }
        }
      }
    } else {
      setSelectedPreferenceIndex(null)
      setPreferredCriterion("none")
    }
  }, [currentQuestionIndex, comparisons, matrix])

  // Configuración del tour
  const tourSteps: TourProps["steps"] = [
    {
      title: "Pregunta actual",
      description:
        "Aquí se muestra la pregunta actual que compara dos criterios. Lee cuidadosamente ambos criterios antes de responder.",
      target: () => ref1.current,
    },
    {
      title: "Recomendación Inteligente",
      description: "Si existen datos suficientes y claros, aparecerá aquí una sugerencia para mantener la coherencia.",
      target: () => document.getElementById('recommendation-box'),
    },
    {
      title: "Criterios a comparar",
      description:
        "Haz clic en el criterio que consideres más importante.",
      target: () => ref2.current,
    },
    {
      title: "Grado de preferencia",
      description:
        "Indica qué tan importante es el criterio seleccionado (escala 1-9).",
      target: () => ref3.current,
    },
    {
      title: "Navegación",
      description: "Botones para avanzar o retroceder.",
      target: () => ref4.current,
    },
    {
      title: "Progreso",
      description: "Barra de progreso.",
      target: () => ref5.current,
    },
    {
      title: "Resultados",
      description:
        "Aquí aparecerán los resultados finales.",
      target: () => ref6.current,
    },
    {
      title: "Guardar",
      description: "Guarda tus resultados cuando estés satisfecho.",
      target: () => ref7.current,
    },
  ]

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

  const handleCriterionSelect = useCallback((criterion: PreferredCriterion) => {
    setPreferredCriterion(criterion)
    setSelectedPreferenceIndex(null)

    if (criterion === "equal") {
      handlePreferenceSelect(0)
    }
  }, [])

  const handlePreferenceSelect = useCallback(
    (optionIndex: number) => {
      setSelectedPreferenceIndex(optionIndex)

      if (comparisons.length > 0 && currentQuestionIndex < comparisons.length) {
        const currentComparison = comparisons[currentQuestionIndex]
        const baseValue = SAATY_PREFERENCE_OPTIONS[optionIndex].value

        let matrixValue: number

        if (preferredCriterion === "node1" || preferredCriterion === "equal") {
          matrixValue = baseValue
        } else if (preferredCriterion === "node2") {
          matrixValue = 1 / baseValue
        } else {
          matrixValue = 1
        }

        const key = `${currentComparison.nodeId1}-${currentComparison.nodeId2}`
        setMatrix((prev) => ({
          ...prev,
          [key]: matrixValue,
        }))
      }
    },
    [comparisons, currentQuestionIndex, preferredCriterion],
  )

  const handleNextQuestion = useCallback(() => {
    if (selectedPreferenceIndex === null) return

    if (currentQuestionIndex < comparisons.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1)
      setPreferredCriterion("none")
      setSelectedPreferenceIndex(null)
    } else {
      setQuestionsCompleted(true)
      calcularPesos()
    }
  }, [currentQuestionIndex, comparisons.length, selectedPreferenceIndex, calcularPesos])

  const handlePreviousQuestion = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1)
    }
  }, [currentQuestionIndex])

  const handleRestart = useCallback(() => {
    setCurrentQuestionIndex(0)
    setPreferredCriterion("none")
    setSelectedPreferenceIndex(null)
    setQuestionsCompleted(false)
    setWeights({})
    setConsistencyRatio(0)
    setInconsistentComparisons([])
    setShowResults(false)
    setRecommendation(null)
    setIntroModalOpen(true) // Volver a mostrar intro si reinicia

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

  const isNextDisabled = useMemo(() => {
    return selectedPreferenceIndex === null
  }, [selectedPreferenceIndex])

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

      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="text-base font-semibold text-blue-800 dark:text-blue-200 mb-2">
          Cuestionario de Comparación por Pares
        </h3>
        <div className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
          <p>
            Este cuestionario te ayudará a determinar la importancia relativa de cada criterio.
          </p>
          <p>
            <strong>Instrucciones:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>**Paso 1:** Selecciona qué criterio es más importante (o si son iguales).</li>
            <li>**Paso 2:** Indica el grado de importancia del criterio seleccionado.</li>
            <li>El sistema te sugerirá respuestas basadas en tus elecciones anteriores para mantener coherencia.</li>
          </ul>
        </div>
      </div>

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

      {!questionsCompleted && currentComparison && (
        <div className="bg-background border rounded-lg p-6">
          <div ref={ref1} className="text-center mb-2">
            <h2 className="text-lg font-semibold mb-2">
              Pregunta {currentQuestionIndex + 1} de {comparisons.length}
            </h2>
            <p className="text-base text-muted-foreground">
              ¿Qué criterio te parece más importante a considerar entre <strong>{currentComparison.node1Title}</strong>{" "}
              y <strong>{currentComparison.node2Title}</strong>?
            </p>
          </div>

          {/* SECCIÓN DE RECOMENDACIÓN */}
          {recommendation && (
            <div
              id="recommendation-box"
              ref={recommendationRef}
              className="mb-6 mt-4 max-w-2xl mx-auto scroll-mt-20 transition-all duration-500"
            >
              <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800 shadow-sm">
                <Lightbulb className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <AlertTitle className="text-amber-800 dark:text-amber-300 ml-2">Sugerencia de Consistencia</AlertTitle>
                <AlertDescription className="text-amber-700 dark:text-amber-400 ml-2 text-sm">
                  <p className="mb-2 leading-relaxed">{recommendation.text}</p>
                  <p className="text-xs font-medium opacity-80 italic">{recommendation.path}</p>
                </AlertDescription>
              </Alert>
            </div>
          )}

          <h3 className="text-center text-md font-semibold mb-4 text-blue-600 dark:text-blue-400 mt-6">
            PASO 1: Elige el criterio más importante
          </h3>

          <div ref={ref2} className="flex flex-col md:flex-row items-center justify-center gap-4 mb-6">
            <button
              className={`flex-1 max-w-sm p-4 rounded-lg border-2 transition-all duration-200 text-left ${preferredCriterion === "node1"
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950 shadow-md"
                  : "border-gray-200 hover:border-blue-300 dark:border-gray-700 dark:hover:border-blue-700"
                }`}
              onClick={() => handleCriterionSelect("node1")}
            >
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <h3 className="font-medium text-lg text-blue-700 dark:text-blue-300">
                    {currentComparison.node1Title}
                  </h3>
                  {currentNodo1?.descripcion && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{currentNodo1.descripcion}</p>
                  )}
                </div>
                {currentNodo1 && <HelpButton onClick={() => handleHelpClick(currentNodo1.idnodo)} />}
              </div>
            </button>

            <button
              className={`px-4 py-2 border rounded-full transition-all duration-200 text-sm font-medium ${preferredCriterion === "equal"
                  ? "bg-gray-200 dark:bg-gray-700 border-gray-500 text-gray-800 dark:text-gray-200 shadow-inner"
                  : "bg-transparent border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
                }`}
              onClick={() => handleCriterionSelect("equal")}
            >
              IGUAL IMPORTANCIA
            </button>

            <button
              className={`flex-1 max-w-sm p-4 rounded-lg border-2 transition-all duration-200 text-left ${preferredCriterion === "node2"
                  ? "border-green-500 bg-green-50 dark:bg-green-950 shadow-md"
                  : "border-gray-200 hover:border-green-300 dark:border-gray-700 dark:hover:border-green-700"
                }`}
              onClick={() => handleCriterionSelect("node2")}
            >
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <h3 className="font-medium text-lg text-green-700 dark:text-green-300">
                    {currentComparison.node2Title}
                  </h3>
                  {currentNodo2?.descripcion && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">{currentNodo2.descripcion}</p>
                  )}
                </div>
                {currentNodo2 && <HelpButton onClick={() => handleHelpClick(currentNodo2.idnodo)} />}
              </div>
            </button>
          </div>

          {preferredCriterion !== "none" && preferredCriterion !== "equal" && (
            <div ref={ref3} className="space-y-2 mb-6 border-t pt-4">
              <h3 className="text-center text-md font-semibold mb-4 text-blue-600 dark:text-blue-400">
                PASO 2: ¿Qué tan importante es **
                {preferredCriterion === "node1" ? currentComparison.node1Title : currentComparison.node2Title}** sobre
                el otro?
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {SAATY_PREFERENCE_OPTIONS.slice(1).map((option, index) => {
                  const optionIndexInFullArray = index + 1
                  const isSelected = selectedPreferenceIndex === optionIndexInFullArray
                  const displayIndex = optionIndexInFullArray

                  return (
                    <button
                      key={displayIndex}
                      onClick={() => handlePreferenceSelect(displayIndex)}
                      className={`p-3 text-center rounded-lg border-2 transition-all duration-200 ${isSelected
                          ? "border-blue-600 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 shadow-lg scale-105"
                          : "border-gray-200 hover:border-blue-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                        }`}
                    >
                      <div className="text-lg font-medium">{option.label.replace("más importante", "")}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {preferredCriterion === "equal" && (
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
              <p className="text-center text-green-700 dark:text-green-300 font-semibold">
                Sí consideras que ambos criterios son de **Igual Importancia** selecciona siguiente. Si crees que uno es más importante seleccionalo.
              </p>
            </div>
          )}

          <div ref={ref4} className="flex justify-between items-center border-t pt-4">
            <Button
              variant="outline"
              onClick={handlePreviousQuestion}
              disabled={currentQuestionIndex === 0}
              className="flex items-center gap-2 bg-transparent"
            >
              <ArrowLeft className="w-4 h-4" />
              Anterior
            </Button>

            <Button onClick={handleNextQuestion} disabled={isNextDisabled} className="flex items-center gap-2">
              {currentQuestionIndex === comparisons.length - 1 ? "Finalizar" : "Siguiente"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

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
                          Si obtuviste un ratio de consistencia mayor al 10% podría significar que tus respuestas no
                          fueron muy coherentes. Podría ser buena idea repetir el cuestionario si consideras que
                          cometiste un error.
                        </p>
                      </div>
                    </div>
                    <Button
                      ref={ref7}
                      size="sm"
                      onClick={handleRestart}
                      className="min-w-[100px] bg-green-800 hover:bg-green-900 text-white"
                    >
                      Repetir cuestionario
                    </Button>
                  </>
                )}
                <Button ref={ref7} size="sm" onClick={handleSave} className="min-w-[100px]">
                  {isConsistent ? "Enviar pesos" : "Enviar pesos igualmente"}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      <Spinner visible={loading} />

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

      {/* Modal de Información de Nodo (Ayuda) */}
      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={selectedNodo ? `Información del Criterio: ${selectedNodo.titulo}` : "Información del Criterio"}
        width="600px"
      >
        {selectedNodo && <NodoInfo nodo={selectedNodo} />}
      </Modal>

      {/* NUEVO: Modal de Bienvenida / Introducción */}
      <Modal
        isOpen={introModalOpen}
        onClose={() => setIntroModalOpen(false)}
        title="Bienvenido al Panel de Expertos"
        width="650px"
      >
        <div className="space-y-5 text-sm md:text-base text-gray-700 dark:text-gray-300">
          <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-950/40 p-4 rounded-lg border border-blue-100 dark:border-blue-900">
            <ClipboardList className="w-6 h-6 text-blue-600 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-1">Su rol es fundamental</h4>
              <p>Ha sido seleccionado por su experiencia y conocimiento técnico para colaborar en la construcción de este modelo de decisión multicriterio.</p>
            </div>
          </div>
          <br />
          <div className="space-y-2">
            <p>
              <strong>¿Qué debe hacer?</strong>
            </p>
            <p>
              Su tarea consiste en realizar una serie de <strong>comparaciones por pares</strong> entre distintos criterios. No existen respuestas correctas o incorrectas; buscamos capturar su juicio profesional sobre qué aspectos tienen mayor importancia relativo en el contexto del problema.
            </p>
          </div>

          <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-xs md:text-sm">
            <p className="font-medium mb-1">Instrucciones rápidas:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Seleccione el criterio que considere más relevante entre los dos presentados.</li>
              <li>Indique la intensidad de esa preferencia (desde "Igual" hasta "Extremadamente más importante").</li>
              <li>El sistema le avisará si sus respuestas muestran inconsistencias lógicas.</li>
            </ul>
          </div>

          <div className="flex justify-end pt-2">
            <Button className="flex items-center gap-2 cursor-pointer" onClick={() => setIntroModalOpen(false)}>
              Comenzar Encuesta
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default CuestionarioExpertos