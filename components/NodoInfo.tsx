

import { Nodo } from "@/types/modelo"


interface NodoInfoProps {
    nodo: Nodo
    className?: string
}

export default function NodoInfo({ nodo, className = "" }: NodoInfoProps) {
    return (
        <div >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                {/* Indicador de tipo de criterio */}
                {nodo.criterioFinal && (
                    <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg">
                        <div
                            className="bg-white rounded-full p-1.5 shadow-sm"
                            title={nodo.beneficio ? "Beneficio - Mejor que aumente" : "Costo - Mejor que disminuya"}
                        >
                            <img
                                src={nodo.beneficio ? "/images/incrementar.png" : "/images/decremento.png"}
                                alt={nodo.beneficio ? "Beneficio" : "Costo"}
                                className="w-5 h-5"
                            />
                        </div>
                        <span className="text-xs font-medium text-blue-700">
                            {nodo.beneficio ? "Beneficio" : "Costo"}
                        </span>
                    </div>
                )}
            </div>

            {/* Descripción */}
            {nodo.descripcion && (
                <div className="mb-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Descripción</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">
                        {nodo.descripcion}
                    </p>
                </div>
            )}

            {/* Rango de valores (solo para criterios finales) */}
            {nodo.criterioFinal && (nodo.min !== undefined || nodo.max !== undefined) && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Rango de Valores</h3>
                    <div className="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg">
                        <div className="text-center">
                            <span className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                                Mínimo
                            </span>
                            <span className="block text-lg font-bold text-gray-900 mt-1">
                                {nodo.min ?? "N/A"}
                            </span>
                        </div>
                        <div className="flex-1 mx-4">
                            <div className="h-2 bg-gradient-to-r from-red-200 via-yellow-200 to-green-200 rounded-full"></div>
                        </div>
                        <div className="text-center">
                            <span className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                                Máximo
                            </span>
                            <span className="block text-lg font-bold text-gray-900 mt-1">
                                {nodo.max ?? "N/A"}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}