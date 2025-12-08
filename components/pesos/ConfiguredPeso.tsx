"use client"

import { useState } from "react"
import Modal from "../Modal"
import { Nodo } from "@/types/modelo"
import AsignarPesos from "./AsignarPesos"
import ComparacionPorPares from "./comparacionParesMatriz"
import ComparacionPorPasos from "./comparacionporpasos"
import { Tabs } from "antd"
import SaatyExpertos from "./comppasosexperto"
import AsignarIgual from "../AsignarIgual"
import AsignarPesosDifusos from "./AsignarPesosFuzzy"

interface ConfigureModalPesoProps {
  isOpen: boolean
  onClose: () => void
  idmodelo: number
  nodos: Nodo[]
  onNodosUpdated: (nodosActualizado: Nodo[]) => void
}

export default function ConfigureModalPeso({
  isOpen,
  onClose,
  idmodelo,
  nodos,
  onNodosUpdated,
}: ConfigureModalPesoProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleGuardarPesos = (weights: Record<number, number>) => {
    const nodosActualizados = nodos.map((nodo) => ({
      ...nodo,
      peso:
        weights[nodo.idnodo] !== undefined
          ? parseFloat(weights[nodo.idnodo].toFixed(6))
          : nodo.peso,
    }))

    onNodosUpdated(nodosActualizados)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configurar pesos" width="100%">
      <Tabs
        type="card"
        items={[
          {
            label: "General",
            key: "1",
            children: (
              <AsignarPesos
                nodos={nodos}
                onSave={handleGuardarPesos}
              />
            ),
          },
          {
            label: "SA",
            key: "2",
            children: (
              <AsignarIgual
                nodos={nodos}
                onSave={handleGuardarPesos}
              />
            ),
          },
          {
            label: "Método Saaty (Matriz)",
            key: "3",
            children: (
              <ComparacionPorPares
                idmodelo={idmodelo}
                nodos={nodos}
                onSave={handleGuardarPesos}
              />
            ),
          },
          {
            label: "Método Saaty (Por pasos)",
            key: "4",
            children: (
              <ComparacionPorPasos
                nodos={nodos}
                onSave={handleGuardarPesos}
              />
            ),
          },
          {
            label: "Método Saaty (Expertos)",
            key: "5",
            children: (
              <SaatyExpertos
              idmodelo={idmodelo}
                nodos={nodos}
                onSave={handleGuardarPesos}
              />
            ),
          },
          {
            label: "Asignar pesos difusos",
            key: "6",
            children: (
              <AsignarPesosDifusos
                nodos={nodos}
                onSave={handleGuardarPesos}
              />
            ),
          }
        ]}
      />
    </Modal>
  )
}
