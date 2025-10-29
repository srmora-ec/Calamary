
import { Handle, Position } from "@xyflow/react"

interface CustomNodoProps {
  data: {
    label: string
    min?: number
    max?: number
    criterioFinal?: boolean
    beneficio?: boolean
    MAUT?: {
      tipoFuncion: "simple" | "dual" | "discreta"
      funcionDiscreta?: { valores: { nombre: string }[] }
    }
  }
  selected?: boolean
  sourcePosition?: Position
  targetPosition?: Position
}

export default function CustomNodo({ data, selected, sourcePosition = Position.Bottom, targetPosition = Position.Top }: CustomNodoProps) {
  return (
    <div
      className={`bg-white border-2 ${selected ? "border-blue-500 bg-blue-50" : "border-black bg-white"
        } rounded-md px-4 py-4 min-w-[200px] text-left relative`}
    >
      {/* Contenedor Título + Imagen */}
      <div className="flex justify-between items-start mb-2">
        <div className="font-semibold text-sm text-gray-800 pr-2 break-words w-0 flex-1">
          {data.label}
        </div>
        {data.criterioFinal && data.MAUT?.tipoFuncion !== "discreta" && (
          <div className="ml-2 flex-shrink-0">
            <div
              className="bg-white rounded-full p-1.5 shadow-md"
              title={data.beneficio ? "Beneficio - Mejor que aumente" : "Costo - Mejor que disminuya"}
            >
              <img
                src={data.beneficio ? "/images/incrementar.png" : "/images/decremento.png"}
                alt={data.beneficio ? "Beneficio" : "Costo"}
                className="w-6 h-6"
              />
            </div>
          </div>
        )}

      </div>

      {/* Min y Max o Discreto */}
      {data.criterioFinal && (
        <div className="flex justify-between text-[11px] text-gray-700 mt-1">
          {data.MAUT?.tipoFuncion === "discreta" && data.MAUT.funcionDiscreta ? (
            <span className="w-full text-center">
              Discreto({data.MAUT.funcionDiscreta.valores.length} opciones)
            </span>
          ) : (
            <>
              <span>{data.min ?? ""}</span>
              <span>{data.max ?? ""}</span>
            </>
          )}
        </div>
      )}

      {/* Handles */}
      <Handle type="target" position={targetPosition} />
      <Handle type="source" position={sourcePosition} />
    </div>
  )
}
