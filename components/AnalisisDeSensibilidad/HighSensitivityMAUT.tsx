"use client"

import { useState } from "react"
import { Select, Button, message, Spin, Card, Tag } from "antd"
import { Nodo } from "@/types/modelo"

// INTERFAZ ADAPTADA para el endpoint /maut/sensitivity/hight-unidimensional
interface SensitivityMAUTResponse {
    criterion_id: string
    criterion_name: string
    initial_local_weight: number
    // La respuesta de alta sensibilidad MAUT devuelve el ranking completo, no solo la mejor alternativa ni el peso global
    initial_ranking: number[] // <--- Cambio: Ranking completo (índice de alternativa + 1)
    stability_local_interval: [number, number]
    is_parent_criterion: boolean
}

interface UnidimensionalSensitivityMAUTProps {
    alternativas: any[]
    criterios: Nodo[]
    metodoNombre: string
    hierarchy: Nodo[]
    matrixNormMin: number[][]
    matrixNormPromedioMin: number[][]
    matrixNormPromedioMax: number[][]
    matrixNormMax: number[][]
}

// Función auxiliar para construir la jerarquía anidada para el backend
function buildNestedHierarchy(nodes: Nodo[]) {
    const nodeMap = new Map<number, any>()

    // Fase 1: Crear nodos planos
    nodes.forEach((node, index) => {
        // Usamos el ID del nodo como string para el backend (coherente con el payload)
        const mappedNode = {
            id: node.idnodo.toString(), 
            name: node.titulo,
            local_weight: node.peso || 0,
            global_weight: node.pesofinal || 0,
            children: [],
            // El column_index es crucial solo para los nodos hoja para mapear a la matriz de criterios
            column_index: node.criterioFinal ? index : undefined, 
        }
        nodeMap.set(node.idnodo, mappedNode)
    })

    // Fase 2: Construir relaciones padre-hijo
    const rootNodes: any[] = []
    nodes.forEach((node, index) => {
        const mappedNode = nodeMap.get(node.idnodo)
        if (node.idpadre === null || node.idpadre === undefined) {
            rootNodes.push(mappedNode)
        } else {
            const parent = nodeMap.get(node.idpadre)
            if (parent) {
                // Aseguramos que los nodos hoja tengan su índice de columna si son necesarios
                if (mappedNode.column_index === undefined && node.criterioFinal) {
                    // Esto asume que la lista `criterios` (o `hierarchy`) está ordenada por column_index
                    // En este contexto, el índice `index` puede ser un proxy si la lista es plana y ordenada.
                    mappedNode.column_index = index; 
                }
                parent.children.push(mappedNode)
            }
        }
    })
    
    return rootNodes
}


