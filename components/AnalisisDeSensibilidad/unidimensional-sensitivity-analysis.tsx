"use client"

import { useState } from "react"
import { Select, Button, message, Spin, Card } from "antd"
import type { Nodo } from "@/types/modelo"

interface SensitivityResponse {
    criterion_id: string
    criterion_name: string
    initial_local_weight: number
    initial_global_weight: number
    initial_best_alternative: number
    stability_local_interval: [number, number]
    is_parent_criterion: boolean
}

interface UnidimensionalSensitivityProps {
    alternativas: any[]
    criterios: Nodo[]
    tipos: string[]
    metodoNombre: string
    hierarchy: Nodo[]
    matrix: number[][]
}

function buildNestedHierarchy(nodes: Nodo[]) {
    const nodeMap = new Map<number, any>()

    // Create nodes with children array
    nodes.forEach((node) => {
        nodeMap.set(node.idnodo, {
            id: node.idnodo.toString(),
            name: node.titulo,
            local_weight: node.peso || 0,
            global_weight: node.pesofinal || 0,
            children: [],
            column_index: undefined,
        })
    })

    // Build parent-child relationships
    const rootNodes: any[] = []
    nodes.forEach((node, index) => {
        const mappedNode = nodeMap.get(node.idnodo)
        if (node.idpadre === null) {
            rootNodes.push(mappedNode)
        } else {
            const parent = nodeMap.get(node.idpadre)
            if (parent) {
                if (!mappedNode.column_index) {
                    mappedNode.column_index = index
                }
                parent.children.push(mappedNode)
            }
        }
    })

    return rootNodes
}

export default function UnidimensionalSensitivityAnalysis({
    alternativas,
    criterios,
    tipos,
    metodoNombre,
    hierarchy,
    matrix,
}: UnidimensionalSensitivityProps) {
    const [selectedCriterion, setSelectedCriterion] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<SensitivityResponse | null>(null)

    const handleAnalyze = async () => {
        if (!selectedCriterion) {
            message.warning("Por favor selecciona un criterio")
            return
        }

        setLoading(true)
        try {
            const nestedHierarchy = buildNestedHierarchy(hierarchy)
            console.log("alternativas", alternativas)
            const payload = {
                matrix,
                hierarchy: nestedHierarchy,
                tipos,
                criterion_id: selectedCriterion,
                step_size: 0.01,
            }

            console.log("[v0] Enviando payload a API:", JSON.stringify(payload, null, 2))

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_URLFASTCALAMARY}/run-sensitivity/${metodoNombre}/local-unidimensional`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                },
            )

            if (!response.ok) {
                const errorText = await response.text()
                console.error("[v0] Error en respuesta API:", {
                    status: response.status,
                    statusText: response.statusText,
                    body: errorText,
                })
                throw new Error(`Error ${response.status}: ${errorText || "Error desconocido en la API de sensibilidad"}`)
            }

            const data: SensitivityResponse = await response.json()
            console.log("[v0] Respuesta exitosa de API:", data)
            setResult(data)
            message.success("Análisis de sensibilidad completado")
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Error desconocido"
            console.error("[v0] Error completo en análisis de sensibilidad:", {
                message: errorMessage,
                error,
                stack: error instanceof Error ? error.stack : undefined,
            })
            message.error(`Error: ${errorMessage}`)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            <Card>
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
                    <Button type="primary" onClick={handleAnalyze} loading={loading} disabled={!selectedCriterion} block>
                        Ejecutar Análisis
                    </Button>
                </div>
            </Card>

            {loading && (
                <div className="flex justify-center p-8">
                    <Spin size="large" />
                </div>
            )}

            {result && !loading && (
                <Card>
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-blue-50 p-4 rounded-lg">
                                <p className="text-sm text-gray-600">Criterio</p>
                                <p className="text-xl font-bold">{result.criterion_name}</p>
                            </div>
                            <div className="bg-blue-50 p-4 rounded-lg">
                                <p className="text-sm text-gray-600">Mejor Alternativa Inicial</p>
                                <p className="text-xl font-bold">
                                    {(() => {
                                        const bestIndex = result.initial_best_alternative
                                        const bestAlt = alternativas?.[bestIndex-1]
                                        return bestAlt ? bestAlt.nombre : `Alternativa ${bestIndex}`
                                    })()}
                                </p>
                            </div>
                            <div className="bg-green-50 p-4 rounded-lg">
                                <p className="text-sm text-gray-600">Peso Local Actual</p>
                                <p className="text-xl font-bold">{(result.initial_local_weight * 100).toFixed(2)}%</p>
                            </div>
                            <div className="bg-green-50 p-4 rounded-lg">
                                <p className="text-sm text-gray-600">Peso Global Actual</p>
                                <p className="text-xl font-bold">{(result.initial_global_weight * 100).toFixed(2)}%</p>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-6 rounded-lg">
                            <h3 className="font-semibold mb-4">Rango de Estabilidad del Peso</h3>
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
                                        <p className="text-gray-600">Mínimo</p>
                                        <p className="text-blue-600 font-bold">{(result.stability_local_interval[0] * 100).toFixed(2)}%</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-gray-600">Actual</p>
                                        <p className="text-red-600 font-bold">{(result.initial_local_weight * 100).toFixed(2)}%</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-gray-600">Máximo</p>
                                        <p className="text-blue-600 font-bold">{(result.stability_local_interval[1] * 100).toFixed(2)}%</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-blue-50 p-4 rounded-lg text-sm text-gray-700">
                            <p className="font-semibold mb-2">Interpretación:</p>
                            <p>
                                La mejor alternativa (Alternativa {result.initial_best_alternative}) se mantiene como la mejor cuando el
                                peso del criterio "{result.criterion_name}" varía entre{" "}
                                <span className="font-bold">{(result.stability_local_interval[0] * 100).toFixed(2)}%</span> y{" "}
                                <span className="font-bold">{(result.stability_local_interval[1] * 100).toFixed(2)}%</span>. El peso
                                actual es <span className="font-bold">{(result.initial_local_weight * 100).toFixed(2)}%</span>.
                            </p>
                        </div>
                    </div>
                </Card>
            )}
        </div>
    )
}
