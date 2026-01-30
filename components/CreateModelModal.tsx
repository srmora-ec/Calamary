"use client"

import type React from "react"
import { useState, useEffect } from "react"
import Modal from "./Modal"
import Image from "next/image"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"

interface Metodo {
  id: number
  nombre: string
  descripcion: string
}

interface CreateModelModalProps {
  isOpen: boolean
  onClose: () => void
  onModelCreated: () => void
}

export default function CreateModelModal({ isOpen, onClose, onModelCreated }: CreateModelModalProps) {
    const { t } = useTranslation()
  const [formData, setFormData] = useState({
    nombre: "",
    descripcion: "" as string | null,
    orientacion: "h" as "h" | "v",
    linea: 1,
    publico: false,
    metodoId: 1,
  })

  const [metodos, setMetodos] = useState<Metodo[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMetodos, setLoadingMetodos] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  // 👇 Cargar métodos desde Supabase
  useEffect(() => {
    const fetchMetodos = async () => {
      setLoadingMetodos(true)
      const { data, error } = await supabase
        .from("metodos")
        .select("id, nombre, descripcion")
        .eq("estado",true)
        .order("id", { ascending: true })

      if (error) {
        console.error(error)
      } else if (data) {
        
        console.log("metodos:",data)
        setMetodos(data)
        // Si no hay método seleccionado aún, tomamos el primero como predeterminado
        if (data.length > 0 && !formData.metodoId) {
          setFormData((prev) => ({ ...prev, metodoId: data[0].id }))
        }
      }
      setLoadingMetodos(false)
    }

    if (isOpen) {
      fetchMetodos()
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    if (!formData.nombre.trim()) {
      setError("El nombre es obligatorio.")
      setLoading(false)
      return
    }
    if (formData.nombre.length > 150) {
      setError("El nombre no puede superar los 150 caracteres.")
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase.rpc("insert_modelo", {
        p_nombre: formData.nombre,
        p_descripcion: formData.descripcion || null,
        p_orientacion: formData.orientacion,
        p_linea: formData.linea,
        p_publico: formData.publico,
        p_metodo: formData.metodoId,
      })

      if (error) throw error
      if (!data || data.length === 0) throw new Error("No se devolvió el modelo creado")

      const nuevoModelo = data[0]
      router.push(`/tablero/${nuevoModelo.id}`)
    } catch (err: any) {
      setError(err.message || "Error al crear el modelo")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFormData({
      nombre: "",
      descripcion: null,
      orientacion: "h",
      linea: 1,
      publico: false,
      metodoId: 1,
    })
    setError("")
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Crear nuevo modelo">
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-4 p-4 rounded bg-red-50 text-red-600">
            {error}
          </div>
        )}

        {/* Nombre */}
        <div className="form-group">
          <label className="form-label">{t("generic.nombre")} *</label>
          <input
            type="text"
            className="form-input"
            value={formData.nombre}
            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
            maxLength={150}
            required
          />
          <small className="text-gray-500">{formData.nombre.length}/150</small>
        </div>

        {/* Descripción */}
        <div className="form-group">
          <label className="form-label">{t("generic.descripcion")}</label>
          <textarea
            className="form-input"
            rows={3}
            maxLength={500}
            value={formData.descripcion || ""}
            onChange={(e) => setFormData({ ...formData, descripcion: e.target.value || null })}
          />
        </div>

        {/* Orientación */}
        <div className="form-group">
          <label className="form-label">{t("generic.orientacion")} *</label>
          <div className="grid grid-cols-2 gap-4">
            {["h", "v"].map((val) => (
              <div
                key={val}
                onClick={() => setFormData({ ...formData, orientacion: val as "h" | "v" })}
                className={`cursor-pointer border-2 rounded-lg flex justify-center items-center p-2
                  ${formData.orientacion === val ? "border-blue-500" : "border-gray-300"}`}
              >
                <Image
                  src={val === "h" ? "/horizontal.png" : "/vertical.png"}
                  alt={val === "h" ? "Horizontal" : "Vertical"}
                  width={100}
                  height={100}
                  className="object-contain"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Línea */}
        <div className="form-group">
          <label className="form-label">{t("modelcard.linea")}</label>
          <select
            className="form-select"
            value={formData.linea}
            onChange={(e) => setFormData({ ...formData, linea: Number.parseInt(e.target.value) })}
          >
            <option value={1}>{t("modelcard.direct")}</option>
            <option value={2}>{t("modelcard.escalo")}</option>
            <option value={3}>{t("modelcard.escalosu")}</option>
            <option value={4}>{t("modelcard.bezier")}</option>
          </select>
        </div>

        {/* Método */}
        <div className="form-group">
          <label className="form-label">{t("generic.metodo")} *</label>
          {loadingMetodos ? (
            <div className="text-gray-500">{t("generic.loading")}...</div>
          ) : (
            <select
              className="form-select"
              value={formData.metodoId}
              onChange={(e) =>
                setFormData({ ...formData, metodoId: Number.parseInt(e.target.value) })
              }
            >
              {metodos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Visibilidad */}
        <div className="form-group">
          <label className="form-label block mb-2">{t("generic.visibilidad")}</label>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, publico: !formData.publico })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              formData.publico ? "bg-blue-600" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                formData.publico ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className="ml-3">{formData.publico ? t("generic.public") : t("generic.private")}</span>
        </div>
        {/* Botones */}
        <div className="modal-footer">
          <button type="button" onClick={handleClose} className="btn btn-secondary" disabled={loading}>
            {t("generic.cancelar")}
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="spinner"></div>
                {t("generic.loading")}...
              </div>
            ) : (
              t("dashboard.bt.crearmod")
            )}
          </button>
        </div>
      </form>
    </Modal>
  )
}
