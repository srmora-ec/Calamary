import { Position } from "@xyflow/react"

export interface ValorDiscretoMAUT {
  id: string; // Para usar como key en React
  nombre: string // Ej: "Muy bien", "Aceptable"
  utilidadMin: number // El valor mínimo de utilidad (Ej: 0.8)
  utilidadMax: number // El valor máximo de utilidad (Ej: 1.0)
}

export interface MAUTConfig {
  tipoFuncion: "simple" | "dual" | "discreta" | "programada" // simple = una función, dual = dos funciones (min/max)
  funcionSimple?: {
    puntos: Array<{ x: number; y: number }>
    pendientes: number[]
  }
  funcionDual?: {
    min: {
      puntos: Array<{ x: number; y: number }>
      pendientes: number[]
    }
    max: {
      puntos: Array<{ x: number; y: number }>
      pendientes: number[]
    }
  }
  // Nueva estructura para valores discretos
  funcionDiscreta?: {
    valores: ValorDiscretoMAUT[]
  }

  funcionProgramada?: {
    codigo: string // Cuerpo de la función Python que recibe x y retorna utilidad
  }

}

export interface Nodo {
  idnodo: number
  posx: number
  posy: number
  titulo: string
  descripcion: string
  idpadre: number | null
  peso?: number
  pesofinal?: number
  acortado?: string
  min?: number
  max?: number
  criterioFinal?: boolean
  beneficio?: boolean
  unidadmedida?: string
  MAUT?: MAUTConfig
}

export interface ModeloData {
  id: string
  nombre: string
  descripcion: string | null
  orientacion: "h" | "v"
  linea: number
  publico: boolean
  metodo: string
  nodos: {
    nodes: Nodo[]
  }
}

export class Modelo {
  private data: ModeloData

  constructor(data: ModeloData) {
    this.data = data
  }

  setNombre(nombre: string) {
    this.data.nombre = nombre
  }
  // 🆕 Setter para la descripción del modelo
  setDescripcion(descripcion: string) {
    this.data.descripcion = descripcion || null
  }

  // 🆕 Setter para la visibilidad del modelo
  setPublico(publico: boolean) {
    this.data.publico = publico
  }
  // Getter para acceder a los datos completos
  getData(): ModeloData {
    return { ...this.data }
  }

  getId(): string {
    return this.data.id
  }

  // Setter para actualizar los datos completos
  setData(newData: ModeloData): void {
    this.data = { ...newData }
    this.actualizarCriterios()
  }
  //Para cambiar la orientacion del modelo (Aspecto estetico)
  setOrientacion(orientacion: "h" | "v") {
    this.data.orientacion = orientacion
  }
  getOrientacion(): "h" | "v" {
    //Para recuperar la orientacion
    return this.data.orientacion
  }
  //Para cambiar linea del modelo (Aspecto estetico)
  setLinea(linea: number) {
    this.data.linea = linea
  }
  //Para cambiar le metodo
  setMetodo(metodo: string) {
    this.data.metodo = metodo
  }

  getLinea(): number {
    return this.data.linea
  }
  getMetodo(): string {
    return this.data.metodo
  }

  // Obtener todos los nodos
  getNodos(): Nodo[] {
    return this.data.nodos?.nodes || []
  }
  //Obtener los nodos con la estructura de reactflow
  getNodosReactFlow() {
    const isHorizontal = this.data.orientacion === "h"
    this.actualizarCriterios()
    return this.getNodos().map((nodo) => ({
      id: nodo.idnodo?.toString() ?? nodo.idnodo,
      position: { x: nodo.posx, y: nodo.posy },
      type: "custom",
      data: {
        label: nodo.titulo ?? "",
        peso: nodo.peso ?? 0,
        pesofinal: nodo.pesofinal ?? 0,
        acortado: nodo.acortado ?? "",
        min: nodo.min ?? -100,
        max: nodo.max ?? 100,
        criterioFinal: nodo.criterioFinal ?? false,
        beneficio: nodo.beneficio ?? true,
        unidadmedida: nodo.unidadmedida ?? "Unidad",
        MAUT: nodo.MAUT ?? null
      } as Record<string, unknown>,
      parentNode: nodo.idpadre != null ? nodo.idpadre.toString() : undefined,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
    }))
  }

