"use client"

import { useParams } from "next/navigation"
import { useEffect, useState, useRef } from "react"
import { Tabs, Button, Table, Input, InputNumber, message, Switch, Spin, Upload } from "antd"
import { UploadOutlined, LeftOutlined, RightOutlined } from "@ant-design/icons"
import { Modelo, type ModeloData, type Nodo } from "@/types/modelo"
import ModeloSvgViewer from "@/components/modelo-svg-viewer"
import { supabase } from "@/lib/supabase"
import * as XLSX from "xlsx"

type ModoValor = "unico" | "rango"

interface ValorUnico {
  tipo: "unico"
  valor: number
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

  const ejecutarMetodo = async () => {
    if (alternativas.length < 2) {
      message.warning("Debes agregar al menos 2 alternativas para evaluar")
      return
    }
    setEvaluando(true)

    try {
      modelo?.calcularPesosFinales()
      const criteriosFinales = modelo?.getCriteriosFinales() || []

      const matrix = alternativas.map((alt) =>
        criteriosFinales.map((crit) => {
          const val = alt.valores[crit.idnodo]
          return val.tipo === "unico" ? val.valor : (val.min + val.max) / 2
        }),
      )

      const tipos = criteriosFinales.map((crit) => (crit.beneficio ? "max" : "min"))

      // Normalización
      const resNormalizacion = await fetch(`${process.env.NEXT_PUBLIC_URLFASTCALAMARY}/run-method/SAW/normalizar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matrix, tipos }),
      })
      if (!resNormalizacion.ok) throw new Error(await resNormalizacion.text())
      const dataNormalizacion = await resNormalizacion.json()
      const matrizNormalizada = dataNormalizacion.result
      const weights = criteriosFinales.map((crit) => crit.pesofinal || 0)

      // Agregación
      const resAgregacion = await fetch(`${process.env.NEXT_PUBLIC_URLFASTCALAMARY}/run-method/SAW/agregar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matrix: matrizNormalizada, weights }),
      })
      if (!resAgregacion.ok) throw new Error(await resAgregacion.text())
      const dataAgregacion: { result: { scores: number[] } } = await resAgregacion.json()
      const { scores } = dataAgregacion.result

      // Create array of objects with score, index, and alternative data
      const combinedData = scores.map((score, idx) => ({
        score,
        idx,
        alternativa: alternativas[idx],
        matrizNormalizada: matrizNormalizada[idx],
      }))

      // Sort by score descending (highest score first)
      combinedData.sort((a, b) => b.score - a.score)

      // Extract sorted data
      const alternativasOrdenadas = combinedData.map((item) => item.alternativa)
      const puntuacionesOrdenadas = combinedData.map((item) => item.score)
      const matrizNormalizadaOrdenada = combinedData.map((item) => item.matrizNormalizada)

      const matrizPonderada: number[][] = matrizNormalizadaOrdenada.map((fila: number[]) =>
        fila.map((valor, idx) => valor * weights[idx]),
      )

      // Update state with sorted alternatives
      setAlternativas(alternativasOrdenadas)

      setResultadoSAW({
        matriz_normalizada: matrizNormalizadaOrdenada,
        matriz_ponderada: matrizPonderada,
        puntuaciones: puntuacionesOrdenadas,
        ranking: combinedData.map((_, i) => i + 1), // 1 = mejor
      })

      message.success("Evaluación completada exitosamente")
    } catch (error) {
      console.error("[v0] Error ejecutando evaluación:", error)
      message.error("Error al ejecutar la evaluación")
    } finally {
      setEvaluando(false)
    }
  }

  const agregarAlternativa = () => {
    const criteriosFinales = modelo?.getCriteriosFinales() || []
    const nuevaAlternativa: Alternativa = {
      key: `alt-${Date.now()}`,
      nombre: `Alternativa ${alternativas.length + 1}`,
      valores: {},
    }

    criteriosFinales.forEach((criterio) => {
      if (modoValor === "unico") {
        nuevaAlternativa.valores[criterio.idnodo] = {
          tipo: "unico",
          valor: criterio.min || 0,
        }
      } else {
        nuevaAlternativa.valores[criterio.idnodo] = {
          tipo: "rango",
          min: criterio.min || 0,
          max: criterio.max || 100,
        }
      }
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

  const actualizarValorUnico = (keyAlternativa: string, idCriterio: number, valor: number) => {
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

  const actualizarValorRango = (keyAlternativa: string, idCriterio: number, campo: "min" | "max", valor: number) => {
    setAlternativas(
      alternativas.map((alt) => {
        if (alt.key === keyAlternativa) {
          const valorActual = alt.valores[idCriterio]
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

        const criteriosFinales = modelo?.getCriteriosFinales() || []
        const headers = jsonData[0].slice(1) // Skip first column (alternative names)

        if (headers.length !== criteriosFinales.length) {
          message.warning(
            `El Excel tiene ${headers.length} columnas de criterios, pero el modelo tiene ${criteriosFinales.length} criterios finales. Se intentará hacer coincidir por nombre.`,
          )
        }

        const nuevasAlternativas: Alternativa[] = []

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
            const excelColIdx = criterioIdx + 1 // +1 because first column is alternative name
            const valor = row[excelColIdx]

            if (valor !== undefined && valor !== null && valor !== "") {
              const numValor = typeof valor === "number" ? valor : Number.parseFloat(valor.toString())

              if (!isNaN(numValor)) {
                nuevaAlternativa.valores[criterio.idnodo] = {
                  tipo: "unico",
                  valor: numValor,
                }
              } else {
                nuevaAlternativa.valores[criterio.idnodo] = {
                  tipo: "unico",
                  valor: criterio.min || 0,
                }
              }
            } else {
              nuevaAlternativa.valores[criterio.idnodo] = {
                tipo: "unico",
                valor: criterio.min || 0,
              }
            }
          })

          nuevasAlternativas.push(nuevaAlternativa)
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
    return false // Prevent default upload behavior
  }

  const criteriosFinales = modelo?.getCriteriosFinales() || []

  const columnasValores =
    modoValor === "unico"
      ? criteriosFinales.map((criterio: Nodo) => ({
          title: criterio.titulo,
          dataIndex: ["valores", criterio.idnodo],
          key: `criterio-${criterio.idnodo}`,
          width: 150,
          render: (valorCriterio: ValorCriterio, record: Alternativa) => {
            const valor = valorCriterio?.tipo === "unico" ? valorCriterio.valor : criterio.min || 0
            return (
              <InputNumber
                value={valor}
                onChange={(val) => actualizarValorUnico(record.key, criterio.idnodo, val || 0)}
                min={criterio.min || 0}
                max={criterio.max || 100}
                className="w-full"
              />
            )
          },
        }))
      : criteriosFinales.flatMap((criterio: Nodo) => [
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

  const columnasNormalizadas = [
    {
      title: "Alternativa",
      dataIndex: "nombre",
      key: "nombre",
      width: 200,
      fixed: "left" as const,
    },
    ...criteriosFinales.map((criterio: Nodo, idx: number) => ({
      title: criterio.titulo,
      dataIndex: `criterio_${idx}`,
      key: `criterio_${idx}`,
      width: 120,
      render: (value: number) => value?.toFixed(4) || "0.0000",
    })),
  ]

  const datosNormalizados = resultadoSAW
    ? alternativas.map((alt, idx) => ({
        key: alt.key,
        nombre: alt.nombre,
        ...criteriosFinales.reduce(
          (acc, _, criterioIdx) => {
            acc[`criterio_${criterioIdx}`] = resultadoSAW.matriz_normalizada[idx]?.[criterioIdx] || 0
            return acc
          },
          {} as Record<string, number>,
        ),
      }))
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
    {
      title: "Puntuación",
      dataIndex: "puntuacion",
      key: "puntuacion",
      width: 150,
      render: (puntuacion: number) => <div className="font-semibold text-blue-600">{puntuacion.toFixed(4)}</div>,
    },
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
        ranking: rank,
        porcentaje: (resultadoSAW.puntuaciones[idx] / Math.max(...resultadoSAW.puntuaciones)) * 100,
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
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Modo:</span>
                <span className={`text-sm font-medium ${modoValor === "unico" ? "text-blue-600" : "text-gray-400"}`}>
                  Valor Único
                </span>
                <Switch
                  checked={modoValor === "rango"}
                  onChange={(checked) => setModoValor(checked ? "rango" : "unico")}
                />
                <span className={`text-sm font-medium ${modoValor === "rango" ? "text-blue-600" : "text-gray-400"}`}>
                  Rango (Min-Max)
                </span>
              </div>
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
                disabled={alternativas.length < 2}
                loading={evaluando}
                className="bg-green-600 hover:bg-green-700"
              >
                Evaluar Alternativas
              </Button>
            </div>
          </div>

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
              para cada criterio (en el mismo orden que aparecen en el modelo)
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
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
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
                <h3 className="text-lg font-semibold mb-2">Clasificación Final - Método SAW</h3>
                <p className="text-sm text-gray-600">Ranking de alternativas basado en puntuaciones ponderadas</p>
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
              <h2 className="text-lg font-bold truncate">{modelo?.getData().nombre}</h2>
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
    </div>
  )
}
