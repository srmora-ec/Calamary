"use client"

import React, { useRef, useState } from "react"
import { Modelo, ModeloData } from "@/types/modelo"
import Tablero from "@/components/tablero"

export default function TableroTest() {
  // Datos de prueba para un modelo
  const dummyData: ModeloData = {
    id: "1",
    nombre: "Modelo de Ejemplo",
    descripcion: "Este es un modelo de prueba para el Tablero",
    orientacion: "h",
    linea: 1,
    publico: true,
    nodos: {
      nodes: [
        { idnodo: 1, posx: 0, posy: 0, titulo: "Objetivo", idpadre: null },
        { idnodo: 2, posx: 150, posy: 100, titulo: "Criterio A", idpadre: 1 },
        { idnodo: 3, posx: 150, posy: -100, titulo: "Criterio B", idpadre: 1 },
        { idnodo: 4, posx: 300, posy: 100, titulo: "Subcriterio A1", idpadre: 2 },
      ],
    },
  }
  const [modelo, SetModelo] = useState(new Modelo(dummyData))

  // const modelo = new Modelo(dummyData)
  const [orientacion, setOrientacion] = useState<"h" | "v">(dummyData.orientacion);
  const [linea, setLinea] = useState<number>(dummyData.linea);

  const handleModeloActualizado = (modeloActual: Modelo) => {
    SetModelo(modeloActual)
        console.log("Modelo actualizado:", modelo);
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 p-6 min-h-screen bg-gray-100">
      {/* Panel de botones */}
      <button
        className="px-4 py-2 bg-green-500 text-white rounded cursor-pointer"
        onClick={() => setOrientacion("h")}
      >
        Horizontal
      </button>
      <h1>dsd</h1>
      <button>ddd</button>
      <button
        className="px-4 py-2 bg-green-500 text-white rounded cursor-pointer"
        onClick={() => setOrientacion("v")}
      >
        Vertical
      </button>
      <select
        className="border rounded px-3 py-2"
        value={linea}
        onChange={(e) => setLinea(Number(e.target.value))}

      >
        <option value={1}>Directa</option>
        <option value={2}>Escalonada</option>
        <option value={3}>Escalonada suave</option>
        <option value={4}>Suave</option>

      </select>
      {/* Panel de Tablero */}
      <div>
        <Tablero modelo={modelo} orientacion={orientacion} linea={linea} onActualizarModelo={handleModeloActualizado} />
      </div>
    </div>
  )
}
