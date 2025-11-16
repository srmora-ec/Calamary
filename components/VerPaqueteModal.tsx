"use client";

import { useState, useEffect } from "react";
import { Modal, Table, Spin, Alert, Tag } from "antd";
import { supabase } from "@/lib/supabase";
import { Modelo, Nodo } from "@/types/modelo";

type TipoPaquete = "Individual" | "Triangulares difusos" | "Maut";

interface VerPaqueteModalProps {
    visible: boolean;
    onClose: () => void;
    paqueteId: number;
    modelo: Modelo;
}

interface AlternativaIndividual {
    id: number;
    alternativa: Record<string, number | string>;
    nombre: string;
}

interface AlternativaMAUT {
    id: number;
    altmin: Record<string, number | string>;
    altmax: Record<string, number | string>;
    nombre: string;
}

interface AlternativaTriangular {
    id: number;
    altlower: Record<string, number>;
    altcenter: Record<string, number>;
    altupper: Record<string, number>;
    nombre: string;
}

const VerPaqueteModal: React.FC<VerPaqueteModalProps> = ({
    visible,
    onClose,
    paqueteId,
    modelo,
}) => {
    const [loading, setLoading] = useState(false);
    const [tipo, setTipo] = useState<TipoPaquete>("Individual");
    const [nombrePaquete, setNombrePaquete] = useState("");
    const [alternativas, setAlternativas] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    const criteriosFinales: Nodo[] = modelo.getCriteriosFinales();

    useEffect(() => {
        if (visible && paqueteId) {
            fetchPaqueteDetalles();
        }
    }, [visible, paqueteId]);

    const fetchPaqueteDetalles = async () => {
        setLoading(true);
        setError(null);

        try {
            // Obtener información básica del paquete
            const { data: paqueteData, error: paqueteError } = await supabase
                .from("paquetedealternativas")
                .select("nombre, tipo")
                .eq("id", paqueteId)
                .single();

            if (paqueteError) throw paqueteError;

            setNombrePaquete(paqueteData.nombre);
            setTipo(paqueteData.tipo as TipoPaquete);

            // Cargar alternativas según el tipo
            if (paqueteData.tipo === "Individual") {
                const { data, error } = await supabase
                    .from("alternativa")
                    .select("id, alternativa, nombre")
                    .eq("paquete", paqueteId);

                if (error) throw error;
                setAlternativas(data as AlternativaIndividual[]);
            } else if (paqueteData.tipo === "Maut") {
                const { data, error } = await supabase
                    .from("alternativamaut")
                    .select("id, altmin, altmax, nombre")
                    .eq("paquete", paqueteId);

                if (error) throw error;
                setAlternativas(data as AlternativaMAUT[]);
            } else if (paqueteData.tipo === "Triangulares difusos") {
                const { data, error } = await supabase
                    .from("alternativatriangular")
                    .select("id, altlower, altcenter, altupper, nombre")
                    .eq("paquete", paqueteId);

                if (error) throw error;
                setAlternativas(data as AlternativaTriangular[]);
            }
        } catch (err: any) {
            console.error("Error cargando detalles del paquete:", err);
            setError(err.message || "Error al cargar los detalles del paquete");
        } finally {
            setLoading(false);
        }
    };

    // Función para verificar si un criterio es discreto MAUT
    const esDiscreto = (criterio: Nodo): boolean => {
        return (
            modelo.getMetodo() === "MAUT" &&
            criterio.MAUT?.tipoFuncion === "discreta" &&
            !!criterio.MAUT.funcionDiscreta?.valores.length
        );
    };

    // Función para formatear valores (numéricos o discretos)
    const formatearValor = (valor: number | string | undefined, criterio: Nodo): string => {
        if (valor === undefined || valor === null) return "—";

        // Si es discreto, mostrar el string directamente
        if (esDiscreto(criterio)) {
            return valor.toString();
        }

        // Si es numérico, formatear con 2 decimales
        if (typeof valor === "number") {
            return valor.toFixed(2);
        }

        // Si es string pero debería ser numérico, intentar convertir
        const numValor = parseFloat(valor.toString());
        if (!isNaN(numValor)) {
            return numValor.toFixed(2);
        }

        return valor.toString();
    };

    // Función para renderizar celda con estilo apropiado
    const renderCelda = (valor: number | string | undefined, criterio: Nodo) => {
        const valorFormateado = formatearValor(valor, criterio);

        if (valorFormateado === "—") {
            return <span className="text-gray-400">—</span>;
        }

        // Si es discreto, mostrar como Tag
        if (esDiscreto(criterio)) {
            return <Tag color="blue">{valorFormateado}</Tag>;
        }

        // Si es numérico, mostrar normal
        return <span className="font-mono">{valorFormateado}</span>;
    };

    const renderTablaIndividual = () => {
        const columns = [
            {
                title: "Alternativa",
                dataIndex: "id",
                key: "id",
                render: (_: any, record: AlternativaIndividual) => (
                    <span className="font-semibold">{record.nombre}</span>
                ),
                width: 200,
                fixed: "left" as const,
            },
            ...criteriosFinales.map((criterio) => ({
                title: criterio.acortado || criterio.titulo,
                key: `crit-${criterio.idnodo}`,
                width: 150,
                render: (record: AlternativaIndividual) => {
                    const valor = record.alternativa[criterio.idnodo.toString()];
                    return renderCelda(valor, criterio);
                },
            })),
        ];

        return (
            <Table
                dataSource={alternativas}
                columns={columns}
                rowKey="id"
                pagination={false}
                scroll={{ x: "max-content" }}
                size="small"
            />
        );
    };

    const renderTablaMAUT = () => {
        const columns = [
            {
                title: "Alternativa",
                dataIndex: "id",
                key: "id",
                render: (_: any, record: AlternativaMAUT) => (
                    <span className="font-semibold">{record.nombre}</span>
                ),
                width: 200,
                fixed: "left" as const,
            },
            ...criteriosFinales.flatMap((criterio) => [
                {
                    title: `${criterio.acortado || criterio.titulo} (Min)`,
                    key: `crit-${criterio.idnodo}-min`,
                    width: esDiscreto(criterio) ? 150 : 120,
                    render: (record: AlternativaMAUT) => {
                        const valor = record.altmin[criterio.idnodo.toString()];
                        return renderCelda(valor, criterio);
                    },
                },
                {
                    title: `${criterio.acortado || criterio.titulo} (Max)`,
                    key: `crit-${criterio.idnodo}-max`,
                    width: esDiscreto(criterio) ? 150 : 120,
                    render: (record: AlternativaMAUT) => {
                        const valor = record.altmax[criterio.idnodo.toString()];
                        return renderCelda(valor, criterio);
                    },
                },
            ]),
        ];

        return (
            <Table
                dataSource={alternativas}
                columns={columns}
                rowKey="id"
                pagination={false}
                scroll={{ x: "max-content" }}
                size="small"
            />
        );
    };

    const renderTablaTriangular = () => {
        const columns = [
            {
                title: "Alternativa",
                dataIndex: "id",
                key: "id",
                render: (_: any, record: AlternativaTriangular) => (
                    <span className="font-semibold">{record.nombre}</span>
                ),
                width: 200,
                fixed: "left" as const,
            },
            ...criteriosFinales.flatMap((criterio) => [
                {
                    title: `${criterio.acortado || criterio.titulo} (Inf)`,
                    key: `crit-${criterio.idnodo}-lower`,
                    width: 110,
                    render: (record: AlternativaTriangular) => {
                        const valor = record.altlower[criterio.idnodo.toString()];
                        return renderCelda(valor, criterio);
                    },
                },
                {
                    title: `${criterio.acortado || criterio.titulo} (Med)`,
                    key: `crit-${criterio.idnodo}-center`,
                    width: 110,
                    render: (record: AlternativaTriangular) => {
                        const valor = record.altcenter[criterio.idnodo.toString()];
                        return renderCelda(valor, criterio);
                    },
                },
                {
                    title: `${criterio.acortado || criterio.titulo} (Sup)`,
                    key: `crit-${criterio.idnodo}-upper`,
                    width: 110,
                    render: (record: AlternativaTriangular) => {
                        const valor = record.altupper[criterio.idnodo.toString()];
                        return renderCelda(valor, criterio);
                    },
                },
            ]),
        ];

        return (
            <Table
                dataSource={alternativas}
                columns={columns}
                rowKey="id"
                pagination={false}
                scroll={{ x: "max-content" }}
                size="small"
            />
        );
    };

    const renderContenido = () => {
        if (loading) {
            return (
                <div className="text-center py-8">
                    <Spin size="large" tip="Cargando alternativas..." />
                </div>
            );
        }

        if (error) {
            return <Alert message="Error" description={error} type="error" showIcon />;
        }

        if (alternativas.length === 0) {
            return (
                <Alert
                    message="Sin Alternativas"
                    description="Este paquete no tiene alternativas registradas."
                    type="info"
                    showIcon
                />
            );
        }

        if (tipo === "Individual") {
            return renderTablaIndividual();
        } else if (tipo === "Maut") {
            return renderTablaMAUT();
        } else if (tipo === "Triangulares difusos") {
            return renderTablaTriangular();
        }

        return null;
    };

    // Contar cuántos criterios son discretos
    const criteriosDiscretos = criteriosFinales.filter(esDiscreto).length;

    return (
        <Modal
            title={`Ver Paquete: ${nombrePaquete}`}
            open={visible}
            onCancel={onClose}
            width={1000}
            footer={null}
        >
            <div className="mb-4 space-y-2">
                <p className="text-sm text-gray-600">
                    <strong>Tipo:</strong> {tipo}
                </p>
                <p className="text-sm text-gray-600">
                    <strong>Total de alternativas:</strong> {alternativas.length}
                </p>
                {modelo.getMetodo() === "MAUT" && criteriosDiscretos > 0 && (
                    <p className="text-sm text-gray-600">
                        <strong>Criterios discretos (cualitativos):</strong> {criteriosDiscretos} de {criteriosFinales.length}
                    </p>
                )}
            </div>
            {renderContenido()}
        </Modal>
    );
};

export default VerPaqueteModal;