import React, { useCallback, useEffect, useRef, useState } from "react"
import { Modelo, Nodo } from "@/types/modelo"
import { applyEdgeChanges, applyNodeChanges, Background, BackgroundVariant, Controls, MiniMap, ReactFlow } from "@xyflow/react"
import '@xyflow/react/dist/style.css';
import Switch from "./Switch";
import CustomNodo from "./CustomNodo";
import ConfigureModalPeso from "./pesos/ConfiguredPeso";
import ExportModelo from "./ExportModelo";

interface TableroProps {
  modelo: Modelo, //modelo completo con todo y nodos
  orientacion: "h" | "v", //Para actualizar la orientación
  linea: number // Para actualizar lineas
  onActualizarModelo?: (modeloActual: Modelo) => void // Para devolver el modelo creado
  onActualizarNodo?: (nodoSeleccionado: Nodo) => void//Para solicitar cambios en un nodo
  nodoCambios: Nodo | null//Para recibir cambios de nodo
}

const Tablero: React.FC<TableroProps> = ({ modelo, orientacion, linea, onActualizarModelo, onActualizarNodo, nodoCambios }) => {//recuperamos elmodelo de desición que vamos a diseñar

  const data = modelo.getData()


  //1. Carga de datos
  const [nodes, setNodes] = useState(modelo.getNodosReactFlow()); // 1.1 Carga inicial de los nodos
  const [edges, setEdges] = useState(modelo.getEdgesReactFlow());// 1.2 Carga inicial de los edges
  const [nodosSeleccionados, setNodosSeleccionados] = useState<Nodo[] | null>(null)
  const [isOpenModal, setIsOpenModal] = useState(false);

  const nodeTypes = {
    custom: CustomNodo,
  }

  useEffect(() => {// Por si se actualizan los datos de orientación

    modelo.setOrientacion(orientacion);
    modelo.setLinea(linea);

    setNodes(modelo.getNodosReactFlow());//volvemos a cargar los nodos
    setEdges(modelo.getEdgesReactFlow());//volvewmos a cargar los edges
  }, [orientacion, modelo, linea]);

  useEffect(() => {// Por si se actualizan los datos de orientación
    if (nodoCambios) {
      console.log(nodoCambios)
      modelo.actualizarNodo(nodoCambios.idnodo, nodoCambios)
      setNodes(modelo.getNodosReactFlow());//volvemos a cargar los nodos

    }
  }, [nodoCambios]);


  // contexto (usamos position: fixed y clientX/clientY)
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; nodoId: number | null }>({
    visible: false,
    x: 0,
    y: 0,
    nodoId: null,
  })
  // Menu con clic derecho*---------------------------------------------
  // refs opcionales si quieres medir el menú para ajustar posición exacta
  const menuRef = useRef<HTMLDivElement | null>(null)

  // cerrar menú (se puede usar desde onClick de ReactFlow o desde document)
  const closeContextMenu = useCallback(() => {
    setContextMenu({ visible: false, x: 0, y: 0, nodoId: null })
  }, [])

  // cerrar con ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeContextMenu()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [closeContextMenu])


  //Segmento de codigo de reactflow para el diseño de modelos (Basicamente permite mover los nodos)
  const onNodesChange = useCallback(
    (changes: any) => setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
    [],
  );
  const onEdgesChange = useCallback(
    (changes: any) => setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
    [],
  );

  const estadisticas = modelo.getEstadisticas()

  const handleActualizar = () => {//Para devolver elmodelo actualizado
    if (onActualizarModelo) {
      guardarpos()
      onActualizarModelo(modelo);
    }
  };


  //-------- diseño del modelo
  // cuando el usuario hace clic derecho sobre un nodo
  const handleNodeContextMenu = (event: MouseEvent, nodo: any) => {
    event.preventDefault()

    // Coordenadas de la ventana (como en tu ejemplo funcional)
    let x = event.clientX
    let y = event.clientY

    // Ajuste simple para que no salga de la ventana (evita overflow)
    const approxMenuW = 220
    const approxMenuH = 180
    const pad = 8
    x = Math.min(x, window.innerWidth - approxMenuW - pad)
    y = Math.min(y, window.innerHeight - approxMenuH - pad)

    setContextMenu({ visible: true, x, y, nodoId: Number(nodo.id) })
  }

  // crear hijo (usa tu lógica del modelo)
  // const crearHijo = (idPadre: number) => {
  //   console.log("modelos orientacion");
  //   console.log("1:" + modelo.getOrientacion())
  //   modelo.setOrientacion(orientacion);
  //   console.log("2:" + modelo.getOrientacion())

  //   const nodosActuales = [...modelo.getNodos()]
  //   const nuevoId = nodosActuales.length ? Math.max(...nodosActuales.map(n => n.idnodo)) + 1 : 1
  //   const nodoPadre = modelo.getNodos().find(n => n.idnodo === idPadre)!
  //   const hijo = {
  //     idnodo: nuevoId,
  //     posx: (nodoPadre?.posx ?? 0) + 150,
  //     posy: (nodoPadre?.posy ?? 0) + 50,
  //     titulo: `Nuevo nodo ${nuevoId}`,
  //     idpadre: idPadre
  //   }
  //   modelo.setNodos(convertirNodos(nodes))
  //   console.log("3:" + modelo.getOrientacion())

  //   modelo.agregarNodo(hijo)
  //   setNodes(modelo.getNodosReactFlow())
  //   setEdges(modelo.getEdgesReactFlow())
  //   console.log("4:" + modelo.getOrientacion())

  //   closeContextMenu()
  //   console.log("5:" + modelo.getOrientacion())

  // }

  const guardarpos = () => {
    modelo.setPosicionesNodos(convertirNodos(nodes))//Guardamos el previo
  }

  // Crear hijo
  const crearHijo = (idPadre: number) => {
    guardarpos();
    modelo.crearHijo(idPadre)//Creamos el hijo
    setNodes(modelo.getNodosReactFlow())
    setEdges(modelo.getEdgesReactFlow())
    closeContextMenu()
  }


  // eliminar rama (sin eliminar nodo raíz)
  const eliminarRama = (idNodo: number) => {
    const nodosRaiz = modelo.getNodosRaiz()
    if (nodosRaiz.some(n => n.idnodo === idNodo)) {
      alert("No se puede eliminar el nodo raíz")
      closeContextMenu()
      return
    }
    guardarpos()
    modelo.eliminarNodo(idNodo)
    setNodes(modelo.getNodosReactFlow())
    setEdges(modelo.getEdgesReactFlow())
    closeContextMenu()
  }
  const configurarNodo = (idnodo: number) => {
    guardarpos()
    const nodo = modelo.getNodoById(idnodo)
    if (nodo && onActualizarNodo) {
      onActualizarNodo(nodo)
    }
    setNodes(modelo.getNodosReactFlow())
    setEdges(modelo.getEdgesReactFlow())
    closeContextMenu()
  }
  const configurarPesos = (idnodo: number) => {
    guardarpos()
    const nodos = modelo.getHijos(idnodo)
    setNodosSeleccionados(nodos)
    console.log(nodos)
    setIsOpenModal(true);
    setNodes(modelo.getNodosReactFlow())
    setEdges(modelo.getEdgesReactFlow())
    closeContextMenu()
  }

  const cambiarOrientacion = (val: "h" | "v") => {
    modelo.setPosicionesNodos(convertirNodos(nodes))
    modelo.setOrientacion(val);
    // Forzar actualización de ReactFlow
    setNodes(modelo.getNodosReactFlow());
    setEdges(modelo.getEdgesReactFlow());
  }

  const cambiarLinea = (val: number) => {
    modelo.setPosicionesNodos(convertirNodos(nodes))

    modelo.setLinea(val);
    // Forzar actualización de ReactFlow
    setNodes(modelo.getNodosReactFlow());
    setEdges(modelo.getEdgesReactFlow());

  }

  //-------------------------
  //convertir nodos de reactflow a nodos del modelo
  const convertirNodos = (rfNodes: any[]): any[] => {
    return rfNodes.map((n) => ({
      idnodo: Number(n.id),
      posx: n.position.x,
      posy: n.position.y,
      titulo: n.data?.label ?? `Nodo ${n.id}`,
      idpadre: n.parentNode ? Number(n.parentNode) : null,
      peso: n.data?.peso,
      pesofinal: n.data?.pesofinal,
      acortado: n.data?.acortado,
    }))
  }


  const handleNodosUpdated = (nodosActualizados: Nodo[]) => {
    // actualiza los nodos en el modelo
    nodosActualizados.forEach((nodo) => {
      modelo.actualizarNodo(nodo.idnodo, nodo)
    })

    // refresca los nodos en ReactFlow
    setNodes(modelo.getNodosReactFlow())
    setEdges(modelo.getEdgesReactFlow())

    // cerrar el modal
    setIsOpenModal(false)
  }


  return (
    <>
      <div style={{ width: '100vw', height: '100vh' }}>
        <div className="fixed top-4 left-4 z-50 flex items-center space-x-4">
          <button
            onClick={handleActualizar}
            className="text-xs px-4 py-2 bg-blue-500 text-white rounded cursor-pointer"
          >
            Guardar cambios
          </button>
          <ExportModelo
            nodos={modelo.getNodos()}
            orientacion={orientacion}
            linea={linea}
            nombreModelo={data.nombre}
          />
          <Switch
            option1={{ label: "Horizontal", value: "h" }}
            option2={{ label: "Vertical", value: "v" }}
            defaultValue={orientacion}
            onChange={(val) => { cambiarOrientacion(val as "h" | "v") }}
          />
          <div>
            <select
              className="form-select text-xs"
              defaultValue={linea}
              onChange={(e) => cambiarLinea(Number(e.target.value))}
            >
              <option value={1} className="text-xs">Directa</option>
              <option value={2} className="text-xs">Escalonada</option>
              <option value={3} className="text-xs">Escalonada Suave</option>
              <option value={4} className="text-xs">Bézier</option>
            </select>
          </div>

        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          // onConnect={onConnect}
          onNodeContextMenu={handleNodeContextMenu as any}
          onClick={closeContextMenu}
          multiSelectionKeyCode="Control"
          fitView
        >
          <Controls />
          {/* <MiniMap /> */}
          <Background color="#ccc" variant={BackgroundVariant.Cross} />
        </ReactFlow>
        {nodosSeleccionados && (
          <ConfigureModalPeso
            idmodelo={Number(modelo.getId())}
            isOpen={isOpenModal}
            onClose={() => setIsOpenModal(false)}
            nodos={nodosSeleccionados}
            onNodosUpdated={handleNodosUpdated}
          >
          </ConfigureModalPeso>
        )}

        {contextMenu.visible && (
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: contextMenu.y,
              left: contextMenu.x,
              backgroundColor: "white",
              border: "1px solid #ccc",
              borderRadius: 6,
              padding: 6,
              zIndex: 9999,
              minWidth: 160,
              boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
            }}
          >
            <button
              onClick={() => contextMenu.nodoId !== null && crearHijo(contextMenu.nodoId)}
              className="block px-3 py-1 hover:bg-gray-100 w-full text-left"
            >
              Crear hijo
            </button>
            <button
              onClick={() => contextMenu.nodoId !== null && eliminarRama(contextMenu.nodoId)}
              className="block px-3 py-1 hover:bg-gray-100 w-full text-left"
            >
              Eliminar rama
            </button>
            <button
              onClick={() => contextMenu.nodoId !== null && configurarNodo(contextMenu.nodoId)}
              className="block px-3 py-1 hover:bg-gray-100 w-full text-left"
            >
              Configuración de criterio
            </button>
            {contextMenu.nodoId !== null &&
              modelo.getNodos().some(n => n.idpadre === contextMenu.nodoId) && (
                <button
                  onClick={() => configurarPesos(contextMenu.nodoId!)}
                  className="block px-3 py-1 hover:bg-gray-100 w-full text-left"
                >
                  Pesos
                </button>
              )}
            <button onClick={closeContextMenu} className="block px-3 py-1 hover:bg-gray-100 w-full text-left">
              Cancelar
            </button>
          </div>
        )}
      </div>
      {/* <div className="p-4 border rounded-lg shadow-md bg-white">
        <h2 className="text-xl font-bold mb-2">{data.nombre}</h2>
        <p className="text-gray-600 mb-4">{data.descripcion ?? "Sin descripción"}</p>

        <h3 className="font-semibold">Estadísticas:</h3>
        <ul className="list-disc list-inside">
          <li>Total de nodos: {estadisticas.totalNodos}</li>
          <li>Criterios finales: {estadisticas.criteriosFinales}</li>
          <li>Nivel máximo: {estadisticas.nivelMaximo}</li>
          <li>Nodos raíz: {estadisticas.nodosRaiz}</li>
        </ul>

        <h3 className="font-semibold mt-4">Nodos:</h3>
        <ul className="list-disc list-inside">
          {modelo.getNodos().map((nodo) => (
            <li key={nodo.idnodo}>
              <strong>{nodo.titulo}</strong> (id: {nodo.idnodo}, padre:{" "}
              {nodo.idpadre ?? "ninguno"})
            </li>
          ))}
        </ul>
      </div>
 */}

    </>

  )
}

export default Tablero
