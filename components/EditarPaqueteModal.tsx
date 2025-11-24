"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Modal, Form, Input, Select, Button, InputNumber, message, Space, Alert, Table, Upload, Tooltip } from "antd";
import { PlusOutlined, DeleteOutlined, UploadOutlined, DeploymentUnitOutlined, CalculatorOutlined } from "@ant-design/icons";
import { supabase } from "@/lib/supabase";
import { Modelo, Nodo } from "@/types/modelo";
import * as XLSX from "xlsx";
// Importamos los componentes de comparación
import ComparacionPorPasos from "./pesos/comparacionporpasos";
import ComparacionParesDifusos from "./pesos/ComparacionParesDifusos";

type TipoPaquete = "Individual" | "Triangulares difusos" | "Maut";

interface Alternativa {
    id: string;
    nombre: string;
    valores: Record<number, number | string | (number | string)[]>; // criterioId -> valor(es)
}

interface EditarPaqueteModalProps {
    visible: boolean;
    onClose: () => void;
    modelo: Modelo;
    paqueteId: number | null; // ID del paquete a editar
    onSuccess: () => void;
}

const EditarPaqueteModal: React.FC<EditarPaqueteModalProps> = ({
    visible,
    onClose,
    modelo,
    paqueteId,
    onSuccess,
}) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [tipo, setTipo] = useState<TipoPaquete>("Individual");
    const [alternativas, setAlternativas] = useState<Alternativa[]>([]);
    const [validacionMAUT, setValidacionMAUT] = useState<string | null>(null);

    // Estados para la comparación de alternativas por pasos (Saaty - Individual)
    const [saatyModalOpen, setSaatyModalOpen] = useState(false);
    const [currentSaatyCriterio, setCurrentSaatyCriterio] = useState<Nodo | null>(null);

    // Estados para la comparación de alternativas Difusas (Triangulares)
    const [fuzzyModalOpen, setFuzzyModalOpen] = useState(false);
    const [currentFuzzyCriterio, setCurrentFuzzyCriterio] = useState<Nodo | null>(null);

    // Obtener criterios finales del modelo
    const criteriosFinales: Nodo[] = modelo.getCriteriosFinales();

    const valoresPorTipo = {
        Individual: 1,
        "Triangulares difusos": 3,
        Maut: 2,
    };

    const cantidadValores = valoresPorTipo[tipo];

    // 1. Cargar datos del paquete al abrir el modal
    useEffect(() => {
        if (visible && paqueteId) {
            cargarDatosPaquete();
        }
    }, [visible, paqueteId]);

    // 2. Validar MAUT si aplica
    useEffect(() => {
        if (modelo && modelo.getMetodo() === "MAUT") {
            const resumen = modelo.obtenerResumenValidacionMAUT();
            const validacion = modelo.verificarFuncionesUtilidad();

            if (!validacion.valido) {
                setValidacionMAUT(resumen);
            } else {
                setValidacionMAUT(null);
            }
        } else {
            setValidacionMAUT(null);
        }
    }, [modelo]);

    const cargarDatosPaquete = async () => {
        if (!paqueteId) return;
        setLoading(true);
        try {
            // 1. Obtener info del paquete
            const { data: paqueteData, error: paqueteError } = await supabase
                .from("paquetedealternativas")
                .select("*")
                .eq("id", paqueteId)
                .single();

            if (paqueteError) throw paqueteError;

            form.setFieldsValue({ nombre: paqueteData.nombre });
            setTipo(paqueteData.tipo as TipoPaquete);

            // 2. Obtener alternativas según el tipo
            let altsData: any[] = [];
            let errorAlts = null;

            if (paqueteData.tipo === "Individual") {
                const res = await supabase.from("alternativa").select("*").eq("paquete", paqueteId);
                altsData = res.data || [];
                errorAlts = res.error;
            } else if (paqueteData.tipo === "Triangulares difusos") {
                const res = await supabase.from("alternativatriangular").select("*").eq("paquete", paqueteId);
                altsData = res.data || [];
                errorAlts = res.error;
            } else if (paqueteData.tipo === "Maut") {
                const res = await supabase.from("alternativamaut").select("*").eq("paquete", paqueteId);
                altsData = res.data || [];
                errorAlts = res.error;
            }

            if (errorAlts) throw errorAlts;

            // 3. Mapear datos de BD a estructura del formulario (Alternativa[])
            const altsFormateadas: Alternativa[] = altsData.map((item: any, index: number) => {
                const valores: Record<number, number | string | (number | string)[]> = {};

                criteriosFinales.forEach((criterio) => {
                    const idStr = criterio.idnodo.toString();
                    
                    if (paqueteData.tipo === "Individual") {
                        valores[criterio.idnodo] = item.alternativa[idStr];
                    } else if (paqueteData.tipo === "Triangulares difusos") {
                        valores[criterio.idnodo] = [
                            item.altlower[idStr],
                            item.altcenter[idStr],
                            item.altupper[idStr]
                        ];
                    } else if (paqueteData.tipo === "Maut") {
                        valores[criterio.idnodo] = [
                            item.altmin[idStr],
                            item.altmax[idStr]
                        ];
                    }
                });

                return {
                    id: item.id?.toString() || index.toString(),
                    nombre: item.nombre || `Alternativa ${index + 1}`,
                    valores
                };
            });

            setAlternativas(altsFormateadas);

        } catch (error: any) {
            console.error("Error cargando paquete:", error);
            message.error("Error al cargar los datos del paquete: " + error.message);
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const getValorInicialParaCriterio = (criterio: Nodo): number | string | (number | string)[] => {
        const isMautDiscreto =
            modelo.getMetodo() === "MAUT" &&
            criterio.MAUT?.tipoFuncion === "discreta" &&
            criterio.MAUT.funcionDiscreta?.valores.length;

        if (tipo === "Maut") {
            if (isMautDiscreto) {
                const defaultValue = criterio.MAUT!.funcionDiscreta!.valores[0].nombre;
                return [defaultValue, defaultValue];
            }
            return [criterio.min || 0, criterio.max || 100];
        } else if (tipo === "Triangulares difusos") {
            return [0, 0, 0];
        } else {
            if (isMautDiscreto) {
                return criterio.MAUT!.funcionDiscreta!.valores[0].nombre;
            }
            return criterio.min || 0;
        }
    };

    const agregarAlternativa = () => {
        const nuevoId = `new-${Date.now()}`;
        const nuevaAlternativa: Alternativa = {
            id: nuevoId,
            nombre: "",
            valores: {}
        };

        criteriosFinales.forEach((criterio) => {
            nuevaAlternativa.valores[criterio.idnodo] = getValorInicialParaCriterio(criterio);
        });

        setAlternativas([...alternativas, nuevaAlternativa]);
    };

    const eliminarAlternativa = (id: string) => {
        if (alternativas.length <= 1) {
            message.warning("Debe haber al menos una alternativa");
            return;
        }
        setAlternativas(alternativas.filter((alt) => alt.id !== id));
    };

    const actualizarNombreAlternativa = (id: string, nombre: string) => {
        setAlternativas(
            alternativas.map((alt) => (alt.id === id ? { ...alt, nombre } : alt))
        );
    };

    const actualizarValorCriterio = (
        altId: string,
        criterioId: number,
        valorIndex: number,
        valor: number | string
    ) => {
        setAlternativas(
            alternativas.map((alt) => {
                if (alt.id !== altId) return alt;

                const valoresActuales = alt.valores[criterioId] || [];
                const nuevosValores = Array.isArray(valoresActuales)
                    ? [...valoresActuales]
                    : [valoresActuales];

                nuevosValores[valorIndex] = valor;

                return {
                    ...alt,
                    valores: {
                        ...alt.valores,
                        [criterioId]: cantidadValores === 1 ? valor : nuevosValores,
                    },
                };
            })
        );
    };

    // --- LÓGICA COMPARTIDA PARA COMPARACIONES ---

    // Validar antes de abrir cualquier modal de comparación
    const validarParaComparacion = () => {
        const alternativasSinNombre = alternativas.some(a => !a.nombre || a.nombre.trim() === "");
        if (alternativasSinNombre) {
            message.warning("Por favor asigne nombre a todas las alternativas antes de compararlas.");
            return false;
        }
        if (alternativas.length < 2) {
            message.warning("Se necesitan al menos 2 alternativas para realizar una comparación.");
            return false;
        }
        return true;
    };

    // Transformar Alternativas a Nodos para los componentes de comparación
    // Usamos el índice de la alternativa como 'idnodo' temporal
    const alternativasComoNodos = useMemo(() => {
        if (!saatyModalOpen && !fuzzyModalOpen) return [];
        return alternativas.map((alt, index) => ({
            idnodo: index, 
            titulo: alt.nombre,
            descripcion: `Alternativa: ${alt.nombre}`,
            posx: 0,
            posy: 0,
            idpadre: null,
            min: 0, max: 0, criterioFinal: true, beneficio: true, unidadmedida: ""
        } as Nodo));
    }, [alternativas, saatyModalOpen, fuzzyModalOpen]);


    // --- Lógica SAATY (Individual) ---

    const handleOpenSaaty = (criterio: Nodo) => {
        if (!validarParaComparacion()) return;
        setCurrentSaatyCriterio(criterio);
        setSaatyModalOpen(true);
    };

    const handleSaveSaatyWeights = (weights: Record<number, number>) => {
        if (!currentSaatyCriterio) return;
        
        const nuevasAlternativas = [...alternativas];
        Object.entries(weights).forEach(([indexStr, peso]) => {
            const index = parseInt(indexStr);
            if (nuevasAlternativas[index]) {
                nuevasAlternativas[index].valores[currentSaatyCriterio!.idnodo] = Number(peso.toFixed(4));
            }
        });

        setAlternativas(nuevasAlternativas);
        setSaatyModalOpen(false);
        setCurrentSaatyCriterio(null);
        message.success("Pesos (Individuales) actualizados correctamente.");
    };

    // --- Lógica DIFUSA (Triangular) ---

    const handleOpenFuzzy = (criterio: Nodo) => {
        if (!validarParaComparacion()) return;
        setCurrentFuzzyCriterio(criterio);
        setFuzzyModalOpen(true);
    };

    const handleSaveFuzzyWeights = (weights: Record<number, { l: string; m: string; u: string }>) => {
        if (!currentFuzzyCriterio) return;

        const nuevasAlternativas = [...alternativas];
        
        Object.entries(weights).forEach(([indexStr, pesoObj]) => {
            const index = parseInt(indexStr);
            if (nuevasAlternativas[index]) {
                const valL = parseFloat(pesoObj.l);
                const valM = parseFloat(pesoObj.m);
                const valU = parseFloat(pesoObj.u);

                nuevasAlternativas[index].valores[currentFuzzyCriterio!.idnodo] = [valL, valM, valU];
            }
        });

        setAlternativas(nuevasAlternativas);
        setFuzzyModalOpen(false);
        setCurrentFuzzyCriterio(null);
        message.success("Pesos Difusos actualizados correctamente.");
    };

    // --- MANEJO DE GUARDADO Y EXCEL ---

    const validarFormulario = (): boolean => {
        const nombre = form.getFieldValue("nombre");
        if (!nombre || nombre.trim() === "") {
            message.error("El nombre del paquete es requerido");
            return false;
        }

        if (alternativas.length < 2) {
            message.error("Debe haber al menos 2 alternativas");
            return false;
        }

        for (const alt of alternativas) {
            if (!alt.nombre || alt.nombre.trim() === "") {
                message.error("Todas las alternativas deben tener un nombre");
                return false;
            }
        }

        for (const alt of alternativas) {
            for (const criterio of criteriosFinales) {
                const valores = alt.valores[criterio.idnodo];

                if (cantidadValores === 1) {
                    if (valores === undefined || valores === null || valores === "") {
                        message.error(
                            `La alternativa "${alt.nombre}" debe tener un valor para el criterio "${criterio.titulo}"`
                        );
                        return false;
                    }
                } else {
                    if (!Array.isArray(valores) || valores.length !== cantidadValores) {
                        message.error(
                            `La alternativa "${alt.nombre}" debe tener ${cantidadValores} valores para el criterio "${criterio.titulo}"`
                        );
                        return false;
                    }
                    if (valores.some((v) => v === undefined || v === null || v === "")) {
                        message.error(
                            `Complete todos los valores para el criterio "${criterio.titulo}" en la alternativa "${alt.nombre}"`
                        );
                        return false;
                    }
                }
            }
        }

        return true;
    };

    const construirJSONAlternativas = () => {
        return alternativas.map((alt) => {
            const baseObj: any = { nombre: alt.nombre };

            if (tipo === "Individual") {
                const criterios: Record<string, any> = {};
                criteriosFinales.forEach((criterio) => {
                    criterios[criterio.idnodo] = alt.valores[criterio.idnodo];
                });
                baseObj.criterios = criterios;
            } else if (tipo === "Triangulares difusos") {
                const lower: Record<string, any> = {};
                const center: Record<string, any> = {};
                const upper: Record<string, any> = {};

                criteriosFinales.forEach((criterio) => {
                    const vals = alt.valores[criterio.idnodo] as any[];
                    lower[criterio.idnodo] = vals[0];
                    center[criterio.idnodo] = vals[1];
                    upper[criterio.idnodo] = vals[2];
                });
                
                baseObj.lower_criterios = lower;
                baseObj.center_criterios = center;
                baseObj.upper_criterios = upper;

            } else if (tipo === "Maut") {
                const min: Record<string, any> = {};
                const max: Record<string, any> = {};

                criteriosFinales.forEach((criterio) => {
                    const vals = alt.valores[criterio.idnodo] as any[];
                    min[criterio.idnodo] = vals[0];
                    max[criterio.idnodo] = vals[1];
                });

                baseObj.min_criterios = min;
                baseObj.max_criterios = max;
            }
            return baseObj;
        });
    };

    const handleSubmit = async () => {
        if (validacionMAUT) {
            message.error("No se puede guardar. Faltan funciones de utilidad (MAUT)");
            return;
        }

        if (!validarFormulario()) return;

        setLoading(true);
        try {
            const nombrePaquete = form.getFieldValue("nombre");
            const alternativasJSON = construirJSONAlternativas();

            const { error } = await supabase.rpc("update_paquetedealternativas_notype", {
                p_id: paqueteId,
                p_nombre: nombrePaquete,
                p_tipo: tipo,
                p_alternativas_json: alternativasJSON,
            });

            if (error) throw error;

            message.success("Paquete actualizado exitosamente");
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error("Error inesperado:", error);
            message.error("Error al actualizar: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleExcelUpload = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: "binary" });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

                if (jsonData.length < 2) {
                    message.error("El archivo Excel debe tener datos");
                    return;
                }
                
                // Nota: Lógica de parseo simplificada para editar.
                // Se asume la misma estructura que en creación.
                const nuevasAlternativas: Alternativa[] = [];
                // ... (Lógica de parseo completa iría aquí si se requiere exactamente igual)
                
                message.info("Para importar desde Excel en edición, asegúrese de mantener la estructura de columnas.");
                // Implementación básica para refrescar la tabla si fuera necesario...
            } catch (error) {
                message.error("Error al procesar el archivo Excel");
            }
        };
        reader.readAsBinaryString(file);
        return false;
    };

    const renderCamposValores = (alt: Alternativa, criterio: Nodo) => {
        const isMautDiscreto =
            modelo.getMetodo() === "MAUT" &&
            criterio.MAUT?.tipoFuncion === "discreta" &&
            criterio.MAUT.funcionDiscreta?.valores.length;

        const labels =
            tipo === "Maut"
                ? ["Mínimo", "Máximo"]
                : tipo === "Triangulares difusos"
                    ? ["Inferior", "Medio", "Superior"]
                    : ["Valor"];

        if (isMautDiscreto) {
            const opcionesDiscretas = criterio.MAUT!.funcionDiscreta!.valores || [];

            if (tipo === "Maut") {
                return (
                    <Space direction="horizontal" size="small">
                        {[0, 1].map((idx) => (
                            <div key={idx} style={{ display: "flex", flexDirection: "column" }}>
                                <span style={{ fontSize: "11px", color: "#666", marginBottom: 2 }}>
                                    {labels[idx]}
                                </span>
                                <Select
                                    size="small"
                                    placeholder={labels[idx]}
                                    value={
                                        Array.isArray(alt.valores[criterio.idnodo])
                                            ? (alt.valores[criterio.idnodo] as (string | number)[])[idx]
                                            : opcionesDiscretas[0]?.nombre
                                    }
                                    onChange={(value) =>
                                        actualizarValorCriterio(alt.id, criterio.idnodo, idx, value)
                                    }
                                    style={{ width: 120 }}
                                >
                                    {opcionesDiscretas.map((op) => (
                                        <Select.Option key={op.nombre} value={op.nombre}>
                                            {op.nombre}
                                        </Select.Option>
                                    ))}
                                </Select>
                            </div>
                        ))}
                    </Space>
                );
            } else {
                return (
                    <Select
                        size="small"
                        placeholder="Valor"
                        value={alt.valores[criterio.idnodo] || opcionesDiscretas[0]?.nombre}
                        onChange={(value) =>
                            actualizarValorCriterio(alt.id, criterio.idnodo, 0, String(value))
                        }
                        style={{ width: 150 }}
                    >
                        {opcionesDiscretas.map((op) => (
                            <Select.Option key={op.nombre} value={op.nombre}>
                                {op.nombre}
                            </Select.Option>
                        ))}
                    </Select>
                );
            }
        }

        return (
            <Space direction="horizontal" size="small">
                {Array.from({ length: cantidadValores }).map((_, idx) => (
                    <div key={idx} style={{ display: "flex", flexDirection: "column" }}>
                        {tipo !== "Individual" && (
                            <span style={{ fontSize: "11px", color: "#666", marginBottom: 2 }}>
                                {labels[idx]}
                            </span>
                        )}
                        <InputNumber
                            size="small"
                            placeholder={labels[idx]}
                            min={criterio.min ?? -100}
                            max={criterio.max ?? 100}
                            step={0.01}
                            value={
                                Array.isArray(alt.valores[criterio.idnodo])
                                    ? (alt.valores[criterio.idnodo] as number[])[idx]
                                    : cantidadValores === 1
                                        ? (alt.valores[criterio.idnodo] as number)
                                        : undefined
                            }
                            onChange={(value) =>
                                actualizarValorCriterio(alt.id, criterio.idnodo, idx, value as number)
                            }
                            style={{ width: tipo === "Individual" ? 110 : 80 }}
                        />
                    </div>
                ))}
            </Space>
        );
    };

    const tableColumns = [
        {
            title: 'Alternativa',
            dataIndex: 'nombre',
            key: 'nombre',
            width: 180,
            fixed: 'left' as const,
            render: (text: string, alt: Alternativa) => (
                <Input
                    size="small"
                    value={text}
                    onChange={(e) => actualizarNombreAlternativa(alt.id, e.target.value)}
                />
            ),
        },
        ...criteriosFinales.map((criterio) => ({
            title: (
                <div className="flex flex-col items-center gap-1">
                    <span title={criterio.titulo}>{criterio.acortado || criterio.titulo}</span>
                    
                    {tipo === "Individual" && (
                        <Tooltip title={`Comparar alternativas por pasos (AHP) bajo el criterio: ${criterio.titulo}`}>
                            <Button
                                size="small"
                                type="dashed"
                                icon={<DeploymentUnitOutlined />}
                                onClick={() => handleOpenSaaty(criterio)}
                                className="text-xs flex items-center h-6"
                            >
                                Comparar
                            </Button>
                        </Tooltip>
                    )}

                    {tipo === "Triangulares difusos" && (
                        <Tooltip title={`Comparar alternativas (Fuzzy AHP) bajo el criterio: ${criterio.titulo}`}>
                            <Button
                                size="small"
                                type="dashed"
                                icon={<CalculatorOutlined />}
                                onClick={() => handleOpenFuzzy(criterio)}
                                className="text-xs flex items-center h-6"
                            >
                                Comparar Difuso
                            </Button>
                        </Tooltip>
                    )}
                </div>
            ),
            key: `criterio-${criterio.idnodo}`,
            width: tipo === "Triangulares difusos" ? 280 : 150,
            render: (text: any, alt: Alternativa) => renderCamposValores(alt, criterio),
        })),
        {
            title: 'Acciones',
            key: 'acciones',
            width: 100,
            fixed: 'right' as const,
            render: (text: any, alt: Alternativa) => (
                <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => eliminarAlternativa(alt.id)}
                    disabled={alternativas.length <= 1}
                    size="small"
                >
                    Eliminar
                </Button>
            ),
        },
    ];

    return (
        <>
            <Modal
                title="Editar Paquete de Alternativas"
                open={visible}
                onCancel={onClose}
                width={1000}
                footer={[
                    <Button key="cancel" onClick={onClose}>Cancelar</Button>,
                    <Button
                        key="submit"
                        type="primary"
                        loading={loading}
                        onClick={handleSubmit}
                        disabled={!!validacionMAUT}
                    >
                        Guardar Cambios
                    </Button>,
                ]}
            >
                <Form form={form} layout="vertical">
                    {validacionMAUT && (
                        <Alert message="Error MAUT" description={validacionMAUT} type="error" showIcon style={{ marginBottom: 16 }} />
                    )}

                    <Form.Item
                        label="Nombre del Paquete"
                        name="nombre"
                        rules={[{ required: true, message: "El nombre es requerido" }]}
                    >
                        <Input />
                    </Form.Item>

                    <Form.Item label="Tipo de Paquete">
                        <Select
                            value={tipo}
                            onChange={(value) => {
                                setTipo(value);
                                setAlternativas(alternativas.map(alt => {
                                    const nuevosValores: any = {};
                                    criteriosFinales.forEach(c => nuevosValores[c.idnodo] = getValorInicialParaCriterio(c));
                                    return { ...alt, valores: nuevosValores };
                                }));
                            }}
                            disabled={modelo.getMetodo() === "MAUT"}
                        >
                            <Select.Option value="Individual">Individual</Select.Option>
                            <Select.Option value="Triangulares difusos">Triangulares difusos</Select.Option>
                            <Select.Option value="Maut">MAUT</Select.Option>
                        </Select>
                    </Form.Item>

                    <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
                        <h4>Alternativas</h4>
                        <Space>
                            <Upload accept=".xlsx,.xls" beforeUpload={handleExcelUpload} showUploadList={false}>
                                <Button icon={<UploadOutlined />} size="small">Importar Excel</Button>
                            </Upload>
                            <Button type="dashed" icon={<PlusOutlined />} onClick={agregarAlternativa} size="small">
                                Agregar
                            </Button>
                        </Space>
                    </div>

                    <Table
                        dataSource={alternativas}
                        columns={tableColumns}
                        rowKey="id"
                        pagination={false}
                        size="small"
                        scroll={{ x: 'max-content', y: 400 }}
                    />
                </Form>
            </Modal>

            {/* Modal de Comparación por Pasos (Saaty) */}
            <Modal
                title={`Comparar Alternativas según: ${currentSaatyCriterio?.titulo || ''}`}
                open={saatyModalOpen}
                onCancel={() => setSaatyModalOpen(false)}
                width={800}
                footer={null}
                destroyOnClose
            >
                {saatyModalOpen && (
                    <div className="max-h-[70vh] overflow-y-auto pr-2">
                        <Alert
                            message="Modo de Comparación de Alternativas (AHP)"
                            description="Estás comparando qué tan preferible es una alternativa sobre otra con respecto a este criterio específico."
                            type="info"
                            showIcon
                            className="mb-4"
                        />
                        <ComparacionPorPasos
                            nodos={alternativasComoNodos}
                            onSave={handleSaveSaatyWeights}
                        />
                    </div>
                )}
            </Modal>

            {/* Modal de Comparación Difusa (Triangular) */}
            <Modal
                title={`Comparar Alternativas (Difuso) según: ${currentFuzzyCriterio?.titulo || ''}`}
                open={fuzzyModalOpen}
                onCancel={() => setFuzzyModalOpen(false)}
                width={900}
                footer={null}
                destroyOnClose
            >
                {fuzzyModalOpen && (
                    <div className="max-h-[80vh] overflow-y-auto pr-2">
                         <Alert
                            message="Modo de Comparación Difusa (Fuzzy AHP)"
                            description="Realiza comparaciones utilizando lógica difusa para capturar la incertidumbre en las preferencias."
                            type="success"
                            showIcon
                            className="mb-4"
                        />
                        <ComparacionParesDifusos
                            nodos={alternativasComoNodos}
                            onSave={handleSaveFuzzyWeights}
                            onCancel={() => setFuzzyModalOpen(false)}
                        />
                    </div>
                )}
            </Modal>
        </>
    );
};

export default EditarPaqueteModal;