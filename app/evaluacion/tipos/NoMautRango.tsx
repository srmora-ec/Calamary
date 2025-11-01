"use client"

import React, { useState } from "react"
import { Table, Input, Button, InputNumber, message, Spin } from "antd"
import { type Modelo, type Nodo } from "@/types/modelo"
// Se asume que estos tipos (Alternativa, ResultadoRango, etc.) se exportan desde "../page"
import { Alternativa, ValorCriterio, AlternativaValores, ResultadoEvaluacion, ValorRango, ResultadoRango } from "../page" 

// ----------------------------------------------------------------------
// Props y Lógica Específica
// ----------------------------------------------------------------------

interface NoMautRangoProps {
  modelo: Modelo | null
  alternativas: Alternativa[]
  setAlternativas: React.Dispatch<React.SetStateAction<Alternativa[]>>
  setResultadoEvaluacion: React.Dispatch<React.SetStateAction<ResultadoEvaluacion | null>>
  criteriosFinales: Nodo[]
}

const getValorInicialParaCriterio = (criterio: Nodo): ValorCriterio => ({
  tipo: "rango",
  min: criterio.min || 0,
  max: criterio.max || 100,
})

const NoMautRango: React.FC<NoMautRangoProps> = ({
  modelo,
  alternativas,
  setAlternativas,
  setResultadoEvaluacion,
  criteriosFinales,
}) => {
  const [evaluando, setEvaluando] = useState(false) // Estado local para el loading

  // --- Lógica de Evaluación por Rango (Min/Avg/Max) ---
  const handleEvaluateRango = async () => {
    if (!modelo || modelo.getMetodo() === "MAUT") {
        // En caso de que se use este componente incorrectamente
        message.error("Método no compatible con evaluación por Rango No-MAUT.")
        return
    }
    if (alternativas.length < 2) {
      message.warning("Debes agregar al menos 2 alternativas para evaluar.")
      return
    }
    setEvaluando(true)
    setResultadoEvaluacion(null)

    try {
      modelo.calcularPesosFinales()
      
      // 1. Construir la matriz de rangos: [[alt1_crit1_range], [alt1_crit2_range], ...]
      const matrix_ranges = alternativas.map((alt) =>
        criteriosFinales.map((crit) => {
          const val = alt.valores[crit.idnodo]
          if (val.tipo !== "rango") {
            // Fallback en caso de dato corrupto, usa el rango del criterio
            return [crit.min || 0, crit.max || 100]
          }
          // Para No-MAUT continuo, los valores son numéricos
          return [val.min, val.max]
        }),
      )

      const tipos = criteriosFinales.map((crit) => (crit.beneficio ? "max" : "min"))
      const weights = criteriosFinales.map((crit) => crit.pesofinal || 0)

      // 2. Llamar a la NUEVA API de rango
      const resRango = await fetch(
        `${process.env.NEXT_PUBLIC_URLFASTCALAMARY}/run-method-rango/${modelo.getData().metodo}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matrix: matrix_ranges, weights, tipos }),
        },
      )
      
      if (!resRango.ok) {
        const errorText = await resRango.text()
        throw new Error(errorText)
      }
      const dataRango: { results: any } = await resRango.json()
      const results = dataRango.results

      // 3. Procesar resultados y reordenar por promedio (AVG)
      const scores = results.puntuaciones_avg as number[]

      // Crear array combinado con score, índice y datos de alternativa
      const combinedData = scores.map((score, idx) => ({
        score,
        idx,
        alternativa: alternativas[idx],
      }))

      // Ordenar por score descendente (mayor score primero)
      combinedData.sort((a, b) => b.score - a.score)

      // Extraer los índices ordenados
      const sortedIndices = combinedData.map((item) => item.idx)

      // 4. Reordenar alternativas y resultados
      const alternativasOrdenadas = sortedIndices.map((idx) => alternativas[idx])
      
      const puntuacionesOrdenadas_min = sortedIndices.map((idx) => results.puntuaciones_min[idx])
      const puntuacionesOrdenadas_avg = sortedIndices.map((idx) => results.puntuaciones_avg[idx])
      const puntuacionesOrdenadas_max = sortedIndices.map((idx) => results.puntuaciones_max[idx])

      const matrizNormalizadaOrdenada_min = sortedIndices.map((idx) => results.matriz_normalizada_min[idx])
      const matrizNormalizadaOrdenada_avg = sortedIndices.map((idx) => results.matriz_normalizada_avg[idx])
      const matrizNormalizadaOrdenada_max = sortedIndices.map((idx) => results.matriz_normalizada_max[idx])

      // 5. Calcular Matriz Ponderada para los 3 escenarios
      const matrizPonderada_min: number[][] = matrizNormalizadaOrdenada_min.map((fila: number[]) =>
        fila.map((valor, idx) => valor * weights[idx]),
      )
      const matrizPonderada_avg: number[][] = matrizNormalizadaOrdenada_avg.map((fila: number[]) =>
        fila.map((valor, idx) => valor * weights[idx]),
      )
      const matrizPonderada_max: number[][] = matrizNormalizadaOrdenada_max.map((fila: number[]) =>
        fila.map((valor, idx) => valor * weights[idx]),
      )

      // 6. Actualizar estado del padre (alternativas ordenadas y resultado)
      setAlternativas(alternativasOrdenadas)

      setResultadoEvaluacion({
        matriz_normalizada_min: matrizNormalizadaOrdenada_min,
        matriz_ponderada_min: matrizPonderada_min,
        puntuaciones_min: puntuacionesOrdenadas_min,

        matriz_normalizada_avg: matrizNormalizadaOrdenada_avg,
        matriz_ponderada_avg: matrizPonderada_avg,
        puntuaciones_avg: puntuacionesOrdenadas_avg,

        matriz_normalizada_max: matrizNormalizadaOrdenada_max,
        matriz_ponderada_max: matrizPonderada_max,
        puntuaciones_max: puntuacionesOrdenadas_max,
        
        ranking: combinedData.map((_, i) => i + 1), // 1 = mejor
      } as ResultadoRango) 

      message.success(`Evaluación RANGO completada exitosamente para ${modelo.getData().metodo}`)

    } catch (error) {
      console.error("[NoMautRango] Error ejecutando evaluación RANGO:", error)
      message.error(
        `Error al ejecutar la evaluación RANGO: ${error instanceof Error ? error.message : "Error desconocido"}`,
      )
      setResultadoEvaluacion(null)
    } finally {
      setEvaluando(false)
    }
  }

  // --- Lógica de Gestión de Alternativas ---
  const agregarAlternativa = () => {
    const nuevaAlternativa: Alternativa = {
      key: `alt-${Date.now()}`,
      nombre: `Alternativa ${alternativas.length + 1}`,
      valores: {},
    }

    criteriosFinales.forEach((criterio) => {
      nuevaAlternativa.valores[criterio.idnodo] = getValorInicialParaCriterio(criterio)
    })

    setAlternativas([...alternativas, nuevaAlternativa])
    setResultadoEvaluacion(null)
    message.success("Alternativa agregada")
  }

  // Actualizar el valor del rango (min o max)
  const actualizarValorRango = (keyAlternativa: string, idCriterio: number, campo: "min" | "max", valor: number) => {
    setAlternativas(
      alternativas.map((alt) => {
        if (alt.key === keyAlternativa) {
          const valorActual = alt.valores[idCriterio]
          // Asegurarse de que el valor actual sea de tipo 'rango'
          const nuevoValor: ValorRango = {
            tipo: "rango",
            min: valorActual.tipo === "rango" ? valorActual.min : 0,
            max: valorActual.tipo === "rango" ? valorActual.max : 100,
          }
          nuevoValor[campo] = valor

          return {
            ...alt,
            valores: {
              ...alt.valores,
              [idCriterio]: nuevoValor,
            },
          }
        }
        return alt
      }),
    )
    setResultadoEvaluacion(null)
  }

  const actualizarNombre = (key: string, nuevoNombre: string) => {
    setAlternativas(
      alternativas.map((alt) => (alt.key === key ? { ...alt, nombre: nuevoNombre } : alt)),
    )
  }

  const eliminarAlternativa = (key: string) => {
    setAlternativas(alternativas.filter((alt) => alt.key !== key))
    setResultadoEvaluacion(null)
    message.success("Alternativa eliminada")
  }

  // Columnas dinámicas para los criterios (Min y Max)
  const columnasValores = criteriosFinales.flatMap((criterio: Nodo) => [
    {
      title: `${criterio.titulo} (Min)`,
      dataIndex: ["valores", criterio.idnodo],
      key: `criterio-${criterio.idnodo}-min`,
      width: 150,
      render: (valorCriterio: ValorCriterio, record: Alternativa) => {
        const valor = valorCriterio?.tipo === "rango" ? valorCriterio.min : criterio.min || 0
        return (
          <InputNumber
            value={valor}
            onChange={(val) => actualizarValorRango(record.key, criterio.idnodo, "min", val || 0)}
            min={criterio.min || 0}
            max={criterio.max || 100}
            className="w-full"
          />
        )
      },
    },
    {
      title: `${criterio.titulo} (Max)`,
      dataIndex: ["valores", criterio.idnodo],
      key: `criterio-${criterio.idnodo}-max`,
      width: 150,
      render: (valorCriterio: ValorCriterio, record: Alternativa) => {
        const valor = valorCriterio?.tipo === "rango" ? valorCriterio.max : criterio.max || 100
        return (
          <InputNumber
            value={valor}
            onChange={(val) => actualizarValorRango(record.key, criterio.idnodo, "max", val || 0)}
            min={criterio.min || 0}
            max={criterio.max || 100}
            className="w-full"
          />
        )
      },
    },
  ])

  const columns = [
    {
      title: "Alternativa",
      dataIndex: "nombre",
      key: "nombre",
      width: 200,
      render: (text: string, record: Alternativa) => (
        <Input
          value={text}
          onChange={(e) => actualizarNombre(record.key, e.target.value)}
          placeholder="Nombre de alternativa"
        />
      ),
    },
    ...columnasValores,
    {
      title: "Acciones",
      key: "acciones",
      width: 100,
      render: (_: any, record: Alternativa) => (
        <Button type="text" danger onClick={() => eliminarAlternativa(record.key)}>
          Eliminar
        </Button>
      ),
    },
  ]

  // ----------------------------------------------------------------------
  // Renderizado
  // ----------------------------------------------------------------------

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold">Gestión de Alternativas (Rango: Mín-Máx)</h3>
        <div className="flex gap-2">
          <Button type="primary" onClick={agregarAlternativa}>
            Agregar Alternativa
          </Button>
          <Button
            type="primary"
            onClick={handleEvaluateRango}
            disabled={alternativas.length < 2 || evaluando}
            loading={evaluando}
            className="bg-green-600 hover:bg-green-700"
          >
            {evaluando ? "Evaluando..." : "Evaluar Alternativas (Rango)"}
          </Button>
        </div>
      </div>
      
      <div className="bg-white rounded-lg border">
        <Table columns={columns} dataSource={alternativas} pagination={false} scroll={{ x: "max-content" }} />
      </div>

      <div className="text-sm text-gray-500">
        <p>
          **Método:** `{modelo?.getData().metodo || "No Seleccionado"}` **| Modo:** Rango (Min-Max) por criterio.
        </p>
        <p className="mt-2 text-xs text-gray-400">
          **Información:** La evaluación se ejecutará tres veces (**Mínimo**, **Promedio** y **Máximo**) para proporcionar un rango de puntuaciones. El ranking se calculará en base al **Puntaje Promedio**.
        </p>
      </div>
    </div>
  )
}

export default NoMautRango