"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"

interface Props {
  modeloId: number
  cita?: any
  onClose: () => void
}

export default function FormularioCita({ modeloId, cita, onClose }: Props) {
  const [autor, setAutor] = useState(cita?.autor || "")
  const [año, setAño] = useState(cita?.año || "")
  const [titulo, setTitulo] = useState(cita?.titulo || "")
  const [fuente, setFuente] = useState(cita?.fuente || "")
  const [doi, setDoi] = useState(cita?.doi || "")
  const [url, setUrl] = useState(cita?.url || "")
  const [tipo, setTipo] = useState(cita?.tipo || "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function buscarDOI() {
    if (!doi) return alert("Ingrese un DOI primero.")
    setLoading(true)
    try {
      const resp = await fetch(`https://api.crossref.org/v1/works/${doi}`)
      if (!resp.ok) throw new Error("DOI no encontrado.")
      const json = await resp.json()
      const msg = json.message
      setTitulo(msg.title?.[0] || "")
      setAutor(msg.author?.map((a: any) => `${a.family}, ${a.given}`).join("; ") || "")
      setAño(msg.issued?.["date-parts"]?.[0]?.[0] || "")
      setFuente(msg["container-title"]?.[0] || msg.publisher || "")
      setUrl(msg.URL || "")
      alert("Datos del DOI cargados correctamente.")
    } catch (e: any) {
      alert(e.message)
    }
    setLoading(false)
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!autor.trim() || !titulo.trim()) {
      setError("Autor y título son obligatorios.")
      return
    }

    setLoading(true)
    const payload = {
      autor,
      año: año ? parseInt(año) : null,
      titulo,
      fuente,
      doi,
      url,
      tipo,
      modelo: modeloId,
    }

    const { error } = cita
      ? await supabase.from("cita").update(payload).eq("id", cita.id)
      : await supabase.from("cita").insert(payload)

    if (error) alert("Error al guardar: " + error.message)
    else onClose()
    setLoading(false)
  }

  return (
    <form onSubmit={guardar} className="space-y-3">
      {error && <div className="bg-red-100 text-red-700 p-2 rounded">{error}</div>}

      <div className="form-group">
        <label className="form-label">Autor(es) *</label>
        <input
          type="text"
          className="form-input"
          value={autor}
          onChange={(e) => setAutor(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label">Año</label>
        <input
          type="number"
          className="form-input"
          value={año}
          onChange={(e) => setAño(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Título *</label>
        <input
          type="text"
          className="form-input"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label">Fuente</label>
        <input
          type="text"
          className="form-input"
          value={fuente}
          onChange={(e) => setFuente(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">DOI</label>
        <div className="flex gap-2">
          <input
            type="text"
            className="form-input flex-1"
            value={doi}
            onChange={(e) => setDoi(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={buscarDOI}
            disabled={loading}
          >
            Buscar
          </button>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">URL</label>
        <input
          type="text"
          className="form-input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Tipo</label>
        <select
          className="form-select"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
        >
          <option value="">Seleccionar...</option>
          <option value="articulo">Artículo</option>
          <option value="libro">Libro</option>
          <option value="tesis">Tesis</option>
          <option value="otro">Otro</option>
        </select>
      </div>

      <div className="modal-footer">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onClose}
          disabled={loading}
        >
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Guardando..." : cita ? "Actualizar" : "Guardar"}
        </button>
      </div>
    </form>
  )
}
