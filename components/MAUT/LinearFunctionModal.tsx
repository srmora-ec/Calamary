"use client"

import { useState, useEffect, useRef } from "react"
import type { MAUTConfig } from "@/types/modelo"

// Nuevo tipo de punto para el modo dual (GMMA)
interface GMMA_Point {
  x: number
  yMin: number
  yMax: number
}

interface Point {
  x: number
  y: number
}

// Interfaz adaptada para el nuevo estado del modo dual
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

  // Estado para el tipo de función
  const [tipoFuncion, setTipoFuncion] = useState<"simple" | "dual" | "discreta">("simple")

  // Estados para función simple (sin cambios)
  const [puntosSimple, setPuntosSimple] = useState<Point[]>([
    { x: min, y: beneficio ? 0 : 1 },
    { x: max, y: beneficio ? 1 : 0 },
  ])

  // ESTADO CENTRALIZADO PARA MODO DUAL (GMMA)
  const [puntosGMMA, setPuntosGMMA] = useState<GMMA_Point[]>([
    { x: min, yMin: beneficio ? 0 : 1, yMax: beneficio ? 0 : 1 },
    { x: max, yMin: beneficio ? 1 : 0, yMax: beneficio ? 1 : 0 },
  ])

  useEffect(() => {
    // Check if we're switching to a different node
    if (lastNodeId.current !== nodeId) {
      lastNodeId.current = nodeId
      isInitialLoad.current = true

      // Load config for the new node
      if (initialConfig) {
        setTipoFuncion(initialConfig.tipoFuncion)

        if (initialConfig.tipoFuncion === "simple" && initialConfig.funcionSimple) {
          setPuntosSimple(initialConfig.funcionSimple.puntos)
        } else if (initialConfig.tipoFuncion === "dual" && initialConfig.funcionDual) {
          // *** Lógica para cargar GMMA ***
          const minPuntos = initialConfig.funcionDual.min.puntos
          const maxPuntos = initialConfig.funcionDual.max.puntos

          // Asume que los puntos X son los mismos y están ordenados para GMMA
          const gmmaPoints: GMMA_Point[] = minPuntos.map((minP, index) => ({
            x: minP.x,
            yMin: minP.y,
            // Buscar yMax en los puntos de la función Max, basándose en la X
            yMax: maxPuntos.find(p => p.x === minP.x)?.y ?? minP.y, 
          }))
          setPuntosGMMA(gmmaPoints)
        }
      } else {
        // No config, use defaults
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

      // Mark initial load as complete after state updates
      setTimeout(() => {
        isInitialLoad.current = false
      }, 0)
    }
  }, [nodeId, initialConfig, min, max, beneficio])

  // Generar Puntos Min y Max a partir del estado GMMA para cálculos y renderizado
  const puntosMin: Point[] = puntosGMMA.map(p => ({ x: p.x, y: p.yMin })).sort((a, b) => a.x - b.x)
  const puntosMax: Point[] = puntosGMMA.map(p => ({ x: p.x, y: p.yMax })).sort((a, b) => a.x - b.x)


  // Calcular pendientes (usa los puntos generados)
  const calcularPendientes = (puntos: Point[]): number[] => {
    const pendientes: number[] = []
    for (let i = 0; i < puntos.length - 1; i++) {
      const dx = puntos[i + 1].x - puntos[i].x
      const dy = puntos[i + 1].y - puntos[i].y
      pendientes.push(dx !== 0 ? dy / dx : 0)
    }
    return pendientes
  }

  // Generar Ecuaciones (sin cambios)
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

  // Calcular Puntos Promedio (usa los puntos generados, sin cambios)
  const calcularPuntosPromedio = (): Point[] => {
    // Crear un conjunto de todos los valores x únicos de ambas funciones
    const xValues = new Set<number>()
    puntosMin.forEach((p) => xValues.add(p.x))
    puntosMax.forEach((p) => xValues.add(p.x))

    const sortedX = Array.from(xValues).sort((a, b) => a - b)

    // Para cada x, calcular el promedio de las utilidades
    return sortedX.map((x) => {
      const yMin = interpolarUtilidad(x, puntosMin)
      const yMax = interpolarUtilidad(x, puntosMax)
      return { x, y: (yMin + yMax) / 2 }
    })
  }

  // Interpolar Utilidad (sin cambios)
  const interpolarUtilidad = (x: number, puntos: Point[]): number => {
    // Encontrar el segmento donde está x
    for (let i = 0; i < puntos.length - 1; i++) {
      if (x >= puntos[i].x && x <= puntos[i + 1].x) {
        const p1 = puntos[i]
        const p2 = puntos[i + 1]
        const t = (x - p1.x) / (p2.x - p1.x)
        return p1.y + t * (p2.y - p1.y)
      }
    }
    // Si está fuera del rango, retornar el valor más cercano
    if (x < puntos[0].x) return puntos[0].y
    return puntos[puntos.length - 1].y
  }

  useEffect(() => {
    // Skip calling onConfigChange during initial load to prevent infinite loop
    if (isInitialLoad.current) {
      return
    }

    // Usar puntosMin y puntosMax generados para MAUTConfig
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
                puntos: puntosMin, // Usar puntosMin generado
                pendientes: calcularPendientes(puntosMin),
              },
              max: {
                puntos: puntosMax, // Usar puntosMax generado
                pendientes: calcularPendientes(puntosMax),
              },
            },
          }),
    }
    onConfigChange(config)
  }, [tipoFuncion, puntosSimple, puntosGMMA]) // Depende de puntosGMMA en vez de puntosMin/Max

  // --- Funciones de actualización para modo SIMPLE (sin cambios) ---

  // Agregar punto a función simple
  const agregarPuntoSimple = () => {
    // Corregido: Usar el primer y último punto de la función actual
    const nuevoX = (puntosSimple[0].x + puntosSimple[puntosSimple.length - 1].x) / 2
    const nuevoY = 0.5
    setPuntosSimple([...puntosSimple, { x: nuevoX, y: nuevoY }].sort((a, b) => a.x - b.x))
  }

  // Eliminar punto de función simple
  const eliminarPuntoSimple = (index: number) => {
    if (puntosSimple.length > 2) {
      setPuntosSimple(puntosSimple.filter((_, i) => i !== index))
    }
  }

  // Actualizar punto de función simple
  const actualizarPuntoSimple = (index: number, campo: "x" | "y", valor: number) => {
    const nuevosPuntos = [...puntosSimple]
    nuevosPuntos[index][campo] = valor

    // Limitar valores
    if (campo === "x") {
      nuevosPuntos[index].x = Math.max(min, Math.min(max, valor))
    } else {
      nuevosPuntos[index].y = Math.max(0, Math.min(1, valor))
    }

    setPuntosSimple(nuevosPuntos.sort((a, b) => a.x - b.x))
  }

  // --- Funciones de actualización para modo DUAL (GMMA) ---

  const agregarPuntoGMMA = () => {
    const ultimoPunto = puntosGMMA[puntosGMMA.length - 1]
    const primerPunto = puntosGMMA[0]
    // Calcula el punto medio del rango actual de X
    const nuevoX = (primerPunto.x + ultimoPunto.x) / 2
    const nuevoY = 0.5 // Valor por defecto
    
    setPuntosGMMA(
      [...puntosGMMA, { x: nuevoX, yMin: nuevoY, yMax: nuevoY }]
      .sort((a, b) => a.x - b.x)
    )
  }

  const eliminarPuntoGMMA = (index: number) => {
    if (puntosGMMA.length > 2) {
      setPuntosGMMA(puntosGMMA.filter((_, i) => i !== index))
    }
  }

  const actualizarPuntoGMMA = (index: number, campo: "x" | "yMin" | "yMax", valor: number) => {
    const nuevosPuntos = [...puntosGMMA]
    nuevosPuntos[index][campo] = valor

    if (campo === "x") {
      nuevosPuntos[index].x = Math.max(min, Math.min(max, valor))
    } else {
      // Limitar valores Y entre 0 y 1
      nuevosPuntos[index][campo] = Math.max(0, Math.min(1, valor))

      // Opcional: Asegurar que YMin <= YMax
      if (nuevosPuntos[index].yMin > nuevosPuntos[index].yMax) {
        // Si se rompe la relación, ajustamos el valor que no se está editando directamente
        if (campo === "yMin") {
          nuevosPuntos[index].yMax = nuevosPuntos[index].yMin;
        } else {
          nuevosPuntos[index].yMin = nuevosPuntos[index].yMax;
        }
      }
    }

    setPuntosGMMA(nuevosPuntos.sort((a, b) => a.x - b.x))
  }


  // --- FUNCIÓN DE RENDERIZADO ORIGINAL (Para modo 'simple') ---
  // Reincorporada para solucionar el error "renderGrafico is not defined"
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
          {/* Ejes */}
          <line
            x1={padding}
            y1={height - padding}
            x2={width - padding}
            y2={height - padding}
            stroke="black"
            strokeWidth="2"
          />
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="black" strokeWidth="2" />

          {/* Etiquetas */}
          <text x={width / 2} y={height - 5} textAnchor="middle" fontSize="12" fill="black">
            {unidadMedida}
          </text>
          <text
            x={5}
            y={height / 2}
            textAnchor="middle"
            fontSize="12"
            fill="black"
            transform={`rotate(-90, 5, ${height / 2})`}
          >
            Utilidad
          </text>

          {/* Marcas en eje X */}
          <text x={scaleX(min)} y={height - padding + 20} textAnchor="middle" fontSize="10" fill="black">
            {min.toFixed(1)}
          </text>
          <text x={scaleX(max)} y={height - padding + 20} textAnchor="middle" fontSize="10" fill="black">
            {max.toFixed(1)}
          </text>

          {/* Marcas en eje Y */}
          <text x={padding - 20} y={scaleY(0)} textAnchor="middle" fontSize="10" fill="black">
            0
          </text>
          <text x={padding - 20} y={scaleY(1)} textAnchor="middle" fontSize="10" fill="black">
            1
          </text>

          {/* Línea de función */}
          <path d={pathData} stroke={color} strokeWidth="2" fill="none" />

          {/* Puntos */}
          {puntos.map((p, i) => (
            <circle key={i} cx={scaleX(p.x)} cy={scaleY(p.y)} r="5" fill={color} />
          ))}
        </svg>

        {mostrarEcuaciones && (
          <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
            <p className="text-xs font-semibold mb-1">Ecuaciones por segmento:</p>
            {ecuaciones.map((eq, i) => (
              <p key={i} className="text-xs font-mono text-gray-700">
                {eq}
              </p>
            ))}
          </div>
        )}
      </div>
    )
  }
  // --- FIN FUNCIÓN DE RENDERIZADO ORIGINAL ---
  

  // --- Renderizado del gráfico GMMA ---

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
        <h4 className="text-sm font-semibold mb-2">Funciones de Utilidad Dual (GMMA)</h4>
        <svg width={width} height={height} className="border border-gray-300 rounded bg-white">
          {/* Ejes y Etiquetas (sin cambios) */}
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="black" strokeWidth="2" />
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="black" strokeWidth="2" />
          <text x={width / 2} y={height - 5} textAnchor="middle" fontSize="12" fill="black">{unidadMedida}</text>
          <text x={5} y={height / 2} textAnchor="middle" fontSize="12" fill="black" transform={`rotate(-90, 5, ${height / 2})`}>Utilidad</text>
          <text x={scaleX(min)} y={height - padding + 20} textAnchor="middle" fontSize="10" fill="black">{min.toFixed(1)}</text>
          <text x={scaleX(max)} y={height - padding + 20} textAnchor="middle" fontSize="10" fill="black">{max.toFixed(1)}</text>
          <text x={padding - 20} y={scaleY(0)} textAnchor="middle" fontSize="10" fill="black">0</text>
          <text x={padding - 20} y={scaleY(1)} textAnchor="middle" fontSize="10" fill="black">1</text>
          

          {/* Línea de Función Mínima (Roja) */}
          <path d={pathDataMin} stroke="#ef4444" strokeWidth="2" fill="none" />
          {/* Línea de Función Máxima (Verde) */}
          <path d={pathDataMax} stroke="#10b981" strokeWidth="2" fill="none" />
          {/* Línea de Función Promedio (Púrpura) */}
          <path d={pathDataPromedio} stroke="#9333ea" strokeWidth="2" strokeDasharray="4 2" fill="none" />


          {/* Puntos (usando el estado GMMA) */}
          {puntosGMMA.map((p, i) => (
            <>
              {/* Punto Y Min (Rojo) */}
              <circle key={`min-${i}`} cx={scaleX(p.x)} cy={scaleY(p.yMin)} r="5" fill="#ef4444" />
              {/* Punto Y Max (Verde) */}
              <circle key={`max-${i}`} cx={scaleX(p.x)} cy={scaleY(p.yMax)} r="5" fill="#10b981" />
            </>
          ))}
        </svg>

        {/* Ecuaciones y Leyenda */}
        <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
            <p className="text-xs font-semibold mb-1">Ecuaciones por segmento:</p>
            <p className="text-xs font-mono text-gray-700 mb-1">
                <span className="text-red-500">Función Mínima:</span> {generarEcuaciones(puntosMin).map(eq => eq.substring(0, eq.indexOf('['))).join(" | ")}
            </p>
            <p className="text-xs font-mono text-gray-700">
                <span className="text-green-500">Función Máxima:</span> {generarEcuaciones(puntosMax).map(eq => eq.substring(0, eq.indexOf('['))).join(" | ")}
            </p>
        </div>

      </div>
    )
  }

  // --- Renderizado General ---

  return (
    <div className="space-y-4">
      {/* Selector de tipo de función */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Tipo de función de utilidad:</label>
        <div className="flex gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              value="simple"
              checked={tipoFuncion === "simple"}
              onChange={(e) => setTipoFuncion(e.target.value as "simple" | "dual")}
              className="mr-2"
            />
            Función simple
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              value="dual"
              checked={tipoFuncion === "dual"}
              onChange={(e) => setTipoFuncion(e.target.value as "simple" | "dual")}
              className="mr-2"
            />
            Función dual (mín/máx - GMMA)
          </label>
        </div>
        <p className="text-xs text-gray-600 mt-1">
          {tipoFuncion === "simple"
            ? "Una sola función lineal para todo el rango de valores"
            : "Dos funciones separadas (mínima y máxima) definidas por pares de utilidad para cada valor de atributo (x). La utilidad del promedio se calcula interpolando (MAUT GMMA)."}
        </p>
      </div>

      {/* Configuración de función simple */}
      {tipoFuncion === "simple" && (
        <div>
          {/* Usamos el render original para el modo simple */}
          {renderGrafico(puntosSimple, "#3b82f6", "Función de Utilidad")}

          <div className="space-y-2">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-semibold">Puntos de la función:</h4>
              <button
                onClick={agregarPuntoSimple}
                className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
              >
                + Agregar punto
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
                    Eliminar
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Configuración de función dual (GMMA) */}
      {tipoFuncion === "dual" && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
            <p className="text-xs text-blue-800">
              <strong>Modo GMMA:</strong> Cada punto de atributo (X) define una utilidad mínima (rojo) y una utilidad
              máxima (verde).
            </p>
          </div>

          {/* Renderizamos el nuevo gráfico GMMA centralizado */}
          {renderGraficoGMMA()}

          <div className="space-y-2">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-semibold">Puntos de la función dual (X, Ymin, Ymax):</h4>
              <button
                onClick={agregarPuntoGMMA}
                className="px-3 py-1 bg-green-700 text-white text-xs rounded hover:bg-green-800"
              >
                + Agregar punto (X)
              </button>
            </div>

            {puntosGMMA.map((punto, index) => (
              <div key={index} className="flex gap-2 items-center">
                <span className="text-xs w-16">Punto {index + 1}:</span>
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
                    Eliminar
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}