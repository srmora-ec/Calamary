"use client"

import { useState } from "react"
import { Modal } from "antd"
import type React from "react"
import type { Nodo } from "@/types/modelo"

interface ModeloSvgViewerProps {
  nodos: Nodo[]
  orientacion: "h" | "v"
  linea: number
  nombreModelo: string
}

const ModeloSvgViewer: React.FC<ModeloSvgViewerProps> = ({ nodos, orientacion, linea, nombreModelo }) => {
  const [isFullscreen, setIsFullscreen] = useState(false)

  const CONFIG = {
    nodeWidth: 195,
    nodeRadius: 6,
    nodeBorderWidth: 2,
    nodePaddingX: 16,
    nodePaddingY: 14,
    canvasPadding: 100,
    titleFontSize: 12,
    titleLineHeight: 20,
    titleFontWeight: 600,
    titleIconGap: 8,
    titleBottomMargin: 8,
    minMaxFontSize: 11,
    minMaxTopMargin: 4,
    minMaxLineHeight: 16,
    iconSize: 24,
    iconPadding: 6,
    iconCircleSize: 36,
    edgeStrokeWidth: 1,
    edgeLabelFontSize: 12,
    edgeLabelOffset: 5,
  }

  const calcularAlturaNodo = (nodo: Nodo) => {
    const cfg = CONFIG
    let altura = cfg.nodePaddingY * 2

    const anchoDisponible =
      cfg.nodeWidth - cfg.nodePaddingX * 2 - (nodo.criterioFinal ? cfg.iconCircleSize + cfg.titleIconGap : 0)
    const charsPerLine = Math.floor(anchoDisponible / (cfg.titleFontSize * 0.6))

    const palabras = nodo.titulo.split(" ")
    let numLineas = 1
    let lineaActual = ""

    palabras.forEach((palabra) => {
      const testLine = lineaActual ? lineaActual + " " + palabra : palabra

      if (testLine.length > charsPerLine && lineaActual) {
        numLineas++
        if (palabra.length > charsPerLine) {
          numLineas += Math.ceil(palabra.length / charsPerLine) - 1
        }
        lineaActual = palabra
      } else if (!lineaActual && palabra.length > charsPerLine) {
        numLineas += Math.ceil(palabra.length / charsPerLine) - 1
        lineaActual = palabra
      } else {
        lineaActual = testLine
      }
    })

    altura += numLineas * cfg.titleLineHeight
    altura += cfg.titleBottomMargin

    if (nodo.criterioFinal) {
      altura += cfg.minMaxTopMargin + cfg.minMaxLineHeight
    }

    return Math.max(altura, 60)
  }

  const getCanvasDimensions = () => {
    if (nodos.length === 0) return { width: 800, height: 600, minX: 0, minY: 0, alturas: {} }

    const padding = CONFIG.canvasPadding
    const nodeWidth = CONFIG.nodeWidth

    const alturas: Record<number, number> = {}
    nodos.forEach((nodo) => {
      alturas[nodo.idnodo] = calcularAlturaNodo(nodo)
    })

    const minX = Math.min(...nodos.map((n) => n.posx)) - padding
    const minY = Math.min(...nodos.map((n) => n.posy)) - padding
    const maxX = Math.max(...nodos.map((n) => n.posx)) + nodeWidth + padding
    const maxY =
      Math.max(
        ...nodos.map((n) => {
          const altura = alturas[n.idnodo] || 100
          return n.posy + altura
        }),
      ) + padding

    return {
      width: maxX - minX,
      height: maxY - minY,
      minX,
      minY,
      alturas,
    }
  }

  const getConnectionPoints = (source: Nodo, target: Nodo, alturas: Record<number, number>) => {
    const nodeWidth = CONFIG.nodeWidth
    const sourceHeight = alturas[source.idnodo] || 100
    const targetHeight = alturas[target.idnodo] || 100
    const isHorizontal = orientacion === "h"

    if (isHorizontal) {
      return {
        x1: source.posx + nodeWidth,
        y1: source.posy + sourceHeight / 2,
        x2: target.posx,
        y2: target.posy + targetHeight / 2,
      }
    } else {
      return {
        x1: source.posx + nodeWidth / 2,
        y1: source.posy + sourceHeight,
        x2: target.posx + nodeWidth / 2,
        y2: target.posy,
      }
    }
  }

  const getLinePath = (x1: number, y1: number, x2: number, y2: number) => {
    switch (linea) {
      case 1:
        return `M ${x1} ${y1} L ${x2} ${y2}`

      case 2:
        const midPoint = orientacion === "h" ? (x1 + x2) / 2 : (y1 + y2) / 2
        if (orientacion === "h") {
          return `M ${x1} ${y1} L ${midPoint} ${y1} L ${midPoint} ${y2} L ${x2} ${y2}`
        } else {
          return `M ${x1} ${y1} L ${x1} ${midPoint} L ${x2} ${midPoint} L ${x2} ${y2}`
        }

      case 3:
        const mid = orientacion === "h" ? (x1 + x2) / 2 : (y1 + y2) / 2
        const radius = 10
        if (orientacion === "h") {
          return `M ${x1} ${y1} L ${mid - radius} ${y1} Q ${mid} ${y1} ${mid} ${y1 + (y2 > y1 ? radius : -radius)} L ${mid} ${y2 - (y2 > y1 ? radius : -radius)} Q ${mid} ${y2} ${mid + radius} ${y2} L ${x2} ${y2}`
        } else {
          return `M ${x1} ${y1} L ${x1} ${mid - radius} Q ${x1} ${mid} ${x1 + (x2 > x1 ? radius : -radius)} ${mid} L ${x2 - (x2 > x1 ? radius : -radius)} ${mid} Q ${x2} ${mid} ${x2} ${mid + radius} L ${x2} ${y2}`
        }

      case 4:
        const dx = x2 - x1
        const dy = y2 - y1
        if (orientacion === "h") {
          return `M ${x1} ${y1} C ${x1 + dx * 0.5} ${y1}, ${x2 - dx * 0.5} ${y2}, ${x2} ${y2}`
        } else {
          return `M ${x1} ${y1} C ${x1} ${y1 + dy * 0.5}, ${x2} ${y2 - dy * 0.5}, ${x2} ${y2}`
        }

      default:
        return `M ${x1} ${y1} L ${x2} ${y2}`
    }
  }

  const dims = getCanvasDimensions()
  const cfg = CONFIG
  const alturas = dims.alturas

  const svgContent = (
    <svg
      viewBox={`0 0 ${dims.width} ${dims.height}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-auto max-h-full"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <style>{`
          .node-rect { fill: white; stroke: black; stroke-width: ${cfg.nodeBorderWidth}; }
          .node-text { font-family: Arial, sans-serif; font-size: ${cfg.titleFontSize}px; fill: #1f2937; font-weight: ${cfg.titleFontWeight}; }
          .node-min-max { font-family: Arial, sans-serif; font-size: ${cfg.minMaxFontSize}px; fill: #374151; }
          .edge-line { stroke: #64748b; stroke-width: ${cfg.edgeStrokeWidth}; fill: none; }
          .edge-label { font-family: Arial, sans-serif; font-size: ${cfg.edgeLabelFontSize}px; fill: black; font-weight: 600; }
          .icon-circle { fill: white; stroke: #e5e7eb; stroke-width: 1; }
        `}</style>
      </defs>

      {nodos.map((nodo) => {
        if (nodo.idpadre !== null) {
          const padre = nodos.find((n) => n.idnodo === nodo.idpadre)
          if (padre) {
            const points = getConnectionPoints(padre, nodo, alturas)
            const path = getLinePath(
              points.x1 - dims.minX,
              points.y1 - dims.minY,
              points.x2 - dims.minX,
              points.y2 - dims.minY,
            )

            return (
              <g key={`edge-${nodo.idnodo}`}>
                <path d={path} className="edge-line" />
                {nodo.peso && (
                  <text
                    x={(points.x1 + points.x2) / 2 - dims.minX}
                    y={(points.y1 + points.y2) / 2 - dims.minY - cfg.edgeLabelOffset}
                    className="edge-label"
                    textAnchor="middle"
                  >
                    {nodo.peso.toFixed(2)}
                  </text>
                )}
              </g>
            )
          }
        }
        return null
      })}

      {nodos.map((nodo) => {
        const x = nodo.posx - dims.minX
        const y = nodo.posy - dims.minY
        const nodeHeight = alturas[nodo.idnodo] || 100

        const anchoTexto =
          cfg.nodeWidth - cfg.nodePaddingX * 2 - (nodo.criterioFinal ? cfg.iconCircleSize + cfg.titleIconGap : 0)
        const charsPerLine = Math.floor(anchoTexto / (cfg.titleFontSize * 0.6))

        const palabras = nodo.titulo.split(" ")
        const lineasTexto: string[] = []
        let lineaActual = ""

        palabras.forEach((palabra) => {
          const testLine = lineaActual ? lineaActual + " " + palabra : palabra

          if (palabra.length > charsPerLine) {
            if (lineaActual) {
              lineasTexto.push(lineaActual)
            }

            let palabraRestante = palabra
            while (palabraRestante.length > 0) {
              const chunk = palabraRestante.substring(0, charsPerLine)
              lineasTexto.push(chunk)
              palabraRestante = palabraRestante.substring(charsPerLine)
            }

            lineaActual = ""
          } else if (testLine.length > charsPerLine && lineaActual) {
            lineasTexto.push(lineaActual)
            lineaActual = palabra
          } else {
            lineaActual = testLine
          }
        })

        if (lineaActual) {
          lineasTexto.push(lineaActual)
        }

        return (
          <g key={`node-${nodo.idnodo}`}>
            <rect x={x} y={y} width={cfg.nodeWidth} height={nodeHeight} rx={cfg.nodeRadius} className="node-rect" />

            {lineasTexto.map((linea, index) => (
              <text
                key={`text-${nodo.idnodo}-${index}`}
                x={x + cfg.nodePaddingX}
                y={y + cfg.nodePaddingY + cfg.titleLineHeight * (index + 1)}
                className="node-text"
              >
                {linea}
              </text>
            ))}

            {nodo.criterioFinal && (
              <>
                <circle
                  cx={x + cfg.nodeWidth - cfg.nodePaddingX - cfg.iconCircleSize / 2}
                  cy={y + cfg.nodePaddingY + cfg.iconCircleSize / 2}
                  r={cfg.iconCircleSize / 2}
                  className="icon-circle"
                />

                {nodo.beneficio ? (
                  <path
                    d={`M ${x + cfg.nodeWidth - cfg.nodePaddingX - cfg.iconCircleSize / 2} ${y + cfg.nodePaddingY + (cfg.iconCircleSize / 2) - cfg.iconSize * 0.25} L ${x + cfg.nodeWidth - cfg.nodePaddingX - cfg.iconCircleSize / 2} ${y + cfg.nodePaddingY + (cfg.iconCircleSize / 2) + cfg.iconSize * 0.25} M ${x + cfg.nodeWidth - cfg.nodePaddingX - (cfg.iconCircleSize / 2) - cfg.iconSize * 0.167} ${y + cfg.nodePaddingY + (cfg.iconCircleSize / 2) - cfg.iconSize * 0.167} L ${x + cfg.nodeWidth - cfg.nodePaddingX - cfg.iconCircleSize / 2} ${y + cfg.nodePaddingY + (cfg.iconCircleSize / 2) - cfg.iconSize * 0.25} L ${x + cfg.nodeWidth - cfg.nodePaddingX - cfg.iconCircleSize / 2 + cfg.iconSize * 0.167} ${y + cfg.nodePaddingY + (cfg.iconCircleSize / 2) - cfg.iconSize * 0.167}`}
                    stroke="#22c55e"
                    strokeWidth="2"
                    fill="none"
                  />
                ) : (
                  <path
                    d={`M ${x + cfg.nodeWidth - cfg.nodePaddingX - cfg.iconCircleSize / 2} ${y + cfg.nodePaddingY + (cfg.iconCircleSize / 2) + cfg.iconSize * 0.25} L ${x + cfg.nodeWidth - cfg.nodePaddingX - cfg.iconCircleSize / 2} ${y + cfg.nodePaddingY + (cfg.iconCircleSize / 2) - cfg.iconSize * 0.25} M ${x + cfg.nodeWidth - cfg.nodePaddingX - (cfg.iconCircleSize / 2) - cfg.iconSize * 0.167} ${y + cfg.nodePaddingY + (cfg.iconCircleSize / 2) + cfg.iconSize * 0.167} L ${x + cfg.nodeWidth - cfg.nodePaddingX - cfg.iconCircleSize / 2} ${y + cfg.nodePaddingY + (cfg.iconCircleSize / 2) + cfg.iconSize * 0.25} L ${x + cfg.nodeWidth - cfg.nodePaddingX - cfg.iconCircleSize / 2 + cfg.iconSize * 0.167} ${y + cfg.nodePaddingY + (cfg.iconCircleSize / 2) + cfg.iconSize * 0.167}`}
                    stroke="#ef4444"
                    strokeWidth="2"
                    fill="none"
                  />
                )}
              </>
            )}

            {nodo.criterioFinal && (
              <>
                <text x={x + cfg.nodePaddingX} y={y + nodeHeight - cfg.nodePaddingY} className="node-min-max">
                  {nodo.min ?? ""}
                </text>
                <text
                  x={x + cfg.nodeWidth - cfg.nodePaddingX}
                  y={y + nodeHeight - cfg.nodePaddingY}
                  className="node-min-max"
                  textAnchor="end"
                >
                  {nodo.max ?? ""}
                </text>
              </>
            )}
          </g>
        )
      })}
    </svg>
  )

  return (
    <>
      <div className="w-full h-full flex flex-col bg-gray-50 rounded-lg overflow-hidden">
        <div className="flex justify-end p-2 border-b border-gray-200">
          <button
            onClick={() => setIsFullscreen(true)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Ver en pantalla completa
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center overflow-auto p-4">{svgContent}</div>
      </div>

      <Modal
        title={`Modelo: ${nombreModelo}`}
        open={isFullscreen}
        onCancel={() => setIsFullscreen(false)}
        footer={null}
        width="95vw"
        style={{ top: 20 }}
        bodyStyle={{
          height: "85vh",
          overflow: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {svgContent}
      </Modal>
    </>
  )
}

export default ModeloSvgViewer
