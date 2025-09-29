"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import type { Nodo } from "@/types/modelo"
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle2, RotateCcw, Calculator } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { calculateAHP } from "./metodos/pesosComPares"
import { actualizarMatriz, cargarMatriz, guardarMatriz } from "./funciones/GuardarMatrizParams"
import Spinner from "./Spinner"
import * as XLSX from "xlsx"
import { saveAs } from "file-saver"


interface ComparacionPorParesProps {
  idmodelo: number//El modelo para guardar
  nodos: Nodo[]//Los nodos
  onSave: (weights: Record<number, number>) => void//Metodo para enviar los resultados
}

// Escala de Saaty: valores numéricos con su descripción
const SAATY_SCALE = [
  { value: 9, label: "9 - Extremadamente más importante" },
  { value: 7, label: "7 - Muy fuertemente más importante" },
  { value: 5, label: "5 - Fuertemente más importante" },
  { value: 3, label: "3 - Moderadamente más importante" },
  { value: 1, label: "1 - Igual importancia" },
  { value: 1 / 3, label: "1/3 - Moderadamente menos importante" },
  { value: 1 / 5, label: "1/5 - Fuertemente menos importante" },
  { value: 1 / 7, label: "1/7 - Muy fuertemente menos importante" },
  { value: 1 / 9, label: "1/9 - Extremadamente menos importante" },
]

// Función que convierte las fracciones a decimales 
const parseFraction = (input: string): number => {
  const trimmed = input.trim()

  // Si el valor tiene "/", tratamos de interpretarlo como fracción
  if (trimmed.includes("/")) {
    const parts = trimmed.split("/")//Separamos el texto por / entonces parts contiene numerador y divisor
    if (parts.length === 2) {//Esto debe valer 2 (num/div)
      const numerator = Number.parseFloat(parts[0])//Convertimos elnúmerador en flotante
      const denominator = Number.parseFloat(parts[1])//Convertimos el denominador en flotante
      if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {//verificamos que todo valga(no dividir poe cero)
        return numerator / denominator//Realizamos la operación
      }
    }
  }

  // Si no es fracción, lo devolvemos como número
  return Number.parseFloat(trimmed)
}

// Función para mostrar los valores en formato de fraccion
const formatValue = (value: number): string => {
  // Si el valor es cercano a una fracción conocida, mostramos esa fracción
  if (Math.abs(value - 1 / 3) < 0.001) return "1/3"
  if (Math.abs(value - 1 / 5) < 0.001) return "1/5"
  if (Math.abs(value - 1 / 7) < 0.001) return "1/7"
  if (Math.abs(value - 1 / 9) < 0.001) return "1/9"
  if (Math.abs(value - 2 / 3) < 0.001) return "2/3"
  if (Math.abs(value - 2 / 5) < 0.001) return "2/5"
  if (Math.abs(value - 2 / 7) < 0.001) return "2/7"
  if (Math.abs(value - 2 / 9) < 0.001) return "2/9"

  // Si es un número entero o cercano, lo mostramos entero
  if (Math.abs(value - Math.round(value)) < 0.001) {
    return Math.round(value).toString()
  }

  // Si no, lo mostramos con 2 decimales
  return value.toFixed(2)
}

// Validación de input: solo permite números, punto y "/"
const validateInput = (value: string): string => {
  return value.replace(/[^0-9./]/g, "")
}

