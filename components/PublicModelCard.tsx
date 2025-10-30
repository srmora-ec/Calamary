"use client"

import { Card, Button, Collapse, theme } from "antd"
import { CopyOutlined } from "@ant-design/icons"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { message } from "antd"
import Image from "next/image"
import Link from "next/link" // Se mantiene Link para abrir en nueva pestaña

const { Panel } = Collapse
const { useToken } = theme

interface PublicModelCardProps {
  modelo: {
    id: number
    nombre: string
    descripcion: string
    fecha: string
    // Asumiendo que el modelo tiene un campo 'publico' para la coherencia visual con la otra tarjeta
    publico?: boolean 
    citas: Array<{
      autor: string
      año: number | null
      titulo: string
      fuente: string | null
      doi: string | null
      url: string | null
      tipo: string | null
    }>
  }
}

export default function PublicModelCard({ modelo }: PublicModelCardProps) {
  const router = useRouter()
  const { token } = useToken()

  const handleCopy = async () => {
    try {
      // Nota: Aquí se asume que el ID es un número, ajusta si es necesario.
      const { data, error } = await supabase.rpc("copiar_modelo", { modelo_id: modelo.id })
      if (error) throw error
      message.success("Modelo copiado exitosamente")
      router.push(`/modelos/${data.id}`)
    } catch (err: any) {
      message.error("Error al copiar el modelo")
      console.error(err)
    }
  }

  // Estilo de la cabecera (sin color de fondo)
  const customHeaderStyle = {
    padding: token.padding,
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
  }

  // Estilo para simular el "footer" de la otra tarjeta
  const customFooterStyle = {
    borderTop: `1px solid ${token.colorBorderSecondary}`,
  }

  return (
    <Card
      // Quitamos 'bordered' para un estilo más limpio y similar al ejemplo
      // Usamos el prop 'styles' para estilizar la cabecera
      styles={{
        header: customHeaderStyle,
        body: { padding: token.padding, paddingTop: 0 }, // Reducimos padding top para compensar el título
        actions: customFooterStyle, // Aplicamos estilo de separador al footer (actions)
      }}
      // El título ahora solo contiene el nombre y la información de estado/orientación (simulada)
      title={
        <div className="flex justify-between items-start">
          <div className="flex-1">
            {/* Título: manteniendo el estilo de fuente sin el fondo azul */}
            <h3 className="text-xl font-bold mb-2">{modelo.nombre}</h3>
          </div>
          {/* Espacio para iconos, simulando la estructura del otro card */}
          <div className="flex items-center gap-2">
             {/* Simulación del icono público/privado (si el modelo lo soporta) */}
            {modelo.publico !== undefined && (
              <span title={modelo.publico ? "Público" : "Privado"}>{modelo.publico ? "🔓" : "🔒"}</span>
            )}
            {/* Si necesitas un icono de orientación, lo pondrías aquí */}
          </div>
        </div>
      }
      
      // La descripción ahora se muestra inmediatamente debajo del título en el cuerpo de la tarjeta
    >
      <p className="text-gray-600 text-sm mb-4">{modelo.descripcion || "Sin descripción"}</p>
      
      {/* Citas y Fecha */}
      <div className="mb-4">
        <p className="text-xs text-gray-400 mb-2">
          Creado: **{new Date(modelo.fecha).toLocaleDateString()}**
        </p>

        {modelo.citas && modelo.citas.length > 0 && (
          <Collapse bordered={false} size="small" className="bg-white mt-4">
            <Panel header={`Citas (${modelo.citas.length})`} key="1" className="p-0">
              {modelo.citas.map((cita, idx) => {
                // Formato de la cita
                const citationText = `${cita.autor}${cita.año ? `, ${cita.año}` : ""}. *${cita.titulo}*. ${cita.fuente ? cita.fuente + "." : ""} ${cita.doi ? `doi: ${cita.doi}.` : ""}`
                // Determinar URL clicable
                const url = cita.url || (cita.doi ? `https://doi.org/${cita.doi}` : null)

                return (
                  <div key={idx} className="mb-2 p-0">
                    <p className="text-xs text-gray-600">
                      {url ? (
                        <a
                          href={url}
                          target="_blank" // Abrir en nueva pestaña
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-700 underline" // Estilo de enlace
                        >
                          {citationText}
                        </a>
                      ) : (
                        citationText
                      )}
                    </p>
                  </div>
                )
              })}
            </Panel>
          </Collapse>
        )}
      </div>

      {/* Acciones movidas al footer para simular el "card-footer" de la otra tarjeta */}
      <div className="flex justify-between items-center w-full">
        {/* Usamos un div para alinear el botón de copiar a la izquierda si no hay más texto */}
        <div>
           <Button
            key="copiar"
            type="link"
            icon={<CopyOutlined />}
            onClick={handleCopy}
            className="text-gray-600 hover:text-blue-500" // Ajustamos el color del enlace
          >
            Copiar Modelo
          </Button>
        </div>
       

        {/* Botón de Play con imagen, similar a la otra tarjeta */}
        <button
          onClick={() => {
            // Nota: Aquí no usamos el estado 'loading' pero puedes reintroducirlo si lo necesitas.
            window.open(`/evaluacion/${modelo.id}`, "_blank")
          }}
          className="focus:outline-none cursor-pointer"
          title="Usar Modelo"
        >
          {/* Se simula la imagen /play.png de 40x40px */}
          <Image
            src="/play.png"
            alt="Botón de play"
            width={40}
            height={40}
            // Tailwind classes para asegurar que se vea como un botón de imagen
            className="transition transform hover:scale-105"
          />
        </button>
      </div>
    </Card>
  )
}