"use client"

import React, { useEffect, useState, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Header from "@/components/Header"
import { Input, Button, message, Form, Card, Space, Table } from "antd"
import { PlayCircleOutlined, SaveOutlined, AlignLeftOutlined } from "@ant-design/icons"
import { useAuthContext } from "@/context/AuthProvider"

interface Resultados {
  matriz_normalizada: number[][]
  matriz_ponderada: number[][]
  puntuaciones: number[]
  ranking: number[]
}

export default function CrearMetodoPage() {
  const router = useRouter()
  const params = useParams()
const idMetodo = params?.id && params.id !== "crear" ? params.id : null
  const { user, loading } = useAuthContext()

  const [isAdmin, setIsAdmin] = useState(false)
  const [nombre, setNombre] = useState("")
  const [descripcion, setDescripcion] = useState("")

  const [normalizarBody, setNormalizarBody] = useState(
    `    """
    Normaliza la matriz según los tipos de criterio ('max' o 'min').
    """
    matrix = np.array(matrix, dtype=float)
    tipos = np.array(tipos)
    norm = np.zeros_like(matrix, dtype=float)
    
    for j in range(matrix.shape[1]):
        if tipos[j] == "max":
            norm[:, j] = matrix[:, j] / matrix[:, j].max()
        else:
            norm[:, j] = matrix[:, j].min() / matrix[:, j]
    
    return norm.tolist()`
  )

  const [agregarBody, setAgregarBody] = useState(
    `    """
    Calcula la puntuación agregada sumando los productos ponderados.
    """
    matrix = np.array(matrix, dtype=float)
    weights = np.array(weights, dtype=float)
    scores = np.sum(matrix * weights, axis=1)
    return scores.tolist()`
  )

  const [extraFuncs, setExtraFuncs] = useState(
    `# Puedes definir funciones auxiliares aquí, pero solo deben ser usadas dentro de las dos principales.`
  )

  const [testResult, setTestResult] = useState("")
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [resultadoTest, setResultadoTest] = useState<Resultados | null>(null)

  useEffect(() => {
    if (!loading && !user) router.push("/login")
    if (user) verificarAdmin()
  }, [user, loading])

  const verificarAdmin = async () => {
    try {
      const { data } = await supabase
        .from("administradores")
        .select("id")
        .eq("usuario", user?.id)
        .maybeSingle()
      setIsAdmin(!!data)
      if (!data) router.push("/")
      if (idMetodo) cargarMetodo(idMetodo)
    } catch {
      setIsAdmin(false)
    }
  }

  const cargarMetodo = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from("metodos")
        .select("nombre, descripcion, codigo")
        .eq("id", id)
        .maybeSingle()

      if (error || !data) throw new Error("No se pudo cargar el método")

      setNombre(data.nombre)
      setDescripcion(data.descripcion)

      // Separar partes del código
      const codigo = data.codigo || ""
      const normMatch = codigo.match(/def normalizar\(.*?\):([\s\S]*?)def agregar/)
      const aggMatch = codigo.match(/def agregar\(.*?\):([\s\S]*)/)
      const extraMatch = codigo.match(/# Puedes definir[\s\S]*/)

      setNormalizarBody(normMatch ? normMatch[1].trimEnd() : "")
      setAgregarBody(aggMatch ? aggMatch[1].trimEnd() : "")
      setExtraFuncs(extraMatch ? extraMatch[0].trimEnd() : "")
    } catch (err) {
      console.error(err)
      message.error("Error al cargar el método.")
    }
  }

  // 🔹 Construir código final
  const buildCodigo = () => {
    return `import numpy as np

def normalizar(matrix, tipos):
${normalizarBody}

def agregar(matrix, weights):
${agregarBody}

${extraFuncs}
`
  }

  // 🔹 Tab para indentar
  const handleTabKey = (e: React.KeyboardEvent<HTMLTextAreaElement>, setter: any) => {
    if (e.key === "Tab") {
      e.preventDefault()
      const target = e.target as HTMLTextAreaElement
      const start = target.selectionStart
      const end = target.selectionEnd
      const newValue = target.value.substring(0, start) + "    " + target.value.substring(end)
      setter(newValue)
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 4
      }, 0)
    }
  }

  // 🔹 Formatear código
  const formatCode = (code: string) => {
    const lines = code.split("\n")
    const formatted: string[] = []
    let indent = 0
    for (let line of lines) {
      const trimmed = line.trim()
      if (!trimmed) {
        formatted.push("")
        continue
      }
      if (
        trimmed.startsWith("return") ||
        trimmed.startsWith("else") ||
        trimmed.startsWith("elif") ||
        trimmed.startsWith("except") ||
        trimmed.startsWith("finally")
      ) {
        indent = Math.max(indent - 1, 0)
      }
      formatted.push("    ".repeat(indent) + trimmed)
      if (trimmed.endsWith(":")) indent++
    }
    return formatted.join("\n")
  }

  const probarCodigo = async () => {
    setTesting(true)
    setResultadoTest(null)
    setTestResult("")
    const codigo = buildCodigo()

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_URLFASTCALAMARY}/test-metodo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo,
          matrix: [
            [1, 2, 3],
            [4, 5, 6],
            [7, 8, 9],
          ],
          weights: [0.3, 0.5, 0.2],
          tipos: ["max", "max", "min"],
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || "Error desconocido")

      const matrizNormalizada = data.normalizar
      const scores = data.agregar
      const matrizPonderada = matrizNormalizada.map((fila: number[], idx: number) =>
        fila.map((val, j) => val * [0.3, 0.5, 0.2][j])
      )
      const combinedData = scores.map((score: number, idx: number) => ({
        score,
        idx,
        nombre: `Alt ${idx + 1}`,
        matrizNormalizada: matrizNormalizada[idx],
      }))
      combinedData.sort((a, b) => b.score - a.score)
      const alternativasOrdenadas = combinedData.map((item) => ({ key: `alt-${item.idx}`, nombre: item.nombre }))
      const puntuacionesOrdenadas = combinedData.map((item) => item.score)
      const ranking = combinedData.map((_, i) => i + 1)

      setResultadoTest({
        matriz_normalizada: matrizNormalizada,
        matriz_ponderada: matrizPonderada,
        puntuaciones: puntuacionesOrdenadas,
        ranking,
      })

      setTestResult(`✅ Prueba completada con éxito.`)
    } catch (err) {
      setTestResult(`❌ Error: ${String(err)}`)
    } finally {
      setTesting(false)
    }
  }

  // 🔹 Guardar o editar método
  const guardarMetodo = async () => {
    if (!nombre.trim() || !descripcion.trim()) {
      message.error("Debes ingresar nombre y descripción.")
      return
    }

    const codigoFinal = buildCodigo()
    setSaving(true)

    try {
      if (idMetodo) {
        const { error } = await supabase.rpc("editar_metodo", {
          p_id: idMetodo,
          p_nombre: nombre,
          p_descripcion: descripcion,
          p_codigo: codigoFinal,
        })
        if (error) throw error
        message.success("Método actualizado exitosamente.")
      } else {
        const { error } = await supabase.rpc("crear_metodo", {
          p_nombre: nombre,
          p_descripcion: descripcion,
          p_codigo: codigoFinal,
        })
        if (error) throw error
        message.success("Método creado exitosamente.")
      }

      router.push("/metodos")
    } catch (err: any) {
      message.error(err.message || "Error al guardar método.")
    } finally {
      setSaving(false)
    }
  }

  if (loading || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" style={{ width: 40, height: 40 }}></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--surface-color)" }}>
      <Header />
      <main className="container py-6">
        <Card title={idMetodo ? "Editar Método" : "Crear Nuevo Método"} className="shadow-md">
          <Form layout="vertical">
            <Form.Item label="Nombre del método" required>
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ejemplo: SAW, TOPSIS, MOORA..."
              />
            </Form.Item>

            <Form.Item label="Descripción" required>
              <Input.TextArea
                rows={3}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Explica brevemente qué hace este método"
              />
            </Form.Item>

            <Form.Item label="Código Python">
              <p className="text-sm text-secondary mb-2">
                🔹 Los encabezados de las funciones son fijos, puedes editar solo el contenido.
                Usa <b>Tab</b> para indentar y <b>Formatear Código</b> para corregir sangrías.
              </p>

              <pre className="font-mono text-sm bg-gray-100 p-2 rounded mb-2">
                import numpy as np
              </pre>

              <pre className="font-mono text-sm bg-gray-100 p-2 rounded-t">
                def normalizar(matrix, tipos):
              </pre>
              <textarea
                rows={10}
                value={normalizarBody}
                onChange={(e) => setNormalizarBody(e.target.value)}
                onKeyDown={(e) => handleTabKey(e, setNormalizarBody)}
                className="w-full font-mono text-sm border rounded-none border-t-0 p-2"
              />

              <pre className="font-mono text-sm bg-gray-100 p-2 rounded-t mt-4">
                def agregar(matrix, weights):
              </pre>
              <textarea
                rows={8}
                value={agregarBody}
                onChange={(e) => setAgregarBody(e.target.value)}
                onKeyDown={(e) => handleTabKey(e, setAgregarBody)}
                className="w-full font-mono text-sm border rounded-none border-t-0 p-2"
              />

              <Form.Item label="Funciones auxiliares (opcional)" className="mt-4">
                <textarea
                  rows={6}
                  value={extraFuncs}
                  onChange={(e) => setExtraFuncs(e.target.value)}
                  onKeyDown={(e) => handleTabKey(e, setExtraFuncs)}
                  className="w-full font-mono text-sm border rounded p-2"
                />
              </Form.Item>

              <Button
                icon={<AlignLeftOutlined />}
                onClick={() => {
                  setNormalizarBody(formatCode(normalizarBody))
                  setAgregarBody(formatCode(agregarBody))
                  setExtraFuncs(formatCode(extraFuncs))
                  message.success("Código formateado correctamente.")
                }}
              >
                Formatear Código
              </Button>
            </Form.Item>

            <Space className="mt-4">
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                loading={testing}
                onClick={probarCodigo}
              >
                Probar Código
              </Button>

              <Button
                type="default"
                icon={<SaveOutlined />}
                loading={saving}
                onClick={guardarMetodo}
              >
                {idMetodo ? "Actualizar Método" : "Guardar Método"}
              </Button>
            </Space>
          </Form>

          {resultadoTest && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2">Resultados de Prueba</h3>
              <Table
                columns={[
                  { title: "Ranking", dataIndex: "ranking", key: "ranking" },
                  { title: "Alternativa", dataIndex: "nombre", key: "nombre" },
                  { title: "Puntuación", dataIndex: "puntuacion", key: "puntuacion" },
                ]}
                dataSource={resultadoTest.ranking.map((r, idx) => ({
                  key: `alt-${idx}`,
                  nombre: `Alt ${idx + 1}`,
                  puntuacion: resultadoTest.puntuaciones[idx],
                  ranking: r,
                }))}
                pagination={false}
              />
            </div>
          )}
        </Card>
      </main>
    </div>
  )
}
