import React, { useState, useEffect, useRef } from 'react';
import { Download, ChevronDown } from 'lucide-react';

interface Nodo {
  idnodo: number;
  posx: number;
  posy: number;
  titulo: string;
  idpadre: number | null;
  peso?: number;
  min?: number;
  max?: number;
  criterioFinal?: boolean;
  beneficio?: boolean;
}

interface ExportModeloProps {
  nodos: Nodo[];
  orientacion: 'h' | 'v';
  linea: number;
  nombreModelo: string;
}

const ExportModelo: React.FC<ExportModeloProps> = ({ nodos, orientacion, linea, nombreModelo }) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  // ========== CONFIGURACIÓN DE DIMENSIONES ==========
  // Ajusta estos valores para cambiar el tamaño de todo
  const CONFIG = {
    // Dimensiones del nodo
    nodeWidth: 195,        // Ancho fijo del nodo (min-w-[200px] en CustomNodo)
    nodeRadius: 6,         // Radio de las esquinas redondeadas (rounded-md)
    nodeBorderWidth: 2,    // Grosor del borde (border-2)
    
    // Padding del nodo (px-4 py-4 = 16px)
    nodePaddingX: 16,      // Padding horizontal interno
    nodePaddingY: 14,      // Padding vertical interno
    
    // Espaciado del canvas
    canvasPadding: 100,    // Padding alrededor de todo el diagrama
    
    // Texto del título (font-semibold text-sm)
    titleFontSize: 12,     // text-sm = 14px
    titleLineHeight: 20,   // line-height estándar para text-sm
    titleFontWeight: 600,  // font-semibold
    
    // Espaciado entre título e ícono
    titleIconGap: 8,       // ml-2 = 8px (espacio entre título e ícono)
    titleBottomMargin: 8,  // mb-2 = 8px
    
    // Min/Max (text-[11px] mt-1)
    minMaxFontSize: 11,    
    minMaxTopMargin: 4,    // mt-1 = 4px
    minMaxLineHeight: 16,  // altura de línea para min/max
    
    // Iconos (beneficio/costo) - w-6 h-6 con p-1.5
    iconSize: 24,          // w-6 h-6 = 24px
    iconPadding: 6,        // p-1.5 = 6px
    iconCircleSize: 36,    // 24px + (6px * 2)
    
    // Líneas/Edges
    edgeStrokeWidth: 1,    
    edgeLabelFontSize: 12, 
    edgeLabelOffset: 5,    
  };

  // Calcular altura dinámica del nodo basado en el contenido
  const calcularAlturaNodo = (nodo: Nodo) => {
    const cfg = CONFIG;
    let altura = cfg.nodePaddingY * 2; // padding superior e inferior
    
    // Calcular líneas de título con word wrap inteligente
    const anchoDisponible = cfg.nodeWidth - (cfg.nodePaddingX * 2) - (nodo.criterioFinal ? cfg.iconCircleSize + cfg.titleIconGap : 0);
    const charsPerLine = Math.floor(anchoDisponible / (cfg.titleFontSize * 0.6));
    
    const palabras = nodo.titulo.split(' ');
    let numLineas = 1;
    let lineaActual = '';
    
    palabras.forEach((palabra) => {
      const testLine = lineaActual ? lineaActual + ' ' + palabra : palabra;
      
      // Si agregar esta palabra excede el límite
      if (testLine.length > charsPerLine && lineaActual) {
        // Saltar a nueva línea
        numLineas++;
        
        // Verificar si la palabra sola cabe en su propia línea
        if (palabra.length > charsPerLine) {
          // La palabra necesita ser cortada en múltiples líneas
          numLineas += Math.ceil(palabra.length / charsPerLine) - 1;
        }
        
        lineaActual = palabra;
      }
      // Si es la primera palabra y es muy larga
      else if (!lineaActual && palabra.length > charsPerLine) {
        numLineas += Math.ceil(palabra.length / charsPerLine) - 1;
        lineaActual = palabra;
      }
      // Agregar la palabra a la línea actual
      else {
        lineaActual = testLine;
      }
    });
    
    // Altura del título
    altura += numLineas * cfg.titleLineHeight;
    
    // Margen después del título
    altura += cfg.titleBottomMargin;
    
    // Si tiene min/max, agregar espacio
    if (nodo.criterioFinal) {
      altura += cfg.minMaxTopMargin + cfg.minMaxLineHeight;
    }
    
    return Math.max(altura, 60); // Mínimo 60px
  };

  // Calcular dimensiones del canvas
  const getCanvasDimensions = () => {
    if (nodos.length === 0) return { width: 800, height: 600, minX: 0, minY: 0, alturas: {} };

    const padding = CONFIG.canvasPadding;
    const nodeWidth = CONFIG.nodeWidth;
    
    // Calcular alturas para cada nodo
    const alturas: Record<number, number> = {};
    nodos.forEach(nodo => {
      alturas[nodo.idnodo] = calcularAlturaNodo(nodo);
    });

    const minX = Math.min(...nodos.map(n => n.posx)) - padding;
    const minY = Math.min(...nodos.map(n => n.posy)) - padding;
    const maxX = Math.max(...nodos.map(n => n.posx)) + nodeWidth + padding;
    const maxY = Math.max(...nodos.map(n => {
      const altura = alturas[n.idnodo] || 100;
      return n.posy + altura;
    })) + padding;

    return {
      width: maxX - minX,
      height: maxY - minY,
      minX,
      minY,
      alturas
    };
  };

  // Obtener puntos de conexión según orientación
  const getConnectionPoints = (source: Nodo, target: Nodo, alturas: Record<number, number>) => {
    const nodeWidth = CONFIG.nodeWidth;
    const sourceHeight = alturas[source.idnodo] || 100;
    const targetHeight = alturas[target.idnodo] || 100;
    const isHorizontal = orientacion === 'h';
    
    if (isHorizontal) {
      return {
        x1: source.posx + nodeWidth,
        y1: source.posy + sourceHeight / 2,
        x2: target.posx,
        y2: target.posy + targetHeight / 2
      };
    } else {
      return {
        x1: source.posx + nodeWidth / 2,
        y1: source.posy + sourceHeight,
        x2: target.posx + nodeWidth / 2,
        y2: target.posy
      };
    }
  };

  // Generar path según tipo de línea
  const getLinePath = (x1: number, y1: number, x2: number, y2: number) => {
    switch (linea) {
      case 1: // Directa
        return `M ${x1} ${y1} L ${x2} ${y2}`;
      
      case 2: // Escalonada
        const midPoint = orientacion === 'h' ? (x1 + x2) / 2 : (y1 + y2) / 2;
        if (orientacion === 'h') {
          return `M ${x1} ${y1} L ${midPoint} ${y1} L ${midPoint} ${y2} L ${x2} ${y2}`;
        } else {
          return `M ${x1} ${y1} L ${x1} ${midPoint} L ${x2} ${midPoint} L ${x2} ${y2}`;
        }
      
      case 3: // Escalonada suave
        const mid = orientacion === 'h' ? (x1 + x2) / 2 : (y1 + y2) / 2;
        const radius = 10;
        if (orientacion === 'h') {
          return `M ${x1} ${y1} L ${mid - radius} ${y1} Q ${mid} ${y1} ${mid} ${y1 + (y2 > y1 ? radius : -radius)} L ${mid} ${y2 - (y2 > y1 ? radius : -radius)} Q ${mid} ${y2} ${mid + radius} ${y2} L ${x2} ${y2}`;
        } else {
          return `M ${x1} ${y1} L ${x1} ${mid - radius} Q ${x1} ${mid} ${x1 + (x2 > x1 ? radius : -radius)} ${mid} L ${x2 - (x2 > x1 ? radius : -radius)} ${mid} Q ${x2} ${mid} ${x2} ${mid + radius} L ${x2} ${y2}`;
        }
      
      case 4: // Bézier
        const dx = x2 - x1;
        const dy = y2 - y1;
        if (orientacion === 'h') {
          return `M ${x1} ${y1} C ${x1 + dx * 0.5} ${y1}, ${x2 - dx * 0.5} ${y2}, ${x2} ${y2}`;
        } else {
          return `M ${x1} ${y1} C ${x1} ${y1 + dy * 0.5}, ${x2} ${y2 - dy * 0.5}, ${x2} ${y2}`;
        }
      
      default:
        return `M ${x1} ${y1} L ${x2} ${y2}`;
    }
  };

  // Generar SVG
  const generateSVG = () => {
    const dims = getCanvasDimensions();
    const cfg = CONFIG;
    const alturas = dims.alturas;

    let svg = `<svg width="${dims.width}" height="${dims.height}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<defs><style>
      .node-rect { fill: white; stroke: black; stroke-width: ${cfg.nodeBorderWidth}; }
      .node-text { font-family: Arial, sans-serif; font-size: ${cfg.titleFontSize}px; fill: #1f2937; font-weight: ${cfg.titleFontWeight}; }
      .node-min-max { font-family: Arial, sans-serif; font-size: ${cfg.minMaxFontSize}px; fill: #374151; }
      .edge-line { stroke: #64748b; stroke-width: ${cfg.edgeStrokeWidth}; fill: none; }
      .edge-label { font-family: Arial, sans-serif; font-size: ${cfg.edgeLabelFontSize}px; fill: black; font-weight: 600; }
      .icon-circle { fill: white; stroke: #e5e7eb; stroke-width: 1; }
    </style></defs>`;

    // Dibujar edges
    nodos.forEach(nodo => {
      if (nodo.idpadre !== null) {
        const padre = nodos.find(n => n.idnodo === nodo.idpadre);
        if (padre) {
          const points = getConnectionPoints(padre, nodo, alturas);
          const path = getLinePath(
            points.x1 - dims.minX,
            points.y1 - dims.minY,
            points.x2 - dims.minX,
            points.y2 - dims.minY
          );
          
          svg += `<path d="${path}" class="edge-line"/>`;
          
          // Label con peso
          if (nodo.peso) {
            const midX = (points.x1 + points.x2) / 2 - dims.minX;
            const midY = (points.y1 + points.y2) / 2 - dims.minY;
            svg += `<text x="${midX}" y="${midY - cfg.edgeLabelOffset}" class="edge-label" text-anchor="middle">${nodo.peso.toFixed(2)}</text>`;
          }
        }
      }
    });

    // Dibujar nodos
    nodos.forEach(nodo => {
      const x = nodo.posx - dims.minX;
      const y = nodo.posy - dims.minY;
      const nodeHeight = alturas[nodo.idnodo] || 100;

      svg += `<rect x="${x}" y="${y}" width="${cfg.nodeWidth}" height="${nodeHeight}" rx="${cfg.nodeRadius}" class="node-rect"/>`;
      
      // Título con word wrap inteligente: salta en espacios, corta palabras largas
      const anchoTexto = cfg.nodeWidth - (cfg.nodePaddingX * 2) - (nodo.criterioFinal ? cfg.iconCircleSize + cfg.titleIconGap : 0);
      const charsPerLine = Math.floor(anchoTexto / (cfg.titleFontSize * 0.6));
      
      const palabras = nodo.titulo.split(' ');
      let lineY = y + cfg.nodePaddingY + cfg.titleLineHeight;
      let lineaActual = '';
      
      palabras.forEach((palabra, index) => {
        const testLine = lineaActual ? lineaActual + ' ' + palabra : palabra;
        
        // Si la palabra sola es más larga que el ancho disponible
        if (palabra.length > charsPerLine) {
          // Escribir lo que hay en la línea actual
          if (lineaActual) {
            svg += `<text x="${x + cfg.nodePaddingX}" y="${lineY}" class="node-text">${lineaActual}</text>`;
            lineY += cfg.titleLineHeight;
          }
          
          // Cortar la palabra en múltiples líneas
          let palabraRestante = palabra;
          while (palabraRestante.length > 0) {
            const chunk = palabraRestante.substring(0, charsPerLine);
            svg += `<text x="${x + cfg.nodePaddingX}" y="${lineY}" class="node-text">${chunk}</text>`;
            palabraRestante = palabraRestante.substring(charsPerLine);
            if (palabraRestante.length > 0) {
              lineY += cfg.titleLineHeight;
            }
          }
          
          lineaActual = '';
        }
        // Si agregar esta palabra excede el límite, saltar a nueva línea
        else if (testLine.length > charsPerLine && lineaActual) {
          svg += `<text x="${x + cfg.nodePaddingX}" y="${lineY}" class="node-text">${lineaActual}</text>`;
          lineY += cfg.titleLineHeight;
          lineaActual = palabra;
        }
        // Agregar la palabra a la línea actual
        else {
          lineaActual = testLine;
        }
      });
      
      // Escribir la última línea si existe
      if (lineaActual) {
        svg += `<text x="${x + cfg.nodePaddingX}" y="${lineY}" class="node-text">${lineaActual}</text>`;
      }

      // Icono si es criterio final (posición absoluta en la esquina superior derecha)
      if (nodo.criterioFinal) {
        const iconCenterX = x + cfg.nodeWidth - cfg.nodePaddingX - (cfg.iconCircleSize / 2);
        const iconCenterY = y + cfg.nodePaddingY + (cfg.iconCircleSize / 2);
        const iconRadius = cfg.iconCircleSize / 2;
        
        svg += `<circle cx="${iconCenterX}" cy="${iconCenterY}" r="${iconRadius}" class="icon-circle"/>`;
        
        // Flecha (ajustada al tamaño del ícono)
        const arrowSize = cfg.iconSize * 0.5;
        if (nodo.beneficio) {
          // Flecha hacia arriba (beneficio)
          svg += `<path d="M ${iconCenterX} ${iconCenterY - arrowSize/2} L ${iconCenterX} ${iconCenterY + arrowSize/2} M ${iconCenterX - arrowSize/3} ${iconCenterY - arrowSize/3} L ${iconCenterX} ${iconCenterY - arrowSize/2} L ${iconCenterX + arrowSize/3} ${iconCenterY - arrowSize/3}" stroke="#22c55e" stroke-width="2" fill="none"/>`;
        } else {
          // Flecha hacia abajo (costo)
          svg += `<path d="M ${iconCenterX} ${iconCenterY + arrowSize/2} L ${iconCenterX} ${iconCenterY - arrowSize/2} M ${iconCenterX - arrowSize/3} ${iconCenterY + arrowSize/3} L ${iconCenterX} ${iconCenterY + arrowSize/2} L ${iconCenterX + arrowSize/3} ${iconCenterY + arrowSize/3}" stroke="#ef4444" stroke-width="2" fill="none"/>`;
        }
      }

      // Min y Max (en la parte inferior)
      if (nodo.criterioFinal) {
        const minMaxY = y + nodeHeight - cfg.nodePaddingY;
        svg += `<text x="${x + cfg.nodePaddingX}" y="${minMaxY}" class="node-min-max">${nodo.min ?? ''}</text>`;
        svg += `<text x="${x + cfg.nodeWidth - cfg.nodePaddingX}" y="${minMaxY}" class="node-min-max" text-anchor="end">${nodo.max ?? ''}</text>`;
      }
    });

    svg += '</svg>';
    return svg;
  };

  // Exportar como PNG
  const exportPNG = () => {
    const svgString = generateSVG();
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const dims = getCanvasDimensions();
      canvas.width = dims.width;
      canvas.height = dims.height;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${nombreModelo || 'modelo'}.png`;
            link.click();
          }
        });
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
    setShowMenu(false);
  };

  // Exportar como SVG
  const exportSVG = () => {
    const svgString = generateSVG();
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${nombreModelo || 'modelo'}.svg`;
    link.click();
    
    URL.revokeObjectURL(url);
    setShowMenu(false);
  };

  // Exportar como PDF (simplificado - en producción usar jsPDF o similar)
  const exportPDF = () => {
    alert('Para exportar PDF necesitarías instalar jsPDF. Por ahora, usa PNG o SVG.');
    setShowMenu(false);
  };

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
          {/* <button
            onClick={exportPDF}
            className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors"
          >
            Exportar PDF
          </button> */}
        </div>
      )}
    </div>
  );
};

export default ExportModelo;