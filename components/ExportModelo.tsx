"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Download, ChevronDown } from "lucide-react"

interface Nodo {
  idnodo: number
  posx: number
  posy: number
  titulo: string
  idpadre: number | null
  peso?: number
  min?: number
  max?: number
  criterioFinal?: boolean
  beneficio?: boolean
}

interface ExportModeloProps {
  nodos: Nodo[]
  orientacion: "h" | "v"
  linea: number
  nombreModelo: string
  descripcion: string | null
  metodo: string 
  logoUrl?: string
}

const ExportModelo: React.FC<ExportModeloProps> = ({ nodos, orientacion, linea, nombreModelo,descripcion, metodo, logoUrl = "https://calamary.vercel.app/logo.png" }) => {
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [showMenu])

  const CONFIG = {
    nodeWidth: 200,
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
    horizontalSpacing: 75, // Reducido a la mitad para orientación vertical
    verticalSpacing: 40, // Reducido a la mitad para orientación horizontal
    logoSize: 40,
    logoPadding: 15,
    maxLineaCorta: 250,
    offsetPesoLargo: 10,
    igualarAlturaHermanos: true,
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

  const calcularPosicionesAutomaticas = () => {
    if (nodos.length === 0) return { nodosPositioned: [], alturas: {} }

    const cfg = CONFIG
    const alturas: Record<number, number> = {}
    nodos.forEach((nodo) => {
      alturas[nodo.idnodo] = calcularAlturaNodo(nodo)
    })

    // Si está activado, igualar altura de hermanos
    if (cfg.igualarAlturaHermanos) {
      const gruposPorPadre = new Map<number | null, number[]>()
      nodos.forEach(nodo => {
        if (!gruposPorPadre.has(nodo.idpadre)) {
          gruposPorPadre.set(nodo.idpadre, [])
        }
        gruposPorPadre.get(nodo.idpadre)!.push(nodo.idnodo)
      })

      gruposPorPadre.forEach((hermanos) => {
        if (hermanos.length > 1) {
          const maxAltura = Math.max(...hermanos.map(id => alturas[id]))
          hermanos.forEach(id => {
            alturas[id] = maxAltura
          })
        }
      })
    }

    // Construir estructura de árbol
    const hijos = new Map<number | null, Nodo[]>()

    nodos.forEach(nodo => {
      if (!hijos.has(nodo.idpadre)) {
        hijos.set(nodo.idpadre, [])
      }
      hijos.get(nodo.idpadre)!.push(nodo)
    })

    // Encontrar raíz(es)
    const raices = nodos.filter(n => n.idpadre === null)

    interface NodoConPos extends Nodo {
      nivel: number
      posCalculada?: number
    }

    const nodosMap = new Map<number, NodoConPos>()

    // Calcular niveles
    const calcularNiveles = (nodo: Nodo, nivel: number) => {
      const info: NodoConPos = { ...nodo, nivel }
      nodosMap.set(nodo.idnodo, info)

      const hijosDeNodo = hijos.get(nodo.idnodo) || []
      hijosDeNodo.forEach(hijo => calcularNiveles(hijo, nivel + 1))
    }

    raices.forEach(raiz => calcularNiveles(raiz, 0))

    const maxNivel = Math.max(...Array.from(nodosMap.values()).map(n => n.nivel))

    // Algoritmo de posicionamiento mejorado (Walker's algorithm simplificado)
    const nodosPositioned: Nodo[] = []

    if (orientacion === "v") {
      // VERTICAL: Proceso de abajo hacia arriba para calcular posiciones relativas
      const posicionesRelativas = new Map<number, number>()

      // Primero, calcular posiciones de las hojas (nivel más bajo)
      for (let nivel = maxNivel; nivel >= 0; nivel--) {
        const nodosNivel = Array.from(nodosMap.values()).filter(n => n.nivel === nivel)

        nodosNivel.forEach(nodo => {
          const hijosNodo = hijos.get(nodo.idnodo) || []

          if (hijosNodo.length === 0) {
            // Es una hoja, asignar posición relativa inicial
            posicionesRelativas.set(nodo.idnodo, 0)
          } else {
            // Calcular posición como promedio de hijos
            const posHijos = hijosNodo.map(h => posicionesRelativas.get(h.idnodo) || 0)
            const minPos = Math.min(...posHijos)
            const maxPos = Math.max(...posHijos)
            posicionesRelativas.set(nodo.idnodo, (minPos + maxPos) / 2)
          }
        })
      }

      // Ahora asignar posiciones absolutas nivel por nivel
      for (let nivel = 0; nivel <= maxNivel; nivel++) {
        const nodosNivel = Array.from(nodosMap.values()).filter(n => n.nivel === nivel)
        const posY = nivel * (Math.max(...Object.values(alturas)) + cfg.verticalSpacing)

        // Agrupar por padre
        const gruposPorPadre = new Map<number | null, NodoConPos[]>()
        nodosNivel.forEach(nodo => {
          if (!gruposPorPadre.has(nodo.idpadre)) {
            gruposPorPadre.set(nodo.idpadre, [])
          }
          gruposPorPadre.get(nodo.idpadre)!.push(nodo)
        })

        let offsetXGlobal = 0

        gruposPorPadre.forEach((hermanos, idPadre) => {
          const numHermanos = hermanos.length
          const anchoTotal = numHermanos * cfg.nodeWidth + (numHermanos - 1) * cfg.horizontalSpacing

          let posXInicio = offsetXGlobal

          if (idPadre !== null) {
            const padre = nodosPositioned.find(n => n.idnodo === idPadre)
            if (padre) {
              // Centrar respecto al padre
              posXInicio = Math.max(offsetXGlobal, padre.posx + cfg.nodeWidth / 2 - anchoTotal / 2)
            }
          }

          hermanos.forEach((nodo, index) => {
            nodosPositioned.push({
              ...nodo,
              posx: posXInicio + index * (cfg.nodeWidth + cfg.horizontalSpacing),
              posy: posY
            })
          })

          offsetXGlobal = posXInicio + anchoTotal + cfg.horizontalSpacing
        })
      }

      // Ajustar para centrar padres que quedaron desalineados
      for (let nivel = maxNivel - 1; nivel >= 0; nivel--) {
        const nodosNivel = nodosPositioned.filter(n => nodosMap.get(n.idnodo)?.nivel === nivel)

        nodosNivel.forEach(padre => {
          const hijosDelPadre = nodosPositioned.filter(n => n.idpadre === padre.idnodo)
          if (hijosDelPadre.length > 0) {
            const minXHijo = Math.min(...hijosDelPadre.map(h => h.posx))
            const maxXHijo = Math.max(...hijosDelPadre.map(h => h.posx + cfg.nodeWidth))
            const centroHijos = (minXHijo + maxXHijo) / 2
            const centroPadre = padre.posx + cfg.nodeWidth / 2
            const ajuste = centroHijos - centroPadre

            padre.posx += ajuste
          }
        })
      }

    } else {
      // HORIZONTAL: Similar pero en eje Y
      for (let nivel = maxNivel; nivel >= 0; nivel--) {
        const nodosNivel = Array.from(nodosMap.values()).filter(n => n.nivel === nivel)
        const posX = nivel * (cfg.nodeWidth + cfg.horizontalSpacing)

        // Agrupar por padre
        const gruposPorPadre = new Map<number | null, NodoConPos[]>()
        nodosNivel.forEach(nodo => {
          if (!gruposPorPadre.has(nodo.idpadre)) {
            gruposPorPadre.set(nodo.idpadre, [])
          }
          gruposPorPadre.get(nodo.idpadre)!.push(nodo)
        })

        let offsetYGlobal = 0

        gruposPorPadre.forEach((hermanos, idPadre) => {
          const alturaTotal = hermanos.reduce((sum, n) => sum + alturas[n.idnodo], 0) +
            (hermanos.length - 1) * cfg.verticalSpacing

          let posYInicio = offsetYGlobal

          if (idPadre !== null) {
            const padre = nodosPositioned.find(n => n.idnodo === idPadre)
            if (padre) {
              const alturaPadre = alturas[padre.idnodo]
              posYInicio = Math.max(offsetYGlobal, padre.posy + alturaPadre / 2 - alturaTotal / 2)
            }
          }

          let posY = posYInicio
          hermanos.forEach((nodo) => {
            nodosPositioned.push({
              ...nodo,
              posx: posX,
              posy: posY
            })
            posY += alturas[nodo.idnodo] + cfg.verticalSpacing
          })

          offsetYGlobal = posY
        })
      }

      // Ajustar padres horizontalmente
      for (let nivel = maxNivel - 1; nivel >= 0; nivel--) {
        const nodosNivel = nodosPositioned.filter(n => nodosMap.get(n.idnodo)?.nivel === nivel)

        nodosNivel.forEach(padre => {
          const hijosDelPadre = nodosPositioned.filter(n => n.idpadre === padre.idnodo)
          if (hijosDelPadre.length > 0) {
            const minYHijo = Math.min(...hijosDelPadre.map(h => h.posy))
            const maxYHijo = Math.max(...hijosDelPadre.map(h => h.posy + alturas[h.idnodo]))
            const centroHijos = (minYHijo + maxYHijo) / 2
            const alturaPadre = alturas[padre.idnodo]
            const centroPadre = padre.posy + alturaPadre / 2
            const ajuste = centroHijos - centroPadre

            padre.posy += ajuste
          }
        })
      }
    }

    return { nodosPositioned, alturas }
  }

  const getCanvasDimensions = () => {
    if (nodos.length === 0) return { width: 800, height: 600, minX: 0, minY: 0, alturas: {}, nodosAjustados: [] }

    const { nodosPositioned, alturas } = calcularPosicionesAutomaticas()
    const padding = CONFIG.canvasPadding
    const nodeWidth = CONFIG.nodeWidth

    const minX = Math.min(...nodosPositioned.map((n) => n.posx)) - padding
    const minY = Math.min(...nodosPositioned.map((n) => n.posy)) - padding
    const maxX = Math.max(...nodosPositioned.map((n) => n.posx)) + nodeWidth + padding
    const maxY =
      Math.max(
        ...nodosPositioned.map((n) => {
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
      nodosAjustados: nodosPositioned,
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

  const generateSVG = () => {
    const dims = getCanvasDimensions()
    const cfg = CONFIG
    const alturas = dims.alturas
    const nodosParaExportar = dims.nodosAjustados

    let svg = `<svg width="${dims.width}" height="${dims.height}" xmlns="http://www.w3.org/2000/svg">`
    svg += `<defs><style>
    .node-rect { fill: white; stroke: black; stroke-width: ${cfg.nodeBorderWidth}; }
    .node-text { font-family: Arial, sans-serif; font-size: ${cfg.titleFontSize}px; fill: #1f2937; font-weight: ${cfg.titleFontWeight}; }
    .node-min-max { font-family: Arial, sans-serif; font-size: ${cfg.minMaxFontSize}px; fill: #374151; }
    .edge-line { stroke: #64748b; stroke-width: ${cfg.edgeStrokeWidth}; fill: none; }
    .edge-label { font-family: Arial, sans-serif; font-size: ${cfg.edgeLabelFontSize}px; fill: black; font-weight: 600; }
    .icon-circle { fill: white; stroke: #e5e7eb; stroke-width: 1; }
    .watermark-text { font-family: Arial, sans-serif; font-size: 12px; fill: #9ca3af; font-weight: 400; }
  </style></defs>`

    svg += `<rect width="${dims.width}" height="${dims.height}" fill="white"/>`

    // Determinar qué grupos de hermanos tienen líneas largas
    const gruposConLineaLarga = new Map<number | null, boolean>()

    nodosParaExportar.forEach((nodo) => {
      if (nodo.idpadre !== null && nodo.peso) {
        const padre = nodosParaExportar.find((n) => n.idnodo === nodo.idpadre)
        if (padre) {
          const points = getConnectionPoints(padre, nodo, alturas)
          const dx = points.x2 - points.x1
          const dy = points.y2 - points.y1
          const longitudLinea = Math.sqrt(dx * dx + dy * dy)

          if (longitudLinea > cfg.maxLineaCorta) {
            gruposConLineaLarga.set(nodo.idpadre, true)
          }
        }
      }
    })

    // Dibujar edges
    nodosParaExportar.forEach((nodo) => {
      if (nodo.idpadre !== null) {
        const padre = nodosParaExportar.find((n) => n.idnodo === nodo.idpadre)
        if (padre) {
          const points = getConnectionPoints(padre, nodo, alturas)
          const path = getLinePath(
            points.x1 - dims.minX,
            points.y1 - dims.minY,
            points.x2 - dims.minX,
            points.y2 - dims.minY,
          )

          svg += `<path d="${path}" class="edge-line"/>`

          if (nodo.peso) {
            const tieneHermanoConLineaLarga = gruposConLineaLarga.get(nodo.idpadre) || false

            let labelX, labelY
            const paddingExtra = 15

            if (orientacion === "v") {
              if (tieneHermanoConLineaLarga) {
                labelX = nodo.posx + cfg.nodeWidth / 2 - dims.minX
                labelY = nodo.posy - cfg.offsetPesoLargo - dims.minY
              } else {
                labelX = (points.x1 + points.x2) / 2 - dims.minX
                labelY = (points.y1 + points.y2) / 2 - dims.minY - cfg.edgeLabelOffset
              }
            } else {
              if (tieneHermanoConLineaLarga) {
                labelX = nodo.posx - cfg.offsetPesoLargo - paddingExtra - dims.minX
                labelY = nodo.posy + alturas[nodo.idnodo] / 2 - dims.minY
              } else {
                labelX = (points.x1 + points.x2) / 2 - dims.minX
                labelY = (points.y1 + points.y2) / 2 - dims.minY - cfg.edgeLabelOffset
              }
            }

            const pesoText = nodo.peso.toFixed(2)
            const textWidth = pesoText.length * cfg.edgeLabelFontSize * 0.6
            const textHeight = cfg.edgeLabelFontSize * 1.2
            const padding = 4

            svg += `<rect x="${labelX - textWidth / 2 - padding}" y="${labelY - textHeight + padding}" width="${textWidth + padding * 2}" height="${textHeight}" fill="white" rx="3"/>`
            svg += `<text x="${labelX}" y="${labelY}" class="edge-label" text-anchor="middle">${pesoText}</text>`
          }
        }
      }
    })

    // Dibujar nodos
    nodosParaExportar.forEach((nodo) => {
      const x = nodo.posx - dims.minX
      const y = nodo.posy - dims.minY
      const nodeHeight = alturas[nodo.idnodo] || 100

      svg += `<rect x="${x}" y="${y}" width="${cfg.nodeWidth}" height="${nodeHeight}" rx="${cfg.nodeRadius}" class="node-rect"/>`

      const anchoTexto =
        cfg.nodeWidth - cfg.nodePaddingX * 2 - (nodo.criterioFinal ? cfg.iconCircleSize + cfg.titleIconGap : 0)
      const charsPerLine = Math.floor(anchoTexto / (cfg.titleFontSize * 0.6))

      const palabras = nodo.titulo.split(" ")
      let lineY = y + cfg.nodePaddingY + cfg.titleLineHeight
      let lineaActual = ""

      palabras.forEach((palabra) => {
        const testLine = lineaActual ? lineaActual + " " + palabra : palabra

        if (palabra.length > charsPerLine) {
          if (lineaActual) {
            svg += `<text x="${x + cfg.nodePaddingX}" y="${lineY}" class="node-text">${lineaActual}</text>`
            lineY += cfg.titleLineHeight
          }

          let palabraRestante = palabra
          while (palabraRestante.length > 0) {
            const chunk = palabraRestante.substring(0, charsPerLine)
            svg += `<text x="${x + cfg.nodePaddingX}" y="${lineY}" class="node-text">${chunk}</text>`
            palabraRestante = palabraRestante.substring(charsPerLine)
            if (palabraRestante.length > 0) {
              lineY += cfg.titleLineHeight
            }
          }

          lineaActual = ""
        } else if (testLine.length > charsPerLine && lineaActual) {
          svg += `<text x="${x + cfg.nodePaddingX}" y="${lineY}" class="node-text">${lineaActual}</text>`
          lineY += cfg.titleLineHeight
          lineaActual = palabra
        } else {
          lineaActual = testLine
        }
      })

      if (lineaActual) {
        svg += `<text x="${x + cfg.nodePaddingX}" y="${lineY}" class="node-text">${lineaActual}</text>`
      }

      if (nodo.criterioFinal) {
        const iconCenterX = x + cfg.nodeWidth - cfg.nodePaddingX - cfg.iconCircleSize / 2
        const iconCenterY = y + cfg.nodePaddingY + cfg.iconCircleSize / 2
        const iconRadius = cfg.iconCircleSize / 2

        svg += `<circle cx="${iconCenterX}" cy="${iconCenterY}" r="${iconRadius}" class="icon-circle"/>`

        const arrowSize = cfg.iconSize * 0.5
        if (nodo.beneficio) {
          svg += `<path d="M ${iconCenterX} ${iconCenterY - arrowSize / 2} L ${iconCenterX} ${iconCenterY + arrowSize / 2} M ${iconCenterX - arrowSize / 3} ${iconCenterY - arrowSize / 3} L ${iconCenterX} ${iconCenterY - arrowSize / 2} L ${iconCenterX + arrowSize / 3} ${iconCenterY - arrowSize / 3}" stroke="#22c55e" stroke-width="2" fill="none"/>`
        } else {
          svg += `<path d="M ${iconCenterX} ${iconCenterY + arrowSize / 2} L ${iconCenterX} ${iconCenterY - arrowSize / 2} M ${iconCenterX - arrowSize / 3} ${iconCenterY + arrowSize / 3} L ${iconCenterX} ${iconCenterY + arrowSize / 2} L ${iconCenterX + arrowSize / 3} ${iconCenterY + arrowSize / 3}" stroke="#ef4444" stroke-width="2" fill="none"/>`
        }
      }

      if (nodo.criterioFinal) {
        const minMaxY = y + nodeHeight - cfg.nodePaddingY
        svg += `<text x="${x + cfg.nodePaddingX}" y="${minMaxY}" class="node-min-max">${nodo.min ?? ""}</text>`
        svg += `<text x="${x + cfg.nodeWidth - cfg.nodePaddingX}" y="${minMaxY}" class="node-min-max" text-anchor="end">${nodo.max ?? ""}</text>`
      }
    })

    // Añadir texto "Generado con Calamary" en la esquina inferior izquierda
    const watermarkX = cfg.logoPadding
    const watermarkY = dims.height - cfg.logoPadding
    svg += `<text x="${watermarkX}" y="${watermarkY}" class="watermark-text">Generado con Calamary**</text>`

    svg += "</svg>"
    return svg
  }

  const exportPNG = () => {
    const svgString = generateSVG()
    const blob = new Blob([svgString], { type: "image/svg+xml" })
    const url = URL.createObjectURL(blob)

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      const canvas = document.createElement("canvas")
      const dims = getCanvasDimensions()
      canvas.width = dims.width
      canvas.height = dims.height

      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = "white"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)

        if (logoUrl) {
          const logoImg = new Image()
          logoImg.crossOrigin = "anonymous"
          logoImg.onload = () => {
            const logoX = dims.width - CONFIG.logoSize - CONFIG.logoPadding
            const logoY = dims.height - CONFIG.logoSize - CONFIG.logoPadding
            ctx.drawImage(logoImg, logoX, logoY, CONFIG.logoSize, CONFIG.logoSize)
            finishPNGExport(canvas)
          }
          logoImg.onerror = () => finishPNGExport(canvas)
          logoImg.src = logoUrl
        } else {
          finishPNGExport(canvas)
        }
      }
      URL.revokeObjectURL(url)
    }
    img.src = url
    setShowMenu(false)
  }

  const finishPNGExport = (canvas: HTMLCanvasElement) => {
    canvas.toBlob((blob) => {
      if (blob) {
        const link = document.createElement("a")
        link.href = URL.createObjectURL(blob)
        link.download = `${nombreModelo || "modelo"}.png`
        link.click()
      }
    })
  }

  const exportSVG = () => {
    const svgString = generateSVG()
    const blob = new Blob([svgString], { type: "image/svg+xml" })
    const url = URL.createObjectURL(blob)

    const link = document.createElement("a")
    link.href = url
    link.download = `${nombreModelo || "modelo"}.svg`
    link.click()

    URL.revokeObjectURL(url)
    setShowMenu(false)
  }

    const exportJSON = () => {
    const modeloData = {
      nombreModelo,
      orientacion,
      descripcion,
      metodo,
      linea,
      nodos,
      fechaExportacion: new Date().toISOString()
    }

    const jsonString = JSON.stringify(modeloData, null, 2)
    const blob = new Blob([jsonString], { type: "application/json" })
    const url = URL.createObjectURL(blob)

    const link = document.createElement("a")
    link.href = url
    link.download = `${nombreModelo || "modelo"}.json`
    link.click()

    URL.revokeObjectURL(url)
    setShowMenu(false)
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors text-xs"
      >
        <Download size={16} />
        <span>Exportar</span>
        <ChevronDown size={14} />
      </button>

      {showMenu && (
        <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-[150px]">
          <button
            onClick={exportPNG}
            className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors"
          >
            Exportar PNG
          </button>
          <button
            onClick={exportSVG}
            className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors"
          >
            Exportar SVG
          </button>
          <button
            onClick={exportJSON}
            className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors"
          >
            Exportar json
          </button>
        </div>
      )}
    </div>
  )
}

export default ExportModelo