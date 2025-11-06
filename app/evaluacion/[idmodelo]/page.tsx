"use client"

import { useParams } from "next/navigation"
import { useEffect, useState, useRef } from "react"
import { Tabs, Button, Table, Input, InputNumber, message, Switch, Spin, Upload, Select, Card } from "antd"
import { UploadOutlined, LeftOutlined, RightOutlined } from "@ant-design/icons"
import { Modelo, type ModeloData, type Nodo } from "@/types/modelo"
import ModeloSvgViewer from "@/components/modelo-svg-viewer"
import UnidimensionalSensitivityAnalysis from "@/components/AnalisisDeSensibilidad/unidimensional-sensitivity-analysis"
import Modal from "@/components/Modal"
import { supabase } from "@/lib/supabase"
import * as XLSX from "xlsx"

type ModoValor = "unico" | "rango"

interface ValorUnico {
  tipo: "unico"
  valor: number | string
}

interface ValorRango {
  tipo: "rango"
  min: number
  max: number
}

type ValorCriterio = ValorUnico | ValorRango

interface AlternativaValores {
  [idCriterio: number]: ValorCriterio
}

interface Alternativa {
  key: string
  nombre: string
  valores: AlternativaValores
}

interface ResultadoSAW {
  matriz_normalizada: number[][]
  matriz_ponderada: number[][]
  puntuaciones: number[]
  ranking: number[]
  result_min?: number[][]
  result_max?: number[][]
  score_min?: number[]
  score_avg?: number[]
  score_max?: number[]
}

