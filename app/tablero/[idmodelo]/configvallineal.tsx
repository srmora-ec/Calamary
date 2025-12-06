"use client"

import { useState, useEffect, useRef } from "react"
import type { MAUTConfig } from "@/types/modelo"
import { t } from "i18next"

interface GMMA_Point {
  x: number
  yMin: number
  yMax: number
}

interface Point {
  x: number
  y: number
}

interface LinearFunctionConfigProps {
  nodeId: number
  min: number
  max: number
  beneficio: boolean
  unidadMedida: string
  initialConfig?: MAUTConfig
  onConfigChange: (config: MAUTConfig) => void
}

export default function LinearFunctionConfig({
  nodeId,
  min,
  max,
  beneficio,
  unidadMedida,
  initialConfig,
  onConfigChange,
}: LinearFunctionConfigProps) {
  const isInitialLoad = useRef(true)
  const lastNodeId = useRef<number | null>(null)

  const [tipoFuncion, setTipoFuncion] = useState<"simple" | "dual" | "discreta">("simple")

  const [puntosSimple, setPuntosSimple] = useState<Point[]>([
    { x: min, y: beneficio ? 0 : 1 },
    { x: max, y: beneficio ? 1 : 0 },
  ])

  const [puntosGMMA, setPuntosGMMA] = useState<GMMA_Point[]>([
    { x: min, yMin: beneficio ? 0 : 1, yMax: beneficio ? 0 : 1 },
    { x: max, yMin: beneficio ? 1 : 0, yMax: beneficio ? 1 : 0 },
  ])

  // --- LÓGICA DE CARGA ---
  useEffect(() => {
    if (lastNodeId.current !== nodeId) {
      lastNodeId.current = nodeId
      isInitialLoad.current = true
      let configValida = false

      if (initialConfig) {
        let puntosValidar: Point[] = []
        if (initialConfig.tipoFuncion === "simple" && initialConfig.funcionSimple) {
          puntosValidar = initialConfig.funcionSimple.puntos
        } else if (initialConfig.tipoFuncion === "dual" && initialConfig.funcionDual) {
          puntosValidar = initialConfig.funcionDual.max.puntos
        }

        if (puntosValidar.length > 0) {
          const primerPunto = puntosValidar[0]
          const ultimoPunto = puntosValidar[puntosValidar.length - 1]

          // Tolerancia para evitar problemas de coma flotante
          const rangoValido = Math.abs(ultimoPunto.x - max) < 0.001

          let tendenciaValida = false
          if (beneficio) {
            tendenciaValida = ultimoPunto.y >= primerPunto.y
          } else {
            tendenciaValida = primerPunto.y >= ultimoPunto.y
          }

          if (rangoValido && tendenciaValida) {
            configValida = true
            setTipoFuncion(initialConfig.tipoFuncion)
            if (initialConfig.tipoFuncion === "simple" && initialConfig.funcionSimple) {
              setPuntosSimple(initialConfig.funcionSimple.puntos)
            } else if (initialConfig.tipoFuncion === "dual" && initialConfig.funcionDual) {
              const minPuntos = initialConfig.funcionDual.min.puntos
              const maxPuntos = initialConfig.funcionDual.max.puntos
              const gmmaPoints: GMMA_Point[] = minPuntos.map((minP) => ({
                x: minP.x,
                yMin: minP.y,
                yMax: maxPuntos.find((p) => p.x === minP.x)?.y ?? minP.y,
              }))
              setPuntosGMMA(gmmaPoints)
            }
          }
        }
      }

      if (!configValida) {
        setTipoFuncion("simple")
        setPuntosSimple([
          { x: min, y: beneficio ? 0 : 1 },
          { x: max, y: beneficio ? 1 : 0 },
        ])
        setPuntosGMMA([
          { x: min, yMin: beneficio ? 0 : 1, yMax: beneficio ? 0 : 1 },
          { x: max, yMin: beneficio ? 1 : 0, yMax: beneficio ? 1 : 0 },
        ])
      }

      setTimeout(() => {
        isInitialLoad.current = false
      }, 0)
    }
  }, [nodeId, initialConfig, min, max, beneficio])

  // --- CÁLCULOS AUXILIARES ---
  const puntosMin: Point[] = puntosGMMA.map((p) => ({ x: p.x, y: p.yMin })).sort((a, b) => a.x - b.x)
  const puntosMax: Point[] = puntosGMMA.map((p) => ({ x: p.x, y: p.yMax })).sort((a, b) => a.x - b.x)

  const calcularPendientes = (puntos: Point[]): number[] => {
    const pendientes: number[] = []
    for (let i = 0; i < puntos.length - 1; i++) {
      const dx = puntos[i + 1].x - puntos[i].x
      const dy = puntos[i + 1].y - puntos[i].y
      pendientes.push(dx !== 0 ? dy / dx : 0)
    }
    return pendientes
  }

  const generarEcuaciones = (puntos: Point[]): string[] => {
    const ecuaciones: string[] = []
    for (let i = 0; i < puntos.length - 1; i++) {
      const p1 = puntos[i]
      const p2 = puntos[i + 1]
      const m = (p2.y - p1.y) / (p2.x - p1.x)
      const b = p1.y - m * p1.x
      const mStr = m.toFixed(4)
      const bStr = b.toFixed(4)
      const signo = b >= 0 ? "+" : ""
      ecuaciones.push(`u(x) = ${mStr}x ${signo} ${bStr}  [${p1.x.toFixed(2)} ≤ x ≤ ${p2.x.toFixed(2)}]`)
    }
    return ecuaciones
  }

  const calcularPuntosPromedio = (): Point[] => {
    const xValues = new Set<number>()
    puntosMin.forEach((p) => xValues.add(p.x))
    puntosMax.forEach((p) => xValues.add(p.x))
    const sortedX = Array.from(xValues).sort((a, b) => a - b)
    return sortedX.map((x) => {
      const yMin = interpolarUtilidad(x, puntosMin)
      const yMax = interpolarUtilidad(x, puntosMax)
      return { x, y: (yMin + yMax) / 2 }
    })
  }

  const interpolarUtilidad = (x: number, puntos: Point[]): number => {
    for (let i = 0; i < puntos.length - 1; i++) {
      if (x >= puntos[i].x && x <= puntos[i + 1].x) {
        const p1 = puntos[i]
        const p2 = puntos[i + 1]
        const t = (x - p1.x) / (p2.x - p1.x)
        return p1.y + t * (p2.y - p1.y)
      }
    }
    if (x < puntos[0].x) return puntos[0].y
    return puntos[puntos.length - 1].y
  }

  // --- HANDLE GUARDAR ---
  const handleGuardar = (e: React.FormEvent) => {
    const config: MAUTConfig = {
      tipoFuncion,
      ...(tipoFuncion === "simple"
        ? {
          funcionSimple: {
            puntos: puntosSimple,
            pendientes: calcularPendientes(puntosSimple),
          },
        }
        : {
          funcionDual: {
            min: {
              puntos: puntosMin,
              pendientes: calcularPendientes(puntosMin),
            },
            max: {
              puntos: puntosMax,
              pendientes: calcularPendientes(puntosMax),
            },
          },
        }),
    }

    onConfigChange(config)

  }

  // --- FUNCIONES DE ACTUALIZACIÓN DE PUNTOS ---
  const agregarPuntoSimple = () => {
    const nuevoX = (puntosSimple[0].x + puntosSimple[puntosSimple.length - 1].x) / 2
    const nuevoY = 0.5
    setPuntosSimple([...puntosSimple, { x: nuevoX, y: nuevoY }].sort((a, b) => a.x - b.x))
  }

  const eliminarPuntoSimple = (index: number) => {
    if (puntosSimple.length > 2) {
      setPuntosSimple(puntosSimple.filter((_, i) => i !== index))
    }
  }

  const actualizarPuntoSimple = (index: number, campo: "x" | "y", valor: number) => {
    const nuevosPuntos = [...puntosSimple]

    if (campo === "x") {
      nuevosPuntos[index].x = Math.max(min, Math.min(max, valor))
    } else {
      let nuevoY = Math.max(0, Math.min(1, valor))
      const ultimoIndice = nuevosPuntos.length - 1

      if (index === 0) {
        const yFinal = nuevosPuntos[ultimoIndice].y
        if (beneficio) {
          if (nuevoY > yFinal) nuevoY = yFinal
        } else {
          if (nuevoY < yFinal) nuevoY = yFinal
        }
      }

      if (index === ultimoIndice) {
        const yInicial = nuevosPuntos[0].y
        if (beneficio) {
          if (nuevoY < yInicial) nuevoY = yInicial
        } else {
          if (nuevoY > yInicial) nuevoY = yInicial
        }
      }
      nuevosPuntos[index].y = nuevoY
    }
    setPuntosSimple(nuevosPuntos.sort((a, b) => a.x - b.x))
  }

  const agregarPuntoGMMA = () => {
    const ultimoPunto = puntosGMMA[puntosGMMA.length - 1]
    const primerPunto = puntosGMMA[0]
    const nuevoX = (primerPunto.x + ultimoPunto.x) / 2
    const nuevoY = 0.5
    setPuntosGMMA(
      [...puntosGMMA, { x: nuevoX, yMin: nuevoY, yMax: nuevoY }].sort((a, b) => a.x - b.x)
    )
  }

  const eliminarPuntoGMMA = (index: number) => {
    if (puntosGMMA.length > 2) {
      setPuntosGMMA(puntosGMMA.filter((_, i) => i !== index))
    }
  }

  const actualizarPuntoGMMA = (index: number, campo: "x" | "yMin" | "yMax", valor: number) => {
    const nuevosPuntos = [...puntosGMMA]

    if (campo === "x") {
      nuevosPuntos[index].x = Math.max(min, Math.min(max, valor))
    } else {
      let nuevoY = Math.max(0, Math.min(1, valor))
      const ultimoIndice = nuevosPuntos.length - 1

      if (index === 0) {
        const yFinal = nuevosPuntos[ultimoIndice][campo]
        if (beneficio) {
          if (nuevoY > yFinal) nuevoY = yFinal
        } else {
          if (nuevoY < yFinal) nuevoY = yFinal
        }
      }

      if (index === ultimoIndice) {
        const yInicial = nuevosPuntos[0][campo]
        if (beneficio) {
          if (nuevoY < yInicial) nuevoY = yInicial
        } else {
          if (nuevoY > yInicial) nuevoY = yInicial
        }
      }

      nuevosPuntos[index][campo] = nuevoY

      if (campo === "yMin" && nuevosPuntos[index].yMin > nuevosPuntos[index].yMax) {
        nuevosPuntos[index].yMax = nuevosPuntos[index].yMin
      }
      if (campo === "yMax" && nuevosPuntos[index].yMax < nuevosPuntos[index].yMin) {
        nuevosPuntos[index].yMin = nuevosPuntos[index].yMax
      }
    }
    setPuntosGMMA(nuevosPuntos.sort((a, b) => a.x - b.x))
  }

  // --- RENDERIZADO ---
  const renderGrafico = (puntos: Point[], color: string, titulo: string, mostrarEcuaciones = true) => {
    const width = 500
    const height = 300
    const padding = 40
    const scaleX = (x: number) => padding + ((x - min) / (max - min)) * (width - 2 * padding)
    const scaleY = (y: number) => height - padding - y * (height - 2 * padding)
    const pathData = puntos.map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(p.x)} ${scaleY(p.y)}`).join(" ")
    const ecuaciones = generarEcuaciones(puntos)

    return (
      <div className="mb-4">
        <h4 className="text-sm font-semibold mb-2">{titulo}</h4>
        <svg width={width} height={height} className="border border-gray-300 rounded bg-white">
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="black" strokeWidth="2" />
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="black" strokeWidth="2" />
          <text x={width / 2} y={height - 5} textAnchor="middle" fontSize="12" fill="black">{unidadMedida}</text>
          <text x={5} y={height / 2} textAnchor="middle" fontSize="12" fill="black" transform={`rotate(-90, 5, ${height / 2})`}>{t('generic.utilidad')}</text>
          <text x={scaleX(min)} y={height - padding + 20} textAnchor="middle" fontSize="10" fill="black">{min.toFixed(1)}</text>
          <text x={scaleX(max)} y={height - padding + 20} textAnchor="middle" fontSize="10" fill="black">{max.toFixed(1)}</text>
          <text x={padding - 20} y={scaleY(0)} textAnchor="middle" fontSize="10" fill="black">0</text>
          <text x={padding - 20} y={scaleY(1)} textAnchor="middle" fontSize="10" fill="black">1</text>
          <path d={pathData} stroke={color} strokeWidth="2" fill="none" />
          {puntos.map((p, i) => (
            <circle key={i} cx={scaleX(p.x)} cy={scaleY(p.y)} r="5" fill={color} />
          ))}
        </svg>
        {mostrarEcuaciones && (
          <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
            <p className="text-xs font-semibold mb-1">{t('lineal.porsegmen')}:</p>
            {ecuaciones.map((eq, i) => (
              <p key={i} className="text-xs font-mono text-gray-700">{eq}</p>
            ))}
          </div>
        )}
      </div>
    )
  }

  const renderGraficoGMMA = () => {
    const width = 500
    const height = 300
    const padding = 40
    const scaleX = (x: number) => padding + ((x - min) / (max - min)) * (width - 2 * padding)
    const scaleY = (y: number) => height - padding - y * (height - 2 * padding)
    const pathDataMin = puntosMin.map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(p.x)} ${scaleY(p.y)}`).join(" ")
    const pathDataMax = puntosMax.map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(p.x)} ${scaleY(p.y)}`).join(" ")
    const puntosPromedio = calcularPuntosPromedio()
    const pathDataPromedio = puntosPromedio.map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(p.x)} ${scaleY(p.y)}`).join(" ")

    return (
      <div className="mb-4">
        <h4 className="text-sm font-semibold mb-2">{t('lineal.fudual')}</h4>
        <svg width={width} height={height} className="border border-gray-300 rounded bg-white">
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="black" strokeWidth="2" />
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="black" strokeWidth="2" />
          <text x={width / 2} y={height - 5} textAnchor="middle" fontSize="12" fill="black">{unidadMedida}</text>
          <text x={5} y={height / 2} textAnchor="middle" fontSize="12" fill="black" transform={`rotate(-90, 5, ${height / 2})`}>{t('generic.utilidad')}</text>
          <text x={scaleX(min)} y={height - padding + 20} textAnchor="middle" fontSize="10" fill="black">{min.toFixed(1)}</text>
          <text x={scaleX(max)} y={height - padding + 20} textAnchor="middle" fontSize="10" fill="black">{max.toFixed(1)}</text>
          <text x={padding - 20} y={scaleY(0)} textAnchor="middle" fontSize="10" fill="black">0</text>
          <text x={padding - 20} y={scaleY(1)} textAnchor="middle" fontSize="10" fill="black">1</text>
          <path d={pathDataMin} stroke="#ef4444" strokeWidth="2" fill="none" />
          <path d={pathDataMax} stroke="#10b981" strokeWidth="2" fill="none" />
          <path d={pathDataPromedio} stroke="#9333ea" strokeWidth="2" strokeDasharray="4 2" fill="none" />
          {puntosGMMA.map((p, i) => (
            <g key={i}>
              <circle cx={scaleX(p.x)} cy={scaleY(p.yMin)} r="5" fill="#ef4444" />
              <circle cx={scaleX(p.x)} cy={scaleY(p.yMax)} r="5" fill="#10b981" />
            </g>
          ))}
        </svg>
        <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
          <p className="text-xs font-semibold mb-1">{t('lineal.porsegmen')}:</p>
          <p className="text-xs font-mono text-gray-700 mb-1">
            <span className="text-red-500">{t('lineal.fmin')}:</span> {generarEcuaciones(puntosMin).map(eq => eq.substring(0, eq.indexOf('['))).join(" | ")}
          </p>
          <p className="text-xs font-mono text-gray-700">
            <span className="text-green-500">{t('lineal.fmax')}:</span> {generarEcuaciones(puntosMax).map(eq => eq.substring(0, eq.indexOf('['))).join(" | ")}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">{t('lineal.tipode')}:</label>
        <div className="flex gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              value="simple"
              checked={tipoFuncion === "simple"}
              onChange={(e) => setTipoFuncion(e.target.value as "simple" | "dual")}
              className="mr-2"
            />
            {t('lineal.fsimple')}
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              value="dual"
              checked={tipoFuncion === "dual"}
              onChange={(e) => setTipoFuncion(e.target.value as "simple" | "dual")}
              className="mr-2"
            />
            {t('lineal.fdual')}
          </label>
        </div>
        <p className="text-xs text-gray-600 mt-1">
          {tipoFuncion === "simple"
            ? t('lineal.s1')
            : t('lineal.s2')}
        </p>
      </div>

      {tipoFuncion === "simple" && (
        <div>
          {renderGrafico(puntosSimple, "#3b82f6", "Función de Utilidad")}
          <div className="space-y-2">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-semibold">{t('lineal.pfuncion')}:</h4>
              <button
                onClick={agregarPuntoSimple}
                className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
              >
                + {t('lineal.addp')}
              </button>
            </div>
            {puntosSimple.map((punto, index) => (
              <div key={index} className="flex gap-2 items-center">
                <span className="text-xs w-16">Punto {index + 1}:</span>
                <label className="text-xs">
                  X:
                  <input
                    type="number"
                    value={punto.x.toFixed(2)}
                    onChange={(e) => actualizarPuntoSimple(index, "x", Number.parseFloat(e.target.value))}
                    step="0.1"
                    className="ml-1 w-20 px-2 py-1 border rounded text-xs"
                    disabled={index === 0 || index === puntosSimple.length - 1}
                  />
                </label>
                <label className="text-xs">
                  Y:
                  <input
                    type="number"
                    value={punto.y.toFixed(2)}
                    onChange={(e) => actualizarPuntoSimple(index, "y", Number.parseFloat(e.target.value))}
                    step="0.1"
                    min="0"
                    max="1"
                    className="ml-1 w-20 px-2 py-1 border rounded text-xs"
                  />
                </label>
                {puntosSimple.length > 2 && index !== 0 && index !== puntosSimple.length - 1 && (
                  <button
                    onClick={() => eliminarPuntoSimple(index)}
                    className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                  >
                  {t('generic.del')}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tipoFuncion === "dual" && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
            <p className="text-xs text-blue-800">
              <strong>{t('lineal.mgmaa')}:</strong> {t('lineal.s3')}
            </p>
          </div>
          {renderGraficoGMMA()}
          <div className="space-y-2">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-semibold">{t('lineal.pfunciondual')} (X, Ymin, Ymax):</h4>
              <button
                onClick={agregarPuntoGMMA}
                className="px-3 py-1 bg-green-700 text-white text-xs rounded hover:bg-green-800"
              >
                + {t('lineal.addp')} (X)
              </button>
            </div>
            {puntosGMMA.map((punto, index) => (
              <div key={index} className="flex gap-2 items-center">
                <span className="text-xs w-16">{t('generic.punto')} {index + 1}:</span>
                <label className="text-xs">
                  X:
                  <input
                    type="number"
                    value={punto.x.toFixed(2)}
                    onChange={(e) => actualizarPuntoGMMA(index, "x", Number.parseFloat(e.target.value))}
                    step="0.1"
                    className="ml-1 w-20 px-2 py-1 border rounded text-xs"
                    disabled={index === 0 || index === puntosGMMA.length - 1}
                  />
                </label>
                <label className="text-xs">
                  <span className="text-red-500">U Min:</span>
                  <input
                    type="number"
                    value={punto.yMin.toFixed(2)}
                    onChange={(e) => actualizarPuntoGMMA(index, "yMin", Number.parseFloat(e.target.value))}
                    step="0.1"
                    min="0"
                    max="1"
                    className="ml-1 w-20 px-2 py-1 border rounded text-xs"
                  />
                </label>
                <label className="text-xs">
                  <span className="text-green-500">U Max:</span>
                  <input
                    type="number"
                    value={punto.yMax.toFixed(2)}
                    onChange={(e) => actualizarPuntoGMMA(index, "yMax", Number.parseFloat(e.target.value))}
                    step="0.1"
                    min="0"
                    max="1"
                    className="ml-1 w-20 px-2 py-1 border rounded text-xs"
                  />
                </label>
                {puntosGMMA.length > 2 && index !== 0 && index !== puntosGMMA.length - 1 && (
                  <button
                    onClick={() => eliminarPuntoGMMA(index)}
                    className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                  >
                    {t('generic.del')}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- BOTÓN DE GUARDADO --- */}
      <div className="pt-4 mt-4 border-t border-gray-200">
        <button
          onClick={(e)=>handleGuardar(e)}
          className="w-full sm:w-auto px-4 py-2 bg-blue-500 text-white rounded font-medium hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 cursor-pointer"
        >
          {t('botones.guardar')}
        </button>
      </div>
    </div>
  )
}