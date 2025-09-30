"use client";

import ComparacionPorPasos from "@/components/pesos/comparacionporpasos";
import CuestionarioExpertos from "@/components/pesos/cuestionario-expertos";
import { supabase } from "@/lib/supabase";
import { Nodo } from "@/types/modelo";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ModeloPage() {
  const { tokenexperto } = useParams();
  const router = useRouter();

  const [nodos, setNodos] = useState<Nodo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokenexperto) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .rpc("obtener_invitacion_valida", { p_token: tokenexperto })
          .single();

        if (error || !data) {
          router.push("/token-caduco");
          return;
        }

        // Mapear nodosJSON a tu estructura de Nodo
        const mappedNodos: Nodo[] = (data.nodosJSON?.nodes ?? []).map((n: any) => ({
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
        <span>Cargando...</span>
      </div>
    );
  }

  if (nodos.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <span>No hay nodos disponibles.</span>
      </div>
    );
  }

  return (
    <div style={{ padding: 10 }}>
      {/* <ComparacionPorPasos nodos={nodos} onSave={(weights: any) => console.log("Pesos guardados:", weights)} /> */}
      <CuestionarioExpertos nodos={nodos} onSave={(weights: any) => console.log("Pesos guardados:", weights)} />
    </div>
  );
}
