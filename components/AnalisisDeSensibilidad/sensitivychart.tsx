import { useState } from "react"
import { Button, message, Spin } from "antd"

interface SensitivityChartProps {
    alternativas: any[]
    matrix: number[][]
    hierarchy: any[]
    tipos: string[]
    metodoNombre: string
    criterionId: string
    criterionName: string
    maxRange: [number, number]
}

interface ResultadoPaso {
    peso_local: number
    pesos_globales: number[]
    ranking: number[]
    mejor_alternativa: number
}

interface SensitivityV2Response {
    criterion_id: string
    criterion_name: string
    initial_local_weight: number
    rango_local: [number, number]
    total_pasos: number
    resultados: ResultadoPaso[]
}

const COLORS = [
    "#3B82F6", // blue
    "#EF4444", // red
    "#10B981", // green
    "#8B5CF6", // purple
    "#06B6D4", // cyan
    "#F59E0B", // amber
    "#EC4899", // pink
    "#14B8A6", // teal
    "#F97316", // orange
    "#6366F1", // indigo
    "#84CC16", // lime
    "#A855F7", // violet
    "#22D3EE", // sky
    "#FB923C", // orange-400
    "#34D399", // emerald
    "#F472B6", // pink-400
    "#4ADE80", // green-400
    "#FBBF24", // yellow-400
    "#60A5FA", // blue-400
    "#C084FC", // purple-400
]

