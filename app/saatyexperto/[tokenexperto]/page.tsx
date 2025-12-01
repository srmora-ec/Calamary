"use client";

import CuestionarioExpertos from "@/components/pesos/cuestionario-expertos";
import { supabase } from "@/lib/supabase";
import { Nodo } from "@/types/modelo";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNotification } from "@/components/NotificationProvider";
import "@/i18n";

export default function ModeloPage() {
  const {t} = useTranslation();
  const {notify}=useNotification();
  const { tokenexperto } = useParams();
  const router = useRouter();

  const [nodos, setNodos] = useState<Nodo[]>([]);
  const [loading, setLoading] = useState(true);
  
  type InvitacionValida = {
    nodosJSON: {
      nodes: any[];
    };
  };

  useEffect(() => {
    if (!tokenexperto) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .rpc("obtener_invitacion_valida", { p_token: tokenexperto })
          .single<InvitacionValida>();

        if (error || !data) {
          router.push("/token-caduco");
          return;
        }

        // Mapear nodosJSON a tu estructura de Nodo
        const mappedNodos: Nodo[] = (data?.nodosJSON?.nodes ?? []).map((n: any) => ({
          idnodo: n.idnodo,
          posx: n.posx,
          posy: n.posy,
          titulo: n.titulo,
          idpadre: n.idpadre,
          peso: n.peso,
          pesofinal: n.pesofinal,
          acortado: n.acortado,
          beneficio: n.beneficio,
          descripcion: n.descripcion,
          criterioFinal: n.criterioFinal,
          unidadmedida: n.unidadmedida,
          min: n.min,
          max: n.max,
        }));

        console.log(mappedNodos)

        setNodos(mappedNodos);

      } catch (err) {
        console.error("Error al obtener invitación:", err);
        router.push("/token-caduco");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [tokenexperto, router, supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <span>{t('generic.loading')}</span>
      </div>
    );
  }

  if (nodos.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <span>{t('modelo.nonodos')}</span>
      </div>
    );
  }

  return (
    <div style={{ padding: 10 }}>
      {/* <ComparacionPorPasos nodos={nodos} onSave={(weights: any) => console.log("Pesos guardados:", weights)} /> */}
      <CuestionarioExpertos
        nodos={nodos}
        onSave={async (matrix, weights) => {
          try {
            const token = Array.isArray(tokenexperto) ? tokenexperto[0] : tokenexperto;
            const { data, error } = await supabase.rpc("responder_invitacion_experto", {
              p_tokenunico: token,
              p_matrix: matrix,
              p_pesos: weights,
            });

            if (error) {
              console.error("Error al guardar matriz:", error);
              notify("Error","error",t('expertos.errorguardar'))
              return;
            }

            console.log("Matriz guardada correctamente", data);
            notify(t('alertas.exito'),"success",t('expertos.exito'))
            router.push("/gracias");
          } catch (err) {
            console.error("Error inesperado:", err);
            notify("Error","error",t('alertas.errordes'))
          }
        }}
      />
    </div>
  );
}
