"use client"

import { useEffect, useState } from "react"
import Modal from "./Modal"
import { supabase } from "@/lib/supabase"
import FormularioCita from "./FormularioCita"
import { useTranslation } from "react-i18next"
import { useNotification } from "./NotificationProvider"

interface Cita {
  id: number
  autor: string
  año?: number
  titulo: string
  fuente?: string
  doi?: string
  url?: string
  tipo?: string
  modelo: number
}

interface Props {
  modeloId: number
}

export default function CitasModelo({ modeloId }: Props) {
  const [citas, setCitas] = useState<Cita[]>([])
  const [loading, setLoading] = useState(true)
  const [openPopoverId, setOpenPopoverId] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<Cita | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { t } = useTranslation()
  const { notify } = useNotification()

  // ======= CARGAR CITAS =======
  async function cargarCitas() {
    setLoading(true)
    const { data, error } = await supabase
      .from("cita")
      .select("*")
      .eq("modelo", modeloId)
      .order("id", { ascending: true })
    if (error) setError("Error al cargar citas: " + error.message)
    else setCitas(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (modeloId) cargarCitas()
  }, [modeloId])

  // ======= ELIMINAR =======
  async function eliminarCita(id: number) {
    const { error } = await supabase.from("cita").delete().eq("id", id)
    if (error) {
      notify("Error","error",)
      alert(t('citas.erroreliminar') + error.message)
    } else {
      cargarCitas()
    }
    setOpenPopoverId(null)
  }

  // ======= FORMATEO IEEE =======
  function formatoIEEE(c: Cita) {
    const partes: string[] = []
    partes.push(c.autor)
    if (c.año) partes.push(`(${c.año})`)
    partes.push(`"${c.titulo}."`)
    if (c.fuente) partes.push(`<i>${c.fuente}</i>`)
    if (c.doi)
      partes.push(
        `<a href="https://doi.org/${c.doi}" target="_blank" class="text-blue-600 underline">https://doi.org/${c.doi}</a>`
      )
    else if (c.url)
      partes.push(
        `<a href="${c.url}" target="_blank" class="text-blue-600 underline">${c.url}</a>`
      )
    return partes.join(" ")
  }

  function abrirCrear() {
    setEditando(null)
    setModalOpen(true)
  }
  function abrirEditar(cita: Cita) {
    setEditando(cita)
    setModalOpen(true)
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">{t('citas.asociadas')}</h2>
        <button
          onClick={abrirCrear}
          className="btn btn-primary flex items-center gap-2"
        >
          <span>＋</span> {t('generic.nueva')} {t('citas.nombre').toLowerCase()}
        </button>
      </div>

      {error && <div className="text-red-500 mb-4">{error}</div>}

      {loading ? (
        <div className="text-gray-500">{t('citas.cargando')}</div>
      ) : citas.length === 0 ? (
        <p className="text-gray-600">{t('citas.nohay')}</p>
      ) : (
        <div className="space-y-3">
          {citas.map((c) => (
            <div
              key={c.id}
              className="border p-3 rounded-lg flex justify-between hover:shadow transition w-full h-full p-4 flex flex-col overflow-auto"
            >
              <div
                className="text-sm text-gray-800"
                dangerouslySetInnerHTML={{ __html: formatoIEEE(c) }}
              />
              <div className="relative">
                {openPopoverId === c.id ? (
                  <div className="absolute right-0 top-0 bg-white border rounded-lg shadow-lg p-3 z-10">
                    <p className="mb-2 text-sm text-gray-700">
                      {t('citas.eliminar')}
                    </p>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setOpenPopoverId(null)}
                        className="btn btn-secondary"
                      >
                        {t('generic.cancelar')}
                      </button>
                      <button
                        onClick={() => eliminarCita(c.id)}
                        className="btn btn-danger"
                      >
                        {t('generic.del')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => abrirEditar(c)}
                      className="btn btn-secondary"
                    >
                      {t('generic.editar')}
                    </button>
                    <button
                      onClick={() => setOpenPopoverId(c.id)}
                      className="btn btn-danger"
                    >
                      {t('generic.del')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editando ? (t('generic.editar')+" "+ t('citas.nombre').toLowerCase()) : (t('generic.nueva')+" "+ t('citas.nombre').toLowerCase())}
          width="600px"
        >
          <FormularioCita
            modeloId={modeloId}
            cita={editando}
            onClose={() => {
              setModalOpen(false)
              cargarCitas()
            }}
          />
        </Modal>
      )}
    </div>
  )
}