export default function SensitivityChart({
    alternativas,
    matrix,
    hierarchy,
    tipos,
    metodoNombre,
    criterionId,
    criterionName,
    maxRange,
}: SensitivityChartProps) {
    const [loading, setLoading] = useState(false)
    const [chartData, setChartData] = useState<SensitivityV2Response | null>(null)

    const handleGenerateChart = async () => {
        setLoading(true)
        try {
            const payload = {
                matrix,
                hierarchy,
                tipos,
                criterion_id: criterionId,
                step_size: 0.01,
            }

            console.log("[Chart] Enviando payload a API v2:", JSON.stringify(payload, null, 2))

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_URLFASTCALAMARY}/run-sensitivity/${metodoNombre}/local-unidimensionalv2`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                }
            )

            if (!response.ok) {
                const errorText = await response.text()
                console.error("[Chart] Error en respuesta API:", {
                    status: response.status,
                    statusText: response.statusText,
                    body: errorText,
                })
                throw new Error(`Error ${response.status}: ${errorText || "Error desconocido"}`)
            }

            const data: SensitivityV2Response = await response.json()
            console.log("[Chart] Respuesta exitosa de API v2:", data)
            setChartData(data)
            message.success("Gráfico generado exitosamente")
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Error desconocido"
            console.error("[Chart] Error completo:", {
                message: errorMessage,
                error,
                stack: error instanceof Error ? error.stack : undefined,
            })
            message.error(`Error: ${errorMessage}`)
        } finally {
            setLoading(false)
        }
    }

    if (alternativas.length > 20) {
        return (
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg text-center">
                <p className="text-yellow-800 font-medium">
                    La generación de gráfico solo está disponible con hasta 20 alternativas
                </p>
                <p className="text-yellow-600 text-sm mt-1">
                    Actualmente tienes {alternativas.length} alternativas
                </p>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center p-8">
                <Spin size="large" />
                <span className="ml-3 text-gray-600">Generando gráfico...</span>
            </div>
        )
    }

    if (!chartData) {
        return (
            <div className="text-center">
                <Button type="primary" size="large" onClick={handleGenerateChart}>
                    Generar Gráfico de Sensibilidad
                </Button>
            </div>
        )
    }

    // Dimensiones del gráfico
    const width = 800
    const height = 500
    const margin = { top: 40, right: 150, bottom: 60, left: 80 }
    const chartWidth = width - margin.left - margin.right
    const chartHeight = height - margin.top - margin.bottom

    // Escalas
    const minWeight = chartData.rango_local[0]
    const maxWeight = chartData.rango_local[1]
    const xScale = (weight: number) =>
        margin.left + ((weight - minWeight) / (maxWeight - minWeight)) * chartWidth

    const yScale = (rank: number) =>
        height - margin.bottom - (rank / alternativas.length) * chartHeight

    // Generar líneas para cada alternativa
    const lines = alternativas.map((alt, altIndex) => {
        const points = chartData.resultados.map((resultado) => {
            const rank = resultado.ranking[altIndex]
            return {
                x: xScale(resultado.peso_local),
                y: yScale(rank),
            }
        })

        const pathData = points
            .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
            .join(" ")

        return {
            path: pathData,
            color: COLORS[altIndex % COLORS.length],
            name: alt.nombre || `Alt ${altIndex + 1}`,
            points,
        }
    })

    // Marcas verticales para puntos críticos (cambios de mejor alternativa)
    // ESTE CÓDIGO SE MANTIENE PARA CALCULAR LOS PUNTOS CRÍTICOS, PERO NO SE DIBUJA
    const criticalPoints: number[] = []
    let lastBest = chartData.resultados[0].mejor_alternativa
    chartData.resultados.forEach((resultado) => {
        if (resultado.mejor_alternativa !== lastBest) {
            criticalPoints.push(resultado.peso_local)
            lastBest = resultado.mejor_alternativa
        }
    })

    const maxRangeX = xScale(maxRange[1]);
    const labelText = maxRange[1].toFixed(2);
    // Para calcular el ancho del fondo blanco, se estima el ancho del texto: 
    // un texto de 4 caracteres (ej: 0.10) con "text-xs font-bold" es aprox 20px de ancho, 
    // se deja un poco de margen.
    const textWidthEstimate = 30; // Estimación: 4 caracteres * 6px/caracter + margen
    const textHeight = 20;
    const textYPosition = height - margin.bottom + 20;
    const rectX = maxRangeX - (textWidthEstimate / 2);
    const rectY = textYPosition - 10; // Ajuste para cubrir el texto

    return (
        <div className="space-y-4">
            <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-semibold text-lg mb-4 text-center">
                    Variación de Rankings según Peso de "{criterionName}"
                </h3>

                <svg width={width} height={height} className="mx-auto">
                    {/* Líneas de cuadrícula horizontales */}
                    {Array.from({ length: alternativas.length + 1 }, (_, i) => (
                        <line
                            key={`grid-h-${i}`}
                            x1={margin.left}
                            y1={yScale(i)}
                            x2={width - margin.right}
                            y2={yScale(i)}
                            stroke="#e5e7eb"
                            strokeWidth="1"
                        />
                    ))}

                    {/* Líneas verticales críticas - ELIMINADAS (No se renderizan) */}

                    {/* Línea vertical del peso máximo del rango (MaxRange[1]) */}
                    <g>
                        {/* 1. Línea principal punteada */}
                        <line
                            x1={maxRangeX}
                            y1={margin.top}
                            x2={maxRangeX}
                            y2={height - margin.bottom}
                            stroke="#dc2626"
                            strokeWidth="2"
                            strokeDasharray="4,4"
                        />
                        {/* 2. Marca de guion en el eje X */}
                        <line
                            x1={maxRangeX}
                            y1={height - margin.bottom}
                            x2={maxRangeX}
                            y2={height - margin.bottom + 5}
                            stroke="#dc2626"
                            strokeWidth="2"
                        />
                    </g>

                   
                    {/* Líneas de las alternativas */}
                    {lines.map((line, i) => (
                        <g key={`line-${i}`}>
                            <path
                                d={line.path}
                                fill="none"
                                stroke={line.color}
                                strokeWidth="2.5"
                                strokeLinejoin="round"
                                strokeLinecap="round"
                            />
                        </g>
                    ))}

                    {/* Eje Y (Rankings) */}
                    <line
                        x1={margin.left}
                        y1={margin.top}
                        x2={margin.left}
                        y2={height - margin.bottom}
                        stroke="#374151"
                        strokeWidth="2"
                    />
                    <text
                        x={margin.left - 50}
                        y={height / 2}
                        textAnchor="middle"
                        transform={`rotate(-90 ${margin.left - 50} ${height / 2})`}
                        className="text-sm font-medium"
                        fill="#374151"
                    >
                        Robot rank
                    </text>
                    {alternativas.map((_, i) => (
                        <text
                            key={`y-label-${i}`}
                            x={margin.left - 10}
                            y={yScale(i + 1)}
                            textAnchor="end"
                            dominantBaseline="middle"
                            className="text-xs"
                            fill="#6b7280"
                        >
                            {i + 1}
                        </text>
                    ))}
                    <text
                        key="y-label-0"
                        x={margin.left - 10}
                        y={yScale(0)}
                        textAnchor="end"
                        dominantBaseline="middle"
                        className="text-xs"
                        fill="#6b7280"
                    >
                        0
                    </text>

                    {/* Eje X (Pesos) */}
                    <line
                        x1={margin.left}
                        y1={height - margin.bottom}
                        x2={width - margin.right}
                        y2={height - margin.bottom}
                        stroke="#374151"
                        strokeWidth="2"
                    />
                    <text
                        x={width / 2}
                        y={height - 15}
                        textAnchor="middle"
                        className="text-sm font-medium"
                        fill="#374151"
                    >
                        Weight of criterion '{criterionName}'
                    </text>
                    {(() => {
                        const labels: number[] = []
                        let currentLabel = Math.floor(minWeight * 10) / 10
                        while (currentLabel < maxWeight) {
                            labels.push(currentLabel)
                            currentLabel = Math.round((currentLabel + 0.1) * 10) / 10
                        }
                        // Siempre agregar el máximo al final
                        labels.push(maxWeight)

                        return labels.map((weight) => (
                            <g key={`x-label-${weight}`}>
                                <line
                                    x1={xScale(weight)}
                                    y1={height - margin.bottom}
                                    x2={xScale(weight)}
                                    y2={height - margin.bottom + 5}
                                    stroke="#374151"
                                    strokeWidth="2"
                                />
                                <text
                                    x={xScale(weight)}
                                    y={height - margin.bottom + 20}
                                    textAnchor="middle"
                                    className="text-xs"
                                    fill="#6b7280"
                                >
                                    {weight.toFixed(2)}
                                </text>
                            </g>
                        ))
                    })()}

                    {/* Leyenda */}
                    {lines.map((line, i) => (
                        <g key={`legend-${i}`} transform={`translate(${width - margin.right + 10}, ${margin.top + i * 20})`}>
                            <line x1="0" y1="0" x2="20" y2="0" stroke={line.color} strokeWidth="2.5" />
                            <text x="25" y="0" dominantBaseline="middle" className="text-xs" fill="#374151">
                                {line.name}
                            </text>
                        </g>
                    ))}
                     {/* 3. Fondo blanco y etiqueta del peso (por encima de todo) */}
                    <g>
                        <rect
                            x={rectX}
                            y={rectY}
                            width={textWidthEstimate}
                            height={textHeight}
                            fill="white"
                            stroke="white"       // opcional: para reforzar el borde blanco
                            strokeWidth="2"      // opcional: borde más ancho para cubrir trazos
                        />
                        <text
                            x={maxRangeX}
                            y={textYPosition}
                            textAnchor="middle"
                            className="text-xs font-bold"
                            fill="#dc2626"
                        >
                            {labelText}
                        </text>
                    </g>

                </svg>

                <div className="mt-4 text-sm text-gray-600 bg-gray-50 p-3 rounded">
                    <p>
                        <strong>Interpretación:</strong> El gráfico muestra cómo cambia el ranking de cada alternativa
                        cuando el peso del criterio "{criterionName}" varía entre {(minWeight * 100).toFixed(2)}% y {(maxWeight * 100).toFixed(2)}%.
                        Las líneas verticales punteadas indican puntos críticos donde cambia la mejor alternativa.
                    </p>
                </div>
            </div>

            <div className="text-center">
                <Button onClick={() => setChartData(null)}>
                    Ocultar Gráfico
                </Button>
            </div>
        </div>
    )
}