export default function HighSensitivityMAUT({
    alternativas,
    criterios,
    metodoNombre,
    hierarchy,
    matrixNormMin,
    matrixNormPromedioMin,
    matrixNormPromedioMax,
    matrixNormMax,
}: UnidimensionalSensitivityMAUTProps) {
    const [selectedCriterion, setSelectedCriterion] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<SensitivityMAUTResponse | null>(null)

    // Función auxiliar para obtener el nombre de la alternativa por su índice + 1
    const getAltName = (indexPlusOne: number): string => {
        const alt = alternativas?.[indexPlusOne - 1]
        return alt ? alt.nombre : `Alternativa ${indexPlusOne}`
    }

    const handleAnalyze = async () => {
        if (!selectedCriterion) {
            message.warning("Por favor selecciona un criterio")
            return
        }

        setLoading(true)
        try {
            // Construir la jerarquía anidada con pesos locales y globales
            const nestedHierarchy = buildNestedHierarchy(hierarchy)
            
            const payload = {
                matrix_norm_min: matrixNormMin,
                matrix_norm_promedio_min: matrixNormPromedioMin,
                matrix_norm_promedio_max: matrixNormPromedioMax,
                matrix_norm_max: matrixNormMax,
                hierarchy: nestedHierarchy, // Jerarquía con pesos para la redistribución
                criterion_id: selectedCriterion, // ID del criterio a variar
                step_size: 0.01,
            }

            console.log("[MAUT High Sensitivity] Enviando payload a API:", JSON.stringify(payload, null, 2))

            const response = await fetch(
                // Llamada al endpoint de Alta Sensibilidad MAUT
                `${process.env.NEXT_PUBLIC_URLFASTCALAMARY}/maut/sensitivity/hight-unidimensional`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                },
            )

            if (!response.ok) {
                const errorText = await response.text()
                console.error("[MAUT High Sensitivity] Error en respuesta API:", {
                    status: response.status,
                    statusText: response.statusText,
                    body: errorText,
                })
                throw new Error(`Error ${response.status}: ${errorText || "Error desconocido en la API de sensibilidad MAUT"}`)
            }

            // La respuesta se mapea a la interfaz de High Sensitivity (que incluye initial_ranking)
            const data: SensitivityMAUTResponse = await response.json()
            console.log("[MAUT High Sensitivity] Respuesta exitosa de API:", data)
            setResult(data)
            message.success("Análisis de sensibilidad MAUT (Ranking Completo) completado")
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Error desconocido"
            console.error("[MAUT High Sensitivity] Error completo:", {
                message: errorMessage,
                error,
                stack: error instanceof Error ? error.stack : undefined,
            })
            message.error(`Error: ${errorMessage}`)
        } finally {
            setLoading(false)
        }
    }

    // Calculamos el peso global del criterio seleccionado para mostrarlo,
    // ya que la API solo devuelve el peso local en el resultado final de High Sensitivity.
    const getInitialGlobalWeight = () => {
        if (!selectedCriterion || !hierarchy) return 0;
        
        const targetNode = hierarchy.find(n => n.idnodo.toString() === selectedCriterion);
        return targetNode?.pesofinal || 0;
    }

    return (
        <div className="space-y-6">
            <Card title="Análisis de Sensibilidad MAUT (Ranking Completo)">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Selecciona el criterio a analizar</label>
                        <Select
                            className="w-full"
                            placeholder="Elige un criterio..."
                            value={selectedCriterion}
                            onChange={setSelectedCriterion}
                            options={criterios.map((c) => ({
                                label: c.titulo,
                                value: c.idnodo.toString(),
                            }))}
                        />
                    </div>
                    <Button 
                        type="primary" 
                        onClick={handleAnalyze} 
                        loading={loading} 
                        disabled={!selectedCriterion} 
                        block
                    >
                        Ejecutar Análisis (Alta Sensibilidad)
                    </Button>
                    <p className="text-xs text-gray-500 mt-2">
                        *El análisis de Alta Sensibilidad determina el rango donde **ninguna alternativa cambia de posición** en el ranking.
                    </p>
                </div>
            </Card>

            {loading && (
                <div className="flex justify-center p-8">
                    <Spin size="large" />
                </div>
            )}

            {result && !loading && (
                <Card title={`Resultados del Análisis: ${result.criterion_name}`}>
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            
                            {/* Criterio */}
                            <div className="bg-blue-50 p-4 rounded-lg">
                                <p className="text-sm text-gray-600">Criterio Variado</p>
                                <p className="text-xl font-bold">{result.criterion_name}</p>
                            </div>
                            
                            {/* Ranking Inicial */}
                            <div className="bg-purple-50 p-4 rounded-lg col-span-2 lg:col-span-1">
                                <p className="text-sm text-gray-600">Ranking Inicial (Top 3)</p>
                                <div className="text-xl font-bold space-y-1">
                                    {result.initial_ranking.slice(0, 3).map((altIndex, i) => (
                                        <div key={i} className="flex items-center">
                                            <Tag color={i === 0 ? "gold" : (i === 1 ? "silver" : "gray")} className="mr-2">
                                                {i + 1}°
                                            </Tag>
                                            <span className="text-base">{getAltName(altIndex)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Peso Local Actual */}
                            <div className="bg-green-50 p-4 rounded-lg">
                                <p className="text-sm text-gray-600">Peso Local Actual</p>
                                <p className="text-xl font-bold">{(result.initial_local_weight * 100).toFixed(2)}%</p>
                            </div>
                            
                            {/* Peso Global Actual (Calculado en el front ya que la API MAUT High Sens no lo devuelve) */}
                            <div className="bg-green-50 p-4 rounded-lg">
                                <p className="text-sm text-gray-600">Peso Global Actual</p>
                                <p className="text-xl font-bold">{(getInitialGlobalWeight() * 100).toFixed(2)}%</p>
                            </div>
                        </div>

                        {/* Visualización del Rango de Estabilidad */}
                        <div className="bg-gray-50 p-6 rounded-lg">
                            <h3 className="font-semibold mb-4">Rango de Estabilidad del Ranking (Peso Local)</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs text-gray-600 mb-2">
                                    <span>0.0</span>
                                    <span>0.25</span>
                                    <span>0.50</span>
                                    <span>0.75</span>
                                    <span>1.0</span>
                                </div>

                                <div className="relative h-8 bg-gray-200 rounded-full overflow-hidden">
                                    {/* Barra de rango estable (azul) */}
                                    <div
                                        className="absolute h-full bg-blue-500 transition-all"
                                        style={{
                                            left: `${result.stability_local_interval[0] * 100}%`,
                                            right: `${100 - result.stability_local_interval[1] * 100}%`,
                                        }}
                                    />

                                    {/* Indicador del peso actual (rojo) */}
                                    <div
                                        className="absolute top-1/2 w-1 h-10 bg-red-600 transform -translate-y-1/2 -translate-x-1/2"
                                        style={{
                                            left: `${result.initial_local_weight * 100}%`,
                                        }}
                                        title={`Peso actual: ${(result.initial_local_weight * 100).toFixed(2)}%`}
                                    />
                                </div>

                                <div className="flex justify-between text-sm font-medium mt-4">
                                    <div className="text-center">
                                        <p className="text-gray-600">Mínimo Estable</p>
                                        <p className="text-blue-600 font-bold">{(result.stability_local_interval[0] * 100).toFixed(2)}%</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-gray-600">Actual</p>
                                        <p className="text-red-600 font-bold">{(result.initial_local_weight * 100).toFixed(2)}%</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-gray-600">Máximo Estable</p>
                                        <p className="text-blue-600 font-bold">{(result.stability_local_interval[1] * 100).toFixed(2)}%</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-purple-50 p-4 rounded-lg text-sm text-gray-700 border border-purple-200">
                            <p className="font-semibold mb-2 flex items-center gap-2">
                                <span className="text-purple-600">🎯</span> Interpretación (Alta Sensibilidad MAUT):
                            </p>
                            <p>
                                El **ranking completo** de alternativas se mantiene sin cambios cuando el
                                peso local del criterio **"{result.criterion_name}"** varía entre{" "}
                                <span className="font-bold text-purple-600">{(result.stability_local_interval[0] * 100).toFixed(2)}%</span> y{" "}
                                <span className="font-bold text-purple-600">{(result.stability_local_interval[1] * 100).toFixed(2)}%</span>.
                            </p>
                            <p className="mt-2 text-xs text-purple-600">
                                Este análisis utiliza la sensibilidad estricta, detectando cualquier cambio de posición en la clasificación, y considera los rangos de incertidumbre (min-max) de los datos de entrada MAUT.
                            </p>
                        </div>
                    </div>
                </Card>
            )}
        </div>
    )
}