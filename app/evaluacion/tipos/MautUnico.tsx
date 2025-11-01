"use client"

import React from "react"
import { Table, Input, Button, InputNumber, message, Select } from "antd"
import { type Modelo, type Nodo } from "@/types/modelo"
import { Alternativa, ValorCriterio, ResultadoEvaluacion } from "../page"

// ----------------------------------------------------------------------
// Props y Lógica Específica
// ----------------------------------------------------------------------

interface MautUnicoProps {
  modelo: Modelo | null
  alternativas: Alternativa[]
  setAlternativas: React.Dispatch<React.SetStateAction<Alternativa[]>>
  setResultadoEvaluacion: React.Dispatch<React.SetStateAction<ResultadoEvaluacion | null>>
  criteriosFinales: Nodo[]
  modoValor: "unico" // Fijo para este componente
}

const getValorInicialParaCriterio = (criterio: Nodo, modelo: Modelo | null): ValorCriterio => {
  // 🔹 MAUT Discreto
  if (modelo?.getMetodo() === "MAUT" && criterio.MAUT?.tipoFuncion === "discreta" && criterio.MAUT.funcionDiscreta?.valores.length) {
    return {
      tipo: "unico",
      valor: criterio.MAUT.funcionDiscreta.valores[0].nombre, // Usa el nombre de la primera opción
    }
  }

  // 🔹 Continuo
  return {
    tipo: "unico",
    valor: criterio.min || 0,
  }
}

const MautUnico: React.FC<MautUnicoProps> = ({
  modelo,
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
      nuevaAlternativa.valores[criterio.idnodo] = getValorInicialParaCriterio(criterio, modelo)
    })

    setAlternativas([...alternativas, nuevaAlternativa])
    setResultadoEvaluacion(null)
    message.success("Alternativa agregada")
  }

  // Actualizada para manejar number (continuo) o string (discreto)
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

  // Componente para renderizar la celda de valor único (continuo o discreto)
  const renderValorUnicoCell = (criterio: Nodo, valorCriterio: ValorCriterio, record: Alternativa) => {
    // 1. Criterio MAUT Discreto
    if (criterio.MAUT?.tipoFuncion === "discreta") {
      const opcionesDiscretas = criterio.MAUT.funcionDiscreta?.valores || []
      const valorSeleccionado = valorCriterio?.tipo === "unico" && typeof valorCriterio.valor === "string"
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

    // 2. Criterio Continuo (Numérico)
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
  }

  // Columnas dinámicas para los criterios
  const columnasValores = criteriosFinales.map((criterio: Nodo) => ({
    title: criterio.titulo,
    dataIndex: ["valores", criterio.idnodo],
    key: `criterio-${criterio.idnodo}`,
    width: 150,
    render: (valorCriterio: ValorCriterio, record: Alternativa) =>
      renderValorUnicoCell(criterio, valorCriterio, record),
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

export default MautUnico