  //Devolver los nodos con el formato de reactflow
  getEdgesReactFlow() {
    const tipoEdgeMap: Record<number, string> = {
      1: "straight", // Directa
      2: "step", // Escalonada
      3: "smoothstep", // Escalonada suave
      4: "default", // Bézier
    }

    const edgeType = tipoEdgeMap[this.data.linea] || "default"

    return this.getNodos()
      .filter((nodo) => nodo.idpadre !== null) // solo los que tienen padre
      .map((nodo) => {
        const nodoHijo = nodo // nodo hijo actual
        const pesoLabel = nodoHijo.peso?.toFixed(2) ?? ""

        return {
          id: `${nodo.idpadre}-${nodo.idnodo}`, // id único del edge
          source: nodo.idpadre!.toString(), // el padre
          target: nodo.idnodo.toString(), // el hijo
          type: edgeType, // tipo de línea
          label: pesoLabel, // <-- agregamos el label aquí
          labelStyle: { fill: "#000", fontWeight: 600, fontSize: 12 },
        }
      })
  }

  // Actualizar nodos
  setNodos(nodos: Nodo[]): void {
    this.data.nodos = { nodes: nodos }
  }

  // Obtener todos los nodos de un nivel específico
  getNodosPorNivel(nivel: number): Nodo[] {
    const nodos = this.getNodos()
    const nodosConNivel = this.calcularNiveles(nodos)
    return nodosConNivel.filter((nodo) => nodo.nivel === nivel).map((n) => n.nodo)
  }

  // Obtener criterios finales (nodos sin hijos)
  getCriteriosFinales(): Nodo[] {
    const nodos = this.getNodos()
    return nodos.filter((nodo) => !this.tieneHijos(nodo.idnodo, nodos))
  }

  // Obtener nodos raíz (sin padre)
  getNodosRaiz(): Nodo[] {
    return this.getNodos().filter((nodo) => nodo.idpadre === null)
  }

  // Obtener hijos de un nodo específico
  getHijos(idNodo: number): Nodo[] {
    return this.getNodos().filter((nodo) => nodo.idpadre === idNodo)
  }

  // Verificar si un nodo tiene hijos
  tieneHijos(idNodo: number, nodos?: Nodo[]): boolean {
    const nodosToCheck = nodos || this.getNodos()
    return nodosToCheck.some((nodo) => nodo.idpadre === idNodo)
  }

  // Calcular niveles de todos los nodos
  private calcularNiveles(nodos: Nodo[]): Array<{ nodo: Nodo; nivel: number }> {
    const nodosConNivel: Array<{ nodo: Nodo; nivel: number }> = []

    // Función recursiva para calcular nivel
    const calcularNivel = (nodo: Nodo, nivel = 0): void => {
      nodosConNivel.push({ nodo, nivel })

      // Buscar hijos y calcular su nivel
      const hijos = nodos.filter((n) => n.idpadre === nodo.idnodo)
      hijos.forEach((hijo) => calcularNivel(hijo, nivel + 1))
    }

    // Empezar con nodos raíz
    const nodosRaiz = nodos.filter((nodo) => nodo.idpadre === null)
    nodosRaiz.forEach((nodo) => calcularNivel(nodo, 0))

    return nodosConNivel
  }

  // Obtener el nivel máximo del árbol
  getNivelMaximo(): number {
    const nodos = this.getNodos()
    if (nodos.length === 0) return 0

    const nodosConNivel = this.calcularNiveles(nodos)
    return Math.max(...nodosConNivel.map((n) => n.nivel))
  }

  // Agregar un nuevo nodo
  agregarNodo(nodo: Nodo): void {
    const nodos = this.getNodos() //obtenemos los nodos
    this.setNodos([...nodos, nodo])
    this.actualizarCriterios()
  }
  //Guardar Posiciones de los nodos. De tal manera solucionamos el bug
  setPosicionesNodos(nuevosNodos: Pick<Nodo, "idnodo" | "posx" | "posy">[]): void {
    const nodos = this.getNodos()

    const nodosActualizados = nodos.map((nodo) => {
      const nodoNuevo = nuevosNodos.find((n) => n.idnodo === nodo.idnodo)
      return nodoNuevo ? { ...nodo, posx: nodoNuevo.posx, posy: nodoNuevo.posy } : nodo
    })

    this.setNodos(nodosActualizados)
  }