export default function AlternativasPage() {
  const { idmodelo } = useParams()
  const [modelo, setModelo] = useState<Modelo | null>(null)
  const [loading, setLoading] = useState(true)
  const [alternativas, setAlternativas] = useState<Alternativa[]>([])
  const [modoValor, setModoValor] = useState<ModoValor>("unico")
  const [resultadoSAW, setResultadoSAW] = useState<ResultadoSAW | null>(null)
  const [evaluando, setEvaluando] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [validacionMAUT, setValidacionMAUT] = useState<string | null>(null)
  const [sensitivityModalOpen, setOpenSensitivityModal] = useState(false)
  const [selectedAnalysisType, setSelectedAnalysisType] = useState<"unidimensional" | null>(null)

  const criteriosFinales = modelo?.getCriteriosFinales() || []

  useEffect(() => {
    if (modelo && modelo.getData().metodo === "MAUT") {
      const resumen = modelo.obtenerResumenValidacionMAUT()
      const validacion = modelo.verificarFuncionesUtilidad()

      if (!validacion.valido) {
        setValidacionMAUT(resumen)
      } else {
        setValidacionMAUT(null)
      }
    } else {
      setValidacionMAUT(null)
    }
  }, [modelo])

  useEffect(() => {
    const fetchModelo = async () => {
      setLoading(true)

      const { data, error } = await supabase.rpc("get_modelo_with_nodos", {
        p_idmodelo: Number(idmodelo),
      })

      if (error) {
        console.error("Error cargando modelo:", error)
        message.error("Error al cargar el modelo")
        setLoading(false)
        return
      }

      if (data) {
        const mapped: ModeloData = {
          id: data.modelo.id?.toString(),
          nombre: data.modelo.nombre,
          descripcion: data.modelo.descripcion,
          orientacion: data.modelo.orientacion,
          linea: data.modelo.linea,
          publico: data.modelo.publico,
          metodo: data.modelo.metodo,
          nodos: {
            nodes: (data.modelo.nodos?.nodes ?? []).map((n: any) => ({
              idnodo: n.idnodo,
              posx: n.posx,
              posy: n.posy,
              titulo: n.titulo,
              idpadre: n.idpadre,
              descripcion: n.descripcion,
              peso: n.peso,
              pesofinal: n.pesofinal,
              acortado: n.acortado,
              beneficio: n.beneficio,
              min: n.min,
              max: n.max,
              criterioFinal: n.criterioFinal,
              MAUT: n.MAUT,
            })),
          },
        }

        const modeloObj = new Modelo(mapped)
        setModelo(modeloObj)
      }
      setLoading(false)
    }

    fetchModelo()
  }, [idmodelo])

  const prepareAPIData = () => {
    if (!modelo) return null

    modelo.calcularPesosFinales()
    const criteriosFinales = modelo.getCriteriosFinales()

    const matrix = alternativas.map((alt) =>
      criteriosFinales.map((crit) => {
        const val = alt.valores[crit.idnodo]
        return val.tipo === "unico" ? (val.valor as number) : (val.min + val.max) / 2
      }),
    )

    const tipos = criteriosFinales.map((crit) => (crit.beneficio ? "max" : "min"))

    return { matrix, tipos }
  }

  const openSensitivityAnalysis = (type: "unidimensional" | "multidimensional") => {
    setSelectedAnalysisType(type)
    setOpenSensitivityModal(true)
  }

  const ejecutarMetodo = async () => {
    if (alternativas.length < 2) {
      message.warning("Debes agregar al menos 2 alternativas para evaluar")
      return
    }
    setEvaluando(true)

    if (modelo?.getMetodo() == "MAUT") {
      try {
        if (validacionMAUT) {
          message.error("No se puede evaluar. Faltan funciones de utilidad en los criterios finales (MAUT)")
          setEvaluando(false)
          return
        }

        modelo?.calcularPesosFinales()

        if (modoValor === "rango") {
          const matrix_min = alternativas.map((alt) =>
            criteriosFinales.map((crit) => {
              const val = alt.valores[crit.idnodo]

              if (crit.MAUT?.tipoFuncion === "discreta") {
                return val.tipo === "rango" ? val.min?.toString() || "" : ""
              }

              if (val.tipo === "rango") {
                return val.min
              }
              return 0
            }),
          )

          const matrix_max = alternativas.map((alt) =>
            criteriosFinales.map((crit) => {
              const val = alt.valores[crit.idnodo]

              if (crit.MAUT?.tipoFuncion === "discreta") {
                return val.tipo === "rango" ? val.max?.toString() || "" : ""
              }

              if (val.tipo === "rango") {
                return val.max
              }
              return 100
            }),
          )

          const criterios = criteriosFinales.map((crit) => ({
            idnodo: crit.idnodo,
            titulo: crit.titulo,
            criterioFinal: crit.criterioFinal,
            min: crit.min,
            max: crit.max,
            MAUT: crit.MAUT,
          }))

          const resNormalizacion = await fetch(`${process.env.NEXT_PUBLIC_URLFASTCALAMARY}/maut/normalizar/rango`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ matrix_min, matrix_max, criterios }),
          })

          if (!resNormalizacion.ok) {
            const errorText = await resNormalizacion.text()
            throw new Error(errorText)
          }

          const dataNormalizacion = await resNormalizacion.json()
          const matrizMin = dataNormalizacion.result_min
          const matrizPromedioMin = dataNormalizacion.result_promedio_min
          const matrizPromedioMax = dataNormalizacion.result_promedio_max
          const matrizMax = dataNormalizacion.result_max

          const weights = criteriosFinales.map((crit) => crit.pesofinal || 0)

          const resPuntaje = await fetch(`${process.env.NEXT_PUBLIC_URLFASTCALAMARY}/maut/puntaje/rango`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              matrix_norm_min: matrizMin,
              matrix_norm_promedio_min: matrizPromedioMin,
              matrix_norm_promedio_max: matrizPromedioMax,
              matrix_norm_max: matrizMax,
              weights,
            }),
          })

          if (!resPuntaje.ok) {
            const errorText = await resPuntaje.text()
            throw new Error(errorText)
          }

          const dataPuntaje = await resPuntaje.json()
          const scoreMin = dataPuntaje.result.score_min
          const scoreAvg = dataPuntaje.result.score_avg
          const scoreMax = dataPuntaje.result.score_max

          const combinedData = scoreAvg.map((score, idx) => ({
            score,
            scoreMin: scoreMin[idx],
            scoreMax: scoreMax[idx],
            idx,
            alternativa: alternativas[idx],
            matrizMin: matrizMin[idx],
            matrizMax: matrizMax[idx],
          }))

          combinedData.sort((a, b) => b.score - a.score)

          const alternativasOrdenadas = combinedData.map((item) => item.alternativa)
          const puntuacionesOrdenadas = combinedData.map((item) => item.score)
          const puntuacionesMinOrdenadas = combinedData.map((item) => item.scoreMin)
          const puntuacionesMaxOrdenadas = combinedData.map((item) => item.scoreMax)
          const matrizMinOrdenada = combinedData.map((item) => item.matrizMin)
          const matrizMaxOrdenada = combinedData.map((item) => item.matrizMax)

          // Calculamos matriz ponderada usando score_avg
          const matrizPonderada: number[][] = puntuacionesOrdenadas.map((score) => [score])

          setAlternativas(alternativasOrdenadas)

          setResultadoSAW({
            matriz_normalizada: [], // No se usa en modo rango
            matriz_ponderada: matrizPonderada,
            puntuaciones: puntuacionesOrdenadas,
            ranking: combinedData.map((_, i) => i + 1),
            result_min: matrizMinOrdenada,
            result_max: matrizMaxOrdenada,
            score_min: puntuacionesMinOrdenadas,
            score_avg: puntuacionesOrdenadas,
            score_max: puntuacionesMaxOrdenadas,
          })

          message.success("Evaluación MAUT (rango) completada exitosamente")
          setEvaluando(false)
          return
        }

        const matrix = alternativas.map((alt) =>
          criteriosFinales.map((crit) => {
            const val = alt.valores[crit.idnodo]

            if (crit.MAUT?.tipoFuncion === "discreta") {
              if (val.tipo === "rango") {
                return val.min?.toString() || ""
              }
              return val.tipo === "unico" ? (val.valor as string) : ""
            }

            if (val.tipo === "unico") {
              return Number(val.valor)
            } else if (val.tipo === "rango") {
              return (val.min + val.max) / 2
            }
            return 0
          }),
        )

        const criterios = criteriosFinales.map((crit) => ({
          idnodo: crit.idnodo,
          titulo: crit.titulo,
          criterioFinal: crit.criterioFinal,
          MAUT: crit.MAUT,
        }))

        const resNormalizacion = await fetch(`${process.env.NEXT_PUBLIC_URLFASTCALAMARY}/maut/normalizar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matrix, criterios }),
        })

        if (!resNormalizacion.ok) {
          const errorText = await resNormalizacion.text()
          throw new Error(errorText)
        }

        const dataNormalizacion = await resNormalizacion.json()
        const matrizNormalizada = dataNormalizacion.result

        const weights = criteriosFinales.map((crit) => crit.pesofinal || 0)

        const resAgregacion = await fetch(`${process.env.NEXT_PUBLIC_URLFASTCALAMARY}/run-method/SAW/agregar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matrix: matrizNormalizada, weights }),
        })

        if (!resAgregacion.ok) {
          const errorText = await resAgregacion.text()
          throw new Error(errorText)
        }

        const dataAgregacion: { result: number[] } = await resAgregacion.json()
        const scores = dataAgregacion.result

        const combinedData = scores.map((score, idx) => ({
          score,
          idx,
          alternativa: alternativas[idx],
          matrizNormalizada: matrizNormalizada[idx],
        }))

        combinedData.sort((a, b) => b.score - a.score)

        const alternativasOrdenadas = combinedData.map((item) => item.alternativa)
        const puntuacionesOrdenadas = combinedData.map((item) => item.score)
        const matrizNormalizadaOrdenada = combinedData.map((item) => item.matrizNormalizada)

        const matrizPonderada: number[][] = matrizNormalizadaOrdenada.map((fila: number[]) =>
          fila.map((valor, idx) => valor * weights[idx]),
        )

        setAlternativas(alternativasOrdenadas)

        setResultadoSAW({
          matriz_normalizada: matrizNormalizadaOrdenada,
          matriz_ponderada: matrizPonderada,
          puntuaciones: puntuacionesOrdenadas,
          ranking: combinedData.map((_, i) => i + 1),
        })

        message.success("Evaluación MAUT completada exitosamente")
      } catch (error) {
        console.error("[v0] Error ejecutando evaluación MAUT:", error)
        message.error(
          `Error al ejecutar la evaluación MAUT: ${error instanceof Error ? error.message : "Error desconocido"}`,
        )
      } finally {
        setEvaluando(false)
      }
      return
    }

    try {
      modelo?.calcularPesosFinales()

      const matrix = alternativas.map((alt) =>
        criteriosFinales.map((crit) => {
          const val = alt.valores[crit.idnodo]
          return val.tipo === "unico" ? (val.valor as number) : (val.min + val.max) / 2
        }),
      )

      const tipos = criteriosFinales.map((crit) => (crit.beneficio ? "max" : "min"))
      const weights = criteriosFinales.map((crit) => crit.pesofinal || 0)

      const resNormalizacion = await fetch(
        `${process.env.NEXT_PUBLIC_URLFASTCALAMARY}/run-method/${modelo?.getData().metodo}/normalizar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matrix, weights, tipos }),
        },
      )
      if (!resNormalizacion.ok) throw new Error(await resNormalizacion.text())
      const dataNormalizacion = await resNormalizacion.json()
      const matrizNormalizada = dataNormalizacion.result

      const resAgregacion = await fetch(
        `${process.env.NEXT_PUBLIC_URLFASTCALAMARY}/run-method/${modelo?.getData().metodo}/agregar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matrix: matrizNormalizada, weights, tipos }),
        },
      )
      if (!resAgregacion.ok) throw new Error(await resAgregacion.text())
      const dataAgregacion: { result: number[] } = await resAgregacion.json()
      const scores = dataAgregacion.result

      const combinedData = scores.map((score, idx) => ({
        score,
        idx,
        alternativa: alternativas[idx],
        matrizNormalizada: matrizNormalizada[idx],
      }))

      combinedData.sort((a, b) => b.score - a.score)

      const alternativasOrdenadas = combinedData.map((item) => item.alternativa)
      const puntuacionesOrdenadas = combinedData.map((item) => item.score)
      const matrizNormalizadaOrdenada = combinedData.map((item) => item.matrizNormalizada)

      const matrizPonderada: number[][] = matrizNormalizadaOrdenada.map((fila: number[]) =>
        fila.map((valor, idx) => valor * weights[idx]),
      )

      setAlternativas(alternativasOrdenadas)

      setResultadoSAW({
        matriz_normalizada: matrizNormalizadaOrdenada,
        matriz_ponderada: matrizPonderada,
        puntuaciones: puntuacionesOrdenadas,
        ranking: combinedData.map((_, i) => i + 1),
      })

      message.success("Evaluación completada exitosamente")
    } catch (error) {
      console.error("[v0] Error ejecutando evaluación:", error)
      message.error("Error al ejecutar la evaluación")
    } finally {
      setEvaluando(false)
    }
  }

  const getValorInicialParaCriterio = (criterio: Nodo, modo: ModoValor): ValorCriterio => {
    const isMautDiscreto =
      modelo?.getMetodo() === "MAUT" &&
      criterio.MAUT?.tipoFuncion === "discreta" &&
      criterio.MAUT.funcionDiscreta?.valores.length

    if (modo === "unico") {
      if (isMautDiscreto) {
        return {
          tipo: "unico",
          valor: criterio.MAUT!.funcionDiscreta!.valores[0].nombre,
        }
      }
      return {
        tipo: "unico",
        valor: criterio.min || 0,
      }
    } else {
      if (isMautDiscreto) {
        const defaultValue = criterio.MAUT!.funcionDiscreta!.valores[0].nombre as unknown as number
        return {
          tipo: "rango",
          min: defaultValue,
          max: defaultValue,
        }
      }
      return {
        tipo: "rango",
        min: criterio.min || 0,
        max: criterio.max || 100,
      }
    }
  }

  const agregarAlternativa = () => {
    const nuevaAlternativa: Alternativa = {
      key: `alt-${Date.now()}`,
      nombre: `Alternativa ${alternativas.length + 1}`,
      valores: {},
    }

    criteriosFinales.forEach((criterio) => {
      nuevaAlternativa.valores[criterio.idnodo] = getValorInicialParaCriterio(criterio, modoValor)
    })

    setAlternativas([...alternativas, nuevaAlternativa])
    setResultadoSAW(null)
    message.success("Alternativa agregada")
  }

  const eliminarAlternativa = (key: string) => {
    setAlternativas(alternativas.filter((alt) => alt.key !== key))
    setResultadoSAW(null)
    message.success("Alternativa eliminada")
  }

  const actualizarValorUnico = (keyAlternativa: string, idCriterio: number, valor: number | string) => {
    setAlternativas(
      alternativas.map((alt) => {
        if (alt.key === keyAlternativa) {
          return {
            ...alt,
            valores: {
              ...alt.valores,
              [idCriterio]: {
                tipo: "unico",
                valor,
              },
            },
          }
        }
        return alt
      }),
    )
    setResultadoSAW(null)
  }

  const actualizarValorRango = (
    keyAlternativa: string,
    idCriterio: number,
    campo: "min" | "max",
    valor: number | string,
  ) => {
    setAlternativas(
      alternativas.map((alt) => {
        if (alt.key === keyAlternativa) {
          const valorActual = alt.valores[idCriterio]
          const currentMin = valorActual.tipo === "rango" ? valorActual.min : 0
          const currentMax = valorActual.tipo === "rango" ? valorActual.max : 100

          const newMin = campo === "min" ? (valor as unknown as number) : currentMin
          const newMax = campo === "max" ? (valor as unknown as number) : currentMax

          const nuevoValor: ValorRango = {
            tipo: "rango",
            min: newMin,
            max: newMax,
          }

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
    setResultadoSAW(null)
  }

  const actualizarNombre = (key: string, nuevoNombre: string) => {
    setAlternativas(
      alternativas.map((alt) => {
        if (alt.key === key) {
          return { ...alt, nombre: nuevoNombre }
        }
        return alt
      }),
    )
  }

  const handleExcelUpload = (file: File) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: "binary" })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

        if (jsonData.length < 2) {
          message.error("El archivo Excel debe tener al menos una fila de encabezados y una fila de datos")
          return
        }

        const nuevasAlternativas: Alternativa[] = []

        if (modoValor === "rango" && modelo?.getMetodo() === "MAUT") {
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i]
            if (!row || row.length === 0) continue

            const nombreAlternativa = row[0]?.toString() || `Alternativa ${i}`
            const nuevaAlternativa: Alternativa = {
              key: `alt-${Date.now()}-${i}`,
              nombre: nombreAlternativa,
              valores: {},
            }

            let excelColIdx = 1
            criteriosFinales.forEach((criterio) => {
              const valorMin = row[excelColIdx]
              const valorMax = row[excelColIdx + 1]

              if (criterio.MAUT?.tipoFuncion === "discreta") {
                const valorMinStr = valorMin?.toString().trim() || ""
                const valorMaxStr = valorMax?.toString().trim() || ""
                const opcionesDiscretas = criterio.MAUT.funcionDiscreta?.valores || []

                const opcionMin = opcionesDiscretas.find((op) => op.nombre.toLowerCase() === valorMinStr.toLowerCase())
                const opcionMax = opcionesDiscretas.find((op) => op.nombre.toLowerCase() === valorMaxStr.toLowerCase())

                nuevaAlternativa.valores[criterio.idnodo] = {
                  tipo: "rango",
                  min: (opcionMin?.nombre as unknown as number) || (opcionesDiscretas[0]?.nombre as unknown as number),
                  max: (opcionMax?.nombre as unknown as number) || (opcionesDiscretas[0]?.nombre as unknown as number),
                }
              } else {
                const numMin = typeof valorMin === "number" ? valorMin : Number.parseFloat(valorMin?.toString() || "0")
                const numMax =
                  typeof valorMax === "number" ? valorMax : Number.parseFloat(valorMax?.toString() || "100")

                nuevaAlternativa.valores[criterio.idnodo] = {
                  tipo: "rango",
                  min: !isNaN(numMin) ? numMin : criterio.min || 0,
                  max: !isNaN(numMax) ? numMax : criterio.max || 100,
                }
              }

              excelColIdx += 2
            })

            nuevasAlternativas.push(nuevaAlternativa)
          }
        } else {
          const headers = jsonData[0].slice(1)

          if (headers.length !== criteriosFinales.length) {
            message.warning(
              `El Excel tiene ${headers.length} columnas de criterios, pero el modelo tiene ${criteriosFinales.length} criterios finales. Se intentará hacer coincidir por nombre.`,
            )
          }

          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i]
            if (!row || row.length === 0) continue

            const nombreAlternativa = row[0]?.toString() || `Alternativa ${i}`
            const nuevaAlternativa: Alternativa = {
              key: `alt-${Date.now()}-${i}`,
              nombre: nombreAlternativa,
              valores: {},
            }

            criteriosFinales.forEach((criterio, criterioIdx) => {
              const excelColIdx = criterioIdx + 1
              const valor = row[excelColIdx]

              if (modelo?.getMetodo() === "MAUT" && criterio.MAUT?.tipoFuncion === "discreta") {
                const valorStr = valor?.toString().trim() || ""
                const opcionesDiscretas = criterio.MAUT.funcionDiscreta?.valores || []
                const opcionEncontrada = opcionesDiscretas.find(
                  (op) => op.nombre.toLowerCase() === valorStr.toLowerCase(),
                )

                nuevaAlternativa.valores[criterio.idnodo] = {
                  tipo: "unico",
                  valor: opcionEncontrada?.nombre || opcionesDiscretas[0]?.nombre || "",
                }
              } else {
                if (valor !== undefined && valor !== null && valor !== "") {
                  const numValor = typeof valor === "number" ? valor : Number.parseFloat(valor.toString())

                  nuevaAlternativa.valores[criterio.idnodo] = {
                    tipo: "unico",
                    valor: !isNaN(numValor) ? numValor : criterio.min || 0,
                  }
                } else {
                  nuevaAlternativa.valores[criterio.idnodo] = {
                    tipo: "unico",
                    valor: criterio.min || 0,
                  }
                }
              }
            })

            nuevasAlternativas.push(nuevaAlternativa)
          }
        }

        setAlternativas(nuevasAlternativas)
        setResultadoSAW(null)
        message.success(`Se cargaron ${nuevasAlternativas.length} alternativas desde el Excel`)
      } catch (error) {
        console.error("Error procesando Excel:", error)
        message.error("Error al procesar el archivo Excel")
      }
    }

    reader.readAsBinaryString(file)
    return false
  }

  const renderValorUnicoCell = (criterio: Nodo, valorCriterio: ValorCriterio, record: Alternativa) => {
    if (modelo?.getMetodo() === "MAUT" && criterio.MAUT?.tipoFuncion === "discreta") {
      const opcionesDiscretas = criterio.MAUT.funcionDiscreta?.valores || []
      const valorSeleccionado =
        valorCriterio?.tipo === "unico" && typeof valorCriterio.valor === "string"
          ? valorCriterio.valor
          : opcionesDiscretas[0]?.nombre || ""

      return (
        <Select
          value={valorSeleccionado}
          onChange={(val) => actualizarValorUnico(record.key, criterio.idnodo, val)}
          className="w-full"
          options={opcionesDiscretas.map((op) => ({
            label: op.nombre,
            value: op.nombre,
          }))}
        />
      )
    }

    const valor =
      valorCriterio?.tipo === "unico" && typeof valorCriterio.valor === "number"
        ? valorCriterio.valor
        : criterio.min || 0

    return (
      <InputNumber
        value={valor}
        onChange={(val) => actualizarValorUnico(record.key, criterio.idnodo, val || 0)}
        min={criterio.min || 0}
        max={criterio.max || 100}
        className="w-full"
      />
    )
  }

  const renderRangeCell = (criterio: Nodo, valorCriterio: ValorCriterio, record: Alternativa, campo: "min" | "max") => {
    const isMautDiscreto = modelo?.getMetodo() === "MAUT" && criterio.MAUT?.tipoFuncion === "discreta"

    if (isMautDiscreto) {
      const opcionesDiscretas = criterio.MAUT.funcionDiscreta?.valores || []
      const rawValue = valorCriterio?.tipo === "rango" ? (campo === "min" ? valorCriterio.min : valorCriterio.max) : ""
      const valorSeleccionado =
        opcionesDiscretas.find((op) => op.nombre === rawValue)?.nombre || opcionesDiscretas[0]?.nombre || ""

      return (
        <Select
          value={valorSeleccionado}
          onChange={(val) => actualizarValorRango(record.key, criterio.idnodo, campo, val)}
          className="w-full"
          options={opcionesDiscretas.map((op) => ({
            label: op.nombre,
            value: op.nombre,
          }))}
        />
      )
    }

    const valor =
      valorCriterio?.tipo === "rango"
        ? campo === "min"
          ? valorCriterio.min
          : valorCriterio.max
        : campo === "min"
          ? criterio.min || 0
          : criterio.max || 100

    return (
      <InputNumber
        value={valor}
        onChange={(val) => actualizarValorRango(record.key, criterio.idnodo, campo, val || 0)}
        min={criterio.min || 0}
        max={criterio.max || 100}
        className="w-full"
      />
    )
  }

  const columnasValores =
    modoValor === "unico"
      ? criteriosFinales.map((criterio: Nodo) => ({
          title: criterio.titulo,
          dataIndex: ["valores", criterio.idnodo],
          key: `criterio-${criterio.idnodo}`,
          width: 150,
          render: (valorCriterio: ValorCriterio, record: Alternativa) =>
            renderValorUnicoCell(criterio, valorCriterio, record),
        }))
      : criteriosFinales.flatMap((criterio: Nodo) => [
          {
            title: `${criterio.titulo} (Min)`,
            dataIndex: ["valores", criterio.idnodo],
            key: `criterio-${criterio.idnodo}-min`,
            width: 150,
            render: (valorCriterio: ValorCriterio, record: Alternativa) =>
              renderRangeCell(criterio, valorCriterio, record, "min"),
          },
          {
            title: `${criterio.titulo} (Max)`,
            dataIndex: ["valores", criterio.idnodo],
            key: `criterio-${criterio.idnodo}-max`,
            width: 150,
            render: (valorCriterio: ValorCriterio, record: Alternativa) =>
              renderRangeCell(criterio, valorCriterio, record, "max"),
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

  const columnasNormalizadas = [
    {
      title: "Alternativa",
      dataIndex: "nombre",
      key: "nombre",
      width: 200,
      fixed: "left" as const,
    },
    ...criteriosFinales.flatMap((criterio: Nodo, idx: number) =>
      modoValor === "rango" && resultadoSAW?.result_min
        ? [
            {
              title: `${criterio.titulo} (Mín)`,
              dataIndex: `criterio_${idx}_min`,
              key: `criterio_${idx}_min`,
              width: 120,
              render: (value: number) => value?.toFixed(4) || "0.0000",
            },
            {
              title: `${criterio.titulo} (Máx)`,
              dataIndex: `criterio_${idx}_max`,
              key: `criterio_${idx}_max`,
              width: 120,
              render: (value: number) => value?.toFixed(4) || "0.0000",
            },
          ]
        : [
            {
              title: criterio.titulo,
              dataIndex: `criterio_${idx}`,
              key: `criterio_${idx}`,
              width: 120,
              render: (value: number) => value?.toFixed(4) || "0.0000",
            },
          ],
    ),
  ]

  const datosNormalizados = resultadoSAW
    ? alternativas.map((alt, idx) => {
        const baseData = {
          key: alt.key,
          nombre: alt.nombre,
        }

        if (modoValor === "rango" && resultadoSAW.result_min) {
          criteriosFinales.forEach((_, criterioIdx) => {
            baseData[`criterio_${criterioIdx}_min`] = resultadoSAW.result_min?.[idx]?.[criterioIdx] || 0
            baseData[`criterio_${criterioIdx}_max`] = resultadoSAW.result_max?.[idx]?.[criterioIdx] || 0
          })
        } else {
          criteriosFinales.forEach((_, criterioIdx) => {
            baseData[`criterio_${criterioIdx}`] = resultadoSAW.matriz_normalizada[idx]?.[criterioIdx] || 0
          })
        }

        return baseData
      })
    : []

  const columnasResultados = [
    {
      title: "Ranking",
      dataIndex: "ranking",
      key: "ranking",
      width: 100,
      render: (ranking: number) => (
        <div className="flex items-center justify-center">
          <span className="text-lg font-bold">{ranking}</span>
        </div>
      ),
    },
    {
      title: "Alternativa",
      dataIndex: "nombre",
      key: "nombre",
      width: 250,
    },
    ...(modoValor === "rango" && resultadoSAW?.score_min
      ? [
          {
            title: "Puntaje (Mín)",
            dataIndex: "puntuacion_min",
            key: "puntuacion_min",
            width: 150,
            render: (puntuacion: number) => <div className="font-semibold text-blue-400">{puntuacion?.toFixed(4)}</div>,
          },
          {
            title: "Puntaje (Avg)",
            dataIndex: "puntuacion",
            key: "puntuacion",
            width: 150,
            render: (puntuacion: number) => <div className="font-semibold text-blue-600">{puntuacion?.toFixed(4)}</div>,
          },
          {
            title: "Puntaje (Máx)",
            dataIndex: "puntuacion_max",
            key: "puntuacion_max",
            width: 150,
            render: (puntuacion: number) => <div className="font-semibold text-blue-800">{puntuacion?.toFixed(4)}</div>,
          },
        ]
      : [
          {
            title: "Puntuación",
            dataIndex: "puntuacion",
            key: "puntuacion",
            width: 150,
            render: (puntuacion: number) => <div className="font-semibold text-blue-600">{puntuacion.toFixed(4)}</div>,
          },
        ]),
    {
      title: "Porcentaje",
      dataIndex: "porcentaje",
      key: "porcentaje",
      width: 150,
      render: (porcentaje: number) => (
        <div className="w-full">
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-200 rounded-full h-6 overflow-hidden">
              <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${porcentaje}%` }} />
            </div>
            <span className="text-sm font-medium">{porcentaje.toFixed(1)}%</span>
          </div>
        </div>
      ),
    },
  ]

  const datosResultados = resultadoSAW
    ? resultadoSAW.ranking.map((rank, idx) => ({
        key: alternativas[idx].key,
        nombre: alternativas[idx].nombre,
        puntuacion: resultadoSAW.puntuaciones[idx],
        puntuacion_min: resultadoSAW.score_min?.[idx] || 0,
        puntuacion_max: resultadoSAW.score_max?.[idx] || 0,
        ranking: rank,
        porcentaje:
          modoValor === "rango" && resultadoSAW.score_avg
            ? (resultadoSAW.score_avg[idx] / Math.max(...(resultadoSAW.score_avg || [1]))) * 100
            : (resultadoSAW.puntuaciones[idx] / Math.max(...resultadoSAW.puntuaciones)) * 100,
      }))
    : []

  const tabItems = [
    {
      key: "1",
      label: "Alternativas",
      children: (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-semibold">Gestión de Alternativas</h3>
              {modelo?.getMetodo() === "MAUT" && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Modo:</span>
                  <span className={`text-sm font-medium ${modoValor === "unico" ? "text-blue-600" : "text-gray-400"}`}>
                    Valor Único
                  </span>
                  <Switch
                    checked={modoValor === "rango"}
                    onChange={(checked) => {
                      setModoValor(checked ? "rango" : "unico")
                      setAlternativas([])
                      setResultadoSAW(null)
                    }}
                  />
                  <span className={`text-sm font-medium ${modoValor === "rango" ? "text-blue-600" : "text-gray-400"}`}>
                    Rango (Min-Max)
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Upload accept=".xlsx,.xls" beforeUpload={handleExcelUpload} showUploadList={false}>
                <Button icon={<UploadOutlined />}>Cargar desde Excel</Button>
              </Upload>
              <Button type="primary" onClick={agregarAlternativa}>
                Agregar Alternativa
              </Button>
              <Button
                type="primary"
                onClick={ejecutarMetodo}
                disabled={alternativas.length < 2 || !!validacionMAUT}
                loading={evaluando}
                className="bg-green-600 hover:bg-green-700"
              >
                Evaluar Alternativas
              </Button>
            </div>
          </div>
          {validacionMAUT && (
            <div className="space-y-2 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              <p className="font-medium">
                ⚠️ **No se puede evaluar** porque faltan funciones de utilidad (Método **MAUT**):
              </p>
              <div className="whitespace-pre-line text-sm">{validacionMAUT}</div>
              <p className="text-sm mt-2 text-red-600">
                Por favor, configura las funciones de utilidad para todos los criterios finales en el tablero del modelo
                antes de evaluar.
              </p>
            </div>
          )}
          <div className="bg-white rounded-lg border">
            <Table columns={columns} dataSource={alternativas} pagination={false} scroll={{ x: "max-content" }} />
          </div>

          <div className="text-sm text-gray-500">
            <p>
              <strong>Criterios finales:</strong> {criteriosFinales.length}
            </p>
            <p>
              <strong>Alternativas:</strong> {alternativas.length}
            </p>
            <p>
              <strong>Modo actual:</strong>{" "}
              {modoValor === "unico" ? "Valor único por criterio" : "Rango (mín-máx) por criterio"}
            </p>
            <p className="mt-2 text-xs text-gray-400">
              <strong>Formato Excel:</strong> Primera columna = nombres de alternativas, siguientes columnas = valores
              para cada criterio (en modo rango: criterio1_min, criterio1_max, criterio2_min, criterio2_max, ...).
              <strong>Para MAUT discreto:</strong> el valor debe coincidir con el nombre de la opción discreta
              configurada.
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "2",
      label: "Evaluación (Normalizada)",
      children: (
        <div className="space-y-4">
          {evaluando ? (
            <div className="flex items-center justify-center p-12">
              <Spin size="large" />
            </div>
          ) : resultadoSAW ? (
            <>
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-2">Matriz Normalizada</h3>
                <p className="text-sm text-gray-600">
                  Valores normalizados de cada criterio para todas las alternativas
                  {modoValor === "rango" && " (mostrando solo Min y Máx)"}
                </p>
              </div>
              <div className="bg-white rounded-lg border">
                <Table
                  columns={columnasNormalizadas}
                  dataSource={datosNormalizados}
                  pagination={false}
                  scroll={{ x: "max-content" }}
                />
              </div>
              <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded">
                <p>
                  <strong>Información:</strong> La normalización ajusta todos los valores a una escala común (0-1) para
                  permitir comparaciones justas entre criterios con diferentes rangos.
                  {modoValor === "rango" && " Los valores promedio se calculan internamente pero no se muestran aquí."}
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-gray-400">
              <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <p className="text-lg">No hay resultados disponibles</p>
              <p className="text-sm">Agrega al menos 2 alternativas y haz clic en "Evaluar Alternativas"</p>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "3",
      label: "Resultados",
      children: (
        <div className="space-y-4">
          {evaluando ? (
            <div className="flex items-center justify-center p-12">
              <Spin size="large" />
            </div>
          ) : resultadoSAW ? (
            <>
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-2">
                  Clasificación Final - Método {modelo?.getData().metodo || "SAW"}
                </h3>
                <p className="text-sm text-gray-600">
                  Ranking de alternativas basado en puntuaciones ponderadas
                  {modoValor === "rango" && " (Mín, Avg, Máx)"}
                </p>
              </div>
              <div className="bg-white rounded-lg border">
                <Table
                  columns={columnasResultados}
                  dataSource={datosResultados}
                  pagination={false}
                  rowClassName={(record) =>
                    record.ranking === 1 ? "bg-green-50" : record.ranking === 2 ? "bg-blue-50" : ""
                  }
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 rounded-lg border-2 border-yellow-300">
                  <div className="text-3xl mb-2">🥇</div>
                  <div className="text-sm text-gray-600">Mejor Alternativa</div>
                  <div className="font-bold text-lg">{datosResultados[0]?.nombre}</div>
                  <div className="text-sm text-gray-500">Puntuación: {datosResultados[0]?.puntuacion.toFixed(4)}</div>
                </div>
                {datosResultados[1] && (
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-lg border-2 border-gray-300">
                    <div className="text-3xl mb-2">🥈</div>
                    <div className="text-sm text-gray-600">Segunda Mejor</div>
                    <div className="font-bold text-lg">{datosResultados[1]?.nombre}</div>
                    <div className="text-sm text-gray-500">Puntuación: {datosResultados[1]?.puntuacion.toFixed(4)}</div>
                  </div>
                )}
                {datosResultados[2] && (
                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg border-2 border-orange-300">
                    <div className="text-3xl mb-2">🥉</div>
                    <div className="text-sm text-gray-600">Tercera Mejor</div>
                    <div className="font-bold text-lg">{datosResultados[2]?.nombre}</div>
                    <div className="text-sm text-gray-500">Puntuación: {datosResultados[2]?.puntuacion.toFixed(4)}</div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-gray-400">
              <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <p className="text-lg">No hay resultados disponibles</p>
              <p className="text-sm">Agrega al menos 2 alternativas y haz clic en "Evaluar Alternativas"</p>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "4",
      label: "Análisis de Sensibilidad",
      disabled: alternativas.length < 2,
      children: (
        <div className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Análisis de Sensibilidad</h3>
            <p className="text-sm text-gray-600">
              Analiza cómo cambios en los pesos de los criterios afectan la clasificación de alternativas
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <Card hoverable onClick={() => openSensitivityAnalysis("unidimensional")} style={{ cursor: "pointer" }}>
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-lg font-semibold">Análisis de Sensibilidad de Peso Unidimensional</h4>
                    <p className="text-sm text-gray-600 mt-2">
                      Evalúa cómo cambia la mejor alternativa cuando varía el peso de un criterio específico mientras
                      los demás permanecen constantes.
                    </p>
                  </div>
                  <span className="text-2xl">📊</span>
                </div>
                <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded text-xs w-fit">Análisis 1D</div>
                <p className="text-xs text-gray-500">Haz clic para analizar la estabilidad de un criterio individual</p>
              </div>
            </Card>

            <Card
              hoverable
              onClick={() => openSensitivityAnalysis("multidimensional")}
              style={{ cursor: "pointer", opacity: 0.6 }}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-lg font-semibold">Análisis de Sensibilidad de Peso de Alta Dimensión</h4>
                    <p className="text-sm text-gray-600 mt-2">
                      Evalúa cómo cambia la clasificación cuando múltiples pesos varían simultáneamente, permitiendo
                      análisis más complejos.
                    </p>
                  </div>
                  <span className="text-2xl">🔮</span>
                </div>
                <div className="bg-gray-100 text-gray-800 px-3 py-1 rounded text-xs w-fit">
                  Análisis Multidimensional (Próximamente)
                </div>
                <p className="text-xs text-gray-500">Funcionalidad en desarrollo</p>
              </div>
            </Card>
          </div>
        </div>
      ),
    },
  ]

  return (
    <div className="flex h-screen">
      <div
        className={`border-r bg-white flex flex-col transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? "w-12" : "w-1/3"
        }`}
      >
        <div className="flex items-center justify-between p-2 border-b">
          {!sidebarCollapsed && (
            <div className="flex-1 px-2">
              <h2 className="text-lg font-bold truncate">
                {modelo?.getData().nombre} <span>({modelo?.getData().metodo})</span>
              </h2>
              <p className="text-xs text-gray-500 truncate">{modelo?.getData().descripcion}</p>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
            title={sidebarCollapsed ? "Expandir modelo" : "Colapsar modelo"}
          >
            {sidebarCollapsed ? <RightOutlined /> : <LeftOutlined />}
          </button>
        </div>

        {!sidebarCollapsed && (
          <div className="flex-1 overflow-hidden p-4">
            <ModeloSvgViewer
              nodos={modelo?.getNodos() || []}
              orientacion={modelo?.getOrientacion() || "h"}
              linea={modelo?.getLinea() || 1}
              nombreModelo={modelo?.getData().nombre || ""}
            />
          </div>
        )}
      </div>

      <div className="flex-1 p-6 overflow-auto">
        <Tabs items={tabItems} defaultActiveKey="1" />
      </div>

      <Modal
        isOpen={sensitivityModalOpen}
        onClose={() => {
          setOpenSensitivityModal(false)
          setSelectedAnalysisType(null)
        }}
        title={
          selectedAnalysisType === "unidimensional"
            ? "Análisis de Sensibilidad de Peso Unidimensional"
            : "Análisis de Sensibilidad Multidimensional"
        }
        width="900px"
      >
        {selectedAnalysisType === "unidimensional" && modelo && (
          <UnidimensionalSensitivityAnalysis
            alternativas={alternativas}
            criterios={modelo.getNodos()}
            tipos={modelo.getCriteriosFinales().map((c) => (c.beneficio ? "max" : "min"))}
            metodoNombre={modelo.getMetodo()}
            hierarchy={modelo.getData().nodos.nodes}
            matrix={prepareAPIData()?.matrix || []}
          />
        )}
        {selectedAnalysisType === "multidimensional" && (
          <div className="p-4 text-center text-gray-500">
            <p>Funcionalidad en desarrollo</p>
          </div>
        )}
      </Modal>
    </div>
  )
}
