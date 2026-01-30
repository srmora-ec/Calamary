"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { Modelo, Nodo } from "@/types/modelo"
import { applyEdgeChanges, applyNodeChanges, Background, BackgroundVariant, Controls, MiniMap, ReactFlow } from "@xyflow/react"
import '@xyflow/react/dist/style.css';
import Switch from "./Switch";
import CustomNodo from "./CustomNodo";
import ConfigureModalPeso from "./pesos/ConfiguredPeso";
import ExportModelo from "./ExportModelo";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import { Button, Checkbox, Drawer, Space } from "antd"; // Importar Button y Drawer
import { MenuOutlined } from '@ant-design/icons'; // Importar un ícono para el botón de menú
import CitasModelo from "./CitasModelo";
import Input from "antd/es/input/Input";
import TextArea from "antd/es/input/TextArea";
import Modal from "./Modal";
import PaquetesDeAlternativas from "./Alternativa";
import { useTranslation } from "react-i18next";

interface TableroProps {
  modelo: Modelo, //modelo completo con todo y nodos
  orientacion: "h" | "v", //Para actualizar la orientación
  linea: number // Para actualizar lineas
  onActualizarModelo?: (modeloActual: Modelo) => void // Para devolver el modelo creado
  onActualizarNodo?: (nodoSeleccionado: Nodo) => void//Para solicitar cambios en un nodo
  onCriterioMaut?: (nodoSeleccionado: Nodo) => void //Para solicitar cambios de la utilidad para elmetodo MAUT
  nodoCambios: Nodo | null//Para recibir cambios de nodo
}

interface Metodo {
  id: number
  nombre: string
  descripcion: string
}


