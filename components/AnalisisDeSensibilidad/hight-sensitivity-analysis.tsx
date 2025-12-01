"use client"

import { useState } from "react"
import { Select, Button, message, Spin, Card, Tag } from "antd"
import { Nodo } from "@/types/modelo"
import { useTranslation } from "react-i18next"
import { useNotification } from "../NotificationProvider"
// import type { Nodo } from "@/types/modelo" 
// import SensitivityChart from "./sensitivychart"



// INTERFAZ ACTUALIZADA para el endpoint /hight-unidimensional
interface SensitivityResponse {
    criterion_id: string
    criterion_name: string
    initial_local_weight: number
    initial_global_weight: number
    initial_ranking: number[] // Cambio: Ahora es el ranking completo (índices de alternativa + 1)
    stability_local_interval: [number, number]
    is_parent_criterion: boolean
}

interface HightSensitivityProps {
    alternativas: any[]
    criterios: Nodo[]
    tipos: string[]
    metodoNombre: string
    hierarchy: Nodo[]
    matrix: number[][]
}

// Función auxiliar para construir la jerarquía anidada para el backend
function buildNestedHierarchy(nodes: Nodo[]) {
    const nodeMap = new Map<number, any>()

    // Fase 1: Crear nodos planos
    nodes.forEach((node, index) => {
        nodeMap.set(node.idnodo, {
            id: node.idnodo.toString(),
            name: node.titulo,
            local_weight: node.peso || 0,
            global_weight: node.pesofinal || 0,
            children: [],
            // Solo las hojas necesitan column_index para el cálculo. Lo incluimos para todos para simplicidad.
            column_index: node.criterioFinal ? index : undefined,
        })
    })

    // Fase 2: Construir relaciones padre-hijo
    const rootNodes: any[] = []
    nodes.forEach((node) => {
        const mappedNode = nodeMap.get(node.idnodo)
        // Usamos el idpadre para determinar si es un nodo raíz
        if (node.idpadre === null) {
            rootNodes.push(mappedNode)
        } else {
            const parent = nodeMap.get(node.idpadre)
            if (parent) {
                parent.children.push(mappedNode)
            }
        }
    })

    // Asegurar qur la jerarquía refleje correctamente la estructura si los IDs son complejos
    // Para simplificar, asumimos que los IDs de los nodos en la matriz coinciden con los de la jerarquía.
    return rootNodes
}

