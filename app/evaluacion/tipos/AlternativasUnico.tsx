"use client"

import React from "react"
import { Table, Input, Button, InputNumber, message } from "antd"
import { type Modelo, type Nodo } from "@/types/modelo"
import { Alternativa, ValorCriterio, AlternativaValores, ResultadoEvaluacion } from "../page" // Importar tipos desde el componente padre

interface NoMautUnicoProps {
  modelo: Modelo | null
  alternativas: Alternativa[]
  setAlternativas: React.Dispatch<React.SetStateAction<Alternativa[]>>
  setResultadoEvaluacion: React.Dispatch<React.SetStateAction<ResultadoEvaluacion | null>>
  criteriosFinales: Nodo[]
  modoValor: "unico" // Fijo para este componente
}

const getValorInicialParaCriterio = (criterio: Nodo): ValorCriterio => ({
  tipo: "unico",
  valor: criterio.min || 0, // Inicia con el valor mínimo
})

const NoMautUnico: React.FC<NoMautUnicoProps> = ({
  alternativas,
  setAlternativas,
  setResultadoEvaluacion,
  criteriosFinales,
}) => {
  // Función para agregar una nueva alternativa
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

  // Actualizar el valor único (siempre numérico para No-MAUT)
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
                valor, // Siempre número
              },
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

  // Columnas dinámicas para los criterios
  const columnasValores = criteriosFinales.map((criterio: Nodo) => ({
    title: criterio.titulo,
    dataIndex: ["valores", criterio.idnodo],
    key: `criterio-${criterio.idnodo}`,
    width: 150,
    render: (valorCriterio: ValorCriterio, record: Alternativa) => {
      // Siempre esperamos ValorUnico con un valor numérico
      const valor = valorCriterio?.tipo === "unico" && typeof valorCriterio.valor === "number"
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
    },
  }))

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
    <>
      <div className="bg-white rounded-lg border">
        <Table columns={columns} dataSource={alternativas} pagination={false} scroll={{ x: "max-content" }} />
      </div>
      <Button type="primary" onClick={agregarAlternativa} className="mt-4">
        Añadir Alternativa
      </Button>
    </>
  )
}

export default NoMautUnico