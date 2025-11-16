"use client";

import { useState, useEffect } from "react";
import { Modal, Table, Button, Alert, Spin, message } from "antd";
import { supabase } from "@/lib/supabase";
import { Modelo, Nodo } from "@/types/modelo";

type TipoPaquete = "Individual" | "Triangulares difusos" | "Maut";

interface PaqueteDeAlternativas {
  id: number;
  nombre: string;
  tipo: TipoPaquete;
  cantidad: number;
  created_at: string;
}

interface CargarAlternativasModalProps {
  visible: boolean;
  onClose: () => void;
  modelo: Modelo;
  onCargar: (alternativas: any[], tipo: TipoPaquete) => void;
}

interface AlternativaIndividual {
  id: number;
  alternativa: Record<string, number>;
}

interface AlternativaMAUT {
  id: number;
  altmin: Record<string, number>;
  altmax: Record<string, number>;
}

const CargarAlternativasModal: React.FC<CargarAlternativasModalProps> = ({
  visible,
  onClose,
  modelo,
  onCargar,
}) => {
  const [paquetes, setPaquetes] = useState<PaqueteDeAlternativas[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPaqueteId, setSelectedPaqueteId] = useState<number | null>(null);

  const metodoModelo = modelo.getMetodo();
  const esModeloMAUT = metodoModelo === "MAUT";

  useEffect(() => {
    if (visible) {
      fetchPaquetes();
    }
  }, [visible]);

  const fetchPaquetes = async () => {
    setLoading(true);
    setError(null);

    try {
      // Filtrar por tipo según el método del modelo
      const tipoPermitido = esModeloMAUT ? "Maut" : "Individual";

      const { data, error } = await supabase
        .from("paquetedealternativas")
        .select("id, nombre, tipo, cantidad, created_at")
        .eq("modelo", Number(modelo.getId()))
        .eq("tipo", tipoPermitido)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setPaquetes(data as PaqueteDeAlternativas[]);
    } catch (err: any) {
      console.error("Error cargando paquetes:", err);
      setError(err.message || "Error al cargar los paquetes");
    } finally {
      setLoading(false);
    }
  };

  const cargarAlternativasDelPaquete = async (paqueteId: number, tipo: TipoPaquete) => {
    setLoading(true);

    try {
      let alternativasData: any[] = [];

      if (tipo === "Individual") {
        const { data, error } = await supabase
          .from("alternativa")
          .select("id, alternativa, nombre")
          .eq("paquete", paqueteId);

        if (error) throw error;
        alternativasData = data as AlternativaIndividual[];
      } else if (tipo === "Maut") {
        const { data, error } = await supabase
          .from("alternativamaut")
          .select("id, altmin, altmax,nombre")
          .eq("paquete", paqueteId);

        if (error) throw error;
        alternativasData = data as AlternativaMAUT[];
      }

      onCargar(alternativasData, tipo);
      message.success("Alternativas cargadas exitosamente");
      onClose();
    } catch (err: any) {
      console.error("Error cargando alternativas:", err);
      message.error("Error al cargar las alternativas: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: "Nombre",
      dataIndex: "nombre",
      key: "nombre",
    },
    {
      title: "Tipo",
      dataIndex: "tipo",
      key: "tipo",
      width: 150,
    },
    {
      title: "Alternativas",
      dataIndex: "cantidad",
      key: "cantidad",
      width: 120,
    },
    {
      title: "Creado",
      dataIndex: "created_at",
      key: "created_at",
      width: 120,
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: "Acciones",
      key: "acciones",
      width: 100,
      render: (record: PaqueteDeAlternativas) => (
        <Button
          type="primary"
          size="small"
          onClick={() => cargarAlternativasDelPaquete(record.id, record.tipo)}
        >
          Cargar
        </Button>
      ),
    },
  ];

  const renderContenido = () => {
    if (loading) {
      return (
        <div className="text-center py-8">
          <Spin size="large" tip="Cargando paquetes..." />
        </div>
      );
    }

    if (error) {
      return <Alert message="Error" description={error} type="error" showIcon />;
    }

    if (paquetes.length === 0) {
      return (
        <Alert
          message="No hay paquetes disponibles"
          description={`No se encontraron paquetes de tipo "${esModeloMAUT ? "MAUT" : "Individual"}" para este modelo.`}
          type="info"
          showIcon
        />
      );
    }

    return (
      <Table
        dataSource={paquetes}
        columns={columns}
        rowKey="id"
        pagination={{ pageSize: 5 }}
      />
    );
  };

  return (
    <Modal
      title="Cargar Alternativas Guardadas"
      open={visible}
      onCancel={onClose}
      width={800}
      footer={null}
    >
      <div className="mb-4">
        <Alert
          message={`Modelo actual: ${metodoModelo}`}
          description={`Solo puedes cargar paquetes de tipo "${esModeloMAUT ? "MAUT" : "Individual"}" para este modelo.`}
          type="info"
          showIcon
        />
      </div>
      {renderContenido()}
    </Modal>
  );
};

export default CargarAlternativasModal;
