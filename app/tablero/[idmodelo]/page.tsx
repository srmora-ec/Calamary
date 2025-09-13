// app/modelos/[idmodelo]/page.tsx  (Next.js 13+ con App Router)
"use client";

import Tablero from "@/components/tablero";
import { useAuthContext } from "@/context/AuthProvider";
import { supabase } from "@/lib/supabase";
import { Modelo, ModeloData } from "@/types/modelo";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react";

export default function ModeloPage() {
  const { idmodelo } = useParams();// Cargar el parametro delid
  const [modelo, setModelo] = useState<Modelo | null>(null);//estructura del modelo
  const [orientacion, setOrientacion] = useState<"h" | "v">("h");//Para cambiar orientacion
  const [linea, setLinea] = useState<number>(1);//Para la linea
  const { user, loading } = useAuthContext();//Verficamos que inicie sesión
  const router = useRouter();

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
        console.log("Veamos ahora que pasa")
        console.log(data)
        const mapped: ModeloData = {//Crear modeldata
          id: data.modelo.id?.toString(),
          nombre: data.modelo.nombre,
          descripcion: data.modelo.descripcion,
          orientacion: data.modelo.orientacion,
          linea: data.modelo.linea,
          publico: data.modelo.publico,
          nodos: {
            nodes: (data.modelo.nodos?.nodes ?? []).map((n: any) => ({
              idnodo: n.idnodo,
              posx: n.posx,
              posy: n.posy,
              titulo: n.titulo,
              idpadre: n.idpadre,
              peso: n.peso,
              pesofinal: n.pesofinal,
              acortado: n.acortado
            }))
          }
        };

        console.log("luego queda")
        console.log(mapped)
        const modeloObj = new Modelo(mapped);
        setModelo(modeloObj);
        setOrientacion(modeloObj.getOrientacion());
        setLinea(modeloObj.getLinea());
        console.log("veamos")
        console.log(modeloObj.getOrientacion())

      }
    };
    fetchModelo();

  }, [idmodelo]);

  const handleModeloActualizado = async (modeloActual: Modelo) => {
    const datamodelo = modeloActual.getData();
    const { data, error } = await supabase
      .rpc("update_modelo_con_nodos", {
        p_idmodelo: Number(datamodelo.id),
        p_nombre: datamodelo.nombre,
        p_descripcion: datamodelo.descripcion,
        p_orientacion: datamodelo.orientacion,
        p_linea: datamodelo.linea,
        p_publico: datamodelo.publico,
        p_nodos: { nodes: datamodelo.nodos.nodes }
      });

    if (error) {
      console.error("Error actualizando modelo:", error);
      return null;
    }
    alert("Modelo actualizado");
    console.log("Modelo actualizado:", data);
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" style={{ width: "40px", height: "40px" }}></div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center h-screen">

      {modelo ? (
        <Tablero
          modelo={modelo}
          orientacion={orientacion}
          linea={linea}
          onActualizarModelo={handleModeloActualizado}
        />

      ) : (
        <p>Cargando...</p>
      )}    </div>
  );
}