// Componente principal
export default function HightSensitivityAnalysis({
    alternativas,
    criterios,
    tipos,
    metodoNombre,
    hierarchy,
    matrix,
}: HightSensitivityProps) {
    const [selectedCriterion, setSelectedCriterion] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<SensitivityResponse | null>(null)
    const { t } = useTranslation();
    const { notify } = useNotification();

    const handleAnalyze = async () => {
        if (!selectedCriterion) {
            return
        }

        setLoading(true)
        try {
            // Se debe obtener la jerarquía que contiene todos los nodos (padres e hijos) para el payload
            const nestedHierarchy = buildNestedHierarchy(hierarchy)

            const payload = {
                matrix,
                hierarchy: nestedHierarchy, // Jerarquía anidada AHP
                tipos,
                criterion_id: selectedCriterion, // ID del criterio a variar
                step_size: 0.01,
            }

            // Llama al nuevo endpoint /hight-unidimensional
            const response = await fetch(
                // Nota: Usando el endpoint /hight-unidimensional
                `${process.env.NEXT_PUBLIC_URLFASTCALAMARY}/run-sensitivity/${metodoNombre}/hight-unidimensional`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                },
            )

            if (!response.ok) {
                const errorText = await response.text()
                console.error("Error en respuesta API (High Sensitivity):", {
                    status: response.status,
                    statusText: response.statusText,
                    body: errorText,
                })
                notify(t('alertas.ups'), "error")
                throw new Error(`Error ${response.status}: ${errorText || "Error desconocido en la API de sensibilidad"}`)
            }

            const data: SensitivityResponse = await response.json()
            console.log("Respuesta exitosa de API (High Sensitivity):", data)
            setResult(data)
            notify(t('alertas.exito'), "success", t('asensibilidad.oknormal'))
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Error desconocido"
            console.error("Error completo en análisis de sensibilidad:", {
                message: errorMessage,
                error,
                stack: error instanceof Error ? error.stack : undefined,
            })
            notify(t('alertas.ups'), "error")
        } finally {
            setLoading(false)
        }
    }

    // Función auxiliar para obtener el nombre de la alternativa por su índice + 1
    const getAltName = (indexPlusOne: number): string => {
        const alt = alternativas?.[indexPlusOne - 1]
        return alt ? alt.nombre : `Alternativa ${indexPlusOne}`
    }

    return (
        <div className="space-y-6">
            <Card>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">{t('asensibilidad.selecccrite')}</label>
                        <Select
                            className="w-full"
                            placeholder={(t('asensibilidad.eligecrit')) + "..."}
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
                        {t('asensibilidad.ejeanalisis')} ({t('asensibilidad.altasen')})
                    </Button>
                    <p className="text-xs text-gray-500 mt-2">
                        {t('asensibilidad.desalta')}
                    </p>
                </div>
            </Card>

            {loading && (
                <div className="flex justify-center p-8">
                    <Spin size="large" />
                </div>
            )}

            {result && !loading && (
                <Card title={`${t('asensibilidad.resultitulo')}: ${result.criterion_name}`}>
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

                            {/* Criterio */}
                            <div className="bg-blue-50 p-4 rounded-lg">
                                <p className="text-sm text-gray-600">{t("asensibilidad.criteriova")}</p>
                                <p className="text-xl font-bold">{result.criterion_name}</p>
                            </div>

                            {/* Ranking Inicial */}
                            <div className="bg-purple-50 p-4 rounded-lg col-span-2 lg:col-span-1">
                                <p className="text-sm text-gray-600">{t('asensibilidad.rankini')} (Top 3)</p>
                                <div className="text-xl font-bold space-y-1">
                                    {result.initial_ranking.slice(0, 3).map((altIndex, i) => (
                                        <div key={i}>
                                            <Tag color={i === 0 ? "gold" : (i === 1 ? "silver" : "gray")}>
                                                {i + 1}°
                                            </Tag>
                                            {getAltName(altIndex)}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Peso Local Actual */}
                            <div className="bg-green-50 p-4 rounded-lg">
                                <p className="text-sm text-gray-600">{t('asensibilidad.ploactual')}</p>
                                <p className="text-xl font-bold">{(result.initial_local_weight * 100).toFixed(2)}%</p>
                            </div>
                        </div>

                        {/* Visualización del Rango de Estabilidad */}
                        <div className="bg-gray-50 p-6 rounded-lg">
                            <h3 className="font-semibold mb-4">{t('asensibilidad.rangestable')}</h3>
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
                                        title={`${'asensibilidad.pesoactual'}: ${(result.initial_local_weight * 100).toFixed(2)}%`}
                                    />
                                </div>

                                <div className="flex justify-between text-sm font-medium mt-4">
                                    <div className="text-center">
                                        <p className="text-gray-600">{t('asensibilidad.minestable')}</p>
                                        <p className="text-blue-600 font-bold">{(result.stability_local_interval[0] * 100).toFixed(2)}%</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-gray-600">{t('generic.actual')}</p>
                                        <p className="text-red-600 font-bold">{(result.initial_local_weight * 100).toFixed(2)}%</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-gray-600">{t('asensibilidad.maxestable')}</p>
                                        <p className="text-blue-600 font-bold">{(result.stability_local_interval[1] * 100).toFixed(2)}%</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-blue-50 p-4 rounded-lg text-sm text-gray-700">
                            <p className="font-semibold mb-2">
                                {t('generic.interpre')} ({t('asensibilidad.altasen')}):
                            </p>
                            <p>
                                {t('asensibilidad.firstdes')}"{result.criterion_name}"** {t('asensibilidad.varia')}{" "}
                                <span className="font-bold text-purple-600">{(result.stability_local_interval[0] * 100).toFixed(2)}%</span> y{" "}
                                <span className="font-bold text-purple-600">{(result.stability_local_interval[1] * 100).toFixed(2)}%</span>.
                            </p>
                            <p className="mt-2 text-xs text-purple-600">
                                {t('asensibilidad.seconddes')}.
                            </p>
                        </div>

                        {/* Se puede descomentar el componente SensitivityChart si está disponible */}
                        {/* <div className="mt-6">
                            <SensitivityChart
                                alternativas={alternativas}
                                matrix={matrix}
                                hierarchy={buildNestedHierarchy(hierarchy)}
                                tipos={tipos}
                                metodoNombre={metodoNombre}
                                criterionId={selectedCriterion!}
                                criterionName={result.criterion_name}
                                maxRange={result.stability_local_interval} 
                            />
                        </div> */}
                    </div>
                </Card>
            )}
        </div>
    )
}