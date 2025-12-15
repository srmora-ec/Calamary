"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Slider } from "antd"
import type { Nodo } from "@/types/modelo"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Calculator, HelpCircle } from "lucide-react"
import Modal from "../Modal"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Spinner from "./Spinner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// Tipos
interface FuzzyNumber {
  l: number
  m: number
  u: number
}

interface ComparacionParesDifusosProps {
  nodos: Nodo[]
  onSave: (weights: Record<number, { l: string; m: string; u: string }>) => void
  onCancel?: () => void
}

interface Comparison {
  nodeId1: number
  nodeId2: number
  node1Title: string
  node2Title: string
}

// ESCALA DIFUSA 
const FUZZY_SCALE: Record<number, { label: string; value: FuzzyNumber }> = {
  0: { label: "Igual (1,1,1)", value: { l: 1, m: 1, u: 1 } },
  1: { label: "Intermedio (1,2,3)", value: { l: 1, m: 2, u: 3 } },
  2: { label: "Moderada (2,3,4)", value: { l: 2, m: 3, u: 4 } },
  3: { label: "Intermedio (3,4,5)", value: { l: 3, m: 4, u: 5 } },
  4: { label: "Fuerte (4,5,6)", value: { l: 4, m: 5, u: 6 } },
  5: { label: "Intermedio (5,6,7)", value: { l: 5, m: 6, u: 7 } },
  6: { label: "Muy Fuerte (6,7,8)", value: { l: 6, m: 7, u: 8 } },
  7: { label: "Intermedio (7,8,9)", value: { l: 7, m: 8, u: 9 } },
  8: { label: "Absoluta (9,9,9)", value: { l: 9, m: 9, u: 9 } },
}

