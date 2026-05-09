"use client"

import { useState, useEffect, useRef } from "react"
import type { MAUTConfig } from "@/types/modelo"
import { useTranslation } from "react-i18next"
import { useNotification } from "@/components/NotificationProvider"
import { BarChart2, Play, AlertTriangle, CheckCircle } from "lucide-react"
import BotonAyuda from "@/components/BotonAyuda"

// ─── Constantes ────────────────────────────────────────────────────────────────

const ALLOWED_TOKENS = [
  "=", "+", "-", "*", "/", "**", "%", "(", ")", ":", ".", ",",
  "x", "return", "if", "else", "elif", "and", "or", "not",
  "True", "False",
  "abs", "round", "min", "max", "sqrt", "log", "log2", "log10",
  "exp", "sin", "cos", "tan", "asin", "acos", "atan",
  "floor", "ceil", "pi", "e",
  "0","1","2","3","4","5","6","7","8","9",
  " ", "\n", "\t",
]

const FORBIDDEN_PATTERNS = [
  /import\s/,
  /exec\s*\(/,
  /eval\s*\(/,
  /__\w+__/,
  /open\s*\(/,
  /print\s*\(/,
  /input\s*\(/,
  /os\./,
  /sys\./,
  /subprocess/,
  /lambda/,
  /while\s/,
  /for\s/,
  /class\s/,
  /def\s/,
  /global\s/,
  /\[\s*\]/,
  /\{\s*\}/,
  // Keywords de JavaScript — dan error confuso en el backend
  /\blet\s/,
  /\bvar\s/,
  /\bconst\s/,
]

// ─── Normalización de funciones matemáticas ────────────────────────────────────

/**
 * Lista de funciones matemáticas soportadas, en orden seguro para reemplazar
 * (log2/log10 antes que log, para no convertir "log" dentro de "log2").
 */
const MATH_FNS = [
  "sqrt", "log2", "log10", "log", "exp",
  "sin", "cos", "tan", "asin", "acos", "atan",
  "floor", "ceil", "abs", "round",
]

/**
 * Normaliza el código Python para que las funciones matemáticas sueltas
 * (exp, sqrt, etc.) queden como math.exp, math.sqrt, etc.
 * Así el backend puede ejecutar el código con `math` disponible.
 * No toca lo que ya empiece con "math." para evitar "math.math.exp".
 */
function normalizarParaBackend(codigo: string): string {
  let result = codigo
  for (const fn of MATH_FNS) {
    result = result.replace(
      new RegExp(`(?<!math\\.)\\b${fn}\\b`, "g"),
      `math.${fn}`
    )
  }
  // Constantes
  result = result.replace(/(?<!math\.)\bpi\b/g, "math.pi")
  // "e" solo si no es parte de una asignación (ej: "e = algo") ni de "elif/else/exp"
  result = result.replace(/(?<!math\.)(?<![a-zA-Z0-9_])\be\b(?![a-zA-Z0-9_=])/g, "math.e")
  return result
}

// ─── Transpilador Python → JS (subset seguro) ──────────────────────────────────

function pythonToJS(code: string): string {
  let js = code

  // 1. Eliminar comentarios Python (# ...)
  js = js.split("\n").map(line => {
    const commentIdx = line.indexOf("#")
    return commentIdx >= 0 ? line.slice(0, commentIdx) : line
  }).join("\n")

  // 2. Constantes matemáticas — solo las que NO tengan "math." delante
  js = js.replace(/(?<!math\.)\bpi\b/g, "Math.PI")
  js = js.replace(/(?<!math\.)(?<![a-zA-Z0-9_])\be\b(?![a-zA-Z0-9_=])/g, "Math.E")

  // 3. Funciones matemáticas → Math.*
  //    Primero convierte "math.exp" → "Math.exp" (código ya normalizado del backend),
  //    luego convierte "exp" suelto → "Math.exp".
  //    Orden: log2/log10 antes que log para no pisar subcadenas.
  const mathFns = [
    "sqrt", "log2", "log10", "log", "exp",
    "sin", "cos", "tan", "asin", "acos", "atan",
    "floor", "ceil", "abs", "round", "min", "max",
  ]
  // Paso 3a: math.fn → Math.fn  (código que ya viene normalizado)
  js = js.replace(/\bmath\.(\w+)/g, (_, fn) => `Math.${fn}`)
  // Paso 3b: fn suelto → Math.fn  (código que el usuario escribe sin prefijo)
  for (const fn of mathFns) {
    js = js.replace(new RegExp(`(?<!Math\\.)\\b${fn}\\b`, "g"), `Math.${fn}`)
  }

  // 4. Booleanos y operadores lógicos Python → JS
  js = js.replace(/\bTrue\b/g, "true")
  js = js.replace(/\bFalse\b/g, "false")
  js = js.replace(/\band\b/g, "&&")
  js = js.replace(/\bor\b/g, "||")
  js = js.replace(/\bnot\b/g, "!")

  // 5. if / elif / else → bloques JS
  const lines = js.split("\n")
  const jsLines: string[] = []
  for (const line of lines) {
    let l = line
    l = l.replace(/^(\s*)elif\s+(.+):\s*$/, "$1} else if ($2) {")
    l = l.replace(/^(\s*)if\s+(.+):\s*$/, "$1if ($2) {")
    l = l.replace(/^(\s*)else\s*:\s*$/, "$1} else {")
    jsLines.push(l)
  }

  // 6. Cerrar bloques abiertos por indentación
  const withBlocks = closeBlocks(jsLines)

  // 7. Declarar variables locales con "let"
  //    En "use strict" dentro de new Function, asignar una variable no declarada
  //    lanza ReferenceError. Detectamos la PRIMERA asignación de cada nombre
  //    y le anteponemos "let ".
  const ASSIGN = /^(\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*=(?![=>])/
  const declared = new Set<string>(["x"]) // "x" es el parámetro, no declarar

  return withBlocks.split("\n").map(line => {
    const trimmed = line.trimStart()
    if (
      !trimmed ||
      trimmed.startsWith("return") ||
      trimmed.startsWith("if") ||
      trimmed.startsWith("} else") ||
      trimmed.startsWith("}") ||
      trimmed.startsWith("{")
    ) {
      return line
    }
    const m = ASSIGN.exec(line)
    if (m) {
      const varName = m[2]
      if (!declared.has(varName)) {
        declared.add(varName)
        return `${m[1]}let ${line.slice(m[1].length)}`
      }
    }
    return line
  }).join("\n")
}

/**
 * Cierra automáticamente los bloques if/else basándose en la indentación.
 */
function closeBlocks(lines: string[]): string {
  const out: string[] = []
  const indentStack: number[] = [0]

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trimStart()
    if (trimmed === "") { out.push(line); continue }
    const indent = line.length - trimmed.length

    while (indentStack.length > 1 && indent < indentStack[indentStack.length - 1]) {
      indentStack.pop()
      if (!trimmed.startsWith("}")) {
        out.push(" ".repeat(indent) + "}")
      }
    }

    out.push(line)

    if (trimmed.endsWith("{")) {
      indentStack.push(indent + 2)
    }
  }
  while (indentStack.length > 1) {
    indentStack.pop()
    out.push("}")
  }
  return out.join("\n")
}

// ─── Evaluador seguro ──────────────────────────────────────────────────────────

function evaluarFuncion(codigo: string, x: number): { result: number | null; error: string | null } {
  console.group(`[MAUT] evaluarFuncion(x=${x})`)
  try {
    console.log("[MAUT] Código Python recibido:\n", codigo)

    const jsCode = pythonToJS(codigo)
    console.log("[MAUT] Código JS transpilado:\n", jsCode)

    let fn: Function
    try {
      fn = new Function("x", `
        "use strict";
        try {
          ${jsCode}
        } catch (e) {
          throw e;
        }
      `)
      console.log("[MAUT] new Function() creada OK")
    } catch (syntaxErr: any) {
      console.error("[MAUT] ERROR al compilar new Function():", syntaxErr.message)
      console.groupEnd()
      return { result: null, error: `Error de sintaxis JS: ${syntaxErr.message}` }
    }

    let result: any
    try {
      result = fn(x)
      console.log("[MAUT] Resultado de fn(x):", result, "| tipo:", typeof result)
    } catch (runtimeErr: any) {
      console.error("[MAUT] ERROR en tiempo de ejecución:", runtimeErr.message)
      console.groupEnd()
      return { result: null, error: `Error en ejecución: ${runtimeErr.message}` }
    }

    if (typeof result !== "number" || !isFinite(result)) {
      console.warn("[MAUT] Resultado no es número finito:", result)
      console.groupEnd()
      return { result: null, error: `La función devolvió '${result}' (${typeof result}), se esperaba número entre 0 y 1.` }
    }

    console.log("[MAUT] OK — resultado válido:", result)
    console.groupEnd()
    return { result, error: null }
  } catch (err: any) {
    console.error("[MAUT] ERROR inesperado:", err)
    console.groupEnd()
    return { result: null, error: err.message }
  }
}

// ─── Validador de seguridad ────────────────────────────────────────────────────

function validarCodigo(codigo: string): string | null {
  // Detectar keywords JS con mensaje específico antes de los patrones genéricos
  if (/\blet\s/.test(codigo) || /\bvar\s/.test(codigo) || /\bconst\s/.test(codigo)) {
    return "Usa Python, no JavaScript. Escribe 'ideal = 35' en vez de 'let ideal = 35'."
  }
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(codigo)) {
      return `Operación no permitida detectada: ${pattern.toString()}`
    }
  }
  if (codigo.trim().length === 0) {
    return "El cuerpo de la función no puede estar vacío."
  }
  if (!codigo.includes("return")) {
    return "La función debe incluir una sentencia 'return'."
  }
  if (/\b\d+,\d+\b/.test(codigo)) {
    return "Usa punto decimal, no coma. Escribe 0.5 en vez de 0,5."
  }
  return null
}

// ─── Componente principal ──────────────────────────────────────────────────────

interface ProgrammedFunctionConfigProps {
  min: number
  max: number
  initialConfig?: MAUTConfig
  onConfigChange: (config: MAUTConfig) => void
  nodeId: number
}

const CODIGO_INICIAL = `# Puedes usar: abs, round, min, max, sqrt, log, log2, log10,
# exp, sin, cos, tan, floor, ceil, pi, e
# Operadores: + - * / ** %  |  Condicionales: if / elif / else

return 1 / (1 + exp(-0.1 * (x - 50)))`

export default function ProgrammedFunctionConfig({
  min,
  max,
  initialConfig,
  onConfigChange,
  nodeId,
}: ProgrammedFunctionConfigProps) {
  const lastNodeId = useRef<number | null>(null)

  const getInitialCode = () => {
    if (initialConfig?.tipoFuncion === "programada" && initialConfig.funcionProgramada?.codigo) {
      return initialConfig.funcionProgramada.codigo
    }
    return CODIGO_INICIAL
  }

  const [codigo, setCodigo] = useState<string>(getInitialCode)
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null)
  const [puntos, setPuntos] = useState<Array<{ x: number; y: number }>>([])
  const [graficaVisible, setGraficaVisible] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const { t } = useTranslation()
  const { notify } = useNotification()

  useEffect(() => {
    if (lastNodeId.current !== nodeId) {
      lastNodeId.current = nodeId
      setCodigo(getInitialCode())
      setGraficaVisible(false)
      setPuntos([])
      setErrorValidacion(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, initialConfig])

  const dibujarGrafica = (pts: Array<{ x: number; y: number }>) => {
    console.log("[MAUT] dibujarGrafica — pts.length:", pts.length)
    const canvas = canvasRef.current
    if (!canvas || pts.length === 0) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    const PAD = { top: 20, right: 20, bottom: 40, left: 50 }
    const innerW = W - PAD.left - PAD.right
    const innerH = H - PAD.top - PAD.bottom

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = "#f9fafb"
    ctx.fillRect(0, 0, W, H)

    ctx.strokeStyle = "#e5e7eb"
    ctx.lineWidth = 1
    for (let i = 0; i <= 5; i++) {
      const yPos = PAD.top + (i / 5) * innerH
      ctx.beginPath()
      ctx.moveTo(PAD.left, yPos)
      ctx.lineTo(PAD.left + innerW, yPos)
      ctx.stroke()
      ctx.fillStyle = "#6b7280"
      ctx.font = "11px monospace"
      ctx.textAlign = "right"
      ctx.fillText((1 - i / 5).toFixed(1), PAD.left - 6, yPos + 4)
    }
    for (let i = 0; i <= 5; i++) {
      const xPos = PAD.left + (i / 5) * innerW
      ctx.beginPath()
      ctx.moveTo(xPos, PAD.top)
      ctx.lineTo(xPos, PAD.top + innerH)
      ctx.stroke()
      const xVal = min + (i / 5) * (max - min)
      ctx.fillStyle = "#6b7280"
      ctx.font = "11px monospace"
      ctx.textAlign = "center"
      ctx.fillText(xVal.toFixed(1), xPos, PAD.top + innerH + 18)
    }

    ctx.strokeStyle = "#9ca3af"
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(PAD.left, PAD.top)
    ctx.lineTo(PAD.left, PAD.top + innerH)
    ctx.lineTo(PAD.left + innerW, PAD.top + innerH)
    ctx.stroke()

    const toCanvasX = (x: number) => PAD.left + ((x - min) / (max - min)) * innerW
    const toCanvasY = (y: number) => PAD.top + (1 - y) * innerH

    ctx.beginPath()
    ctx.strokeStyle = "#3b82f6"
    ctx.lineWidth = 2.5
    ctx.lineJoin = "round"
    pts.forEach((p, i) => {
      const cx = toCanvasX(p.x)
      const cy = toCanvasY(p.y)
      if (i === 0) ctx.moveTo(cx, cy)
      else ctx.lineTo(cx, cy)
    })
    ctx.stroke()

    ctx.beginPath()
    pts.forEach((p, i) => {
      const cx = toCanvasX(p.x)
      const cy = toCanvasY(p.y)
      if (i === 0) ctx.moveTo(cx, cy)
      else ctx.lineTo(cx, cy)
    })
    ctx.lineTo(toCanvasX(pts[pts.length - 1].x), PAD.top + innerH)
    ctx.lineTo(toCanvasX(pts[0].x), PAD.top + innerH)
    ctx.closePath()
    ctx.fillStyle = "rgba(59,130,246,0.08)"
    ctx.fill()

    ctx.fillStyle = "#374151"
    ctx.font = "bold 11px monospace"
    ctx.textAlign = "center"
    ctx.fillText("x", PAD.left + innerW / 2, H - 4)
    ctx.save()
    ctx.translate(12, PAD.top + innerH / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText("u(x)", 0, 0)
    ctx.restore()
  }

  const generarPuntos = () => {
    console.group("[MAUT] generarPuntos()")

    const validationError = validarCodigo(codigo)
    if (validationError) {
      setErrorValidacion(validationError)
      setPuntos([])
      setGraficaVisible(false)
      console.groupEnd()
      return
    }

    setErrorValidacion(null)

    const xPrueba = min + (max - min) / 2
    // La gráfica evalúa con el código tal como el usuario lo escribe
    // (pythonToJS se encarga de convertir exp → Math.exp para el sandbox JS)
    const prueba = evaluarFuncion(codigo, xPrueba)
    if (prueba.result === null) {
      setErrorValidacion(prueba.error ?? "Error evaluando la función.")
      setPuntos([])
      setGraficaVisible(false)
      console.groupEnd()
      return
    }

    const steps = 120
    const nuevoPuntos: Array<{ x: number; y: number }> = []
    let primerError: string | null = null

    for (let i = 0; i <= steps; i++) {
      const x = min + (i / steps) * (max - min)
      const { result, error } = evaluarFuncion(codigo, x)
      if (result === null) {
        primerError = error ?? "La función generó un error al evaluarse."
        break
      }
      nuevoPuntos.push({ x, y: Math.max(0, Math.min(1, result)) })
    }

    if (primerError) {
      setErrorValidacion(primerError)
      setPuntos([])
      setGraficaVisible(false)
    } else {
      setPuntos(nuevoPuntos)
      setGraficaVisible(true)
      setTimeout(() => {
        dibujarGrafica(nuevoPuntos)
        console.groupEnd()
      }, 0)
    }
  }

  const handleGuardar = () => {
    const error = validarCodigo(codigo)
    if (error) {
      notify(t('alertas.cuidado'), "warning", error)
      return
    }

    // Verificar que la función evalúa correctamente en el sandbox JS
    // usando el código original (sin normalizar), ya que pythonToJS
    // convierte exp → Math.exp internamente para el navegador.
    const { result: testY, error: testError } = evaluarFuncion(codigo, (min + max) / 2)
    if (testY === null) {
      notify(t('alertas.cuidado'), "warning", testError ?? "La función no pudo evaluarse correctamente. Verifica la sintaxis.")
      return
    }

    // Normalizar para el backend: exp → math.exp, pi → math.pi, etc.
    // El backend ejecuta con `{"math": math}`, así que necesita el prefijo.
    const codigoNormalizado = normalizarParaBackend(codigo)

    const newConfig: MAUTConfig = {
      tipoFuncion: "programada",
      funcionProgramada: {
        codigo: codigoNormalizado.trim(),
      },
      funcionSimple: undefined,
      funcionDual: undefined,
      funcionDiscreta: undefined,
    }
    onConfigChange(newConfig)
    notify(t('alertas.exito'), "success", t('generic.cguardad'))
  }

  return (
    <div>
      {/* Encabezado */}
      <div className="flex items-center p-4">
        <h3 className="text-lg font-semibold text-gray-700">
          {t('programada.titulo', 'Función de utilidad programada')}
        </h3>
        <div className="flex-1 flex justify-end items-center relative">
          <BotonAyuda route="/docs/programmedfunction#crear-programada">
            {t('programada.ayuda', 'Ayuda')}
          </BotonAyuda>
        </div>
      </div>

      <p className="text-sm text-gray-500 px-4 mb-3">
        {t(
          'programada.indicaciones',
          'Define el cuerpo de la función de utilidad en Python. Recibirás el valor x del criterio y deberás retornar un número entre 0 y 1.'
        )}
      </p>

      {/* Cabecera de la función (no editable) */}
      <div className="mx-4 mb-1">
        <div className="bg-gray-800 text-green-400 font-mono text-sm px-4 py-2 rounded-t-md border-b border-gray-700 select-none">
          <span className="text-blue-400">def</span>{" "}
          <span className="text-yellow-300">utilidad</span>
          <span className="text-white">(</span>
          <span className="text-orange-300">x</span>
          <span className="text-white">: float) -&gt; float:</span>
          <span className="ml-4 text-gray-500">
            # x ∈ [{min}, {max}]
          </span>
        </div>

        {/* Editor de código */}
        <div className="relative">
          <textarea
            value={codigo}
            onChange={(e) => {
              setCodigo(e.target.value)
              setErrorValidacion(null)
              setGraficaVisible(false)
            }}
            spellCheck={false}
            rows={10}
            className={`w-full font-mono text-sm bg-gray-900 text-gray-100 p-4 pl-8 rounded-b-md border-2 resize-y focus:outline-none transition-colors ${
              errorValidacion
                ? "border-red-500 focus:border-red-400"
                : "border-gray-700 focus:border-blue-500"
            }`}
            style={{ tabSize: 4, minHeight: "180px" }}
            placeholder={`    return 1 / (1 + exp(-0.1 * (x - 50)))`}
          />
          <span className="absolute top-3 left-2 text-gray-600 font-mono text-sm select-none">
            ▸
          </span>
        </div>
      </div>

      {/* Mensaje de error de validación */}
      {errorValidacion && (
        <div className="mx-4 mb-3 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{errorValidacion}</span>
        </div>
      )}

      {/* Advertencia de operaciones permitidas */}
      <div className="mx-4 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-700 text-xs">
        <strong>{t('programada.permitido', 'Permitido')}:</strong>{" "}
        {t(
          'programada.listapermitidos',
          'abs, round, min, max, sqrt, log, log2, log10, exp, sin, cos, tan, asin, acos, atan, floor, ceil, pi, e — operadores básicos (+, -, *, /, **, %) — if / elif / else'
        )}
        <br />
        <strong>{t('programada.prohibido', 'No permitido')}:</strong>{" "}
        {t(
          'programada.listaprohibidos',
          'import, exec, eval, for, while, def, class, listas, diccionarios, print, input, acceso a módulos'
        )}
      </div>

      {/* Botón de previsualizar gráfica */}
      <div className="px-4 mb-4">
        <button
          onClick={generarPuntos}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white text-sm rounded-md hover:bg-indigo-600 transition-colors"
        >
          <BarChart2 className="h-4 w-4" />
          {t('programada.vergrafica', 'Previsualizar gráfica')}
        </button>
      </div>

      {/* Canvas de la gráfica */}
      <div
        className="mx-4 mb-4 border border-gray-200 rounded-md overflow-hidden bg-gray-50"
        style={{ display: graficaVisible && puntos.length > 0 ? "block" : "none" }}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-white text-sm text-gray-600">
          <CheckCircle className="h-4 w-4 text-green-500" />
          {t('programada.graficaok', 'Función evaluada correctamente — u(x) ∈ [0, 1]')}
        </div>
        <div className="p-3 flex justify-center">
          <canvas
            ref={canvasRef}
            width={560}
            height={260}
            className="max-w-full"
            style={{ display: "block" }}
          />
        </div>
      </div>

      {/* Botón Guardar */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={handleGuardar}
          className="w-full sm:w-auto px-4 py-2 bg-blue-500 text-white rounded font-medium hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
        >
          {t('botones.guardar')}
        </button>
      </div>
    </div>
  )
}