// Componente principal
const ComparacionPorPares: React.FC<ComparacionPorParesProps> = ({ nodos, idmodelo, onSave }) => {
  // Estados del componente
  const [loadMessage, setLoadMessage] = useState<string | null>(null) // mensaje de advertencia al cargar para cuando cargamos pesos ya existentes
  const [matrix, setMatrix] = useState<Record<string, number>>({}) // matriz de comparaciones
  const [displayValues, setDisplayValues] = useState<Record<string, string>>({}) // valores visibles en inputs (Se llenaran de la carga de supabase)
  const [weights, setWeights] = useState<Record<number, number>>({}) // pesos calculados
  const [consistencyRatio, setConsistencyRatio] = useState<number>(0) // ratio de consistencia
  const [errors, setErrors] = useState<string[]>([]) // lista de errores
  const [isCalculated, setIsCalculated] = useState(false) // flag si se calcularon los pesos
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Al iniciar, construir una matriz identidad (1s en la diagonal)
  useEffect(() => {
    const initialMatrix: Record<string, number> = {}// Creamos un objeto vacío donde vamos a guardar los valores numéricos de la matriz
    // La clave será "idNodo1-idNodo2" y el valor será el peso numérico de esa comparación
    // Creamos otro objeto vacío donde guardaremos los valores como texto para mostrarlos en los inputs
    // La clave es la misma, pero el valor será una cadena (ejemplo: "1", "1/3", etc.)
    const initialDisplayValues: Record<string, string> = {}
    for (let i = 0; i < nodos.length; i++) {//Hacemos doble bucle para crear lamatriz (recorremos los nodos)
      for (let j = 0; j < nodos.length; j++) {//dos veces
        const key = `${nodos[i].idnodo}-${nodos[j].idnodo}`//Creamos la clave con los nodos i j
        if (i <= j) {//Toda la parte de la matriz superior es uno
          initialMatrix[key] = 1
          initialDisplayValues[key] = "1"
        }
      }
    }

    setMatrix(initialMatrix)
    setDisplayValues(initialDisplayValues)
  }, [nodos])

  // cargar una matriz guardada desde Supabase
  useEffect(() => {
    const fetchMatriz = async () => {
      if (nodos.length === 0) return//Verificamos que hay nodos
      const idpadre = nodos[0]?.idpadre//Sacamos el un idpadre para hacer la consulta
      if (!idpadre) return//Si no hay idpadre volvemos

      try {
        const savedMatrix = await cargarMatriz(idmodelo, idpadre)//carganos la matriz

        if (savedMatrix) {//Si hay matriz
          // Verificamos que la matriz guardada y la actual sean igual
          const nCurrent = nodos.length//sacamos la cantidad de los nodos de la actual
          const nSaved = Math.round(Math.sqrt(Object.keys(savedMatrix.matrix || {}).length * 2 + 0.25) - 0.5)
          //Arriba. Caclulamos la cantidad actual de la rescatada de supabase.
          //Sacamos la matriz savedMatrix.matrix de eso le sacamos eltamaño .length
          //a ese valor lo multiplicamos por dos y le sumanos 0.25
          //a eso le sacamos la raiz cuadrada
          //y a eso le restamos0.5 y asi sacamos la cantidad de nodos 
          if (nSaved !== nCurrent) {//si no es compatible avisamos que no se puede
            setLoadMessage(
              `⚠️ La matriz guardada el ${new Date(savedMatrix.created_at).toLocaleDateString()} ya no es compatible con la estructura actual del modelo.`
            )
            return
          }

          // Cargar la matriz y pesos previos
          setMatrix(savedMatrix.matrix)
          setDisplayValues(
            Object.fromEntries(
              Object.entries(savedMatrix.matrix).map(([k, v]) => [k, formatValue(v as number)])
            )
          )//Mapeamos el savedMatrix para registrar los valores
          setWeights(savedMatrix.pesos || {}) //registramos los pesos con SavedPesos
          setConsistencyRatio(0)//Guardamos la consistencia en 0
          setIsCalculated(false) //Ponemos queno ha calculado
          setLoadMessage(null)//quitamos el aviso (SI hay)
        }
      } catch (err) {
        console.error(err)
      }
    }

    fetchMatriz()
  }, [idmodelo, nodos])

  // Obtiene el valor de la matriz entre dos nodos
  const getMatrixValue = (nodeId1: number, nodeId2: number): number => {//recibe las coordenadas
    if (nodeId1 === nodeId2) return 1//si es igual siempre es 1
    const key1 = `${nodeId1}-${nodeId2}`//creamos la clave
    const key2 = `${nodeId2}-${nodeId1}`//cramos la clave del inverso

    if (matrix[key1] !== undefined) return matrix[key1]//retornamos su valor normal
    else if (matrix[key2] !== undefined) return 1 / matrix[key2]//retoprnamos su inverso

    return 1//si no retornamos 1
  }

  // Actualiza el valor de la matriz cuando el usuario edita un input
  const updateMatrixValue = (nodeId1: number, nodeId2: number, value: string) => {
    const cleanValue = validateInput(value)
    const numValue = parseFraction(cleanValue)

    // Validaciones: debe ser positivo y estar en la escala de Saaty
    if (isNaN(numValue) || numValue <= 0) {
      setErrors((prev) => [...prev, "Valores inválidos (usa números positivos o fracciones tipo 1/5)"])
      return
    }
    if (numValue < 1 / 9 || numValue > 9) {
      setErrors((prev) => [...prev, "Los valores deben estar entre 1/9 y 9"])
      return
    }

    const key = `${nodeId1}-${nodeId2}`//creamos clave
    setMatrix((prev) => ({ ...prev, [key]: numValue }))
    setDisplayValues((prev) => ({ ...prev, [key]: cleanValue }))
    setErrors([])
    setIsCalculated(false)
  }

  // Verifica que los valores sean consistentes (valor * inverso ≈ 1)
  const verificarCoherencia = (): boolean => {
    const erroresCoherencia: string[] = []
    let c = 0

    for (let i = 0; i < nodos.length; i++) {//Solo recorremos la matriz normal y comparamos por la inversa
      for (let j = i + 1; j < nodos.length; j++) {
        const valor = getMatrixValue(nodos[i].idnodo, nodos[j].idnodo)
        const inverso = getMatrixValue(nodos[j].idnodo, nodos[i].idnodo)
        if (Math.abs(valor * inverso - 1) > 0.001) {
          erroresCoherencia.push(`Incoherencia entre ${nodos[i].titulo} y ${nodos[j].titulo}`)
        }
      }
    }
    setErrors(erroresCoherencia)
    console.log(errors)
console.log(erroresCoherencia.length)

    return erroresCoherencia.length === 0
  }

  // Calcula los pesos usando AHP (via API FastAPI)
  const calcularPesos = async () => {
    setLoading(true);
    if (!verificarCoherencia()) return
    const n = nodos.length
    const matrizCompleta: number[][] = []

    // Construir matriz cuadrada completa
    for (let i = 0; i < n; i++) {
      matrizCompleta[i] = []
      for (let j = 0; j < n; j++) {
        matrizCompleta[i][j] = getMatrixValue(nodos[i].idnodo, nodos[j].idnodo)
      }
    }

    try {
      const result = await calculateAHP(matrizCompleta) // API calcula pesos y CR
      const newWeights: Record<number, number> = {}
      nodos.forEach((nodo, index) => {
        newWeights[nodo.idnodo] = result.weights[index]
      })

      setWeights(newWeights)
      setConsistencyRatio(result.CR)
      setIsCalculated(true)
      setErrors([])

    } catch (err) {
      console.error("Error al calcular AHP:", err)
      setErrors(["No se pudo calcular los pesos desde el servidor."])
    } finally {
      setLoading(false);
    }
  }

  // Resetea la matriz a identidad
  const resetearMatriz = () => {
    const resetMatrix: Record<string, number> = {}
    const resetDisplayValues: Record<string, string> = {}

    for (let i = 0; i < nodos.length; i++) {
      for (let j = 0; j < nodos.length; j++) {
        const key = `${nodos[i].idnodo}-${nodos[j].idnodo}`
        resetMatrix[key] = 1
        resetDisplayValues[key] = "1"
      }
    }

    setMatrix(resetMatrix)
    setDisplayValues(resetDisplayValues)
    setWeights({})
    setConsistencyRatio(0)
    setErrors([])
    setIsCalculated(false)
  }

  // Guardar matriz y pesos en Supabase
  const handleSave = async () => {
    if (!isCalculated || errors.length > 0) return
    const idpadre = nodos[0]?.idpadre
    if (!idpadre) {
      setErrors(["No se encontró el idpadre de los nodos."])
      return
    }

    try {
      const existingMatrix = await cargarMatriz(idmodelo, idpadre)
      let data
      if (existingMatrix) {
        // Actualizar matriz existente
        data = await actualizarMatriz({ idmodelo, nodopadre: idpadre, matrix, pesos: weights })
      } else {
        // Crear nueva
        data = await guardarMatriz({ idmodelo, nodopadre: idpadre, matrix, pesos: weights })
      }

      onSave(weights)
      alert(`Matriz ${existingMatrix ? "actualizada" : "guardada"} correctamente.`)
    } catch (err) {
      console.error(err)
      setErrors(["Error al guardar la matriz."])
    }
  }

  // Condiciones de consistencia
  const isConsistent = consistencyRatio < 0.1
  const consistencyPercentage = (consistencyRatio * 100).toFixed(1)

  // Exportar la matriz a Excel
  const exportarExcel = () => {
    const n = nodos.length

    // Construimos la matriz completa en formato bidimensional
    const matrizExcel: (string | number)[][] = []

    // Encabezado
    matrizExcel.push(["Criterio", ...nodos.map((n) => n.titulo)])

    // Filas
    for (let i = 0; i < n; i++) {
      const fila: (string | number)[] = [nodos[i].titulo]
      for (let j = 0; j < n; j++) {
        fila.push(getMatrixValue(nodos[i].idnodo, nodos[j].idnodo))
      }
      matrizExcel.push(fila)
    }

    // Crear hoja y libro
    const worksheet = XLSX.utils.aoa_to_sheet(matrizExcel)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Matriz")

    // Generar archivo y descargar
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
    const data = new Blob([excelBuffer], { type: "application/octet-stream" })
    saveAs(data, `matriz_comparacion_modelo_${idmodelo}.xlsx`)
  }

  // Función para cargar matriz desde Excel
  const cargarDesdeExcel = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer)
      const workbook = XLSX.read(data, { type: "array" })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData: (string | number)[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

      // Verificación de encabezado
      const encabezado = jsonData[0]?.slice(1) // Ignoramos la primera columna "Criterio"
      if (!encabezado || encabezado.length !== nodos.length) {
        setErrors(["El archivo no coincide con la cantidad de criterios actuales."])
        return
      }

      // Opcional: verificar que los nombres coincidan exactamente
      for (let i = 0; i < nodos.length; i++) {
        if (encabezado[i] !== nodos[i].titulo) {
          setErrors([`El criterio "${encabezado[i]}" no coincide con "${nodos[i].titulo}"`])
          return
        }
      }

      // Construir la matriz
      const nuevaMatrix: Record<string, number> = {}
      const nuevaDisplay: Record<string, string> = {}

      for (let i = 0; i < nodos.length; i++) {
        for (let j = 0; j < nodos.length; j++) {
          const valor = jsonData[i + 1]?.[j + 1] // +1 porque la primera fila es encabezado
          if (valor !== undefined) {
            const key = `${nodos[i].idnodo}-${nodos[j].idnodo}`
            const numValue = parseFraction(String(valor))
            nuevaMatrix[key] = numValue
            nuevaDisplay[key] = formatValue(numValue)
          }
        }
      }

      setMatrix(nuevaMatrix)
      if (!verificarCoherencia()) {
              alert("enserio? y mi error?")
        resetearMatriz() // Usar tu método existente para resetear
        setErrors(["El archivo de excel cargado no es coherente con la estructura de matriz de Saaty"])
      } else {
        // Si es coherente, todo OK
        setDisplayValues(nuevaDisplay)
        setIsCalculated(false)
        setErrors([])
        console.log("Matriz cargada exitosamente desde Excel")
      }

    }

    reader.readAsArrayBuffer(file)
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <Spinner visible={loading} />
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Escala de Saaty</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
          {SAATY_SCALE.map((item) => (
            <div key={item.value} className="flex items-center gap-2">
              <span className="font-mono w-8 text-right">{formatValue(item.value)}</span>
              <span className="text-muted-foreground">{item.label.split(" - ")[1]}</span>
            </div>
          ))}
        </div>
        {loadMessage && (
          <div className="p-3 mb-4 border-l-4 border-yellow-400 bg-yellow-50 text-yellow-800 rounded">
            {loadMessage}
          </div>
        )}

      </CardContent>
      <br />
      {/* Matriz de comparación */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border p-2 bg-muted font-medium text-left min-w-[150px]">Criterio</th>
              {nodos.map((nodo) => (
                <th key={nodo.idnodo} className="border p-2 bg-muted font-medium text-center min-w-[120px]">
                  <div className="text-xs">{nodo.titulo}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {nodos.map((nodoFila, i) => (
              <tr key={nodoFila.idnodo}>
                <td className="border p-2 bg-muted font-medium">{nodoFila.titulo}</td>
                {nodos.map((nodoColumna, j) => (
                  <td key={nodoColumna.idnodo} className="border p-0 text-center">
                    {i === j ? (
                      <div className="p-2">
                        <span className="font-mono text-muted-foreground">1.00</span>
                      </div>
                    ) : i < j ? (
                      <Input
                        type="text"
                        value={displayValues[`${nodoFila.idnodo}-${nodoColumna.idnodo}`] || "1"}
                        onChange={(e) => {
                          const cleanValue = validateInput(e.target.value)
                          e.target.value = cleanValue
                          updateMatrixValue(nodoFila.idnodo, nodoColumna.idnodo, cleanValue)
                        }}
                        className="w-full h-full border-0 rounded-none text-center font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="1 o 1/5"
                      />
                    ) : (
                      <div className="p-2">
                        <span className="font-mono text-muted-foreground">
                          {formatValue(1 / getMatrixValue(nodoColumna.idnodo, nodoFila.idnodo))}
                        </span>
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
        <strong>Tip:</strong> Puedes ingresar valores como números decimales (0.2) o como fracciones (1/5). Ambos
        formatos son equivalentes y válidos.
      </div>

      {/* Errores */}
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

      {/* Botones de acción */}
      <div className="flex flex-wrap justify-between items-center gap-2">
        <Button
          variant="outline"
          onClick={resetearMatriz}
          className="flex items-center gap-2 bg-transparent"
        >
          <RotateCcw className="h-4 w-4" />
          Resetear Matriz
        </Button>

        {/* Botón para cargar Excel */}
        <Button
          variant="outline"
          className="flex items-center gap-2 bg-transparent"
          onClick={() => fileInputRef.current?.click()}
        >
          📂 Cargar desde Excel
        </Button>

        {/* Input oculto */}
        <input
          type="file"
          accept=".xlsx"
          className="hidden"
          ref={fileInputRef}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) cargarDesdeExcel(file)
            e.target.value = ""
          }}
        />

        <Button
          onClick={exportarExcel}
          variant="outline"
          className="flex items-center gap-2 bg-transparent"
        >
          📥 Exportar a Excel
        </Button>

        <Button
          onClick={calcularPesos}
          disabled={errors.length > 0}
          className="flex items-center gap-2"
        >
          <Calculator className="h-4 w-4" />
          Calcular Pesos
        </Button>
      </div>


      {/* Resultados */}
      {isCalculated && (
        <>
          <CardHeader>
            <CardTitle className="text-lg">Resultados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Consistencia */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-2">
                {isConsistent ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                )}
                <span className="font-medium">Ratio de Consistencia:</span>
              </div>
              <div className="text-right">
                <span className={`font-mono text-lg ${isConsistent ? "text-green-600" : "text-red-600"}`}>
                  {consistencyPercentage}%
                </span>
                <div className="text-xs text-muted-foreground">
                  {isConsistent ? "Aceptable (< 10%)" : "Revisar matriz (≥ 10%)"}
                </div>
              </div>
            </div>
            <br />

            {/* Pesos calculados */}
            <div className="space-y-3">
              <h4 className="font-medium">Pesos Calculados:</h4>
              {nodos.map((nodo) => {
                const peso = weights[nodo.idnodo] || 0
                const porcentaje = (peso * 100).toFixed(2)

                return (
                  <div key={nodo.idnodo} className="flex items-center justify-between p-2 rounded border">
                    <span className="font-medium">{nodo.titulo}</span>
                    <div className="text-right">
                      <span className="font-mono text-xs">{peso.toFixed(6)}</span>
                      <span className="text-xs text-muted-foreground ml-2">({porcentaje}%)</span>
                    </div>
                  </div>
                )
              })}
            </div>

            <br />

            {/* Botón guardar */}
            <div className="flex justify-end pt-4">
              <Button onClick={handleSave} disabled={!isConsistent} className="min-w-[120px]">
                Guardar Pesos
              </Button>
            </div>
          </CardContent>
        </>
      )}
    </div>
  )
}

export default ComparacionPorPares
