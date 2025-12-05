
import { useState } from "react"
import { Select, Button, message, Spin, Card } from "antd"
import type { Nodo } from "@/types/modelo"
import { useTranslation } from "react-i18next"
import { useNotification } from "../NotificationProvider"
// import LanguageSwitcher from "@/components/LanguageSwitcher";


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
    const { t } = useTranslation();
    const { notify } = useNotification();

    const handleAnalyze = async () => {//Analizar
        if (!selectedCriterion) {
            message.warning("Por favor selecciona un criterio")
            return
        }

        setLoading(true)
        try {
            const nestedHierarchy = buildNestedHierarchy(hierarchy)//Construirmo el arbol
            const payload = {
                matrix,
                hierarchy: nestedHierarchy,
                tipos,
                criterion_id: selectedCriterion,
                step_size: 0.01,
            }

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_URLFASTCALAMARY}/run-sensitivity/${metodoNombre}/local-unidimensional`,//llamamos la api
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                },
            )

            if (!response.ok) {
                const errorText = await response.text()
                console.error("Error en respuesta API:", {
                    status: response.status,
                    statusText: response.statusText,
                    body: errorText,
                })
                notify(t('alertas.ups'), "error")

                throw new Error(`Error ${response.status}: ${errorText || "Error desconocido en la API de sensibilidad"}`)
            }

            const data: SensitivityResponse = await response.json()
            console.log(" Respuesta exitosa de API:", data)
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
                    <Button type="primary" onClick={handleAnalyze} loading={loading} disabled={!selectedCriterion} block>
                        {t('asensibilidad.ejeanalisis')} ({t('asensibilidad.normalsen')})
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
                                <p className="text-sm text-gray-600">{t("asensibilidad.criteriova")}</p>
                                <p className="text-xl font-bold">{result.criterion_name}</p>
                            </div>
                            <div className="bg-blue-50 p-4 rounded-lg">
                                <p className="text-sm text-gray-600">{t('resultados.mejoralt')} {t('generic.actual').toLowerCase()}</p>
                                <p className="text-xl font-bold">
                                    {(() => {
                                        const bestIndex = result.initial_best_alternative
                                        const bestAlt = alternativas?.[bestIndex - 1]
                                        return bestAlt ? bestAlt.nombre : `Alternativa ${bestIndex}`
                                    })()}
                                </p>
                            </div>
                            <div className="bg-green-50 p-4 rounded-lg">
                                <p className="text-sm text-gray-600">{t('asensibilidad.ploactual')}</p>
                                <p className="text-xl font-bold">{(result.initial_local_weight * 100).toFixed(2)}%</p>
                            </div>
                            <div className="bg-green-50 p-4 rounded-lg">
                                <p className="text-sm text-gray-600">{t('asensibilidad.pgloactual')}</p>
                                <p className="text-xl font-bold">{(result.initial_global_weight * 100).toFixed(2)}%</p>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-6 rounded-lg">
                            <h3 className="font-semibold mb-4">{t('asensibilidad.rangestapeso')}</h3>
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
                                        <p className="text-gray-600">{t('generic.minimo')}</p>
                                        <p className="text-blue-600 font-bold">{(result.stability_local_interval[0] * 100).toFixed(2)}%</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-gray-600">{t('generic.actual')}</p>
                                        <p className="text-red-600 font-bold">{(result.initial_local_weight * 100).toFixed(2)}%</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-gray-600">{t('generic.maximo')}</p>
                                        <p className="text-blue-600 font-bold">{(result.stability_local_interval[1] * 100).toFixed(2)}%</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-blue-50 p-4 rounded-lg text-sm text-gray-700">
                            <p className="font-semibold mb-2">
                                {t('generic.interpre')}:
                            </p>
                            <p>
                                {t('asensibilidad.thirddes')}"{result.criterion_name}") {t('asensibilidad.fordes')}{" "}
                                <span className="font-bold text-purple-600">{(result.stability_local_interval[0] * 100).toFixed(2)}%</span> y{" "}
                                <span className="font-bold text-purple-600">{(result.stability_local_interval[1] * 100).toFixed(2)}%</span>.
                            </p>
                        </div>
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
