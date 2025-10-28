"use client"

import { useState, useEffect } from "react"
import Modal from "./Modal"
import { Nodo } from "@/types/modelo"
import Switch from "./Switch"

interface ConfigureModalNodoProps {
    isOpen: boolean//abir
    onClose: () => void//cerrar
    nodo: Nodo//el nodo
    onNodoUpdated: (nodoActualizado: Nodo) => void
}

export default function ConfigureModalNodo({ isOpen, onClose, nodo, onNodoUpdated }: ConfigureModalNodoProps) {
    const [formData, setFormData] = useState<Nodo>(nodo)//formdata
    const [loading, setLoading] = useState(false)//loading
    const [error, setError] = useState("")//Errores

    // Cuando cambie el nodo recibido, refresca el form
    useEffect(() => {
        if (nodo) setFormData(nodo)
    }, [nodo])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        try {
            if (!formData.titulo.trim()) {
                setError("El título es obligatorio.")
                setLoading(false)
                return
            }

            if (formData.min !== undefined && formData.max !== undefined && formData.min >= formData.max) {
                setError("El mínimo debe ser menor que el máximo.")
                setLoading(false)
                return
            }

            onNodoUpdated(formData)
            onClose()
        } catch (err: any) {
            setError(err.message || "Error al actualizar el nodo")
        } finally {
            setLoading(false)
        }
    }
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Editar nodo #${formData.idnodo}`}>
            <form onSubmit={handleSubmit}>
                {error && (
                    <div className="mb-4 p-4 rounded bg-red-100 text-red-600">
                        {error}
                    </div>
                )}

                {/* Título */}
                <div className="form-group">
                    <label className="form-label">Título *</label>
                    <input
                        type="text"
                        className="form-input"
                        value={formData.titulo}
                        onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                        maxLength={50}
                        required
                    />
                </div>

                {/* Acortado */}
                <div className="form-group">
                    <label className="form-label">Acortado</label>
                    <input
                        type="text"
                        className="form-input"
                        value={formData.acortado ?? ""}
                        onChange={(e) => setFormData({ ...formData, acortado: e.target.value })}
                        maxLength={5}

                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Descripción</label>
                    <textarea
                        className="form-input"
                        value={formData.descripcion}
                        onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                        maxLength={200}
                        rows={4} // opcional, para definir alto inicial
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">Unidad de medida *</label>
                    <input
                        type="text"
                        className="form-input"
                        value={formData.unidadmedida}
                        onChange={(e) => setFormData({ ...formData, unidadmedida: e.target.value})}
                        maxLength={10}
                        required
                    />
                </div>

                {formData.criterioFinal && (

                    <>
                        <div className="form-group">
                            {/* Minimo */}
                            <label className="form-label">Mínimo *</label>
                            <input
                                type="number"
                                className="form-input"
                                value={formData.min ?? -100}
                                onChange={(e) => setFormData({ ...formData, min: Number(e.target.value) })}
                                maxLength={5}
                                required
                            />
                        </div>
                        {/* Maximo */}
                        <div className="form-group">
                            <label className="form-label">Máximo *</label>
                            <input
                                type="number"
                                className="form-input"
                                value={formData.max ?? 100}
                                onChange={(e) => setFormData({ ...formData, max: Number(e.target.value) })}
                                max={9999}
                                required
                            />
                        </div>
                        <Switch
                            option1={{ label: "Beneficio", value: "true" }}
                            option2={{ label: "Costo", value: "false" }}
                            defaultValue={String(formData.beneficio)}
                            onChange={(val) => {
                                console.log(val)
                                setFormData({ ...formData, beneficio: val === "true" })
                            }}
                        />
                    </>
                )}


                {/* Botones */}
                <div className="modal-footer">
                    <button type="button" onClick={onClose} className="btn btn-secondary" disabled={loading}>
                        Cancelar
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? "Guardando..." : "Guardar cambios"}
                    </button>
                </div>
            </form>
        </Modal >
    )
}