  //Calcular los pesos al crear eliminar un hijo
  private recalcularPesos(idPadre: number): void {
    const nodos = this.getNodos() //obtenemos los nodos
    const hijos = nodos.filter((n) => n.idpadre === idPadre) //Filtramos los hijos
    if (hijos.length === 0) return

    const peso = Number.parseFloat((1 / hijos.length).toFixed(6)) //Obtenemos el peso partido por igual

    const nodosActualizados = nodos.map((n) => {
      const esHijo = hijos.some((h) => h.idnodo === n.idnodo)
      if (esHijo) {
        // Crear una copia profunda del nodo preservando MAUT
        return {
          ...n,
          peso,
          // Preservar explícitamente MAUT si existe
          MAUT: n.MAUT ? { ...n.MAUT } : undefined,
        }
      }
      return n
    })

    this.setNodos(nodosActualizados) //Establecemos los nuevos nodos con los pesos arreglados
  }

  // Crear hijo
  crearHijo(idPadre: number): Nodo {
    const nodos = this.getNodos() //Obtenemos todos los nodos
    const nuevoId = nodos.length ? Math.max(...nodos.map((n) => n.idnodo)) + 1 : 1 //Calculamos un nuevo id
    const padre = nodos.find((n) => n.idnodo === idPadre) //Encontramos el padre

    if (!padre) {
      //Verificamos que hay padre
      throw new Error(`No se encontró el nodo padre con id ${idPadre}`)
    }

    const hijo: Nodo = {
      idnodo: nuevoId,
      posx: padre.posx + (this.getOrientacion() === "h" ? 150 : 0), // Si es h lo ubicamos a la derecha
      posy: padre.posy + (this.getOrientacion() === "v" ? 100 : 50), // si es v hacia abajo
      min: -100,
      max: 100,
      titulo: `Nuevo nodo ${nuevoId}`,
      descripcion: "",
      idpadre: idPadre,
      beneficio: true,
      unidadmedida: "Unidad",
      peso: 0, // se recalculará más abajo
    }

    // Agregamos el hijo
    const nuevosNodos = [...nodos, hijo]
    this.setNodos(nuevosNodos)

    // Recalcular pesos de todos los hijos de ese padre
    this.recalcularPesos(idPadre)

    this.actualizarCriterios()
    return hijo
  }

  // Eliminar un nodo y todos sus descendientes
  eliminarNodo(idNodo: number): void {
    const nodos = this.getNodos()
    const nodo = nodos.find((n) => n.idnodo === idNodo)
    if (!nodo) return

    const nodosAEliminar = this.obtenerDescendientes(idNodo, nodos)
    nodosAEliminar.push(idNodo)

    const nodosRestantes = nodos.filter((nodo) => !nodosAEliminar.includes(nodo.idnodo))
    this.setNodos(nodosRestantes)

    // Recalcular pesos de los hermanos restantes
    if (nodo.idpadre !== null) {
      this.recalcularPesos(nodo.idpadre)
    }

    this.actualizarCriterios()
  }

  // Obtener todos los descendientes de un nodo
  private obtenerDescendientes(idNodo: number, nodos: Nodo[]): number[] {
    const descendientes: number[] = []
    const hijos = nodos.filter((nodo) => nodo.idpadre === idNodo)

    hijos.forEach((hijo) => {
      descendientes.push(hijo.idnodo)
      descendientes.push(...this.obtenerDescendientes(hijo.idnodo, nodos))
    })

    return descendientes
  }

  // Actualizar un nodo específico
  actualizarNodo(idNodo: number, datosNuevos: Partial<Nodo>): void {
    const nodos = this.getNodos()
    const nodoActual = nodos.find((n) => n.idnodo === idNodo)

    const minCambio = datosNuevos.min !== undefined && nodoActual?.min !== datosNuevos.min
    const maxCambio = datosNuevos.max !== undefined && nodoActual?.max !== datosNuevos.max

    const nodosActualizados = nodos.map((nodo) => {
      if (nodo.idnodo === idNodo) {
        const nodoActualizado = { ...nodo, ...datosNuevos }

        // Si min o max cambiaron, limpiar la configuración MAUT
        if (minCambio || maxCambio) {
          nodoActualizado.MAUT = undefined
        }

        return nodoActualizado
      }
      return nodo
    })

    this.setNodos(nodosActualizados)
    this.actualizarCriterios()
  }

  // Obtener un nodo específico por ID
  getNodoById(idNodo: number): Nodo | undefined {
    return this.getNodos().find((nodo) => nodo.idnodo === idNodo)
  }

