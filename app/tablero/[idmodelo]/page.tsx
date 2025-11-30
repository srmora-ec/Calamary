// app/modelos/[idmodelo]/page.tsx  (Next.js 13+ con App Router)
"use client";

import ConfigureMautNodo from "@/components/ConfiguredCriterioMaut";
import ConfigureModalNodo from "@/components/ConfiguredNodo";//Configurar la información del nodo
import ConfigureModalPeso from "@/components/pesos/ConfiguredPeso";//Modal para confugurar el peso
import Spinner from "@/components/pesos/Spinner";
import Tablero from "@/components/tablero";
import { useAuthContext } from "@/context/AuthProvider";
import { supabase } from "@/lib/supabase";
import { Modelo, ModeloData, Nodo } from "@/types/modelo";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNotification } from "@/components/NotificationProvider";

export default function ModeloPage() {
  const { idmodelo } = useParams(); // Cargar el parametro delicado

  const { notify } = useNotification();
  const [modelo, setModelo] = useState<Modelo | null>(null); //estructura del modelo
  const [orientacion, setOrientacion] = useState<"h" | "v">("h"); //Para cambiar orientacion
  const [linea, setLinea] = useState<number>(1); //Para la linea
  const { user, loading } = useAuthContext(); //Verficamos que inicie sesión
  const [isConfigureOpen, setIsConfigureOpen] = useState(false);
  const [IsMautConfigured, setIsMautConfigured] = useState(false);
  // const [isPesoOpen, setIsPesoOpen] = useState(false); //Para abrir 
  const [nodoActual, setNodoActual] = useState<Nodo | null>(null); //Para actualizar un nodo

  const router = useRouter();
  const { t } = useTranslation("modelos");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    const fetchModelo = async () => {//consultar el modelo
      const { data, error } = await supabase
        .rpc("get_modelo_with_nodos", { p_idmodelo: idmodelo });//Consultando el modelo con la función creada en supabase

      if (error) {
        console.error("Error cargando modelo:", error);
        return;
      }

      if (data) {
        const mapped: ModeloData = {//Crear modeldata
          id: data.modelo.id?.toString(),
          nombre: data.modelo.nombre,
          descripcion: data.modelo.descripcion,
          orientacion: data.modelo.orientacion,
          linea: data.modelo.linea,
          publico: data.modelo.publico,
          metodo: data.modelo.metodo,
          nodos: {
            nodes: (data.modelo.nodos?.nodes ?? []).map((n: any) => ({
              idnodo: n.idnodo,
              posx: n.posx,
              posy: n.posy,
              titulo: n.titulo,
              idpadre: n.idpadre,
              descripcion: n.descripcion,
              peso: n.peso,
              pesofinal: n.pesofinal,
              acortado: n.acortado,
              beneficio: n.beneficio,
              unidadmedida: n.unidadmedida,
              MAUT: n.MAUT,
              min: n.min,
              max: n.max
            }))
          }
        };

        const modeloObj = new Modelo(mapped);
        setModelo(modeloObj);
        setOrientacion(modeloObj.getOrientacion());
        setLinea(modeloObj.getLinea());
      }
    };
    fetchModelo();

  }, [idmodelo]);

  const handleNodoActualizado = (nodo: Nodo) => {
    setNodoActual(nodo);
    setIsConfigureOpen(true);
  }

  const handleCriterioMaut = (nodo: Nodo) => {
    setNodoActual(nodo);
    setIsMautConfigured(true);

  }

  const handleModeloActualizado = async (modeloActual: Modelo) => {//Para actualizar elmodelo en la base de datos
    const datamodelo = modeloActual.getData();
    const { data, error } = await supabase
      .rpc("update_modelo_con_nodos", {
        p_idmodelo: Number(datamodelo.id),
        p_nombre: datamodelo.nombre,
        p_descripcion: datamodelo.descripcion,
        p_orientacion: datamodelo.orientacion,
        p_linea: datamodelo.linea,
        p_publico: datamodelo.publico,
        p_nodos: { nodes: datamodelo.nodos.nodes },
        p_metodo_nombre: datamodelo.metodo
      });

    if (error) {
      console.error("Error actualizando modelo:", error);
      notify("Error", "error", t('modelos.errorupdmodel'))
      return null;
    }
    alert("Modelo actualizado");
    notify(t('alertas.exito'), "success", t('modelos.modelactua'))
    console.log("Modelo actualizado:", data);
  }

  if (loading || !user) {
    return (
      <Spinner visible={true} />
    )
  }

  return (
    <div className="flex items-center justify-center h-screen">
      {nodoActual && (
        <>
          <ConfigureModalNodo
            isOpen={isConfigureOpen}
            onClose={() => { setIsConfigureOpen(false) }}
            nodo={nodoActual}
            onNodoUpdated={setNodoActual}
          />

          <ConfigureMautNodo
            isOpen={IsMautConfigured}
            onClose={() => { setIsMautConfigured(false) }}
            nodo={nodoActual}
            onNodoUpdated={setNodoActual}
          />
        </>
      )}

      {modelo && (
        <>
          <Tablero
            modelo={modelo}
            orientacion={orientacion}
            linea={linea}
            onActualizarModelo={handleModeloActualizado}
            onActualizarNodo={handleNodoActualizado}
            onCriterioMaut={handleCriterioMaut}
            nodoCambios={nodoActual}
          />
        </>
      )}
    </div>
  );
}
