"use client"

import React, { useState, useRef, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"

// Lista de componentes disponibles para probar
const AVAILABLE_COMPONENTS = [
  { name: "Header", path: "Header" },
  { name: "Tablero", path: "tablero" },
  { name: "Button", path: "ui/button" },
  { name: "Card", path: "ui/card" },
  { name: "Input", path: "ui/input" },
  { name: "Textarea", path: "ui/textarea" },
  { name: "Badge", path: "ui/badge" },
  { name: "Alert", path: "ui/alert" },
  { name: "Avatar", path: "ui/avatar" },
  { name: "Checkbox", path: "ui/checkbox" },
  { name: "Dialog", path: "ui/dialog" },
  { name: "Progress", path: "ui/progress" },
  { name: "Switch", path: "ui/switch" },
  { name: "Tabs", path: "ui/tabs" },
  { name: "Toast", path: "ui/toast" },
]

interface LogEntry {
  timestamp: string
  type: "info" | "success" | "error" | "method"
  message: string
  data?: any
}

interface ComponentMethod {
  name: string
  params: string[]
}

export default function ComponentTester() {
  const [selectedComponent, setSelectedComponent] = useState<string>("")
  const [loadedComponent, setLoadedComponent] = useState<React.ComponentType<any> | null>(null)
  const [componentProps, setComponentProps] = useState<Record<string, any>>({})
  const [propInputs, setPropInputs] = useState<Record<string, string>>({})
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [availableMethods, setAvailableMethods] = useState<ComponentMethod[]>([])
  const [methodInputs, setMethodInputs] = useState<Record<string, string>>({})
  const componentRef = useRef<any>(null)

  const addLog = (type: LogEntry["type"], message: string, data?: any) => {
    const newLog: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
      data,
    }
    setLogs((prev) => [...prev, newLog])
  }

  const loadComponent = async (componentPath: string) => {
    try {
      addLog("info", `Cargando componente: ${componentPath}`)

      const module = await import(`@/components/${componentPath}`)
      const Component = module.default || module[Object.keys(module)[0]]

      if (Component) {
        setLoadedComponent(() => Component)
        addLog("success", `Componente cargado exitosamente: ${componentPath}`)

        detectComponentMethods(Component)

        setComponentProps({})
        setPropInputs({})
        setMethodInputs({})
      } else {
        addLog("error", `No se pudo encontrar el componente en: ${componentPath}`)
      }
    } catch (error) {
      addLog("error", `Error cargando componente: ${error}`)
      setLoadedComponent(null)
    }
  }

  const detectComponentMethods = (Component: any) => {
    const methods: ComponentMethod[] = []

    const commonMethods = [
      { name: "onClick", params: ["event"] },
      { name: "onChange", params: ["value"] },
      { name: "onSubmit", params: ["data"] },
      { name: "onFocus", params: [] },
      { name: "onBlur", params: [] },
      { name: "onMouseEnter", params: [] },
      { name: "onMouseLeave", params: [] },
    ]

    if (Component.name === "Tablero" || Component.displayName === "Tablero") {
      methods.push(
        { name: "actualizarModelo", params: ["modelo"] },
        { name: "obtenerModelo", params: [] },
        { name: "solicitarInformacion", params: [] },
      )
    }

    methods.push(...commonMethods)
    setAvailableMethods(methods)
    addLog("info", `Métodos detectados: ${methods.map((m) => m.name).join(", ")}`)
  }

  const updateProp = (propName: string, value: string) => {
    try {
      let parsedValue: any = value

      if (
        value.startsWith("{") ||
        value.startsWith("[") ||
        value === "true" ||
        value === "false" ||
        !isNaN(Number(value))
      ) {
        try {
          parsedValue = JSON.parse(value)
        } catch {
          // If JSON parse fails, keep as string
          parsedValue = value
        }
      }

      setComponentProps((prev) => ({
        ...prev,
        [propName]: parsedValue,
      }))

      setPropInputs((prev) => ({
        ...prev,
        [propName]: value,
      }))

      addLog("info", `Prop actualizada: ${propName} = ${value}`)
    } catch (error) {
      addLog("error", `Error actualizando prop ${propName}: ${error}`)
    }
  }

  const callMethod = (methodName: string) => {
    try {
      const inputValue = methodInputs[methodName] || ""
      let params: any[] = []

      if (inputValue.trim()) {
        try {
          params = inputValue.startsWith("[") ? JSON.parse(inputValue) : [JSON.parse(inputValue)]
        } catch {
          params = [inputValue]
        }
      }

      addLog("method", `Llamando método: ${methodName}(${params.map((p) => JSON.stringify(p)).join(", ")})`)

      if (componentRef.current && typeof componentRef.current[methodName] === "function") {
        const result = componentRef.current[methodName](...params)
        addLog("success", `Método ejecutado: ${methodName}`, result)

        if (result && typeof result.then === "function") {
          result
            .then((asyncResult: any) => {
              addLog("success", `Resultado asíncrono de ${methodName}:`, asyncResult)
            })
            .catch((error: any) => {
              addLog("error", `Error asíncrono en ${methodName}:`, error)
            })
        }
      } else {
        if (componentProps[methodName] && typeof componentProps[methodName] === "function") {
          const result = componentProps[methodName](...params)
          addLog("success", `Event handler ejecutado: ${methodName}`, result)
        } else {
          addLog("error", `Método no encontrado: ${methodName}`)
        }
      }
    } catch (error) {
      addLog("error", `Error ejecutando método ${methodName}: ${error}`)
    }
  }

  const clearLogs = () => {
    setLogs([])
    addLog("info", "Logs limpiados")
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Component Tester</h1>
          <p className="text-muted-foreground mt-2">
            Prueba componentes dinámicamente, inspecciona métodos y propiedades
          </p>
        </div>

        <div>
          {/* Control Panel */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Panel de Control</CardTitle>
              <CardDescription>Selecciona y configura componentes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Component Selection */}
              <div>
                <label className="text-sm font-medium mb-2 block">Componente</label>
                <Select
                  value={selectedComponent}
                  onValueChange={(value) => {
                    setSelectedComponent(value)
                    const component = AVAILABLE_COMPONENTS.find((c) => c.name === value)
                    if (component) {
                      loadComponent(component.path)
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un componente" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_COMPONENTS.map((comp) => (
                      <SelectItem key={comp.name} value={comp.name}>
                        {comp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Props Configuration */}
              <div>
                <h3 className="text-sm font-medium mb-2">Props</h3>
                <div className="space-y-2">
                  {["children", "className", "disabled", "variant", "size"].map((propName) => (
                    <div key={propName} className="flex gap-2">
                      <Input
                        placeholder={propName}
                        value={propInputs[propName] || ""}
                        onChange={(e) => updateProp(propName, e.target.value)}
                        className="text-xs"
                      />
                    </div>
                  ))}
                  <Input
                    placeholder="Prop personalizada: nombre=valor"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const [name, ...valueParts] = e.currentTarget.value.split("=")
                        const value = valueParts.join("=")
                        if (name && value) {
                          updateProp(name.trim(), value.trim())
                          e.currentTarget.value = ""
                        }
                      }
                    }}
                    className="text-xs"
                  />
                </div>
              </div>

              <Separator />

              {/* Methods Testing */}
              <div>
                <h3 className="text-sm font-medium mb-2">Métodos</h3>
                <ScrollArea className="h-32">
                  <div className="space-y-2">
                    {availableMethods.map((method) => (
                      <div key={method.name} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {method.name}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => callMethod(method.name)}
                            className="h-6 px-2 text-xs"
                          >
                            Ejecutar
                          </Button>
                        </div>
                        {method.params.length > 0 && (
                          <Input
                            placeholder={`Parámetros: ${method.params.join(", ")}`}
                            value={methodInputs[method.name] || ""}
                            onChange={(e) =>
                              setMethodInputs((prev) => ({
                                ...prev,
                                [method.name]: e.target.value,
                              }))
                            }
                            className="text-xs h-6"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>

          {/* Component Preview */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Vista Previa</CardTitle>
              <CardDescription>Componente renderizado</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="min-h-[300px] border rounded-lg p-4 bg-muted/10">
                {loadedComponent ? (
                  <Suspense fallback={<div>Cargando componente...</div>}>
                    <div className="w-full h-full">
                      {React.createElement(loadedComponent, {
                        ref: componentRef,
                        ...componentProps,
                        onClick: (e: any) => {
                          addLog("method", "onClick triggered", e)
                          if (componentProps.onClick) componentProps.onClick(e)
                        },
                        onChange: (value: any) => {
                          addLog("method", "onChange triggered", value)
                          if (componentProps.onChange) componentProps.onChange(value)
                        },
                      })}
                    </div>
                  </Suspense>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Selecciona un componente para previsualizarlo
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Logs Panel */}
          <Card className="lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Logs</CardTitle>
                <CardDescription>Actividad y resultados</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={clearLogs}>
                Limpiar
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {logs.map((log, index) => (
                    <div
                      key={index}
                      className="text-xs p-2 rounded border-l-2"
                      style={{
                        borderLeftColor:
                          log.type === "error"
                            ? "#ef4444"
                            : log.type === "success"
                              ? "#22c55e"
                              : log.type === "method"
                                ? "#3b82f6"
                                : "#6b7280",
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={log.type === "error" ? "destructive" : "secondary"} className="text-xs">
                          {log.type}
                        </Badge>
                        <span className="text-muted-foreground">{log.timestamp}</span>
                      </div>
                      <div className="font-mono">{log.message}</div>
                      {log.data && (
                        <pre className="mt-1 text-xs bg-muted p-1 rounded overflow-x-auto">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