const Tablero: React.FC<TableroProps> = ({ modelo, orientacion, linea, onActualizarModelo, onActualizarNodo, nodoCambios, onCriterioMaut }) => {//recuperamos elmodelo de desición que vamos a diseñar

  const data = modelo.getData()
  const { t } = useTranslation()
  //1. Carga de datos
  const [nodes, setNodes] = useState(modelo.getNodosReactFlow()); // 1.1 Carga inicial de los nodos
  const [edges, setEdges] = useState(modelo.getEdgesReactFlow());// 1.2 Carga inicial de los edges
  const [nodosSeleccionados, setNodosSeleccionados] = useState<Nodo[] | null>(null)
  const [isOpenModal, setIsOpenModal] = useState(false);
  const [openModalAlt, setOpenModalAlt] = useState(false);
  const [metodos, setMetodos] = useState<Metodo[]>([]);
  const [metodo, setMetodo] = useState<string>("");
  const [nombreModelo, setNombreModelo] = useState(data.nombre);
  const [descripcionModelo, setDescripcionModelo] = useState(data.descripcion || "");
  const [esPublico, setEsPublico] = useState(data.publico);

  // Estado para el Drawer
  const [openDrawer, setOpenDrawer] = useState(false);

  const nodeTypes = {
    custom: CustomNodo,
  }

  useEffect(() => {// Por si se actualizan los datos de orientación

    modelo.setOrientacion(orientacion);
    modelo.setLinea(linea);
    setMetodo(data.metodo);
    setNombreModelo(data.nombre);
    setDescripcionModelo(data.descripcion || "");
    setEsPublico(data.publico);
    setNodes(modelo.getNodosReactFlow());//volvemos a cargar los nodos
    setEdges(modelo.getEdgesReactFlow());//volvewmos a cargar los edges
  }, [orientacion, modelo, linea]);


  useEffect(() => {
    const fetchMetodos = async () => {
      const { data, error } = await supabase
        .from("metodos")
        .select("id, nombre, descripcion")
        .eq("estado", true)
        .order("id", { ascending: true })

      if (error) {
        console.error(error)
      } else if (data) {

        console.log("metodos:", data)
        setMetodos(data)
      }
    }
    fetchMetodos()
  }, [])

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

  // const estadisticas = modelo.getEstadisticas()

  const handleActualizar = () => {//Para devolver elmodelo actualizado
    if (onActualizarModelo) {
      guardarpos()
      modelo.setNombre(nombreModelo);
      modelo.setDescripcion(descripcionModelo);
      modelo.setPublico(esPublico);
      onActualizarModelo(modelo);
    }
  };

  const handlePlay = async () => {
    await handleActualizar();
    window.open("/evaluacion/" + data.id, "_blank")
  }


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

  const configurarUtilidad = (idnodo: number) => {
    guardarpos()
    const nodo = modelo.getNodoById(idnodo)
    if (nodo && onCriterioMaut) {
      onCriterioMaut(nodo)
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

  // Componente que contiene todas las opciones de configuración
  const ConfigOptions = () => (
    <Space direction="horizontal" wrap size="small" className="w-full flex">
      <button
        onClick={handleActualizar}
        className="text-xs px-4 py-2 bg-blue-500 text-white rounded cursor-pointer"
      >
        Guardar cambios
      </button>

      <label className="block text-xs font-semibold mb-1">Nombre</label>
      <Input
        value={nombreModelo}
        onChange={(e) => setNombreModelo(e.target.value)}
        maxLength={150}
        placeholder="Nombre del modelo"
        className="text-xs"
      />
      <label className="block text-xs font-semibold mb-1">Descripción</label>
      <TextArea
        value={descripcionModelo}
        onChange={(e) => setDescripcionModelo(e.target.value)}
        rows={2}
        maxLength={500}
        placeholder="Descripción del modelo"
        className="text-xs"
      />
      <Checkbox
        checked={esPublico}
        onChange={(e) => setEsPublico(e.target.checked)}
      >
        <span className="text-xs font-semibold">Modelo Público</span>
      </Checkbox>

      <ExportModelo
        nodos={modelo.getNodos()}
        orientacion={orientacion}
        linea={linea}
        nombreModelo={data.nombre}
        descripcion={data.descripcion}
        metodo={data.metodo}
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
      {modelo.getMetodo() != "" && (
        <div>
          <select
            className="form-select text-xs border rounded px-2 py-1"
            value={metodo}
            onChange={(e) => {
              setMetodo(e.target.value);
              modelo.setMetodo(e.target.value)
              console.log(e.target.value)
            }}
          >
            <option value="">Selecciona un método</option>
            {metodos.map((metodo) => (
              <option key={metodo.id} value={metodo.nombre}>
                {metodo.nombre}
              </option>
            ))}
          </select>
        </div>
      )}


      {/* <button
        onClick={() => {
          window.open("/evaluacion/" + data.id, "_blank")
        }}
        className="focus:outline-none cursor-pointer"
      >
        <Image
          src="/play.png"
          alt="Botón de play"
          width={40}
          height={40}
        />
      </button> */}
    </Space>
  );

  const handleCloseAlt = () => {
    setOpenModalAlt(false);
  }

  return (
    <>
      <div style={{ width: '100vw', height: '100vh' }}>
        <div className="fixed top-4 left-4 z-50 flex flex-col lg:flex-row items-start lg:items-center gap-2 lg:gap-3">

          <Button
            type="primary"
            icon={<MenuOutlined />}
            onClick={() => setOpenDrawer(true)}
            className="w-full lg:hidden"
          >
            {t("generic.opciones")}
          </Button>

          <Button
            type="default"
            onClick={() => setOpenModalAlt(true)}
            className="w-full lg:w-auto"
          >
            {t("generic.alternativas")}
          </Button>
          <div className="hidden lg:flex items-center gap-4">
            <ConfigOptions />
          </div>
        </div>
        <Modal isOpen={openModalAlt} onClose={handleCloseAlt} title="Alternativas" width="100%">
          <PaquetesDeAlternativas modelo={modelo}></PaquetesDeAlternativas>
        </Modal>
        <div className="fixed top-4 right-4 z-50 flex items-center space-x-4">
          <button
            onClick={handlePlay}
            className="focus:outline-none cursor-pointer"
          >
            <Image
              src="/play.png"
              alt="Botón de play"
              width={40}
              height={40}
            />
          </button>
        </div>

        {/* Drawer de Ant Design para móviles */}
        <Drawer
          title={t("modelos.opmodel")}
          placement="left"
          onClose={() => setOpenDrawer(false)}
          open={openDrawer}
          width={typeof window !== 'undefined' && window.innerWidth >= 1024 ? 500 : '90%'} styles={{
            body: { padding: '10px' } // Ajustar padding del contenido
          }}
        >
          {/* El contenido del Drawer en móviles debe ser en dirección vertical */}
          <Space direction="vertical" size="middle" className="w-full">
            <button
              onClick={() => { handleActualizar(); setOpenDrawer(false); }} // Cerrar al guardar
              className="text-xs px-4 py-2 bg-blue-500 text-white rounded cursor-pointer w-full"
            >
              {t("botones.guardar")}
            </button>

            <Input
              value={nombreModelo}
              onChange={(e) => setNombreModelo(e.target.value)}
              maxLength={150}
              placeholder={t("modelos.nommod")}
              className="text-xs"
            />
            <label className="block text-xs font-semibold mb-1">{t("generic.descripcion")}</label>
            <TextArea
              value={descripcionModelo}
              onChange={(e) => setDescripcionModelo(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder={t("modelos.desmod")}
              className="text-xs"
            />
            <label className="form-label block mb-2">{t("generic.visibilidad")}</label>
            <button
              type="button"
              onClick={() => setEsPublico(!esPublico)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${esPublico ? "bg-blue-600" : "bg-gray-300"
                }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${esPublico ? "translate-x-6" : "translate-x-1"
                  }`}
              />
            </button>
            <span className="ml-3">{esPublico ? t("generic.public") : t("generic.private")}</span>

            <Switch
              option1={{ label: t("modelos.horizontal"), value: "h" }}
              option2={{ label: t("modelos.vertical"), value: "v" }}
              defaultValue={orientacion}
              onChange={(val) => { cambiarOrientacion(val as "h" | "v") }}
            />
            <div className="w-full">
              <label className="block text-xs mb-1">{t("modelos.tlinea")}</label>
              <select
                className="form-select text-xs w-full p-2 border rounded"
                defaultValue={linea}
                onChange={(e) => cambiarLinea(Number(e.target.value))}
              >
                <option value={1} className="text-xs">{t("modelcard.direct")}</option>
                <option value={2} className="text-xs">{t("modelcard.escalo")}</option>
                <option value={3} className="text-xs">{t("modelcard.escalosu")}</option>
                <option value={4} className="text-xs">{t("modelcard.bezier")}</option>
              </select>
            </div>
            {modelo.getMetodo() != "" && (
              <div className="w-full">
                <label className="block text-xs mb-1">{t("generic.metodo")}</label>
                <select
                  className="form-select text-xs border rounded px-2 py-1 w-full"
                  value={metodo}
                  onChange={(e) => {
                    setMetodo(e.target.value);
                    modelo.setMetodo(e.target.value)
                  }}
                >
                  <option value="">{t("modelos.selmet")}</option>
                  {metodos.map((metodo) => (
                    <option key={metodo.id} value={metodo.nombre}>
                      {metodo.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <ExportModelo
              nodos={modelo.getNodos()}
              orientacion={orientacion}
              linea={linea}
              nombreModelo={data.nombre}
              descripcion={data.descripcion}
              metodo={data.metodo}
            />

            <CitasModelo modeloId={Number(data.id)} />
          </Space>
        </Drawer>


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
              {t("menutablero.crearh")}
            </button>
            <button
              onClick={() => contextMenu.nodoId !== null && eliminarRama(contextMenu.nodoId)}
              className="block px-3 py-1 hover:bg-gray-100 w-full text-left"
            >
              {t("menutablero.elimrama")}
            </button>
            <button
              onClick={() => contextMenu.nodoId !== null && configurarNodo(contextMenu.nodoId)}
              className="block px-3 py-1 hover:bg-gray-100 w-full text-left"
            >
              {t("menutablero.confcri")}
            </button>
            {modelo.getMetodo() == "MAUT" && !modelo.tieneHijos(Number(contextMenu.nodoId)) && (
              <button
                onClick={() => contextMenu.nodoId !== null && configurarUtilidad(contextMenu.nodoId)}
                className="block px-3 py-1 hover:bg-gray-100 w-full text-left"
              >
                {t("menutablero.confutl")}
              </button>
            )}
            {contextMenu.nodoId !== null &&
              modelo.getNodos().some(n => n.idpadre === contextMenu.nodoId) && (
                <button
                  onClick={() => configurarPesos(contextMenu.nodoId!)}
                  className="block px-3 py-1 hover:bg-gray-100 w-full text-left"
                >
                  {t("menutablero.pesos")}
                </button>
              )}
            <button onClick={closeContextMenu} className="block px-3 py-1 hover:bg-gray-100 w-full text-left">
              {t("generic.cancelar")}
            </button>
          </div>
        )}
      </div >
    </>

  )
}

export default Tablero