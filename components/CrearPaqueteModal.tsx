"use client";

import { useState, useEffect } from "react";
import { Modal, Form, Input, Select, Button, InputNumber, message, Space, Alert, Table, Upload } from "antd";
import { PlusOutlined, DeleteOutlined, UploadOutlined } from "@ant-design/icons";
import { supabase } from "@/lib/supabase";
import { Modelo, Nodo } from "@/types/modelo";
import * as XLSX from "xlsx";

type TipoPaquete = "Individual" | "Triangulares difusos" | "Maut";

interface Alternativa {
    id: string;
    nombre: string;
    valores: Record<number, number | string | (number | string)[]>; // criterioId -> valor(es)
}

interface CrearPaqueteModalProps {
    visible: boolean;
    onClose: () => void;
    modelo: Modelo;
    onSuccess: () => void;
}

const CrearPaqueteModal: React.FC<CrearPaqueteModalProps> = ({
    visible,
    onClose,
    modelo,
    onSuccess,
}) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [tipo, setTipo] = useState<TipoPaquete>(
        modelo.getMetodo()?.toLowerCase() === "maut" ? "Maut" : "Individual"
    );
    const [alternativas, setAlternativas] = useState<Alternativa[]>([
        { id: "1", nombre: "", valores: {} },
    ]);
    const [validacionMAUT, setValidacionMAUT] = useState<string | null>(null);

    // Obtener criterios finales del modelo
    const criteriosFinales: Nodo[] = modelo.getCriteriosFinales();

    const valoresPorTipo = {
        Individual: 1,
        "Triangulares difusos": 3,
        Maut: 2,
    };

    const cantidadValores = valoresPorTipo[tipo];

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
        const nuevoId = (alternativas.length + 1).toString();
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
            const criterios: Record<string, number | string | (number | string)[]> = {};

            criteriosFinales.forEach((criterio) => {
                const acortado = criterio.acortado || `${criterio.idnodo}`;
                criterios[acortado] = alt.valores[criterio.idnodo];
            });

            if (tipo === "Individual") {
                return { nombre: alt.nombre, criterios };
            } else if (tipo === "Triangulares difusos") {
                const lower_criterios: Record<string, number> = {};
                const center_criterios: Record<string, number> = {};
                const upper_criterios: Record<string, number> = {};

                criteriosFinales.forEach((criterio) => {
                    const valores = alt.valores[criterio.idnodo] as (number | string)[];
                    lower_criterios[criterio.idnodo] = valores[0] as number;
                    center_criterios[criterio.idnodo] = valores[1] as number;
                    upper_criterios[criterio.idnodo] = valores[2] as number;
                });

                return {
                    nombre: alt.nombre,
                    lower_criterios,
                    center_criterios,
                    upper_criterios,
                };
            } else if (tipo === "Maut") {
                const min_criterios: Record<string, number | string> = {};
                const max_criterios: Record<string, number | string> = {};

                criteriosFinales.forEach((criterio) => {
                    const valores = alt.valores[criterio.idnodo] as (number | string)[];

                    min_criterios[criterio.idnodo] = valores[0];
                    max_criterios[criterio.idnodo] = valores[1];
                });

                return {
                    nombre: alt.nombre,
                    min_criterios,
                    max_criterios,
                };
            }
        });
    };

    const handleSubmit = async () => {
        if (validacionMAUT) {
            message.error("No se puede crear el paquete. Faltan funciones de utilidad en los criterios finales (MAUT)");
            return;
        }

        if (!validarFormulario()) return;

        setLoading(true);
        try {
            const nombrePaquete = form.getFieldValue("nombre");
            const alternativasJSON = construirJSONAlternativas();

            const { data, error } = await supabase.rpc("insert_paquetedealternativas_notype", {
                p_nombre: nombrePaquete,
                p_tipo: tipo,
                p_modelo: Number(modelo.getId()),
                p_alternativas_json: alternativasJSON,
            });

            if (error) {
                console.error("Error al crear paquete:", error);
                message.error("Error al crear el paquete: " + error.message);
                return;
            }

            message.success("Paquete de alternativas creado exitosamente");
            form.resetFields();
            setAlternativas([{ id: "1", nombre: "", valores: {} }]);
            setTipo(modelo.getMetodo()?.toLowerCase() === "maut" ? "Maut" : "Individual");
            onSuccess();
            onClose();
        } catch (error) {
            console.error("Error inesperado:", error);
            message.error("Error inesperado al crear el paquete");
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        setAlternativas([{ id: "1", nombre: "", valores: {} }]);
        setTipo(modelo.getMetodo()?.toLowerCase() === "maut" ? "Maut" : "Individual");
        onClose();
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
                    message.error("El archivo Excel debe tener al menos una fila de encabezados y una fila de datos");
                    return;
                }

                const nuevasAlternativas: Alternativa[] = [];

                if (tipo === "Maut") {
                    for (let i = 1; i < jsonData.length; i++) {
                        const row = jsonData[i];
                        if (!row || row.length === 0) continue;

                        const nombreAlternativa = row[0]?.toString() || `Alternativa ${i}`;

                        const nuevaAlternativa: Alternativa = {
                            id: `${Date.now()}-${i}`,
                            nombre: nombreAlternativa,
                            valores: {},
                        };

                        let excelColIdx = 1;

                        criteriosFinales.forEach((criterio) => {
                            const valorMin = row[excelColIdx];
                            const valorMax = row[excelColIdx + 1];

                            if (criterio.MAUT?.tipoFuncion === "discreta") {
                                const valorMinStr = valorMin?.toString().trim() || "";
                                const valorMaxStr = valorMax?.toString().trim() || "";
                                const opcionesDiscretas = criterio.MAUT.funcionDiscreta?.valores || [];

                                const opcionMin = opcionesDiscretas.find(
                                    (op) => op.nombre.toLowerCase() === valorMinStr.toLowerCase()
                                );
                                const opcionMax = opcionesDiscretas.find(
                                    (op) => op.nombre.toLowerCase() === valorMaxStr.toLowerCase()
                                );

                                nuevaAlternativa.valores[criterio.idnodo] = 
                                    [opcionMin?.nombre || opcionesDiscretas[0]?.nombre || "",
                                     opcionMax?.nombre || opcionesDiscretas[0]?.nombre || ""];
                            } else {
                                const numMin = typeof valorMin === "number" ? valorMin : Number.parseFloat(valorMin?.toString() || "0");
                                const numMax = typeof valorMax === "number" ? valorMax : Number.parseFloat(valorMax?.toString() || "100");

                                nuevaAlternativa.valores[criterio.idnodo] = [
                                    !isNaN(numMin) ? numMin : criterio.min || 0,
                                    !isNaN(numMax) ? numMax : criterio.max || 100
                                ];
                            }

                            excelColIdx += 2;
                        });

                        nuevasAlternativas.push(nuevaAlternativa);
                    }
                } else if (tipo === "Triangulares difusos") {
                    for (let i = 1; i < jsonData.length; i++) {
                        const row = jsonData[i];
                        if (!row || row.length === 0) continue;

                        const nombreAlternativa = row[0]?.toString() || `Alternativa ${i}`;

                        const nuevaAlternativa: Alternativa = {
                            id: `${Date.now()}-${i}`,
                            nombre: nombreAlternativa,
                            valores: {},
                        };

                        let excelColIdx = 1;

                        criteriosFinales.forEach((criterio) => {
                            const valorInferior = row[excelColIdx];
                            const valorMedio = row[excelColIdx + 1];
                            const valorSuperior = row[excelColIdx + 2];

                            const numInf = typeof valorInferior === "number" ? valorInferior : Number.parseFloat(valorInferior?.toString() || "0");
                            const numMed = typeof valorMedio === "number" ? valorMedio : Number.parseFloat(valorMedio?.toString() || "0");
                            const numSup = typeof valorSuperior === "number" ? valorSuperior : Number.parseFloat(valorSuperior?.toString() || "0");

                            nuevaAlternativa.valores[criterio.idnodo] = [
                                !isNaN(numInf) ? numInf : 0,
                                !isNaN(numMed) ? numMed : 0,
                                !isNaN(numSup) ? numSup : 0
                            ];

                            excelColIdx += 3;
                        });

                        nuevasAlternativas.push(nuevaAlternativa);
                    }
                } else {
                    for (let i = 1; i < jsonData.length; i++) {
                        const row = jsonData[i];
                        if (!row || row.length === 0) continue;

                        const nombreAlternativa = row[0]?.toString() || `Alternativa ${i}`;

                        const nuevaAlternativa: Alternativa = {
                            id: `${Date.now()}-${i}`,
                            nombre: nombreAlternativa,
                            valores: {},
                        };

                        criteriosFinales.forEach((criterio, criterioIdx) => {
                            const excelColIdx = criterioIdx + 1;
                            const valor = row[excelColIdx];

                            if (modelo?.getMetodo() === "MAUT" && criterio.MAUT?.tipoFuncion === "discreta") {
                                const valorStr = valor?.toString().trim() || "";
                                const opcionesDiscretas = criterio.MAUT.funcionDiscreta?.valores || [];

                                const opcionEncontrada = opcionesDiscretas.find(
                                    (op) => op.nombre.toLowerCase() === valorStr.toLowerCase(),
                                );

                                nuevaAlternativa.valores[criterio.idnodo] = 
                                    opcionEncontrada?.nombre || opcionesDiscretas[0]?.nombre || "";
                            } else {
                                if (valor !== undefined && valor !== null && valor !== "") {
                                    const numValor = typeof valor === "number" ? valor : Number.parseFloat(valor.toString());

                                    nuevaAlternativa.valores[criterio.idnodo] = 
                                        !isNaN(numValor) ? numValor : criterio.min || 0;
                                } else {
                                    nuevaAlternativa.valores[criterio.idnodo] = criterio.min || 0;
                                }
                            }
                        });

                        nuevasAlternativas.push(nuevaAlternativa);
                    }
                }

                if (nuevasAlternativas.length === 0) {
                    message.warning("No se encontraron alternativas válidas en el archivo Excel");
                    return;
                }

                setAlternativas(nuevasAlternativas);
                message.success(`Se cargaron ${nuevasAlternativas.length} alternativas desde el Excel`);
            } catch (error) {
                console.error("Error procesando Excel:", error);
                message.error("Error al procesar el archivo Excel");
            }
        };

        reader.readAsBinaryString(file);
        return false; // Prevent automatic upload
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
                        <span style={{ fontSize: "11px", color: "#666", marginBottom: 2 }}>
                            {labels[idx]}
                        </span>
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
                            style={{ width: 90 }}
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
                    placeholder={`Nombre de la alternativa`}
                    value={text}
                    onChange={(e) => actualizarNombreAlternativa(alt.id, e.target.value)}
                />
            ),
        },
        ...criteriosFinales.map((criterio) => ({
            title: criterio.acortado || criterio.titulo,
            key: `criterio-${criterio.idnodo}`,
            width: 150,
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
        <Modal
            title="Crear Nuevo Paquete de Alternativas"
            open={visible}
            onCancel={handleCancel}
            width={1000}
            footer={[
                <Button key="cancel" onClick={handleCancel}>
                    Cancelar
                </Button>,
                <Button
                    key="submit"
                    type="primary"
                    loading={loading}
                    onClick={handleSubmit}
                    disabled={!!validacionMAUT}
                >
                    Crear Paquete
                </Button>,
            ]}
        >
            <Form form={form} layout="vertical">
                {validacionMAUT && (
                    <Alert
                        message="No se puede crear el paquete"
                        description={
                            <div>
                                <p className="font-medium">
                                    ⚠️ Faltan funciones de utilidad (Método MAUT):
                                </p>
                                <div className="whitespace-pre-line text-sm mt-2">
                                    {validacionMAUT}
                                </div>
                                <p className="text-sm mt-2">
                                    Por favor, configura las funciones de utilidad para todos los criterios finales
                                    en el tablero del modelo antes de crear el paquete.
                                </p>
                            </div>
                        }
                        type="error"
                        showIcon
                        style={{ marginBottom: 16 }}
                    />
                )}

                <Form.Item
                    label="Nombre del Paquete"
                    name="nombre"
                    rules={[{ required: true, message: "El nombre es requerido" }]}
                >
                    <Input placeholder="Ingrese el nombre del paquete" />
                </Form.Item>

                {modelo.getMetodo() !== "MAUT" && (
                    <Form.Item label="Tipo de Paquete" required>
                        <Select
                            value={tipo}
                            onChange={(value) => {
                                setTipo(value);
                                setAlternativas(
                                    alternativas.map((alt) => {
                                        const nuevosValores: Record<number, number | string | (number | string)[]> = {};
                                        criteriosFinales.forEach((criterio) => {
                                            nuevosValores[criterio.idnodo] = getValorInicialParaCriterio(criterio);
                                        });
                                        return { ...alt, valores: nuevosValores };
                                    })
                                );
                            }}
                        >
                            <Select.Option value="Individual">Individual</Select.Option>
                            <Select.Option value="Triangulares difusos">Triangulares difusos</Select.Option>
                            <Select.Option value="Maut">MAUT</Select.Option>
                        </Select>
                    </Form.Item>
                )}

                <div style={{ marginBottom: 16, marginTop: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <h4>Alternativas (mínimo 2)</h4>
                        <Space>
                            <Upload 
                                accept=".xlsx,.xls" 
                                beforeUpload={handleExcelUpload} 
                                showUploadList={false}
                            >
                                <Button icon={<UploadOutlined />} size="small">
                                    Cargar desde Excel
                                </Button>
                            </Upload>
                            <Button
                                type="dashed"
                                icon={<PlusOutlined />}
                                onClick={agregarAlternativa}
                                size="small"
                            >
                                Agregar Alternativa
                            </Button>
                        </Space>
                    </div>
                </div>

                <div className="text-sm text-gray-500 mb-3 bg-blue-50 p-2 rounded">
                    <p className="text-xs">
                        <strong>Formato Excel:</strong> Primera columna = nombres de alternativas. 
                        {tipo === "Individual" && " Siguientes columnas = un valor por criterio."}
                        {tipo === "Maut" && " Siguientes columnas = pares de valores (mín, máx) por criterio."}
                        {tipo === "Triangulares difusos" && " Siguientes columnas = tríos de valores (inferior, medio, superior) por criterio."}
                        {" "}Para MAUT discreto: el valor debe coincidir con el nombre de la opción.
                    </p>
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
    );
};

export default CrearPaqueteModal;
