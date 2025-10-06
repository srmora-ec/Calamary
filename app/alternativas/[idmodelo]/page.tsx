"use client"

import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { Tabs, Button, Table, Input, InputNumber, message, Switch } from "antd"
import { Modelo, type ModeloData, type Nodo } from "@/types/modelo"
import ModeloSvgViewer from "@/components/modelo-svg-viewer"
import { supabase } from "@/lib/supabase"

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

export default function AlternativasPage() {
  const { idmodelo } = useParams()
  const [modelo, setModelo] = useState<Modelo | null>(null)
  const [loading, setLoading] = useState(true)
  const [alternativas, setAlternativas] = useState<Alternativa[]>([])
  const [modoValor, setModoValor] = useState<ModoValor>("unico")

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
    message.success("Alternativa agregada")
  }

  const eliminarAlternativa = (key: string) => {
    setAlternativas(alternativas.filter((alt) => alt.key !== key))
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Cargando modelo...</div>
      </div>
    )
  }

  if (!modelo) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg text-red-500">Error al cargar el modelo</div>
      </div>
    )
  }

  const criteriosFinales = modelo.getCriteriosFinales()

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
            <Button type="primary" onClick={agregarAlternativa}>
              Agregar Alternativa
            </Button>
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
          </div>
        </div>
      ),
    },
    {
      key: "2",
      label: "Evaluación",
      children: (
        <div className="p-4">
          <p className="text-gray-500">Aquí irá la evaluación de alternativas (próximamente)</p>
        </div>
      ),
    },
    {
      key: "3",
      label: "Resultados",
      children: (
        <div className="p-4">
          <p className="text-gray-500">Aquí irán los resultados finales (próximamente)</p>
        </div>
      ),
    },
  ]

  return (
    <div className="flex h-screen">
      <div className="w-1/3 border-r bg-white p-4 flex flex-col">
        <div className="mb-4">
          <h2 className="text-xl font-bold">{modelo.getData().nombre}</h2>
          <p className="text-sm text-gray-500">{modelo.getData().descripcion}</p>
        </div>
        <div className="flex-1 overflow-hidden">
          <ModeloSvgViewer
            nodos={modelo.getNodos()}
            orientacion={modelo.getOrientacion()}
            linea={modelo.getLinea()}
            nombreModelo={modelo.getData().nombre}
          />
        </div>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        <Tabs items={tabItems} defaultActiveKey="1" />
      </div>
    </div>
  )
}
