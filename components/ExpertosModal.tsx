"use client"

import { useEffect, useState } from "react"
import Modal from "./Modal"
import { supabase } from "@/lib/supabase"
import { Search, UserPlus, Loader2, X } from "lucide-react"
import { Nodo } from "@/types/modelo"
import { sendEmail } from "./sendEmail"

interface Experto {
    id: number
    nombres: string
    correo: string
}

interface ExpertosModalProps {
    isOpen: boolean
    idModelo: number
    nodos: Nodo[]//Los nodos
    onClose: () => void
    onSelect: (expertos: Experto[]) => void
}

export default function ExpertosModal({
    isOpen,
    onClose,
    onSelect,
    idModelo,
    nodos
}: ExpertosModalProps) {
    const [expertos, setExpertos] = useState<Experto[]>([])
    const [loading, setLoading] = useState(false)
    const [busqueda, setBusqueda] = useState("")
    const [error, setError] = useState("")
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [nuevo, setNuevo] = useState({ nombres: "", correo: "" })
    const [selected, setSelected] = useState<Experto[]>([])
    const [mensaje, setMensaje] = useState(
        "Estimado(a) experto(a), lo invitamos cordialmente a participar en la construcción de un modelo de decisión multicriterial. Su experiencia y conocimiento son fundamentales para evaluar y ponderar criterios de manera precisa, mediante el enlace proporcionado. Su colaboración permitirá generar un análisis riguroso, confiable y útil para la toma de decisiones, contribuyendo al desarrollo de un modelo sólido que refleje las prioridades y preferencias relevantes."
    )
    const [progreso, setProgreso] = useState({ actual: 0, total: 0 });

    const fetchExpertos = async (q?: string) => {
        setLoading(true)
        setError("")
        try {
            const { data, error } = await supabase.rpc("obtener_expertos", {
                p_busqueda: q || null,
            })
            if (error) throw error
            setExpertos(data || [])
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (isOpen) {
            fetchExpertos()
            setBusqueda("")
            setShowCreateForm(false)
            setNuevo({ nombres: "", correo: "" })
            setSelected([])
        }
    }, [isOpen])

    const handleCreate = async () => {
        if (!nuevo.nombres.trim() || !nuevo.correo.trim()) {
            setError("Debes ingresar nombre y correo")
            return
        }
        setLoading(true)
        setError("")
        try {
            const { data, error } = await supabase.rpc("crear_experto", {
                p_nombres: nuevo.nombres,
                p_correo: nuevo.correo,
            })
            if (error) throw error
            if (data) {
                setExpertos([data, ...expertos])
                setShowCreateForm(false)
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const toggleSelect = (exp: Experto) => {
        const exists = selected.find((s) => s.id === exp.id)
        if (exists) {
            setSelected(selected.filter((s) => s.id !== exp.id))
        } else {
            setSelected([...selected, exp])
        }
    }

    // Contador de caracteres para el mensaje
    const handleMensajeChange = (text: string) => {
        if (text.length <= 400) {
            setMensaje(text)
        }
    }

    const handleEnviarInvitaciones = async () => {
        if (selected.length === 0) return;

        setLoading(true);
        setError("");
        setProgreso({ actual: 0, total: 0 });

        try {
            // Convertimos nodos a JSON
            const nodosJSON = { nodes: nodos };

            // Sacamos el idpadre del nodo raíz
            const idpadre = nodos[0]?.idpadre ?? 0;

            // Array de IDs de expertos seleccionados
            const idsExpertos = selected.map((s) => s.id);

            // 1. Crear invitaciones en la base de datos
            const { data, error } = await supabase.rpc("crear_invitaciones_expertos", {
                p_expertos: idsExpertos,
                p_idmodelo: idModelo,
                p_idpadre: idpadre,
                p_nodosjson: nodosJSON,
                p_instrucciones: mensaje,
            });

            if (error) throw error;

            console.log("Invitaciones creadas:", data);

            // 2. Configurar progreso
            setProgreso({ actual: 0, total: data.length });

            // 3. Enviar emails a cada experto con su URL única
            let emailsEnviados = 0;
            let emailsFallidos = 0;

            for (let i = 0; i < data.length; i++) {
                const invitacion = data[i];

                try {
                    // Actualizar progreso
                    setProgreso({ actual: i + 1, total: data.length });

                    // Buscar el experto correspondiente
                    const experto = selected.find(exp => exp.id === invitacion.idexperto);

                    if (!experto) {
                        console.error(`No se encontró experto con ID: ${invitacion.idexperto}`);
                        emailsFallidos++;
                        continue;
                    }

                    // Crear contenido HTML personalizado
                    const htmlContent = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #1890ff; text-align: center;">Invitación a participar como experto</h2>
                        
                        <p>Estimado/a <strong>${experto.nombres}</strong>,</p>
                        
                        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <p>${mensaje}</p>
                        </div>
                        
                        <p>Para participar en la evaluación, por favor haga clic en el siguiente enlace:</p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${invitacion.urlinvitacion}" 
                               style="background-color: #1890ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                                🔗 Acceder al cuestionario
                            </a>
                        </div>
                        
                        <p style="color: #666; font-size: 14px;">
                            <strong>Nota:</strong> Este enlace es único y personal. Su participación es muy valiosa para nuestro estudio.
                        </p>
                        
                        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                        
                        <p style="color: #666; font-size: 12px; text-align: center;">
                            Gracias por su colaboración.<br>
                            <strong>Equipo de investigación - CALAMARY</strong>
                        </p>
                    </div>
                `;

                    // Enviar email
                    const res = await fetch(`${process.env.NEXT_PUBLIC_URLFASTCALAMARY}/send-email`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            to: experto.correo,
                            subject: "Invitación para participar como experto - Modelo de decisión multicriterial",
                            html_content: htmlContent
                        })
                    });

                    if (res.ok) {
                        console.log(`Email enviado exitosamente a: ${experto.correo}`);
                        emailsEnviados++;
                    } else {
                        const errorData = await res.json();
                        console.error(`Error enviando email a ${experto.correo}:`, errorData);
                        emailsFallidos++;
                    }

                    // Pequeña pausa entre emails para evitar rate limiting
                    await new Promise(resolve => setTimeout(resolve, 500));

                } catch (emailError) {
                    console.error(`Error enviando email:`, emailError);
                    emailsFallidos++;
                }
            }

            // Mostrar resultado final
            if (emailsEnviados > 0) {
                alert(`✅ Se crearon ${data.length} invitaciones y se enviaron ${emailsEnviados} emails exitosamente.${emailsFallidos > 0 ? ` (${emailsFallidos} emails fallaron)` : ''}`);
            } else {
                alert(`⚠️ Se crearon ${data.length} invitaciones pero no se pudieron enviar los emails.`);
            }

            // Limpiar selección y cerrar modal
            setSelected([]);
            setProgreso({ actual: 0, total: 0 });
            onClose();

        } catch (err: any) {
            setError(err.message || "Error al crear invitaciones");
            console.error("Error en handleEnviarInvitaciones:", err);
            setProgreso({ actual: 0, total: 0 });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Seleccionar Expertos" width="650px">
            <div className="space-y-6">
                {/* Barra de búsqueda */}
                <div className="flex flex-wrap md:flex-nowrap items-center gap-2 w-full" style={{ marginBottom: 10 }}>
                    <div className="relative flex-1">
                        <input
                            type="text"
                            placeholder="Buscar experto..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") fetchExpertos(busqueda)
                            }}
                            className="pl-8 pr-3 py-2 border rounded w-full"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => fetchExpertos(busqueda)}
                        className="btn btn-primary whitespace-nowrap"
                    >
                        Buscar
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowCreateForm(!showCreateForm)}
                        className="btn btn-secondary flex items-center gap-2 whitespace-nowrap"
                    >
                        <UserPlus className="h-4 w-4" /> Nuevo
                    </button>
                </div>

                {error && <div className="text-red-500 text-sm">{error}</div>}

                {/* Crear experto */}
                {showCreateForm && (
                    <div className="border rounded p-4 space-y-3 mt-2">
                        <input
                            type="text"
                            placeholder="Nombres"
                            value={nuevo.nombres}
                            onChange={(e) => setNuevo({ ...nuevo, nombres: e.target.value })}
                            className="form-input w-full"
                        />
                        <input
                            type="email"
                            placeholder="Correo"
                            value={nuevo.correo}
                            onChange={(e) => setNuevo({ ...nuevo, correo: e.target.value })}
                            className="form-input w-full"
                        />
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={handleCreate}
                                disabled={loading}
                                className="btn btn-primary"
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear"}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowCreateForm(false)}
                                className="btn btn-secondary"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}

                {/* Seleccionados */}
                {selected.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {selected.map((s) => (
                            <span
                                key={s.id}
                                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full flex items-center gap-1 text-sm"
                            >
                                {s.nombres}
                                <X
                                    className="h-4 w-4 cursor-pointer"
                                    onClick={() => toggleSelect(s)}
                                />
                            </span>
                        ))}
                    </div>
                )}

                {/* Lista de expertos */}
                <div className="max-h-64 overflow-y-auto border rounded mt-2" style={{ marginTop: 10 }}>
                    {loading ? (
                        <div className="p-4 text-center text-gray-500">Cargando...</div>
                    ) : expertos.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">No hay expertos</div>
                    ) : (
                        <ul>
                            {expertos.map((exp) => {
                                const isSelected = !!selected.find((s) => s.id === exp.id)
                                return (
                                    <li
                                        key={exp.id}
                                        onClick={() => toggleSelect(exp)}
                                        className={`px-4 py-3 cursor-pointer border-b last:border-0 transition ${isSelected
                                            ? "bg-blue-100 hover:bg-blue-200"
                                            : "hover:bg-blue-50"
                                            }`}
                                    >
                                        <p className="font-medium">{exp.nombres}</p>
                                        <p className="text-sm text-gray-500">{exp.correo}</p>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </div>

                {/* Botón confirmar */}
                <div className="flex justify-end mt-2" style={{ marginTop: 10 }}>
                    <button
                        type="button"
                        onClick={handleEnviarInvitaciones}
                        disabled={selected.length === 0 || loading}
                        className="btn btn-primary"
                    >
                        {loading ? (
                            <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {progreso.total > 0 ? `Enviando emails ${progreso.actual}/${progreso.total}` : 'Procesando...'}
                            </div>
                        ) : (
                            `Confirmar selección (${selected.length})`
                        )}
                    </button>
                </div>
                {/* Mensaje editable */}
                <div className="mt-4">
                    <label className="block mb-1 font-medium" style={{ marginBottom: 10 }}>
                        Mensaje de invitación (máx. 400 letras)
                    </label>
                     <label className="block mb-1" style={{ marginBottom: 10 }}>
                        Es importante incluir un contexto o explicación que explique el modelo de decisión que se está creando de tal manera que quede claro para los expertos
                    </label>
                    <textarea
                        className="form-input w-full h-40"
                        value={mensaje}
                        maxLength={400}
                        onChange={(e) => handleMensajeChange(e.target.value)}
                    />
                </div>
            </div>
        </Modal>
    )
}
