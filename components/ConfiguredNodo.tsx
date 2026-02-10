"use client"

import { useState, useEffect } from "react"
import Modal from "./Modal"
import { Nodo } from "@/types/modelo"
import Switch from "./Switch"
import { useTranslation } from "react-i18next"

interface ConfigureModalNodoProps {
    isOpen: boolean//abir
    onClose: () => void//cerrar
    nodo: Nodo//el nodo
    onNodoUpdated: (nodoActualizado: Nodo) => void
}

export default function ConfigureModalNodo({ isOpen, onClose, nodo, onNodoUpdated }: ConfigureModalNodoProps) {
    const {t} = useTranslation();
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

            if (formData.min >= formData.max) {
                setError(t("confignodo.minmax"))
                setLoading(false)
                return
            }

            onNodoUpdated(formData)
            onClose()
        } catch (err: any) {
            setError(err.message || "Error")
        } finally {
            setLoading(false)
        }
    }
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`${t("confignodo.editnodo")} #${formData.idnodo}`}>
            <form onSubmit={handleSubmit}>
                {error && (
                    <div className="mb-4 p-4 rounded bg-red-100 text-red-600">
                        {error}
                    </div>
                )}

                {/* Título */}
                <div className="form-group">
                    <label className="form-label">{t('generic.titulo')} *</label>
                    <input
                        type="text"
                        className="form-input"
                        value={formData.titulo}
                        onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                        maxLength={50}
                        required
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">{t('generic.descripcion')}</label>
                    <textarea
                        className="form-input"
                        value={formData.descripcion}
                        onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                        maxLength={800}
                        rows={4} // opcional, para definir alto inicial
                    />
                </div>
                {formData.criterioFinal && (

                    <>
                <div className="form-group">
                    <label className="form-label">{t("confignodo.unime")} *</label>
                    <input
                        type="text"
                        className="form-input"
                        value={formData.unidadmedida}
                        onChange={(e) => setFormData({ ...formData, unidadmedida: e.target.value})}
                        maxLength={20}
                        required
                    />
                </div>

                
                        <div className="form-group">
                            {/* Minimo */}
                            <label className="form-label">{t("generic.minimo")} *</label>
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
                            <label className="form-label">{t("generic.maximo")} *</label>
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
                            option1={{ label: t("generic.beneficio"), value: "true" }}
                            option2={{ label: t("generic.costo"), value: "false" }}
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
                        {t("generic.cancelar")}
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? t("generic.loading") : t("botones.guardar")}
                    </button>
                </div>
            </form>
        </Modal >
    )
}