const ComparacionParesDifusos: React.FC<ComparacionParesDifusosProps> = ({ nodos, onSave, onCancel }) => {
  const [comparisons, setComparisons] = useState<Comparison[]>([])
  const [sliderValues, setSliderValues] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [showResultsModal, setShowResultsModal] = useState(false)
  
  // Estados de resultados
  const [geometricMeans, setGeometricMeans] = useState<Record<number, FuzzyNumber>>({})
  const [fuzzyWeights, setFuzzyWeights] = useState<Record<number, FuzzyNumber>>({})
  
  // Totales
  const [totalGeometricMean, setTotalGeometricMean] = useState<FuzzyNumber>({ l: 0, m: 0, u: 0 })
  const [orderedInverse, setOrderedInverse] = useState<FuzzyNumber>({ l: 0, m: 0, u: 0 })

  // 1. Inicializar comparaciones
  useEffect(() => {
    if (!nodos || nodos.length < 2) return
    const comps: Comparison[] = []
    const initialValues: Record<string, number> = {}
    
    for (let i = 0; i < nodos.length; i++) {
      for (let j = i + 1; j < nodos.length; j++) {
        comps.push({
          nodeId1: nodos[i].idnodo,
          nodeId2: nodos[j].idnodo,
          node1Title: nodos[i].titulo,
          node2Title: nodos[j].titulo,
        })
        initialValues[`${nodos[i].idnodo}-${nodos[j].idnodo}`] = 0
      }
    }
    setComparisons(comps)
    setSliderValues(initialValues)
  }, [nodos])

  // --- LÓGICA MATEMÁTICA ---

  // Inverso para AHP (Orden Creciente: 1/u, 1/m, 1/l)
  const orderedInverseTFN = (a: FuzzyNumber): FuzzyNumber => ({ l: 1 / a.u, m: 1 / a.m, u: 1 / a.l })

  // Inverso matemático estricto (Decreciente: 1/l, 1/m, 1/u) - Solo para mostrar en tabla 4
  const rawInverseTFN = (a: FuzzyNumber): FuzzyNumber => ({ l: 1 / a.l, m: 1 / a.m, u: 1 / a.u })

  const multiplyTFN = (a: FuzzyNumber, b: FuzzyNumber): FuzzyNumber => ({ l: a.l * b.l, m: a.m * b.m, u: a.u * b.u })

  const handleCalculate = () => {
    setLoading(true)
    setTimeout(() => {
      calculateFuzzyWeights()
      setLoading(false)
      setShowResultsModal(true)
    }, 500)
  }

  const calculateFuzzyWeights = () => {
    const n = nodos.length
    const matrix: Record<string, FuzzyNumber> = {}

    // Paso A: Construir Matriz Llena (NxN)
    nodos.forEach(rowNode => {
      nodos.forEach(colNode => {
        if (rowNode.idnodo === colNode.idnodo) {
          matrix[`${rowNode.idnodo}-${colNode.idnodo}`] = { l: 1, m: 1, u: 1 }
        } else {
          // Lógica para recuperar valor del slider
          // Clave directa: Row-Col
          let val = sliderValues[`${rowNode.idnodo}-${colNode.idnodo}`]
          let isInverse = false

          // Si no existe directa, buscamos inversa: Col-Row
          if (val === undefined) {
             val = sliderValues[`${colNode.idnodo}-${rowNode.idnodo}`]
             isInverse = true
          }

          const absVal = Math.abs(val)
          const scaleVal = FUZZY_SCALE[absVal]?.value || {l:1, m:1, u:1}
          let finalTFN: FuzzyNumber = { ...scaleVal }

          // Asignación de valor según quién gana (Izquierda vs Derecha)
          if (!isInverse) {
             // Estamos en celda [Row, Col]. Slider es [Row vs Col].
             // Val > 0: Gana Derecha (Col). Row es recíproco.
             // Val < 0: Gana Izquierda (Row). Row es directo.
             if (val > 0) finalTFN = orderedInverseTFN(scaleVal) 
          } else {
             // Estamos en celda [Row, Col]. Slider es [Col vs Row].
             // Val > 0: Gana Derecha (Row). Row es directo.
             // Val < 0: Gana Izquierda (Col). Row es recíproco.
             if (val < 0) finalTFN = orderedInverseTFN(scaleVal)
          }
          
          matrix[`${rowNode.idnodo}-${colNode.idnodo}`] = finalTFN
        }
      })
    })

  // Paso B: Calcular Media Geométrica por FILA (Izquierda a Derecha) [cite: 192]
    // Eq 8 del PDF: Multiplicar todos los d_ij de la fila i y elevar a 1/n
    const r: Record<number, FuzzyNumber> = {}
    let sumR: FuzzyNumber = { l: 0, m: 0, u: 0 }

    nodos.forEach(rowNode => { // Iteramos FILAS (Criterios)
      let productL = 1
      let productM = 1
      let productU = 1

      nodos.forEach(colNode => { // Iteramos COLUMNAS (de Izq a Der)
        const cell = matrix[`${colNode.idnodo}-${rowNode.idnodo}`]
        productL *= cell.l
        productM *= cell.m
        productU *= cell.u
      })
      
      // Raíz n-ésima
      const geometricMean: FuzzyNumber = {
          l: Math.pow(productL, 1/n),
          m: Math.pow(productM, 1/n),
          u: Math.pow(productU, 1/n)
      }
      
      r[rowNode.idnodo] = geometricMean
      
      // Acumular Total para el paso siguiente
      sumR = { 
          l: sumR.l + geometricMean.l, 
          m: sumR.m + geometricMean.m, 
          u: sumR.u + geometricMean.u 
      }
    })

    setGeometricMeans(r)
    setTotalGeometricMean(sumR)

    // Paso C: Calcular Vector Inverso (Step 5b)
    const orderedInv = orderedInverseTFN(sumR)
    setOrderedInverse(orderedInv)

    // w_i = r_i * orderedInv
    const w: Record<number, FuzzyNumber> = {}
    nodos.forEach(nodo => {
      w[nodo.idnodo] = multiplyTFN(r[nodo.idnodo], orderedInv)
    })

    setFuzzyWeights(w)
  }

  const handleConfirmSave = () => {
    const output: Record<number, { l: string; m: string; u: string }> = {}
    nodos.forEach(nodo => {
        const fw = fuzzyWeights[nodo.idnodo]
        output[nodo.idnodo] = {
            l: fw.l.toFixed(4),
            m: fw.m.toFixed(4),
            u: fw.u.toFixed(4)
        }
    })
    onSave(output)
    setShowResultsModal(false)
  }

  // Helpers UI
  const getSliderLabel = (val: number) => {
      if (val === 0) return "1"
      const abs = Math.abs(val)
      const fuzzyStr = `(${FUZZY_SCALE[abs].value.l},${FUZZY_SCALE[abs].value.m},${FUZZY_SCALE[abs].value.u})`
      return fuzzyStr
  }

  const marks = {
    '-8': { label: 'Abs(9)', style: { fontSize: '10px' } },
    '-6': { label: 'M.F.(7)', style: { fontSize: '10px' } },
    '-4': { label: 'Fte(5)', style: { fontSize: '10px' } },
    '-2': { label: 'Mod(3)', style: { fontSize: '10px' } },
    '0': { label: 'Igual', style: { fontWeight: 'bold', fontSize: '11px' } },
    '2': { label: 'Mod(3)', style: { fontSize: '10px' } },
    '4': { label: 'Fte(5)', style: { fontSize: '10px' } },
    '6': { label: 'M.F.(7)', style: { fontSize: '10px' } },
    '8': { label: 'Abs(9)', style: { fontSize: '10px' } },
  }

  // Calculamos el inverso raw solo para mostrarlo en la tabla (como en el PDF)
  const rawInverseDisplay = rawInverseTFN(totalGeometricMean)

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      
      <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg p-4 text-sm text-muted-foreground">
        <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-2">
           <HelpCircle className="h-4 w-4"/> Comparación por Pares Difusos (Fuzzy AHP)
        </p>
        <p>
          Deslice hacia el lado del criterio más importante. El cálculo aplicará el Método de Buckley:
          Media Geométrica por Fila (Izquierda - Derecha).
        </p>
      </div>

      <div className="space-y-4">
        {comparisons.map((comp, idx) => {
          const val = sliderValues[`${comp.nodeId1}-${comp.nodeId2}`] || 0
          
          return (
            <div key={idx} className="border rounded-lg p-4 sm:p-6 hover:bg-accent/5 transition-colors">
               <div className="flex items-center justify-between gap-4 mb-6">
                  <div className="flex-1 bg-blue-50 dark:bg-blue-950/40 p-2 rounded border border-blue-100 dark:border-blue-900 flex items-center gap-2">
                     <span className="text-blue-700 dark:text-blue-300 font-semibold text-sm sm:text-base truncate flex-1">
                        {comp.node2Title}
                     </span>
                     {val < 0 && <span className="text-xs font-mono text-blue-600 bg-blue-100 px-1 rounded hidden sm:inline-block">Val: {getSliderLabel(val)}</span>}
                  </div>

                  <span className="text-muted-foreground font-bold text-xs px-2">VS</span>

                  <div className="flex-1 bg-green-50 dark:bg-green-950/40 p-2 rounded border border-green-100 dark:border-green-900 flex items-center gap-2 text-right justify-end">
                     {val > 0 && <span className="text-xs font-mono text-green-600 bg-green-100 px-1 rounded hidden sm:inline-block">Val: {getSliderLabel(val)}</span>}
                     <span className="text-green-700 dark:text-green-300 font-semibold text-sm sm:text-base truncate flex-1">
                        {comp.node1Title}
                     </span>
                  </div>
               </div>

               <div className="px-2 sm:px-8 pb-2">
                  <Slider 
                    min={-8} 
                    max={8} 
                    step={1} 
                    marks={marks} 
                    value={val}
                    onChange={(v) => setSliderValues(prev => ({...prev, [`${comp.nodeId1}-${comp.nodeId2}`]: v}))}
                    trackStyle={{ backgroundColor: val < 0 ? '#3b82f6' : val > 0 ? '#22c55e' : '#e2e8f0' }}
                    handleStyle={{ borderColor: val < 0 ? '#3b82f6' : val > 0 ? '#22c55e' : '#64748b' }}
                  />
               </div>
            </div>
          )
        })}
      </div>

      <div className="flex justify-end gap-4 pt-4 border-t">
        {onCancel && (
            <Button variant="outline" onClick={onCancel}>
                Cancelar
            </Button>
        )}
        <Button onClick={handleCalculate} disabled={loading} size="lg" className="min-w-[150px]">
          {loading ? <Spinner visible={true} /> : <><Calculator className="mr-2 h-4 w-4"/> Calcular Pesos Difusos</>}
        </Button>
      </div>

      {/* MODAL DE RESULTADOS */}
      <Modal 
         isOpen={showResultsModal} 
         onClose={() => setShowResultsModal(false)}
         title="Resultados del Cálculo (Buckley Method)"
         width="800px"
      >
         <div className="space-y-6 overflow-y-auto max-h-[70vh]">
            
            {/* TABLA 4: Medias Geométricas */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold">Tabla 4: Medias geométricas de los valores difusos</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead>Criterio</TableHead>
                                <TableHead className="text-center">Media Geométrica (l, m, u)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {nodos.map(nodo => {
                                const r = geometricMeans[nodo.idnodo]
                                if(!r) return null
                                return (
                                    <TableRow key={nodo.idnodo}>
                                        <TableCell className="font-medium">{nodo.titulo}</TableCell>
                                        <TableCell className="text-center font-mono text-sm text-muted-foreground">
                                            {r.l.toFixed(2)} &nbsp; {r.m.toFixed(2)} &nbsp; {r.u.toFixed(2)}
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                            
                            {/* FILA: Total */}
                            <TableRow className="bg-blue-50/50 font-medium border-t-2 border-blue-100">
                                <TableCell>Total</TableCell>
                                <TableCell className="text-center font-mono text-sm">
                                    {totalGeometricMean.l.toFixed(2)} &nbsp; {totalGeometricMean.m.toFixed(2)} &nbsp; {totalGeometricMean.u.toFixed(2)}
                                </TableCell>
                            </TableRow>
                            
                            {/* FILA: Inverso (Solo visualización) */}
                            <TableRow className="bg-slate-50/50 text-muted-foreground text-xs">
                                <TableCell>Inverso (potencia -1)</TableCell>
                                <TableCell className="text-center font-mono">
                                    {rawInverseDisplay.l.toFixed(2)} &nbsp; {rawInverseDisplay.m.toFixed(2)} &nbsp; {rawInverseDisplay.u.toFixed(2)}
                                </TableCell>
                            </TableRow>
                            
                            {/* FILA: Orden Creciente (Usado para el cálculo final) */}
                            <TableRow className="bg-green-50/50 text-green-800 font-medium">
                                <TableCell>Orden Creciente (Usado para Peso)</TableCell>
                                <TableCell className="text-center font-mono text-sm">
                                    {orderedInverse.l.toFixed(2)} &nbsp; {orderedInverse.m.toFixed(2)} &nbsp; {orderedInverse.u.toFixed(2)}
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* TABLA 5: Pesos Difusos */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold">Tabla 5: Pesos difusos relativos </CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead>Criterio</TableHead>
                                <TableHead className="text-center text-green-700 font-bold">Peso Difuso (l, m, u)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {nodos.map(nodo => {
                                const w = fuzzyWeights[nodo.idnodo]
                                if(!w) return null
                                return (
                                    <TableRow key={nodo.idnodo}>
                                        <TableCell className="font-medium">{nodo.titulo}</TableCell>
                                        <TableCell className="text-center font-mono font-semibold text-green-700">
                                            {w.l.toFixed(3)} &nbsp; {w.m.toFixed(3)} &nbsp; {w.u.toFixed(3)}
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <div className="flex justify-end gap-2 pt-2">
                 <Button variant="outline" onClick={() => setShowResultsModal(false)}>Volver</Button>
                 <Button onClick={handleConfirmSave} className="bg-green-600 hover:bg-green-700 text-white">
                    <CheckCircle2 className="mr-2 h-4 w-4"/> Usar estos Pesos
                 </Button>
            </div>
         </div>
      </Modal>

    </div>
  )
}

export default ComparacionParesDifusos