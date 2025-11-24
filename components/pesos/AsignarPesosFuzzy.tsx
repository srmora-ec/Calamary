"use client"

import type React from "react"
import { useState, useMemo, useEffect } from "react"
import type { Nodo } from "@/types/modelo"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { AlertCircle, Calculator, Scale } from "lucide-react" // Importamos Scale para el icono
import { Alert, AlertDescription } from "@/components/ui/alert"
import Modal from "../Modal" // Asegúrate de importar tu Modal
import ComparacionParesDifusos from "./ComparacionParesDifusos" // Importamos el componente hijo

interface AsignarPesosDifusosProps {
    nodos: Nodo[]
    onSave: (weights: Record<number, number>) => void
}

interface FuzzyWeight {
    l: string
    m: string
    u: string
}

const AsignarPesosDifusos: React.FC<AsignarPesosDifusosProps> = ({ nodos, onSave }) => {
    const [fuzzyWeights, setFuzzyWeights] = useState<Record<number, FuzzyWeight>>({})
    const [showDetails, setShowDetails] = useState(false)
    
    // Estado para controlar el Modal de Comparación por Pares
    const [isComparisonOpen, setIsComparisonOpen] = useState(false)

    // Inicializar
    useEffect(() => {
        const initialWeights: Record<number, FuzzyWeight> = {}
        nodos.forEach((nodo) => {
            initialWeights[nodo.idnodo] = { l: "1", m: "1", u: "1" }
        })
        setFuzzyWeights(initialWeights)
    }, [nodos])

    // --- CÁLCULOS (Step 6 & Step 7) ---
    const { results, sumM, isGlobalValid, globalError } = useMemo(() => {
        const res: Record<number, { M: number; N: number; isValid: boolean; error?: string }> = {}
        let totalM = 0
        let allValid = true
        let errorMsg = ""

        nodos.forEach((nodo) => {
            const w = fuzzyWeights[nodo.idnodo]
            if (!w) return

            const l = parseFloat(w.l) || 0
            const m = parseFloat(w.m) || 0
            const u = parseFloat(w.u) || 0

            // Validaciones de lógica difusa (l <= m <= u)
            let rowValid = true
            let rowError = ""

            if (l > m) { rowValid = false; rowError = "l > m"; }
            if (m > u) { rowValid = false; rowError = "m > u"; }
            if (l < 0) { rowValid = false; rowError = "Negativo"; }

            if (!rowValid) allValid = false

            // Eq. 6: M_i = (l + m + u) / 3
            const M = (l + m + u) / 3
            totalM += M

            res[nodo.idnodo] = { M, N: 0, isValid: rowValid, error: rowError }
        })

        // Eq. 7: N_i = M_i / sum(M)
        if (totalM > 0) {
            nodos.forEach((nodo) => {
                if (res[nodo.idnodo]) {
                    res[nodo.idnodo].N = res[nodo.idnodo].M / totalM
                }
            })
        } else if (nodos.length > 0) {
            allValid = false;
            errorMsg = "La suma de medias es 0";
        }

        return { results: res, sumM: totalM, isGlobalValid: allValid, globalError: errorMsg }
    }, [nodos, fuzzyWeights])

    // --- MANEJADORES ---
    
    const handleWeightChange = (nodeId: number, field: keyof FuzzyWeight, value: string) => {
        if (value !== "" && !/^\d*\.?\d*$/.test(value)) return

        setFuzzyWeights((prev) => ({
            ...prev,
            [nodeId]: { ...prev[nodeId], [field]: value },
        }))
    }

    // NUEVO: Función que recibe los pesos del componente de Comparación por Pares
    const handleComparisonSave = (calculatedWeights: Record<number, { l: string; m: string; u: string }>) => {
        // Actualizamos el estado local con los valores recibidos
        setFuzzyWeights(calculatedWeights)
        // Cerramos el modal
        setIsComparisonOpen(false)
    }

    const handleSave = () => {
        if (!isGlobalValid) return
        const finalWeights: Record<number, number> = {}
        nodos.forEach((nodo) => {
            finalWeights[nodo.idnodo] = Number(results[nodo.idnodo]?.N.toFixed(6)) || 0
        })
        onSave(finalWeights)
    }

    const getProgressColor = (percentage: number, isValid: boolean) => {
        if (!isValid) return "bg-red-500"
        if (percentage < 10) return "bg-slate-400"
        if (percentage < 25) return "bg-blue-400"
        return "bg-primary"
    }

    return (
        <div className="w-full max-w-4xl mx-auto space-y-6">

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-medium leading-none">Pesos Difusos (Fuzzy AHP)</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        Ingrese valores manualmente o use la comparación por pares.
                    </p>
                </div>

                <div className="flex items-center gap-2 text-sm flex-wrap justify-end">
                    
                    {/* NUEVO: Botón para abrir el modal de comparación */}
                    <Button 
                        variant="secondary" 
                        size="sm" 
                        className="gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200"
                        onClick={() => setIsComparisonOpen(true)}
                    >
                        <Scale className="h-4 w-4" />
                        Comparar por Pares
                    </Button>

                    <div className="flex items-center gap-2 ml-2 px-2 py-1 bg-muted rounded">
                        <span className="text-muted-foreground">Suma $N_i$:</span>
                        <span className={`font-mono font-bold ${Math.abs((Object.values(results).reduce((a, b) => a + b.N, 0)) - 1) < 0.0001 ? "text-green-600" : "text-orange-500"}`}>
                            {Object.values(results).reduce((a, b) => a + b.N, 0).toFixed(4)}
                        </span>
                    </div>
                    
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowDetails(!showDetails)}
                        className="gap-2"
                    >
                        <Calculator className="h-4 w-4" />
                        {showDetails ? "Ocultar" : "Ver"} Cálculo
                    </Button>
                </div>
            </div>

            {!isGlobalValid && (
                <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        {globalError || "Verifique los errores: El orden debe ser Inferior (l) ≤ Medio (m) ≤ Superior (u)"}
                    </AlertDescription>
                </Alert>
            )}

            <Card className="border-muted">
                <CardContent className="p-0 divide-y divide-muted">
                    {nodos.map((nodo) => {
                        const w = fuzzyWeights[nodo.idnodo] || { l: "0", m: "0", u: "0" }
                        const data = results[nodo.idnodo] || { M: 0, N: 0, isValid: true }
                        const percentage = data.N * 100
                        const hasError = !data.isValid

                        return (
                            <div key={nodo.idnodo} className="p-4 sm:p-5 transition-colors hover:bg-muted/30">
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center justify-between">
                                        <Label className={`text-base font-medium ${hasError ? "text-red-600" : ""}`}>
                                            {nodo.titulo}
                                        </Label>
                                        <div className="text-right">
                                            <span className="text-xs text-muted-foreground mr-2">Peso Final ($N_i$):</span>
                                            <span className="font-mono font-bold text-sm">{data.N.toFixed(4)}</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                                        <div className="col-span-1 md:col-span-5 lg:col-span-4">
                                            <div className="grid grid-cols-3 gap-2">
                                                {/* Inputs para l, m, u */}
                                                {["l", "m", "u"].map((field, idx) => (
                                                    <div key={field} className="space-y-1">
                                                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold pl-1">
                                                            {field === "l" ? "Low" : field === "m" ? "Mid" : "Upp"}
                                                        </span>
                                                        <Input
                                                            type="number"
                                                            value={w[field as keyof FuzzyWeight]}
                                                            onChange={(e) => handleWeightChange(nodo.idnodo, field as keyof FuzzyWeight, e.target.value)}
                                                            className={`h-9 font-mono text-center text-sm ${hasError ? "border-red-300 bg-red-50" : field === "m" ? "bg-muted/20" : ""}`}
                                                            placeholder={field}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                            {data.error && <p className="text-xs text-red-500 mt-1 ml-1 font-medium">{data.error}</p>}
                                        </div>

                                        <div className="col-span-1 md:col-span-7 lg:col-span-8 pb-2">
                                            <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-500 ease-out ${getProgressColor(percentage, data.isValid)}`}
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between mt-1">
                                                <span className="text-[10px] text-muted-foreground">0%</span>
                                                <span className="text-[10px] text-muted-foreground font-mono">{percentage.toFixed(2)}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </CardContent>
            </Card>

            {showDetails && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <Card className="bg-slate-50 dark:bg-slate-900 border-dashed">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium uppercase text-muted-foreground">Detalles del Proceso (Step 6 & 7)</CardTitle>
                            <CardDescription className="text-xs">
                                Cálculo de medias ($M_i$) y normalización ($N_i$) según Tabla 5 y 6 del documento.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {/* TABLA DE DETALLES (IDÉNTICA AL CÓDIGO ANTERIOR) */}
                            <div className="relative w-full overflow-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-muted-foreground bg-muted/50 uppercase">
                                        <tr>
                                            <th className="px-4 py-2 rounded-l-md">Criterio</th>
                                            <th className="px-4 py-2 text-center">Input $(l,m,u)$</th>
                                            <th className="px-4 py-2 text-right">Media $M_i$</th>
                                            <th className="px-4 py-2 text-right rounded-r-md">Peso Norm. $N_i$</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-muted/50">
                                        {nodos.map(nodo => {
                                            const d = results[nodo.idnodo]
                                            const w = fuzzyWeights[nodo.idnodo]
                                            return (
                                                <tr key={nodo.idnodo}>
                                                    <td className="px-4 py-2 font-medium">{nodo.titulo}</td>
                                                    <td className="px-4 py-2 text-center font-mono text-xs">
                                                        ({w?.l}, {w?.m}, {w?.u})
                                                    </td>
                                                    <td className="px-4 py-2 text-right font-mono text-muted-foreground">
                                                        {d?.M.toFixed(4)}
                                                    </td>
                                                    <td className="px-4 py-2 text-right font-mono font-bold text-primary">
                                                        {d?.N.toFixed(6)}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                        <tr className="bg-muted/30 font-semibold">
                                            <td className="px-4 py-2 text-right" colSpan={2}>Totales ($\Sigma$)</td>
                                            <td className="px-4 py-2 text-right font-mono">{sumM.toFixed(4)}</td>
                                            <td className="px-4 py-2 text-right font-mono">1.0000</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            <div className="flex justify-end pt-2">
                <Button
                    onClick={handleSave}
                    disabled={!isGlobalValid}
                    size="lg"
                    className="min-w-[140px] shadow-sm"
                >
                    Guardar Pesos
                </Button>
            </div>

            {/* --- MODAL DE COMPARACIÓN POR PARES (INTEGRACIÓN) --- */}
            <Modal
                isOpen={isComparisonOpen}
                onClose={() => setIsComparisonOpen(false)}
                title="Matriz de Comparación por Pares (Fuzzy Saaty)"
                width="900px"
            >
                {isComparisonOpen && (
                    <ComparacionParesDifusos 
                        nodos={nodos}
                        onSave={handleComparisonSave} // Aquí se recuperan los pesos
                        onCancel={() => setIsComparisonOpen(false)}
                    />
                )}
            </Modal>

        </div>
    )
}

export default AsignarPesosDifusos