  actualizarCriterios() {
    //Para actualizar si tiene hijos
    const nodos = this.getNodos()
    const nodosActualizados = nodos.map((nodo) => ({
      ...nodo,
      criterioFinal: !this.tieneHijos(nodo.idnodo),
      // Preservar explícitamente MAUT si existe
      MAUT: nodo.MAUT ? { ...nodo.MAUT } : undefined,
    }))
    this.setNodos(nodosActualizados)
  }

  // Método para calcular los pesos finales de todos los nodos según AHP
  calcularPesosFinales(): void {
    const nodos = this.getNodos()

    // Función recursiva para asignar pesofinal
    const asignarPesoFinal = (nodo: Nodo, pesoAcumulado: number) => {
      const hijos = this.getHijos(nodo.idnodo)
      // Peso final del nodo = peso acumulado que recibe del padre
      nodo.pesofinal = pesoAcumulado

      if (hijos.length > 0) {
        hijos.forEach((hijo) => {
          const pesoHijo = hijo.peso ?? 1 / hijos.length // si no tiene peso definido, repartir equitativamente
          asignarPesoFinal(hijo, pesoAcumulado * pesoHijo)
        })
      }
    }

    // Iniciar desde nodos raíz con peso acumulado = 1
    this.getNodosRaiz().forEach((nodoRaiz) => {
      asignarPesoFinal(nodoRaiz, 1)
    })

    // Actualizar los nodos con los nuevos pesos finales
    this.setNodos(nodos)
  }

  // Obtener estadísticas del modelo
  getEstadisticas() {
    const nodos = this.getNodos()
    const criteriosFinales = this.getCriteriosFinales()
    const nivelMaximo = this.getNivelMaximo()

    return {
      totalNodos: nodos.length,
      criteriosFinales: criteriosFinales.length,
      nivelMaximo: nivelMaximo + 1, // +1 porque empezamos en 0
      nodosRaiz: this.getNodosRaiz().length,
    }
  }

  verificarFuncionesUtilidad(): {
    valido: boolean
    criteriosSinFuncion: Nodo[]
    totalCriteriosFinales: number
    criteriosConfigurados: number
  } {
    // Solo validar si el método es MAUT
    if (this.data.metodo !== "MAUT") {
      return {
        valido: true,
        criteriosSinFuncion: [],
        totalCriteriosFinales: 0,
        criteriosConfigurados: 0,
      }
    }

    const criteriosFinales = this.getCriteriosFinales()
    const criteriosSinFuncion = criteriosFinales.filter((nodo) => {
      // Verificar si el nodo tiene configuración MAUT
      if (!nodo.MAUT) return true

      // Verificar que la configuración sea válida según el tipo
      if (nodo.MAUT.tipoFuncion === "simple") {
        return !nodo.MAUT.funcionSimple || nodo.MAUT.funcionSimple.puntos.length < 2
      } else if (nodo.MAUT.tipoFuncion === "dual") {
        return (
          !nodo.MAUT.funcionDual ||
          nodo.MAUT.funcionDual.min.puntos.length < 2 ||
          nodo.MAUT.funcionDual.max.puntos.length < 2
        )
      } else if (nodo.MAUT.tipoFuncion === "discreta") {
        return (
          !nodo.MAUT.funcionDiscreta ||
          nodo.MAUT.funcionDiscreta.valores.length < 2
        )
      } else if (nodo.MAUT.tipoFuncion === "programada") {
        // Válida si el código no está vacío
        return (
          !nodo.MAUT.funcionProgramada ||
          nodo.MAUT.funcionProgramada.codigo.trim().length === 0
        )
      }

      return true
    })

    return {
      valido: criteriosSinFuncion.length === 0,
      criteriosSinFuncion,
      totalCriteriosFinales: criteriosFinales.length,
      criteriosConfigurados: criteriosFinales.length - criteriosSinFuncion.length,
    }
  }

  obtenerResumenValidacionMAUT(): string {
    const validacion = this.verificarFuncionesUtilidad()

    if (this.data.metodo !== "MAUT") {
      return "El modelo no usa el método MAUT"
    }

    if (validacion.valido) {
      return `Todos los criterios finales (${validacion.totalCriteriosFinales}) tienen su función de utilidad configurada`
    }

    const criteriosFaltantes = validacion.criteriosSinFuncion.map((n) => n.titulo).join(", ")
    return `Faltan ${validacion.criteriosSinFuncion.length} de ${validacion.totalCriteriosFinales} criterios por configurar: ${criteriosFaltantes}`
  }
}