"use client";

import { useState, useEffect } from "react";
import { Button, Spin, Table, Alert } from "antd";
import { PlusOutlined, EyeOutlined, EditOutlined } from "@ant-design/icons";
import { supabase } from "@/lib/supabase";
import { Modelo } from "@/types/modelo";
import CrearPaqueteModal from "./CrearPaqueteModal";
import VerPaqueteModal from "./VerPaqueteModal";
import EditarPaqueteModal from "./EditarPaqueteModal";

// --- Tipos de la Entidad PaqueteDeAlternativas ---

/**
 * Tipos definidos para la columna 'tipo' de la tabla 'paquetedealternativas'.
 */
type TipoPaquete = "Individual" | "Triangulares difusos" | "Maut";

/**
 * Interfaz que refleja la estructura de la tabla 'paquetedealternativas' para los datos a mostrar.
 */
interface PaqueteDeAlternativas {
  id: number;
  nombre: string;
  tipo: TipoPaquete;
  cantidad: number;
  created_at: string;
}

/**
 * Interfaz para el prop 'modelo', asumiendo que contiene al menos el 'id'.
 */
interface PaquetesDeAlternativasProps {
  modelo: Modelo;
}

const PaquetesDeAlternativas: React.FC<PaquetesDeAlternativasProps> = ({ modelo }) => {
  const [paquetes, setPaquetes] = useState<PaqueteDeAlternativas[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [verModalVisible, setVerModalVisible] = useState(false);
  const [editarModalVisible, setEditarMV] = useState(false);

  const [paqueteSeleccionado, setPaqueteSeleccionado] = useState<number | null>(null);

  const fetchPaquetes = async (modeloId: number) => {
    setLoading(true);
    setError(null);

    // Consulta a Supabase para obtener los paquetes asociados al ID del modelo
    const { data, error } = await supabase
      .from("paquetedealternativas")
      .select("id, nombre, tipo, cantidad, created_at")
      .eq("modelo", modeloId) // Filtra por el ID del modelo recibido
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error al cargar los paquetes de alternativas:", error);
      setError("Error al cargar los paquetes: " + error.message);
      setPaquetes([]);
    } else {
      setPaquetes(data as PaqueteDeAlternativas[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    // Ejecuta la carga de datos cuando el componente se monta o el ID del modelo cambia
    if (modelo) {
      fetchPaquetes(Number(modelo.getId()));
    }
  }, [modelo]);

  // Definición de las columnas para el componente Table de Ant Design
  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      width: 60,
    },
    {
      title: "Nombre",
      dataIndex: "nombre",
      key: "nombre",
    },
    {
      title: "Tipo",
      dataIndex: "tipo",
      key: "tipo",
    },
    {
      title: "Cant. Alternativas",
      dataIndex: "cantidad",
      key: "cantidad",
      width: 150,
    },
    {
      title: "Creado",
      dataIndex: "created_at",
      key: "created_at",
      render: (date: string) => new Date(date).toLocaleDateString(),
      width: 100,
    },
    {
      title: "Acciones",
      key: "acciones",
      width: 100,
      render: (record: PaqueteDeAlternativas) => (
        <>
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => {
              setPaqueteSeleccionado(record.id);
              setVerModalVisible(true);
            }}
          >
            Ver
          </Button>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => {
              setPaqueteSeleccionado(record.id);
              setEditarMV(true);
            }}
          >
            Editar
          </Button>
        </>
      ),
    },
  ];

  const handleSuccess = () => {
    fetchPaquetes(Number(modelo.getId()));
  };


  return (
    <div className="p-4">

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Paquetes de alternativas</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setModalVisible(true)}
        >
          Crear nuevo paquete de alternativas
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <Spin size="large" tip="Cargando paquetes..." />
        </div>
      ) : error ? (
        <Alert
          message="Error de Carga"
          description={error}
          type="error"
          showIcon
        />
      ) : paquetes.length === 0 ? (
        <Alert
          message="No hay Paquetes de Alternativas"
          description={`No se encontraron paquetes de alternativas asociados al Modelo ID: ${modelo.getId()}.`}
          type="info"
          showIcon
        />
      ) : (
        // Mostrar la tabla con los paquetes disponibles
        <Table
          dataSource={paquetes}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 5 }}
          scroll={{ x: 'max-content' }}
        />
      )}

      <CrearPaqueteModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        modelo={modelo}
        onSuccess={handleSuccess}
      />

      {paqueteSeleccionado && (
        <>
          <VerPaqueteModal
            visible={verModalVisible}
            onClose={() => {
              setVerModalVisible(false);
              setPaqueteSeleccionado(null);
            }}
            paqueteId={paqueteSeleccionado}
            modelo={modelo}
          />
          <EditarPaqueteModal
            visible={editarModalVisible}
            onClose={() => {
              setEditarMV(false);
              setPaqueteSeleccionado(null);
            }}
            paqueteId={paqueteSeleccionado}
            onSuccess={()=>alert("Se edito el paquete con exito")}
            modelo={modelo}
          />
        </>
      )}
    </div>
  );
};

export default PaquetesDeAlternativas;
