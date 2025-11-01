"use client"

import type React from "react"
import { Table, Input, Button, InputNumber, message, Select } from "antd"
import type { Modelo, Nodo } from "@/types/modelo"
import type { Alternativa, ValorCriterio, ResultadoEvaluacion, ValorRango } from "@/app/alternativas/page"

interface MautRangoProps {
  modelo: Modelo | null
  alternativas: Alternativa[]
  setAlternativas: React.Dispatch<React.SetStateAction<Alternativa[]>>
  setResultadoEvaluacion: React.Dispatch<React.SetStateAction<ResultadoEvaluacion | null>>
  criteriosFinales: Nodo[]
  modoValor: "rango"
}

const getValorInicialParaCriterio = (criterio: Nodo): ValorCriterio => {
  const isDiscreto = criterio.MAUT?.tipoFuncion === "discreta"
  let initialMin: string | number
  let initialMax: string | number

  if (isDiscreto) {
    const firstDiscreteValue = criterio.MAUT?.funcionDiscreta?.valores?.[0]?.nombre || ""
    initialMin = firstDiscreteValue
    initialMax = firstDiscreteValue
  } else {
    initialMin = criterio.min || 0
    initialMax = criterio.max || 100
  }

  return {
    tipo: "rango",
    min: initialMin,
    max: initialMax,
  }
}

const MautRango: React.FC<MautRangoProps> = ({
  alternativas,
  setAlternativas,
  setResultadoEvaluacion,
  criteriosFinales,
}) => {
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

  const actualizarValorRango = (keyAlternativa: string, idCriterio: number, campo: "min" | "max", valor: number) => {
    setAlternativas(
      alternativas.map((alt) => {
        if (alt.key === keyAlternativa) {
          const valorActual = alt.valores[idCriterio]

          const nuevoValor: ValorRango = {
            tipo: "rango",
            min: valorActual.tipo === "rango" ? (typeof valorActual.min === "number" ? valorActual.min : 0) : 0,
            max: valorActual.tipo === "rango" ? (typeof valorActual.max === "number" ? valorActual.max : 100) : 100,
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

  const actualizarValorDiscreto = (keyAlternativa: string, idCriterio: number, campo: "min" | "max", valor: string) => {
    setAlternativas(
      alternativas.map((alt) => {
        if (alt.key === keyAlternativa) {
          const valorActual = alt.valores[idCriterio]

          const nuevoValor: ValorRango = {
            tipo: "rango",
            min: valorActual.tipo === "rango" ? (typeof valorActual.min === "string" ? valorActual.min : "") : "",
            max: valorActual.tipo === "rango" ? (typeof valorActual.max === "string" ? valorActual.max : "") : "",
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
    setAlternativas(alternativas.map((alt) => (alt.key === key ? { ...alt, nombre: nuevoNombre } : alt)))
  }

  const eliminarAlternativa = (key: string) => {
    setAlternativas(alternativas.filter((alt) => alt.key !== key))
    setResultadoEvaluacion(null)
    message.success("Alternativa eliminada")
  }

  const renderInput = (criterio: Nodo, record: Alternativa, campo: "min" | "max", valorCriterio: ValorCriterio) => {
    const isDiscreto = criterio.MAUT?.tipoFuncion === "discreta"

    const valor =
      valorCriterio?.tipo === "rango"
        ? campo === "min"
          ? valorCriterio.min
          : valorCriterio.max
        : isDiscreto
          ? ""
          : campo === "min"
            ? criterio.min || 0
            : criterio.max || 100

    if (isDiscreto) {
      const discreteValues = criterio.MAUT?.funcionDiscreta?.valores || []
      const options = discreteValues.map((v: any) => ({
        label: v.nombre,
        value: v.nombre,
      }))

      const strValor = typeof valor === "string" ? valor : ""

      return (
        <Select
          value={strValor || undefined}
          onChange={(val) => actualizarValorDiscreto(record.key, criterio.idnodo, campo, val)}
          options={options}
          className="w-full"
          placeholder={`Seleccionar ${campo}`}
        />
      )
    } else {
      const numValor = typeof valor === "number" ? valor : 0

      return (
        <InputNumber
          value={numValor}
          onChange={(val) => actualizarValorRango(record.key, criterio.idnodo, campo, val || 0)}
          min={criterio.min || 0}
          max={criterio.max || 100}
          className="w-full"
        />
      )
    }
  }

  const columnasValores = criteriosFinales.flatMap((criterio: Nodo) => [
    {
      title: `${criterio.titulo} (Min)`,
      dataIndex: ["valores", criterio.idnodo],
      key: `criterio-${criterio.idnodo}-min`,
      width: 150,
      render: (valorCriterio: ValorCriterio, record: Alternativa) =>
        renderInput(criterio, record, "min", valorCriterio),
    },
    {
      title: `${criterio.titulo} (Max)`,
      dataIndex: ["valores", criterio.idnodo],
      key: `criterio-${criterio.idnodo}-max`,
      width: 150,
      render: (valorCriterio: ValorCriterio, record: Alternativa) =>
        renderInput(criterio, record, "max", valorCriterio),
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

export default MautRango
