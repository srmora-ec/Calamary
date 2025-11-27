"use client"

import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import {
  Tabs,
  Button,
  Table,
  Input,
  InputNumber,
  message,
  Spin,
  Upload,
  Select,
  Card,
  Row,
  Col,
  Drawer,
  Modal as AntModal,
} from "antd"
import { UploadOutlined, FolderOpenOutlined } from "@ant-design/icons"
import { Modelo, type ModeloData, type Nodo } from "@/types/modelo"
import ModeloSvgViewer from "@/components/modelo-svg-viewer"
import UnidimensionalSensitivityAnalysis from "@/components/AnalisisDeSensibilidad/unidimensional-sensitivity-analysis"
import UnidimensionalSensitivityMAUT from "@/components/AnalisisDeSensibilidad/UnidimensionalSensitivityMAUT"
import Modal from "@/components/Modal"
import { supabase } from "@/lib/supabase"
import * as XLSX from "xlsx"
import Image from "next/image"
import HightSensitivityAnalysis from "@/components/AnalisisDeSensibilidad/hight-sensitivity-analysis"
import HighSensitivityMAUT from "@/components/AnalisisDeSensibilidad/HighSensitivityMAUT"

type ModoValor = "unico" | "rango" | "fuzzy"

interface ValorUnico {
  tipo: "unico"
  valor: number | string
}

interface ValorRango {
  tipo: "rango"
  min: number | string
  max: number | string
}

interface ValorFuzzy {
  tipo: "fuzzy"
  l: number | string // low
  m: number | string // mid
  u: number | string // upper
}

type ValorCriterio = ValorUnico | ValorRango | ValorFuzzy

interface AlternativaValores {
  [idCriterio: number]: ValorCriterio
}

interface Alternativa {
  key: string
  nombre: string
  valores: AlternativaValores
}

interface Resultado {
  matriz_normalizada: number[][]
  puntuaciones: number[]
  ranking: number[]
  result_min?: number[][]
  result_max?: number[][]
  result_promedio_min?: number[][]
  result_promedio_max?: number[][]
  score_min?: number[]
  score_avg?: number[]
  score_max?: number[]
}

interface PaqueteDeAlternativas {
  id: number
  nombre: string
  tipo: string
  cantidad: number
  created_at: string
}

