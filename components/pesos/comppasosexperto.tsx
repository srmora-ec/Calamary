"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import type { Nodo } from "@/types/modelo"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Info, Trash2, Download } from "lucide-react"
import * as XLSX from "xlsx"
import ExpertosModal from "../ExpertosModal"
import { Col, Row } from "antd"
import { supabase } from "@/lib/supabase"

interface SaatyExpertosProps {
  idmodelo: number
  nodos: Nodo[]
  onSave: (weights: Record<number, number>) => void
}

type ExpertMatrix = {
  id?: number
  nombre: string
  matrix?: Record<string, number>
  pesos: number[]
}

const SaatyExpertos: React.FC<SaatyExpertosProps> = ({ nodos = [], onSave, idmodelo }) => {
  const [expertos, setExpertos] = useState<ExpertMatrix[]>([])
  const [finalWeights, setFinalWeights] = useState<number[] | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [openModal, setOpenModal] = useState(false)
  const [loading, setLoading] = useState(false)

  // Cargar matrices de expertos al montar el componente
  useEffect(() => {
    cargarMatricesExpertos()
  }, [idmodelo, nodos])

  const cargarMatricesExpertos = async () => {
    if (nodos.length === 0) return

    const idpadre = nodos[0].idpadre
    if (idpadre === null) return

    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('obtener_matrices_expertos', {
        p_idmodelo: idmodelo,
        p_nodopadre: idpadre
      })

      if (error) {
        console.error('Error al cargar matrices:', error)
        setErrors(['Error al cargar las matrices de expertos'])
        return
      }

      if (data && data.length > 0) {
        const matricesCargadas: ExpertMatrix[] = data.map((item: any) => ({
          id: item.id,
          nombre: item.nombreexperto,
          matrix: item.matrix as Record<string, number>,
          pesos: Object.values(item.pesos) as number[]
        }))
        setExpertos(matricesCargadas)
      }
    } catch (err) {
      console.error('Error inesperado:', err)
      setErrors(['Error inesperado al cargar las matrices'])
    } finally {
      setLoading(false)
    }
  }

  // Cargar Excel de un experto
  const cargarExcelExperto = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer)
      const workbook = XLSX.read(data, { type: "array" })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const matriz = XLSX.utils.sheet_to_json<(string | number)[]>(
        worksheet,
        { header: 1 }
      ) as (string | number)[][]

      if (matriz.length - 1 !== nodos.length) {
        setErrors(["⚠️ El archivo no coincide con la cantidad de criterios."])
        return
      }

      const encabezados = matriz[0].slice(1)
      for (let i = 0; i < nodos.length; i++) {
        if (encabezados[i] !== nodos[i].titulo) {
          setErrors([`El criterio "${encabezados[i]}" no coincide con "${nodos[i].titulo}"`])
          return
        }
      }

      const m: number[][] = []
      for (let i = 1; i < matriz.length; i++) {
        const fila = matriz[i].slice(1).map((v) => Number(v))
        m.push(fila as number[])
      }

      const pesos = calcularPesos(m)

      setExpertos((prev) => [
        ...prev,
        {
          nombre: file.name,
          pesos,
        },
      ])
    }
    reader.readAsArrayBuffer(file)
  }

  // Calcular pesos de una matriz
  const calcularPesos = (matrix: number[][]): number[] => {
    const n = matrix.length
    const colSums = Array(n).fill(0)

    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        colSums[j] += matrix[i][j]
      }
    }

    const pesos = Array(n).fill(0)
    for (let i = 0; i < n; i++) {
      let suma = 0
      for (let j = 0; j < n; j++) {
        suma += matrix[i][j] / colSums[j]
      }
      pesos[i] = suma / n
    }
    return pesos
  }

  const eliminarExperto = (index: number) => {
    setExpertos((prev) => prev.filter((_, i) => i !== index))
    setFinalWeights(null)
  }

  const calcularFinal = () => {
    if (expertos.length === 0) return

    const n = nodos.length
    const gmean = Array(n).fill(1)

    for (let i = 0; i < n; i++) {
      for (const exp of expertos) {
        gmean[i] *= exp.pesos[i]
      }
      gmean[i] = Math.pow(gmean[i], 1 / expertos.length)
    }

    const total = gmean.reduce((a, b) => a + b, 0)
    const normalizado = gmean.map((v) => v / total)

    setFinalWeights(normalizado)
  }

  const handleSave = () => {
    if (!finalWeights) return
    const weightsObj: Record<number, number> = {}
    nodos.forEach((nodo, i) => {
      weightsObj[nodo.idnodo] = finalWeights[i]
    })
    onSave(weightsObj)
  }

  const descargarMatricesExpertos = () => {
    if (expertos.length === 0) {
      setErrors(["No hay matrices de expertos para descargar."])
      return
    }

    const n = nodos.length
    const workbook = XLSX.utils.book_new()

    // Lleva el control de nombres para evitar duplicados
    const usedNames: Record<string, number> = {}

    expertos.forEach((experto) => {
      if (!experto.matrix) return

      const data: (string | number)[][] = []

      // Encabezados
      const headers = [""]
      nodos.forEach(n => headers.push(n.titulo))
      headers.push("Peso")
      data.push(headers)

      // Filas
      for (let i = 0; i < n; i++) {
        const fila: (string | number)[] = [nodos[i].titulo]
        const currentId = nodos[i].idnodo

        for (let j = 0; j < n; j++) {
          const compareId = nodos[j].idnodo
          let valor: number

          if (i === j) {
            valor = 1
          } else if (i < j) {
            const key = `${currentId}-${compareId}`
            valor = experto.matrix[key] ||
              (experto.matrix[`${compareId}-${currentId}`]
                ? 1 / experto.matrix[`${compareId}-${currentId}`]
                : 0)
          } else {
            const key = `${compareId}-${currentId}`
            valor = experto.matrix[key]
              ? 1 / experto.matrix[key]
              : (experto.matrix[`${currentId}-${compareId}`] || 0)
          }

          fila.push(Number(valor.toFixed(4)))
        }

        fila.push(experto.pesos[i]?.toFixed(4) || 0)
        data.push(fila)
      }

      const worksheet = XLSX.utils.aoa_to_sheet(data)

      const wscols = [{ wch: 25 }]
      for (let i = 0; i < n + 1; i++) {
        wscols.push({ wch: 15 })
      }
      worksheet["!cols"] = wscols

      // Crear nombre base válido
      let baseName = experto.nombre.substring(0, 31).replace(/[\*\?\/\\\[\]]/g, "_")

      // Si ya existe, añadir número incremental
      if (usedNames[baseName]) {
        usedNames[baseName]++
        baseName = `${baseName}${usedNames[baseName]}`
      } else {
        usedNames[baseName] = 1
      }

      // Añadir hoja con el nombre final
      XLSX.utils.book_append_sheet(workbook, worksheet, baseName)
    })

    XLSX.writeFile(workbook, `MatricesExpertos_Modelo${idmodelo}.xlsx`)
  }


  return (
    <div className="w-full space-y-6">
      {loading && (
        <div className="text-center py-4">
          <span>Cargando matrices de expertos...</span>
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        accept=".xlsx,.xls"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            cargarExcelExperto(file)
            e.target.value = ""
          }
        }}
      />

      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="text-base font-semibold text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
          <Info className="w-4 h-4" />
          Rol de los Expertos en el Método de Saaty
        </h3>
        <div className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
          <p>
            En muchos problemas de decisión complejos, no basta con que un solo individuo asigne
            los pesos de los criterios. Por ello, se recurre a <strong>expertos en la materia</strong>,
            quienes aportan su conocimiento especializado para determinar la importancia relativa
            de cada criterio mediante comparaciones por pares.
          </p>
        </div>
      </div>
      <br />
      {/* >>> BOTONES ACTUALIZADOS EN UN LAYOUT DE 4 COLUMNAS <<< */}
      <Row gutter={[8, 8]}>
        <Col xs={24} sm={6}>
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            style={{ width: "100%" }}
          >
            📂 Cargar Excel
          </Button>
        </Col>
        <Col xs={24} sm={6}>
          <Button
            onClick={() => setOpenModal(true)}
            style={{ width: "100%" }}
          >
            👥 Invitar expertos
          </Button>
        </Col>
        <Col xs={24} sm={6}>
          <Button
            onClick={calcularFinal}
            disabled={expertos.length === 0}
            style={{ width: "100%" }}
          >
            ⚖️ Calcular Pesos
          </Button>
        </Col>
        <Col xs={24} sm={6}>
          <Button
            onClick={descargarMatricesExpertos}
            disabled={expertos.length === 0}
            style={{ width: "100%" }}
          >
            <Download className="w-4 h-4 mr-2" />
            Descargar Matrices
          </Button>
        </Col>
      </Row>
      {/* >>> FIN DE BOTONES ACTUALIZADOS <<< */}
      <br />
      {expertos.length > 0 && (
        <div className="border rounded-lg p-4 overflow-x-auto">
          <table className="min-w-full border-collapse border text-sm">
            <thead>
              <tr>
                <th className="border px-2 py-1">Criterio</th>
                {expertos.map((exp, i) => (
                  <th key={i} className="border px-2 py-1">
                    <div className="flex items-center justify-between gap-2">
                      <span>{exp.nombre}</span>
                      <button
                        onClick={() => eliminarExperto(i)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                        title="Eliminar experto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </th>
                ))}
                {finalWeights && (
                  <th className="border px-2 py-1 bg-blue-100">Final</th>
                )}
              </tr>
            </thead>
            <tbody>
              {nodos.map((nodo, i) => (
                <tr key={nodo.idnodo}>
                  <td className="border px-2 py-1 font-medium">{nodo.titulo}</td>
                  {expertos.map((exp, j) => (
                    <td key={j} className="border px-2 py-1 text-center">
                      {exp.pesos[i]?.toFixed(4) || 'N/A'}
                    </td>
                  ))}
                  {finalWeights && (
                    <td className="border px-2 py-1 text-center font-semibold bg-blue-50">
                      {finalWeights[i].toFixed(4)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <ExpertosModal
        idModelo={idmodelo}
        isOpen={openModal}
        onClose={() => setOpenModal(false)}
        onSelect={() => {
          setOpenModal(false)
          cargarMatricesExpertos() // Recargar matrices después de invitar
        }}
        nodos={nodos}
      />

      {finalWeights && (
        <div className="flex justify-end">
          <Button onClick={handleSave}>💾 Guardar Pesos</Button>
        </div>
      )}
    </div>
  )
}

export default SaatyExpertos