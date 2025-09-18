"use client"

import { useState, useEffect } from "react"
import Modal from "../Modal"
import { Nodo } from "@/types/modelo"
import { Tab, Tabs } from "../Tabs"
import AsignarPesos from "./AsignarPesos"

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        try {
            // if (!formData.titulo.trim()) {
            //     setError("El título es obligatorio.")
            //     setLoading(false)
            //     return
            // }

            // if (formData.min !== undefined && formData.max !== undefined && formData.min >= formData.max) {
            //     setError("El mínimo debe ser menor que el máximo.")
            //     setLoading(false)
            //     return
            // }

            // onNodoUpdated(formData)
            onClose()
        } catch (err: any) {
            setError(err.message || "Error al actualizar el nodo")
        } finally {
            setLoading(false)
        }
    }

    const handleGuardarPesos = (weights: Record<number, number>) => {
        //   setNodos((prev) =>
        //     prev.map((nodo) =>
        //       weights[nodo.idnodo] !== undefined
        //         ? { ...nodo, peso: parseFloat(weights[nodo.idnodo].toFixed(6)) }
        //         : nodo
        //     )
        //   )
    }


    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Configurar pesos">
            <Tabs>
                <Tab label="General">

                    <AsignarPesos
                        nodos={nodos} // Lista completa de nodos
                        onSave={handleGuardarPesos} // Función para guardar los pesos
                    />
                </Tab>
                <Tab label="As">holis</Tab>

            </Tabs>
        </Modal >
    )
}
