import { Position } from '@xyflow/react'

export interface Nodo {
  idnodo: number
  posx: number
  posy: number
  titulo: string
  idpadre: number | null
  peso?: number
  pesofinal?: number
  acortado?: string
  min?: number
  max?: number
  criterioFinal?: boolean
  beneficio?: boolean
}

export interface ModeloData {
  id: string
  nombre: string
  descripcion: string | null
  orientacion: "h" | "v"
  linea: number
  publico: boolean
  nodos: {
    nodes: Nodo[]
  }
}

export class Modelo {
  private data: ModeloData

  constructor(data: ModeloData) {
    this.data = data
  }

  // Getter para acceder a los datos completos
  getData(): ModeloData {
    return { ...this.data }
  }

  // Setter para actualizar los datos completos
  setData(newData: ModeloData): void {
    this.data = { ...newData }
    this.actualizarCriterios()

  }
  //Para cambiar la orientacion del modelo (Aspecto estetico)
  setOrientacion(orientacion: "h" | "v") {
    this.data.orientacion = orientacion;
  }
  getOrientacion(): "h" | "v" {//Para recuperar la orientacion
    return this.data.orientacion;
  }
  //Para cambiar linea del modelo (Aspecto estetico)
  setLinea(linea: number) {
    this.data.linea = linea;
  }

  getLinea(): number {
    return this.data.linea;
  }

  // Obtener todos los nodos
  getNodos(): Nodo[] {
    return this.data.nodos?.nodes || []
  }
  //Obtener los nodos con la estructura de reactflow
  getNodosReactFlow() {
    const isHorizontal = this.data.orientacion === "h";
    this.actualizarCriterios();
    return this.getNodos().map((nodo) => ({
      id: nodo.idnodo?.toString() ?? nodo.idnodo,
      position: { x: nodo.posx, y: nodo.posy },
      type: "custom",
      data: {
        label: nodo.titulo ?? '',
        peso: nodo.peso ?? 0,
        pesofinal: nodo.pesofinal ?? 0,
        acortado: nodo.acortado ?? '',
        min: nodo.min ?? -100,
        max: nodo.max ?? 100,
        criterioFinal: nodo.criterioFinal ?? false,
        beneficio: nodo.beneficio ?? true
      } as Record<string, unknown>,
      parentNode: nodo.idpadre != null ? nodo.idpadre.toString() : undefined,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      targetPosition: isHorizontal ? Position.Left : Position.Top
    }));
  }

  //Devolver los nodos con el formato de reactflow
  getEdgesReactFlow() {
    const tipoEdgeMap: Record<number, string> = {
      1: 'straight',        // Directa
      2: 'step',           // Escalonada
      3: 'smoothstep',     // Escalonada suave
      4: 'default',           // Sebier
    }

    const edgeType = tipoEdgeMap[this.data.linea] || 'default'

    return this.getNodos()
      .filter((nodo) => nodo.idpadre !== null) // solo los que tienen padre
      .map((nodo) => ({
        id: `${nodo.idpadre}-${nodo.idnodo}`, // id único del edge
        source: nodo.idpadre!.toString(), // el padre
        target: nodo.idnodo.toString(),   // el hijo
        type: edgeType,// tipo de linea
      }))
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
    const nodos = this.getNodos()
    this.setNodos([...nodos, nodo])
    this.actualizarCriterios()

  }
//Guardar Posiciones de los nodos. De tal manera solucionamos el bug
  setPosicionesNodos(nuevosNodos: Pick<Nodo, "idnodo" | "posx" | "posy">[]): void {
  const nodos = this.getNodos()

  const nodosActualizados = nodos.map((nodo) => {
    const nodoNuevo = nuevosNodos.find((n) => n.idnodo === nodo.idnodo)
    return nodoNuevo
      ? { ...nodo, posx: nodoNuevo.posx, posy: nodoNuevo.posy }
      : nodo
  })

  this.setNodos(nodosActualizados)
}
  // Crear hijo
  crearHijo(idPadre: number): Nodo {
    const nodos = this.getNodos()
    const nuevoId = nodos.length ? Math.max(...nodos.map(n => n.idnodo)) + 1 : 1
    const padre = nodos.find(n => n.idnodo === idPadre)

    if (!padre) {
      throw new Error(`No se encontró el nodo padre con id ${idPadre}`)
    }

    const hijo: Nodo = {
      idnodo: nuevoId,
      posx: padre.posx + (this.getOrientacion() === "h" ? 150 : 0), // si horizontal → desplaza X
      posy: padre.posy + (this.getOrientacion() === "v" ? 100 : 50), // si vertical → desplaza Y
      min: -100,
      max: 100,
      titulo: `Nuevo nodo ${nuevoId}`,
      idpadre: idPadre,
      beneficio: true
    }

    this.agregarNodo(hijo)
    this.actualizarCriterios()
    return hijo
  }

  // Eliminar un nodo y todos sus descendientes
  eliminarNodo(idNodo: number): void {
    const nodos = this.getNodos()
    const nodosAEliminar = this.obtenerDescendientes(idNodo, nodos)
    nodosAEliminar.push(idNodo)

    const nodosRestantes = nodos.filter((nodo) => !nodosAEliminar.includes(nodo.idnodo))
    this.setNodos(nodosRestantes)
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
    const nodosActualizados = nodos.map((nodo) => (nodo.idnodo === idNodo ? { ...nodo, ...datosNuevos } : nodo))
    this.setNodos(nodosActualizados)
    this.actualizarCriterios()

  }

  // Obtener un nodo específico por ID
  getNodoById(idNodo: number): Nodo | undefined {
    return this.getNodos().find((nodo) => nodo.idnodo === idNodo)
  }

  actualizarCriterios() {//Para actualizar si tiene hijos
    const nodos = this.getNodos()
    const nodosActualizados = nodos.map(nodo => ({
      ...nodo,
      criterioFinal: !this.tieneHijos(nodo.idnodo)
    }))
    this.setNodos(nodosActualizados)
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
}

