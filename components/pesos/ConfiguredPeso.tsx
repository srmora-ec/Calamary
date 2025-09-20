"use client"

import { useState, useEffect } from "react"
import Modal from "../Modal"
import { Nodo } from "@/types/modelo"
import { Tab, Tabs } from "../Tabs"
import AsignarPesos from "./AsignarPesos"
import ComparacionPorPares from "./comparacionParesMatriz"
import ComparacionPorPasos from "./comparacionporpasos"

interface ConfigureModalPesoProps {
    isOpen: boolean//abir
    onClose: () => void//cerrar
    nodos: Nodo[]
    onNodosUpdated: (nodosActualizado: Nodo[]) => void
}

export default function ConfigureModalPeso({ isOpen, onClose, nodos, onNodosUpdated }: ConfigureModalPesoProps) {
    // const [formData, setFormData] = useState<Nodo>(nodo)//formdata
    const [loading, setLoading] = useState(false)//loading
    const [error, setError] = useState("")//Errores

    // Cuando cambie el nodo recibido, refresca el form
    // useEffect(() => {
    //     if (nodo) setFormData(nodo)
    // }, [nodo])

    const handleGuardarPesos = (weights: Record<number, number>) => {
        const nodosActualizados = nodos.map((nodo) => ({
            ...nodo,
            peso: weights[nodo.idnodo] !== undefined
                ? parseFloat(weights[nodo.idnodo].toFixed(6))
                : nodo.peso
        }))

        onNodosUpdated(nodosActualizados) //
    }



    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Configurar pesos" width="100%">
            <Tabs>
                <Tab label="General">

                    <AsignarPesos
                        nodos={nodos} // Lista completa de nodos
                        onSave={handleGuardarPesos} // Función para guardar los pesos
                    />
                </Tab>
                <Tab label="Método Saaty (Matriz)">

                            <ComparacionPorPares
                                nodos={nodos}
                                onSave={handleGuardarPesos}
                            />
                </Tab>
                  <Tab label="Método Saaty (Por pasos)">
                            <ComparacionPorPasos
                                nodos={nodos}
                                onSave={handleGuardarPesos}
                            />
                        </Tab>
            </Tabs>
        </Modal >
    )
}