export default function AlternativasPage() {
  const { idmodelo } = useParams()
  const [modelo, setModelo] = useState<Modelo | null>(null)
  const [loading, setLoading] = useState(true)
  const [alternativas, setAlternativas] = useState<Alternativa[]>([])
  const [modoValor, setModoValor] = useState<ModoValor>("unico")
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [evaluando, setEvaluando] = useState(false)
  const [validacionMAUT, setValidacionMAUT] = useState<string | null>(null)
  const [sensitivityModalOpen, setOpenSensitivityModal] = useState(false)
  const [selectedAnalysisType, setSelectedAnalysisType] = useState<"unidimensional" | "multidimensional" | null>(null)
  const [openModel, setOpenModel] = useState(false)
  const [paquetesModalVisible, setPaquetesModalVisible] = useState(false)
  const [paquetes, setPaquetes] = useState<PaqueteDeAlternativas[]>([])
  const [loadingPaquetes, setLoadingPaquetes] = useState(false)

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
    if (modelo) {
      const nuevoModo = modelo.getMetodo() === "MAUT" ? "rango" : "unico"
      if (modoValor !== nuevoModo) {
        setModoValor(nuevoModo)
        setAlternativas([])
        setResultado(null)
      }
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

  const fetchPaquetes = async () => {
    setLoadingPaquetes(true)

    const { data, error } = await supabase
      .from("paquetedealternativas")
      .select("id, nombre, tipo, cantidad, created_at")
      .eq("modelo", Number(idmodelo))
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error al cargar paquetes:", error)
      message.error("Error al cargar los paquetes de alternativas")
      setPaquetes([])
    } else {
      setPaquetes(data as PaqueteDeAlternativas[])
    }

    setLoadingPaquetes(false)
  }

  const getValorInicialParaCriterio = (criterio: Nodo, modo: ModoValor): ValorCriterio => {
    if (modo === "fuzzy") {
      return {
        tipo: "fuzzy",
        l: criterio.min || 0,
        m: (criterio.min || 0 + criterio.max || 100) / 2,
        u: criterio.max || 100,
      }
    }

    if (modo === "unico") {
      return {
        tipo: "unico",
        valor: criterio.min || 0,
      }
    } else {
      const isMautDiscreto =
        modelo?.getMetodo() === "MAUT" &&
        criterio.MAUT?.tipoFuncion === "discreta" &&
        criterio.MAUT.funcionDiscreta?.valores.length

      if (isMautDiscreto) {
        const defaultValue = criterio.MAUT!.funcionDiscreta!.valores[0].nombre
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

  const cargarPaqueteDeAlternativas = async (paqueteId: number, tipoPaquete: string) => {
    try {
      setLoadingPaquetes(true)

      let alternativasCargadas: Alternativa[] = []

      if (tipoPaquete === "Individual") {
        const { data, error } = await supabase
          .from("alternativa")
          .select("id, alternativa, nombre")
          .eq("paquete", paqueteId)

        if (error) throw error

        alternativasCargadas = data.map((alt: any, idx: number) => {
          const valores: AlternativaValores = {}

          criteriosFinales.forEach((criterio) => {
            const valorGuardado = alt.alternativa[criterio.idnodo.toString()] //|| alt.alternativa[criterio?.acortado]
            if (valorGuardado !== undefined && valorGuardado !== null) {
              valores[criterio.idnodo] = {
                tipo: "unico",
                valor: valorGuardado,
              }
            } else {
              // Valor por defecto si no existe
              valores[criterio.idnodo] = getValorInicialParaCriterio(criterio, "unico")
            }
          })

          return {
            key: `alt-${Date.now()}-${idx}`,
            nombre: alt.nombre || `Alternativa ${idx + 1}`,
            valores,
          }
        })
      } else if (tipoPaquete === "Maut") {
        const { data, error } = await supabase
          .from("alternativamaut")
          .select("id, altmin, altmax, nombre")
          .eq("paquete", paqueteId)

        if (error) throw error

        alternativasCargadas = data.map((alt: any, idx: number) => {
          const valores: AlternativaValores = {}

          criteriosFinales.forEach((criterio) => {
            const valorMin = alt.altmin[criterio.idnodo.toString()] //|| alt.altmin[criterio.acortado]
            const valorMax = alt.altmax[criterio.idnodo.toString()] //|| alt.altmax[criterio.acortado]

            if (valorMin !== undefined && valorMax !== undefined) {
              valores[criterio.idnodo] = {
                tipo: "rango",
                min: valorMin,
                max: valorMax,
              }
            } else {
              // Valor por defecto si no existe
              valores[criterio.idnodo] = getValorInicialParaCriterio(criterio, "rango")
            }
          })

          return {
            key: `alt-${Date.now()}-${idx}`,
            nombre: alt.nombre || `Alternativa ${idx + 1}`,
            valores,
          }
        })
      } else if (tipoPaquete === "Triangulares difusos") {
        // 1. Validamos que el usuario esté en modo fuzzy antes de cargar
        if (modoValor !== "fuzzy") {
          message.warning("Debes activar el 'Modo Difuso' (botón morado) antes de cargar este paquete.")
          setLoadingPaquetes(false)
          return
        }

        // 2. Consulta a la tabla alternativatriangular
        const { data, error } = await supabase
          .from("alternativatriangular")
          .select("id, altlower, altcenter, altupper, nombre")
          .eq("paquete", paqueteId)

        if (error) throw error

        // 3. Mapeo de datos (DB -> Frontend Structure)
        alternativasCargadas = data.map((alt: any, idx: number) => {
          const valores: AlternativaValores = {}

          criteriosFinales.forEach((criterio) => {
            // Convertimos ID a string para acceder al JSON
            const key = criterio.idnodo.toString() 

            // Extraemos los valores del JSON
            const valL = alt.altlower[key]
            const valM = alt.altcenter[key]
            const valU = alt.altupper[key]

            // Verificamos que existan los 3 valores
            if (valL !== undefined && valM !== undefined && valU !== undefined) {
              valores[criterio.idnodo] = {
                tipo: "fuzzy",
                l: valL,
                m: valM,
                u: valU,
              }
            } else {
              // Valor por defecto si falta algún dato en el JSON
              valores[criterio.idnodo] = getValorInicialParaCriterio(criterio, "fuzzy")
            }
          })

          return {
            key: `alt-${Date.now()}-${idx}`,
            nombre: alt.nombre || `Alternativa ${idx + 1}`,
            valores,
          }
        })
      }

      // Validar que se hayan cargado alternativas
      if (alternativasCargadas.length === 0) {
        message.warning("El paquete no contiene alternativas")
        return
      }

      // Validar compatibilidad con el modelo actual
      const tipoEsperado = modelo?.getMetodo() === "MAUT" ? "Maut" : "Individual"
      if (tipoPaquete !== tipoEsperado && tipoPaquete !== "Triangulares difusos") {
        message.error(`El paquete es de tipo "${tipoPaquete}" pero el modelo requiere tipo "${tipoEsperado}"`)
        return
      }

      setAlternativas(alternativasCargadas)
      setResultado(null)
      setPaquetesModalVisible(false)
      message.success(`Se cargaron ${alternativasCargadas.length} alternativas del paquete`)
    } catch (error) {
      console.error("Error cargando paquete:", error)
      message.error("Error al cargar las alternativas del paquete")
    } finally {
      setLoadingPaquetes(false)
    }
  }

  const prepareAPIData = () => {
    if (!modelo) return null

    modelo.calcularPesosFinales()
    const criteriosFinales = modelo.getCriteriosFinales()

    const matrix = alternativas.map((alt) =>
      criteriosFinales.map((crit) => {
        const val = alt.valores[crit.idnodo]
        return val.tipo === "unico" ? (val.valor as number) : ((val.min as number) + (val.max as number)) / 2
      }),
    )

    const tipos = criteriosFinales.map((crit) => (crit.beneficio ? "max" : "min"))

    return { matrix, tipos }
  }

  const openSensitivityAnalysis = (type: "unidimensional" | "multidimensional") => {
    setSelectedAnalysisType(type)
    setOpenSensitivityModal(true)
  }

  const defuzzificarAlternativas = (): number[][] => {
    return alternativas.map((alt) => {
      return criteriosFinales.map((crit) => {
        const val = alt.valores[crit.idnodo]
        if (val.tipo === "fuzzy") {
          const l = Number.parseFloat(val.l.toString()) || 0
          const m = Number.parseFloat(val.m.toString()) || 0
          const u = Number.parseFloat(val.u.toString()) || 0

          // M_i = (l + m + u) / 3 (desfusificación)
          return (l + m + u) / 3
        }
        return 0
      })
    })
  }

  const EvaluarAlternativas = async () => {
    if (alternativas.length < 2) {
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

          const combinedData = scoreAvg.map((score: number, idx: number) => ({
            score,
            scoreMin: scoreMin[idx],
            scoreMax: scoreMax[idx],
            idx,
            alternativa: alternativas[idx],
            matrizMin: matrizMin[idx],
            matrizPromedioMin: matrizPromedioMin[idx],
            matrizPromedioMax: matrizPromedioMax[idx],
            matrizMax: matrizMax[idx],
          }))

          combinedData.sort((a: any, b: any) => b.score - a.score)

          const alternativasOrdenadas = combinedData.map((item: any) => item.alternativa)
          const puntuacionesOrdenadas = combinedData.map((item: any) => item.score)
          const puntuacionesMinOrdenadas = combinedData.map((item: any) => item.scoreMin)
          const puntuacionesMaxOrdenadas = combinedData.map((item: any) => item.scoreMax)
          const matrizMinOrdenada = combinedData.map((item: any) => item.matrizMin)
          const matrizPromedioMinOrdenada = combinedData.map((item: any) => item.matrizPromedioMin)
          const matrizPromedioMaxOrdenada = combinedData.map((item: any) => item.matrizPromedioMax)
          const matrizMaxOrdenada = combinedData.map((item: any) => item.matrizMax)

          setAlternativas(alternativasOrdenadas)

          setResultado({
            matriz_normalizada: [],
            puntuaciones: puntuacionesOrdenadas,
            ranking: combinedData.map((_: { score: number }, i: number) => i + 1),
            result_min: matrizMinOrdenada,
            result_promedio_min: matrizPromedioMinOrdenada,
            result_promedio_max: matrizPromedioMaxOrdenada,
            result_max: matrizMaxOrdenada,
            score_min: puntuacionesMinOrdenadas,
            score_avg: puntuacionesOrdenadas,
            score_max: puntuacionesMaxOrdenadas,
          })

          message.success("Evaluación MAUT (rango) completada exitosamente")
          setEvaluando(false)
          return
        }
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

      let matrix: number[][]

      if (modoValor === "fuzzy") {
        // Use defuzzified values for evaluation
        matrix = defuzzificarAlternativas()
      } else {
        matrix = alternativas.map((alt) =>
          criteriosFinales.map((crit) => {
            const val = alt.valores[crit.idnodo]
            return val.tipo === "unico" ? (val.valor as number) : 0
          }),
        )
      }
      console.log(matrix)

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

      setAlternativas(alternativasOrdenadas)

      setResultado({
        matriz_normalizada: matrizNormalizadaOrdenada,
        puntuaciones: puntuacionesOrdenadas,
        ranking: combinedData.map((_, i) => i + 1),
      })

      message.success(`Evaluación ${modoValor === "fuzzy" ? "difusa " : ""}completada exitosamente`)
    } catch (error) {
      console.error(" Error ejecutando evaluación:", error)
      message.error("Error al ejecutar la evaluación")
    } finally {
      setEvaluando(false)
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
    setResultado(null)
    message.success("Alternativa agregada")
  }

  const eliminarAlternativa = (key: string) => {
    setAlternativas(alternativas.filter((alt) => alt.key !== key))
    setResultado(null)
    message.success("Alternativa eliminada")
  }

  const actualizarValorUnico = (key: string, idCriterio: number, valor: number | string) => {
    setAlternativas(
      alternativas.map((alt) => {
        if (alt.key === key) {
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
    setResultado(null)
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

          const newMin = campo === "min" ? valor : currentMin
          const newMax = campo === "max" ? valor : currentMax

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
    setResultado(null)
  }

  const actualizarValorFuzzy = (
    keyAlternativa: string,
    idCriterio: number,
    campo: "l" | "m" | "u",
    valor: number | string,
  ) => {
    setAlternativas(
      alternativas.map((alt) => {
        if (alt.key === keyAlternativa) {
          const valorActual = alt.valores[idCriterio]
          if (valorActual.tipo === "fuzzy") {
            return {
              ...alt,
              valores: {
                ...alt.valores,
                [idCriterio]: {
                  ...valorActual,
                  [campo]: valor,
                },
              },
            }
          }
        }
        return alt
      }),
    )
    setResultado(null)
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

  const toggleFuzzyMode = () => {
    if (modelo?.getMetodo() === "MAUT") {
      message.warning("El modo difuso no está disponible para modelos MAUT")
      return
    }

    const nuevoModo: ModoValor = modoValor === "fuzzy" ? "unico" : "fuzzy"
    setModoValor(nuevoModo)

    // Convert existing alternatives to new mode
    setAlternativas(
      alternativas.map((alt) => {
        const nuevosValores: AlternativaValores = {}

        criteriosFinales.forEach((criterio) => {
          const valorActual = alt.valores[criterio.idnodo]

          if (nuevoModo === "fuzzy") {
            // Converting from unico to fuzzy
            if (valorActual?.tipo === "unico") {
              const val = Number.parseFloat(valorActual.valor.toString()) || 0
              nuevosValores[criterio.idnodo] = {
                tipo: "fuzzy",
                l: Math.max(criterio.min || 0, val * 0.9),
                m: val,
                u: Math.min(criterio.max || 100, val * 1.1),
              }
            } else {
              nuevosValores[criterio.idnodo] = getValorInicialParaCriterio(criterio, "fuzzy")
            }
          } else {
            // Converting from fuzzy to unico
            if (valorActual?.tipo === "fuzzy") {
              const l = Number.parseFloat(valorActual.l.toString()) || 0
              const m = Number.parseFloat(valorActual.m.toString()) || 0
              const u = Number.parseFloat(valorActual.u.toString()) || 0
              nuevosValores[criterio.idnodo] = {
                tipo: "unico",
                valor: (l + m + u) / 3, // Use defuzzified value
              }
            } else {
              nuevosValores[criterio.idnodo] = getValorInicialParaCriterio(criterio, "unico")
            }
          }
        })

        return { ...alt, valores: nuevosValores }
      }),
    )

    setResultado(null)
    message.success(`Modo cambiado a ${nuevoModo === "fuzzy" ? "difuso" : "único"}`)
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

        if (modelo?.getMetodo() === "MAUT") {
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
                  min: opcionMin?.nombre || opcionesDiscretas[0]?.nombre || "",
                  max: opcionMax?.nombre || opcionesDiscretas[0]?.nombre || "",
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

          if (modoValor === "fuzzy") {
            // In fuzzy mode, expect 3 columns per criterion (l, m, u)
            if (headers.length !== criteriosFinales.length * 3) {
              message.warning(
                `El Excel tiene ${headers.length} columnas, pero en modo difuso se esperan ${criteriosFinales.length * 3} columnas (3 por cada criterio: low, mid, upper).`,
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
                const excelColIdx = criterioIdx * 3 + 1 // 3 columns per criterion
                const valorL = row[excelColIdx]
                const valorM = row[excelColIdx + 1]
                const valorU = row[excelColIdx + 2]

                const numL = typeof valorL === "number" ? valorL : Number.parseFloat(valorL?.toString() || "0")
                const numM = typeof valorM === "number" ? valorM : Number.parseFloat(valorM?.toString() || "0")
                const numU = typeof valorU === "number" ? valorU : Number.parseFloat(valorU?.toString() || "0")

                nuevaAlternativa.valores[criterio.idnodo] = {
                  tipo: "fuzzy",
                  l: !isNaN(numL) ? numL : criterio.min || 0,
                  m: !isNaN(numM) ? numM : (criterio.min || 0 + criterio.max || 100) / 2,
                  u: !isNaN(numU) ? numU : criterio.max || 100,
                }
              })

              nuevasAlternativas.push(nuevaAlternativa)
            }
          } else {
            // Existing logic for non-fuzzy mode
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
        }

        setAlternativas(nuevasAlternativas)
        setResultado(null)
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
      const opcionesDiscretas = criterio.MAUT?.funcionDiscreta?.valores || []
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
        value={valor as number}
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
      title: "Nombre",
      dataIndex: "nombre",
      key: "nombre",
      fixed: "left" as const,
      width: 150,
      render: (text: string, record: Alternativa) => (
        <Input
          size="small"
          value={text}
          onChange={(e) => {
            setAlternativas(
              alternativas.map((alt) => (alt.key === record.key ? { ...alt, nombre: e.target.value } : alt)),
            )
            setResultado(null)
          }}
        />
      ),
    },
    ...criteriosFinales.map((criterio, idx) => ({
      title: (
        <div className="text-center">
          <div className="font-medium">{criterio.titulo}</div>
          <div className="text-xs text-gray-500 mt-1">
            {modoValor === "fuzzy"
              ? "(L, M, U)"
              : modoValor === "rango"
                ? "(Min-Max)"
                : `(${criterio.min} - ${criterio.max})`}
          </div>
        </div>
      ),
      dataIndex: ["valores", criterio.idnodo],
      key: `crit-${criterio.idnodo}`,
      width: modoValor === "fuzzy" ? 200 : modoValor === "rango" ? 150 : 120,
      render: (_: any, record: Alternativa) => renderCellEditor(record, criterio),
    })),
    {
      title: "Acciones",
      key: "acciones",
      fixed: "right" as const,
      width: 100,
      render: (_: any, record: Alternativa) => (
        <Button size="small" danger onClick={() => eliminarAlternativa(record.key)}>
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
      modoValor === "rango" && resultado?.result_min
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

  const datosNormalizados = resultado
    ? alternativas.map((alt, idx) => {
        const baseData: { [key: string]: any } = {
          key: alt.key,
          nombre: alt.nombre,
        }

        if (modoValor === "rango" && resultado.result_min) {
          criteriosFinales.forEach((_, criterioIdx) => {
            baseData[`criterio_${criterioIdx}_min`] = resultado.result_min?.[idx]?.[criterioIdx] || 0
            baseData[`criterio_${criterioIdx}_max`] = resultado.result_max?.[idx]?.[criterioIdx] || 0
          })
        } else {
          criteriosFinales.forEach((_, criterioIdx) => {
            baseData[`criterio_${criterioIdx}`] = resultado.matriz_normalizada[idx]?.[criterioIdx] || 0
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
    ...(modoValor === "rango" && resultado?.score_min
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
  ]

  const datosResultados = resultado
    ? resultado.ranking.map((rank, idx) => ({
        key: alternativas[idx].key,
        nombre: alternativas[idx].nombre,
        puntuacion: resultado.puntuaciones[idx],
        puntuacion_min: resultado.score_min?.[idx] || 0,
        puntuacion_max: resultado.score_max?.[idx] || 0,
        ranking: rank,
        porcentaje:
          modoValor === "rango" && resultado.score_avg
            ? (resultado.score_avg[idx] / Math.max(...(resultado.score_avg || [1]))) * 100
            : (resultado.puntuaciones[idx] / Math.max(...resultado.puntuaciones)) * 100,
      }))
    : []

  const onCloseModelDrawer = () => {
    setOpenModel(false)
  }

  // const columnasPaquetesModal = [
  //   {
  //     title: "Nombre",
  //     dataIndex: "nombre",
  //     key: "nombre",
  //   },
  //   {
  //     title: "Tipo",
  //     dataIndex: "tipo",
  //     key: "tipo",
  //     width: 150,
  //   },
  //   {
  //     title: "Cant. Alternativas",
  //     dataIndex: "cantidad",
  //     key: "cantidad",
  //     width: 150,
  //   },
  //   {
  //     title: "Creado",
  //     dataIndex: "created_at",
  //     key: "created_at",
  //     render: (date: string) => new Date(date).toLocaleDateString(),
  //     width: 120,
  //   },
  //   {
  //     title: "Acciones",
  //     key: "acciones",
  //     width: 100,
  //     render: (record: PaqueteDeAlternativas) => (
  //       <Button
  //         key="cargar"
  //         type="primary"
  //         onClick={() => cargarPaqueteDeAlternativas(record.id, record.tipo)}
  //         loading={loadingPaquetes}
  //         size="small" // Tamaño pequeño para que quepa bien en la columna
  //       >
  //         Cargar
  //       </Button>
  //     ),
  //   },
  // ]

  const renderCellEditor = (alternativa: Alternativa, criterio: Nodo) => {
    const valor = alternativa.valores[criterio.idnodo]

    if (modoValor === "fuzzy" && valor?.tipo === "fuzzy") {
      return (
        <div className="flex gap-1">
          <InputNumber
            size="small"
            value={typeof valor.l === "number" ? valor.l : Number.parseFloat(valor.l as string)}
            onChange={(val) => actualizarValorFuzzy(alternativa.key, criterio.idnodo, "l", val ?? 0)}
            min={criterio.min}
            max={criterio.max}
            style={{ width: "33%" }}
            placeholder="L"
          />
          <InputNumber
            size="small"
            value={typeof valor.m === "number" ? valor.m : Number.parseFloat(valor.m as string)}
            onChange={(val) => actualizarValorFuzzy(alternativa.key, criterio.idnodo, "m", val ?? 0)}
            min={criterio.min}
            max={criterio.max}
            style={{ width: "34%" }}
            placeholder="M"
          />
          <InputNumber
            size="small"
            value={typeof valor.u === "number" ? valor.u : Number.parseFloat(valor.u as string)}
            onChange={(val) => actualizarValorFuzzy(alternativa.key, criterio.idnodo, "u", val ?? 0)}
            min={criterio.min}
            max={criterio.max}
            style={{ width: "33%" }}
            placeholder="U"
          />
        </div>
      )
    }

    if (modoValor === "unico" && valor?.tipo === "unico") {
      if (modelo?.getMetodo() === "MAUT" && criterio.MAUT?.tipoFuncion === "discreta") {
        const opciones = criterio.MAUT?.funcionDiscreta?.valores || []
        return (
          <Select
            size="small"
            value={valor.valor as string}
            onChange={(val) => actualizarValorUnico(alternativa.key, criterio.idnodo, val)}
            style={{ width: "100%" }}
          >
            {opciones.map((opcion) => (
              <Select.Option key={opcion.nombre} value={opcion.nombre}>
                {opcion.nombre}
              </Select.Option>
            ))}
          </Select>
        )
      }

      return (
        <InputNumber
          size="small"
          value={typeof valor.valor === "number" ? valor.valor : Number.parseFloat(valor.valor as string)}
          onChange={(val) => actualizarValorUnico(alternativa.key, criterio.idnodo, val ?? 0)}
          min={criterio.min}
          max={criterio.max}
          style={{ width: "100%" }}
        />
      )
    }

    if (modoValor === "rango" && valor?.tipo === "rango") {
      if (modelo?.getMetodo() === "MAUT" && criterio.MAUT?.tipoFuncion === "discreta") {
        const opciones = criterio.MAUT?.funcionDiscreta?.valores || []
        return (
          <div className="flex gap-1">
            <Select
              size="small"
              value={valor.min as string}
              onChange={(val) => actualizarValorRango(alternativa.key, criterio.idnodo, "min", val)}
              style={{ width: "50%" }}
            >
              {opciones.map((opcion) => (
                <Select.Option key={opcion.nombre} value={opcion.nombre}>
                  {opcion.nombre}
                </Select.Option>
              ))}
            </Select>
            <Select
              size="small"
              value={valor.max as string}
              onChange={(val) => actualizarValorRango(alternativa.key, criterio.idnodo, "max", val)}
              style={{ width: "50%" }}
            >
              {opciones.map((opcion) => (
                <Select.Option key={opcion.nombre} value={opcion.nombre}>
                  {opcion.nombre}
                </Select.Option>
              ))}
            </Select>
          </div>
        )
      }

      return (
        <div className="flex gap-1">
          <InputNumber
            size="small"
            value={typeof valor.min === "number" ? valor.min : Number.parseFloat(valor.min as string)}
            onChange={(val) => actualizarValorRango(alternativa.key, criterio.idnodo, "min", val ?? 0)}
            min={criterio.min}
            max={criterio.max}
            style={{ width: "50%" }}
            placeholder="Min"
          />
          <InputNumber
            size="small"
            value={typeof valor.max === "number" ? valor.max : Number.parseFloat(valor.max as string)}
            onChange={(val) => actualizarValorRango(alternativa.key, criterio.idnodo, "max", val ?? 0)}
            min={criterio.min}
            max={criterio.max}
            style={{ width: "50%" }}
            placeholder="Max"
          />
        </div>
      )
    }

    return <span className="text-gray-400">-</span>
  }

  const tabItems = [
    {
      key: "1",
      label: "Alternativas",
      children: (
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} lg={12}>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Gestión de Alternativas</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {modelo?.getMetodo() === "MAUT"
                      ? "Modelo MAUT: Utilice rangos (mín-máx) para cada criterio."
                      : modoValor === "fuzzy"
                        ? "Modo difuso: Ingrese tres valores (Inferior, Medio, Superior) para cada criterio."
                        : "Modo normal: Ingrese un valor único para cada criterio."}
                  </p>
                </div>
              </Col>

              <Col xs={24} lg={12}>
                <Row gutter={[8, 8]} justify="end">
                  {modelo?.getMetodo() !== "MAUT" && (
                    <Col xs={24} sm={12} md="auto">
                      <Button
                        block
                        onClick={toggleFuzzyMode}
                        type={modoValor === "fuzzy" ? "primary" : "default"}
                        className={modoValor === "fuzzy" ? "bg-purple-600 hover:bg-purple-700" : ""}
                      >
                        {modoValor === "fuzzy" ? "Modo Difuso ✓" : "Activar Modo Difuso"}
                      </Button>
                    </Col>
                  )}

                  <Col xs={24} sm={12} md="auto">
                    <Button
                      block
                      icon={<FolderOpenOutlined />}
                      onClick={() => {
                        fetchPaquetes()
                        setPaquetesModalVisible(true)
                      }}
                    >
                      Cargar paquete de alternativas
                    </Button>
                  </Col>

                  <Col xs={24} sm={12} md="auto">
                    <Upload accept=".xlsx,.xls" beforeUpload={handleExcelUpload} showUploadList={false}>
                      <Button block icon={<UploadOutlined />}>
                        Cargar desde Excel
                      </Button>
                    </Upload>
                  </Col>

                  <Col xs={24} sm={12} md="auto">
                    <Button block type="primary" onClick={agregarAlternativa}>
                      Agregar Alternativa
                    </Button>
                  </Col>

                  <Col xs={24} sm={12} md="auto">
                    <Button
                      block
                      type="primary"
                      onClick={EvaluarAlternativas}
                      disabled={alternativas.length < 2 || !!validacionMAUT}
                      loading={evaluando}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Evaluar Alternativas
                    </Button>
                  </Col>
                </Row>
              </Col>
            </Row>
          </div>

          {validacionMAUT && (
            <div className="space-y-2 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              <p className="font-medium">
                ⚠️ <strong>No se puede evaluar</strong> porque faltan funciones de utilidad (Método <strong>MAUT</strong>
                ):
              </p>
              <div className="whitespace-pre-line text-sm">{validacionMAUT}</div>
              <p className="text-sm mt-2 text-red-600">
                Por favor, configura las funciones de utilidad para todos los criterios finales en el tablero del modelo
                antes de evaluar.
              </p>
            </div>
          )}

          <div className="bg-white rounded-lg border overflow-x-auto">
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
              {modoValor === "fuzzy"
                ? "Difuso (3 valores: Inferior, Medio, Superior por criterio)"
                : modoValor === "unico"
                  ? "Valor único por criterio"
                  : "Rango (mín-máx) por criterio"}
            </p>
            <p className="mt-2 text-xs text-gray-400">
              <strong>Formato Excel:</strong> Primera columna = nombres de alternativas, siguientes columnas = valores
              para cada criterio
              {modoValor === "fuzzy"
                ? " (en modo difuso: criterio1_l, criterio1_m, criterio1_u, criterio2_l, criterio2_m, criterio2_u, ...)."
                : modoValor === "rango"
                  ? " (en modo rango: criterio1_min, criterio1_max, criterio2_min, criterio2_max, ...)."
                  : "."}
              <strong> Para MAUT discreto:</strong> el valor debe coincidir con el nombre de la opción discreta
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
          ) : resultado ? (
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
          ) : resultado ? (
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
              <br />
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
              <p className="text-lg">No hay resultados disponibles.</p>
              <p className="text-sm">Agrega al menos 2 alternativas y haz clic en "Evaluar Alternativas"</p>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "4",
      label: "Análisis de Sensibilidad",
      disabled: alternativas.length < 2 || !resultado,
      children: (
        <div className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Análisis de Sensibilidad</h3>
            <p className="text-sm text-gray-600">
              Analiza cómo cambios en los pesos de los criterios afectan la clasificación de alternativas
            </p>
          </div>
          <br />

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
                </div>
                <p className="text-xs text-gray-500">Haz clic para analizar la estabilidad de un criterio individual</p>
              </div>
            </Card>

            <Card hoverable onClick={() => openSensitivityAnalysis("multidimensional")} style={{ cursor: "pointer" }}>
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-lg font-semibold">Análisis de Sensibilidad de Peso de Alta Dimensión</h4>
                    <p className="text-sm text-gray-600 mt-2">
                      Evalúa cómo cambia la clasificación cuando múltiples pesos varían simultáneamente, permitiendo
                      análisis más complejos.
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">Haz clic para analizar la estabilidad de un criterio individual</p>
              </div>
            </Card>
          </div>
        </div>
      ),
    },
  ]



  const columnasPaquetesModal = [
    {
      title: "Nombre",
      dataIndex: "nombre",
      key: "nombre",
    },
    {
      title: "Tipo",
      dataIndex: "tipo",
      key: "tipo",
      width: 150,
    },
    {
      title: "Cant. Alternativas",
      dataIndex: "cantidad",
      key: "cantidad",
      width: 150,
    },
    {
      title: "Creado",
      dataIndex: "created_at",
      key: "created_at",
      render: (date: string) => new Date(date).toLocaleDateString(),
      width: 120,
    },
    {
      title: "Acciones",
      key: "acciones",
      width: 100,
      render: (record: PaqueteDeAlternativas) => (
        <Button
          key="cargar"
          type="primary"
          onClick={() => cargarPaqueteDeAlternativas(record.id, record.tipo)}
          loading={loadingPaquetes}
          size="small" // Tamaño pequeño para que quepa bien en la columna
        >
          Cargar
        </Button>
      ),
    },
  ]

  return (
    <div className="p-6">
      <div className={`border-r bg-white flex flex-col transition-all duration-300 ease-in-out`}>
        <div className="fixed top-4 right-4 z-50 flex items-center space-x-4">
          <button
            onClick={() => {
              setOpenModel(true)
            }}
            className="focus:outline-none cursor-pointer"
          >
            <Image src="/arbol.png" alt="Botón de play" width={40} height={40} />
          </button>
        </div>
        <Drawer title={`Modelo`} placement="left" size={"large"} onClose={onCloseModelDrawer} open={openModel}>
          <ModeloSvgViewer
            nodos={modelo?.getNodos() || []}
            orientacion={modelo?.getOrientacion() || "h"}
            linea={modelo?.getLinea() || 1}
            nombreModelo={modelo?.getData().nombre || ""}
          />
        </Drawer>
      </div>

      <Tabs
        defaultActiveKey="1"
        items={[
          {
            key: "1",
            label: "Alternativas",
            children: (
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <Row gutter={[16, 16]} align="middle">
                    <Col xs={24} lg={12}>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Gestión de alternativas</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {modelo?.getMetodo() === "MAUT"
                            ? "Modelo MAUT: Utilice rangos (mín-máx) para cada criterio."
                            : modoValor === "fuzzy"
                              ? "Modo Difuso: Ingrese tres valores (Inferior, Medio, Superior) para cada criterio."
                              : "Modo Normal: Ingrese un valor único para cada criterio."}
                        </p>
                      </div>
                    </Col>

                    <Col xs={24} lg={12}>
                      <Row gutter={[8, 8]} justify="end">
                        {modelo?.getMetodo() !== "MAUT" && (
                          <Col xs={24} sm={12} md="auto">
                            <Button
                              block
                              onClick={toggleFuzzyMode}
                              type={modoValor === "fuzzy" ? "primary" : "default"}
                              className={modoValor === "fuzzy" ? "bg-purple-600 hover:bg-purple-700" : ""}
                            >
                              {modoValor === "fuzzy" ? "Modo Difuso ✓" : "Activar Modo Difuso"}
                            </Button>
                          </Col>
                        )}

                        <Col xs={24} sm={12} md="auto">
                          <Button
                            block
                            icon={<FolderOpenOutlined />}
                            onClick={() => {
                              fetchPaquetes()
                              setPaquetesModalVisible(true)
                            }}
                          >
                            Cargar paquete de alternativas
                          </Button>
                        </Col>

                        <Col xs={24} sm={12} md="auto">
                          <Upload accept=".xlsx,.xls" beforeUpload={handleExcelUpload} showUploadList={false}>
                            <Button block icon={<UploadOutlined />}>
                              Cargar desde Excel
                            </Button>
                          </Upload>
                        </Col>

                        <Col xs={24} sm={12} md="auto">
                          <Button block type="primary" onClick={agregarAlternativa}>
                            Agregar Alternativa
                          </Button>
                        </Col>

                        <Col xs={24} sm={12} md="auto">
                          <Button
                            block
                            type="primary"
                            onClick={EvaluarAlternativas}
                            disabled={alternativas.length < 2 || !!validacionMAUT}
                            loading={evaluando}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Evaluar Alternativas
                          </Button>
                        </Col>
                      </Row>
                    </Col>
                  </Row>
                </div>

                {validacionMAUT && (
                  <div className="space-y-2 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                    <p className="font-medium">
                      ⚠️ <strong>No se puede evaluar</strong> porque faltan funciones de utilidad (Método{" "}
                      <strong>MAUT</strong>):
                    </p>
                    <div className="whitespace-pre-line text-sm">{validacionMAUT}</div>
                    <p className="text-sm mt-2 text-red-600">
                      Por favor, configura las funciones de utilidad para todos los criterios finales en el tablero del
                      modelo antes de evaluar.
                    </p>
                  </div>
                )}

                <div className="bg-white rounded-lg border overflow-x-auto">
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
                    {modoValor === "fuzzy"
                      ? "Difuso (3 valores: Inferior, Medio, Superior por criterio)"
                      : modoValor === "unico"
                        ? "Valor único por criterio"
                        : "Rango (mín-máx) por criterio"}
                  </p>
                  <p className="mt-2 text-xs text-gray-400">
                    <strong>Formato Excel:</strong> Primera columna = nombres de alternativas, siguientes columnas =
                    valores para cada criterio
                    {modoValor === "fuzzy"
                      ? " (en modo difuso: criterio1_l, criterio1_m, criterio1_u, criterio2_l, criterio2_m, criterio2_u, ...)."
                      : modoValor === "rango"
                        ? " (en modo rango: criterio1_min, criterio1_max, criterio2_min, criterio2_max, ...)."
                        : "."}
                    <strong> Para MAUT discreto:</strong> el valor debe coincidir con el nombre de la opción discreta
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
                ) : resultado ? (
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
                        <strong>Información:</strong> La normalización ajusta todos los valores a una escala común (0-1)
                        para permitir comparaciones justas entre criterios con diferentes rangos.
                        {modoValor === "rango" &&
                          " Los valores promedio se calculan internamente pero no se muestran aquí."}
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
                ) : resultado ? (
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
                    <br />
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 rounded-lg border-2 border-yellow-300">
                        <div className="text-3xl mb-2">🥇</div>
                        <div className="text-sm text-gray-600">Mejor Alternativa</div>
                        <div className="font-bold text-lg">{datosResultados[0]?.nombre}</div>
                        <div className="text-sm text-gray-500">
                          Puntuación: {datosResultados[0]?.puntuacion.toFixed(4)}
                        </div>
                      </div>
                      {datosResultados[1] && (
                        <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-lg border-2 border-gray-300">
                          <div className="text-3xl mb-2">🥈</div>
                          <div className="text-sm text-gray-600">Segunda Mejor</div>
                          <div className="font-bold text-lg">{datosResultados[1]?.nombre}</div>
                          <div className="text-sm text-gray-500">
                            Puntuación: {datosResultados[1]?.puntuacion.toFixed(4)}
                          </div>
                        </div>
                      )}
                      {datosResultados[2] && (
                        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg border-2 border-orange-300">
                          <div className="text-3xl mb-2">🥉</div>
                          <div className="text-sm text-gray-600">Tercera Mejor</div>
                          <div className="font-bold text-lg">{datosResultados[2]?.nombre}</div>
                          <div className="text-sm text-gray-500">
                            Puntuación: {datosResultados[2]?.puntuacion.toFixed(4)}
                          </div>
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
                    <p className="text-lg">No hay resultados disponibles.</p>
                    <p className="text-sm">Agrega al menos 2 alternativas y haz clic en "Evaluar Alternativas"</p>
                  </div>
                )}
              </div>
            ),
          },
          {
            key: "4",
            label: "Análisis de Sensibilidad",
            disabled: alternativas.length < 2 || !resultado,
            children: (
              <div className="space-y-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold mb-2">Análisis de Sensibilidad</h3>
                  <p className="text-sm text-gray-600">
                    Analiza cómo cambios en los pesos de los criterios afectan la clasificación de alternativas
                  </p>
                </div>
                <br />

                <div className="grid grid-cols-1 gap-6">
                  <Card
                    hoverable
                    onClick={() => openSensitivityAnalysis("unidimensional")}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-lg font-semibold">Análisis de Sensibilidad de Peso Unidimensional</h4>
                          <p className="text-sm text-gray-600 mt-2">
                            Evalúa cómo cambia la mejor alternativa cuando varía el peso de un criterio específico
                            mientras los demás permanecen constantes.
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">
                        Haz clic para analizar la estabilidad de un criterio individual
                      </p>
                    </div>
                  </Card>

                  <Card
                    hoverable
                    onClick={() => openSensitivityAnalysis("multidimensional")}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-lg font-semibold">Análisis de Sensibilidad de Peso de Alta Dimensión</h4>
                          <p className="text-sm text-gray-600 mt-2">
                            Evalúa cómo cambia la clasificación cuando múltiples pesos varían simultáneamente,
                            permitiendo análisis más complejos.
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">
                        Haz clic para analizar la estabilidad de un criterio individual
                      </p>
                    </div>
                  </Card>
                </div>
              </div>
            ),
          },
        ]}
      />

      {/* Modal para seleccionar paquete de alternativas */}
      <AntModal
        title="Cargar Paquete de Alternativas"
        open={paquetesModalVisible}
        onCancel={() => setPaquetesModalVisible(false)}
        footer={null}
        width={1200}
      >
        {loadingPaquetes ? (
          <div className="text-center py-8">
            <Spin size="large" tip="Cargando paquetes..." />
          </div>
        ) : paquetes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No hay paquetes de alternativas disponibles para este modelo.</p>
            <p className="text-sm mt-2">Crea un paquete desde la pestaña de Paquetes.</p>
          </div>
        ) : (
          <Table
            dataSource={paquetes}
            columns={columnasPaquetesModal}
            rowKey="id"
            pagination={{ pageSize: 5 }}
            scroll={{ x: "max-content" }}
            size="small" // Usar un tamaño pequeño para una lista dentro de un modal
          />
        )}
      </AntModal>

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
        {selectedAnalysisType === "unidimensional" && modelo && modelo.getMetodo() === "MAUT" && (
          <UnidimensionalSensitivityMAUT
            alternativas={alternativas}
            criterios={modelo.getNodos()}
            metodoNombre={modelo.getMetodo()}
            hierarchy={modelo.getData().nodos.nodes}
            matrixNormMin={resultado?.result_min || []}
            matrixNormPromedioMin={resultado?.result_promedio_min || []}
            matrixNormPromedioMax={resultado?.result_promedio_max || []}
            matrixNormMax={resultado?.result_max || []}
          />
        )}
        {selectedAnalysisType === "multidimensional" && modelo && modelo.getMetodo() === "MAUT" && (
          <HighSensitivityMAUT
            alternativas={alternativas}
            criterios={modelo.getNodos()}
            metodoNombre={modelo.getMetodo()}
            hierarchy={modelo.getData().nodos.nodes}
            matrixNormMin={resultado?.result_min || []}
            matrixNormPromedioMin={resultado?.result_promedio_min || []}
            matrixNormPromedioMax={resultado?.result_promedio_max || []}
            matrixNormMax={resultado?.result_max || []}
          />
        )}
        {selectedAnalysisType === "unidimensional" && modelo && modelo.getMetodo() !== "MAUT" && (
          <UnidimensionalSensitivityAnalysis
            alternativas={alternativas}
            criterios={modelo.getNodos()}
            tipos={modelo.getCriteriosFinales().map((c) => (c.beneficio ? "max" : "min"))}
            metodoNombre={modelo.getMetodo()}
            hierarchy={modelo.getData().nodos.nodes}
            matrix={prepareAPIData()?.matrix || []}
          />
        )}
        {selectedAnalysisType === "multidimensional" && modelo && modelo.getMetodo() !== "MAUT" && (
          <HightSensitivityAnalysis
            alternativas={alternativas}
            criterios={modelo.getNodos()}
            tipos={modelo.getCriteriosFinales().map((c) => (c.beneficio ? "max" : "min"))}
            metodoNombre={modelo.getMetodo()}
            hierarchy={modelo.getData().nodos.nodes}
            matrix={prepareAPIData()?.matrix || []}
          />
        )}
      </Modal>
    </div>
  )
}
