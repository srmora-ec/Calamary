"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import Image from "next/image"
import { supabase } from "@/lib/supabase"

// ─── Static data ──────────────────────────────────────────────────────────────
const METHODS = [
    {
        name: "SAW",
        full: "Simple Additive Weighting",
        desc: "Suma ponderada de los valores normalizados de cada alternativa.",
    },
    {
        name: "MOORA",
        full: "Multi-Objective Optimization on the basis of Ratio Analysis",
        desc: "Optimización multiobjetivo basada en análisis de razones.",
    },
    {
        name: "TOPSIS",
        full: "Technique for Order Preference by Similarity to Ideal Solution",
        desc: "Ordena alternativas según su proximidad a la solución ideal.",
    },
    {
        name: "AHP",
        full: "Proceso Analítico Jerárquico",
        desc: "Asignación de pesos mediante comparaciones por pares y la escala de Saaty.",
    },
    {
        name: "MAUT",
        full: "Multi-Attribute Utility Theory",
        desc: "Evaluación de alternativas mediante funciones de utilidad definidas por el usuario.",
    },
]

const GUIDE_STEPS = [
    {
        id: 1,
        icon: "🌳",
        title: "Construye la jerarquía",
        description:
            "Diseña gráficamente la estructura de tu modelo: objetivo principal, criterios y subcriterios mediante un tablero visual interactivo.",
    },
    {
        id: 2,
        icon: "⚖️",
        title: "Asigna pesos a los criterios",
        description:
            "Ingresa pesos directamente, usa la matriz de comparación por pares de Saaty, o invita expertos para una valoración colaborativa.",
    },
    {
        id: 3,
        icon: "📋",
        title: "Registra las alternativas",
        description:
            "Agrega manualmente las opciones a evaluar o impórtalas desde Excel. Cada alternativa recibe un valor por cada criterio final.",
    },
    {
        id: 4,
        icon: "🏆",
        title: "Evalúa y obtén el ranking",
        description:
            "Selecciona el método MCDM (SAW, MOORA, TOPSIS, AHP o MAUT) y ejecuta la evaluación. El sistema genera el ranking de alternativas automáticamente.",
    },
    {
        id: 5,
        icon: "📤",
        title: "Exporta los resultados",
        description:
            "Descarga el modelo y los resultados en formato JSON o Excel para documentar o reutilizar en futuros proyectos.",
    },
]


// ─── Types ────────────────────────────────────────────────────────────────────
interface Stats {
    modelos: number
    metodos: number
    usuarios: number
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NavBar({ onAbout, onContact, onLogin }: { onAbout: () => void; onContact: () => void; onLogin: () => void }) {
    return (
        <nav
            style={{
                position: "sticky",
                top: 0,
                zIndex: 100,
                backgroundColor: "var(--surface-color)",
                borderBottom: "1px solid var(--border-color)",
                padding: "0 2rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                height: "64px",
                boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <Image src="/logo.png" alt="Calamary logo" width={36} height={36} priority />
                <span style={{ fontWeight: 700, fontSize: "1.25rem" }} className="text-primary">
                    Calamary
                </span>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <button onClick={onAbout} className="btn btn-secondary" style={{ fontSize: "0.875rem" }}>
                    Acerca de
                </button>
                <button onClick={onContact} className="btn btn-secondary" style={{ fontSize: "0.875rem" }}>
                    Contacto
                </button>
                <button onClick={onLogin} className="btn btn-primary" style={{ fontSize: "0.875rem" }}>
                    Iniciar Sesión
                </button>
            </div>
        </nav>
    )
}

function StatCard({ icon, label, value, loading }: { icon: string; label: string; value: number; loading: boolean }) {
    return (
        <div className="card" style={{ flex: "1 1 200px", display: "flex", alignItems: "center", gap: "1.25rem", padding: "1.5rem" }}>
            <div
                style={{
                    width: 56, height: 56, borderRadius: "50%",
                    backgroundColor: "var(--primary-color)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "1.4rem", flexShrink: 0,
                }}
            >
                {icon}
            </div>
            <div>
                <div style={{ fontSize: "1.75rem", fontWeight: 800, minWidth: 32 }} className="text-primary">
                    {loading ? (
                        <span style={{ display: "inline-block", width: 36, height: 28, borderRadius: 6, backgroundColor: "var(--border-color)", animation: "pulse 1.4s ease-in-out infinite" }} />
                    ) : (
                        value
                    )}
                </div>
                <div className="text-secondary" style={{ fontSize: "0.875rem" }}>{label}</div>
            </div>
        </div>
    )
}

function SectionTitle({ icon, title }: { icon?: string; title: string }) {
    return (
        <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }} className="text-primary">
            {icon && <span>{icon}</span>} {title}
        </h2>
    )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
    return (
        <div
            onClick={onClose}
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: "1rem" }}
        >
            <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}>
                <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h2 className="text-primary" style={{ fontWeight: 700, fontSize: "1.1rem" }}>{title}</h2>
                    <button onClick={onClose} className="btn btn-secondary" style={{ padding: "0.25rem 0.75rem", fontSize: "0.875rem" }}>✕ Cerrar</button>
                </div>
                <div className="card-body">{children}</div>
            </div>
        </div>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function HomePage() {
    const { t } = useTranslation()
    const router = useRouter()

    const [modal, setModal] = useState<null | "about" | "contact" | "guide">(null)
    const [expandedFaq, setExpandedFaq] = useState<number | null>(null)
    const [contactForm, setContactForm] = useState({ name: "", email: "", message: "" })
    const [contactSent, setContactSent] = useState(false)

    // ── Stats state ──────────────────────────────────────────────────────────
    const [stats, setStats] = useState<Stats>({ modelos: 0, metodos: 0, usuarios: 0 })
    const [statsLoading, setStatsLoading] = useState(true)

    useEffect(() => {
        async function fetchStats() {
            try {
                const { data, error } = await supabase.rpc("get_public_stats")
                if (error) throw error

                setStats({
                    modelos: data.modelos ?? 0,
                    metodos: data.metodos ?? 0,
                    usuarios: data.usuarios ?? 0,
                })
            } catch (err) {
                console.error("Error fetching stats:", err)
            } finally {
                setStatsLoading(false)
            }
        }

        fetchStats()
    }, [])

    // Definimos las stats con valores dinámicos
    const STATS = [
        { icon: "🗂️", label: "Modelos Públicos", value: stats.modelos },
        { icon: "⚙️", label: "Métodos Disponibles", value: stats.metodos },
        { icon: "👥", label: "Usuarios Registrados", value: stats.usuarios },
    ]


    const handleDownload = () => {
        const link = document.createElement("a")
        link.href = "/assetsdoc/MANUALDEFUNCIONAMIENTO.pdf"
        link.download = "manual.pdf"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    return (
        <div style={{ minHeight: "100vh", backgroundColor: "var(--surface-color)" }}>

            {/* Animación del skeleton loader */}
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }
            `}</style>

            <NavBar onAbout={() => setModal("about")} onContact={() => setModal("contact")} onLogin={() => router.push("/login")} />

            {/* Hero */}
            <div style={{ textAlign: "center", padding: "2.5rem 1.5rem 1.75rem", borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--card-background, #fff)" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "0.75rem" }}>
                    <Image src="/logo.png" alt="Calamary" width={56} height={56} priority />
                </div>
                <h1 style={{ fontSize: "1.75rem", fontWeight: 800, marginBottom: "0.4rem" }} className="text-primary">
                    Bienvenido a Calamary
                </h1>
                <p className="text-secondary" style={{ maxWidth: 580, margin: "0 auto 1.25rem", lineHeight: 1.65 }}>
                    Aplicación web para la construcción y análisis de{" "}
                    <strong>modelos de decisión multicriterio (MCDM)</strong>. Diseña jerarquías de criterios,
                    asigna pesos, evalúa alternativas y analiza la sensibilidad de tu decisión, todo desde el navegador.
                </p>
                <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                    <button onClick={() => router.push("/register")} className="btn btn-primary">Comenzar ahora</button>
                    <button onClick={handleDownload} className="btn btn-secondary">📖 Guía de usuario</button>
                </div>
                <p className="text-secondary" style={{ marginTop: "0.85rem", fontSize: "0.8rem" }}>
                    Soportado por: FCI – Ingeniería de Software · Universidad Técnica Estatal de Quevedo
                </p>
            </div>

            {/* Stats */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "1.25rem", padding: "1.75rem 2rem", justifyContent: "center", borderBottom: "1px solid var(--border-color)" }}>
                {STATS.map((s) => (
                    <StatCard key={s.label} {...s} loading={statsLoading} />
                ))}
            </div>

            {/* Main Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem", padding: "1.75rem 2rem" }}>

                {/* Methods table */}
                <div>
                    <SectionTitle icon="⚙️" title="Métodos Disponibles" />
                    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                            <thead>
                                <tr style={{ backgroundColor: "var(--primary-color)", color: "#fff" }}>
                                    <th style={{ padding: "0.6rem 1rem", textAlign: "left" }}>Sigla</th>
                                    <th style={{ padding: "0.6rem 1rem", textAlign: "left" }}>Descripción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {METHODS.map((m, i) => (
                                    <tr key={m.name} style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: i % 2 === 0 ? "transparent" : "var(--surface-color)" }}>
                                        <td style={{ padding: "0.65rem 1rem", fontWeight: 700, verticalAlign: "top" }} className="text-primary">{m.name}</td>
                                        <td style={{ padding: "0.65rem 1rem" }}>
                                            <div style={{ fontWeight: 500, fontSize: "0.8rem" }}>{m.full}</div>
                                            <div className="text-secondary" style={{ fontSize: "0.75rem", lineHeight: 1.4, marginTop: "0.1rem" }}>{m.desc}</div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Quick steps */}
                <div>
                    <SectionTitle title="¿Cómo funciona?" />
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                        {GUIDE_STEPS.slice(0, 4).map((step) => (
                            <div key={step.id} className="card" style={{ padding: "0.85rem 1rem", display: "flex", gap: "0.85rem", alignItems: "flex-start" }}>
                                <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: "var(--primary-color)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.05rem", flexShrink: 0 }}>
                                    {step.icon}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: "0.875rem", marginBottom: "0.15rem" }}>{step.id}. {step.title}</div>
                                    <div className="text-secondary" style={{ fontSize: "0.78rem", lineHeight: 1.5 }}>{step.description}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>

            {/* Footer */}
            <footer style={{ borderTop: "1px solid var(--border-color)", textAlign: "center", padding: "1.25rem", fontSize: "0.8rem" }} className="text-secondary">
                © {new Date().getFullYear()} Calamary · Universidad Técnica Estatal de Quevedo · Todos los derechos reservados
            </footer>

            {/* ══════ MODALS ══════ */}

            {modal === "about" && (
                <Modal title="Acerca de Calamary" onClose={() => setModal(null)}>
                    <div style={{ lineHeight: 1.75, fontSize: "0.9rem" }} className="text-secondary">
                        <p style={{ marginBottom: "1rem" }}>
                            <strong className="text-primary">Calamary</strong> es una aplicación web para la construcción y análisis de{" "}
                            <strong>modelos de decisión multicriterio (MCDM)</strong>, desarrollada como Proyecto Tecnológico de Titulación
                            en la Facultad de Ciencias de la Computación de la Universidad Técnica Estatal de Quevedo (UTEQ).
                        </p>
                        <p style={{ marginBottom: "1rem" }}>
                            Su propósito es <strong>democratizar el acceso a las metodologías MCDM</strong> mediante una interfaz visual
                            e intuitiva que elimina las barreras técnicas del software tradicional de escritorio, permitiendo trabajar
                            desde cualquier dispositivo con conexión a internet.
                        </p>
                        <p style={{ marginBottom: "0.75rem" }}><strong>Métodos soportados:</strong> SAW, MOORA, TOPSIS, AHP y MAUT.</p>
                        <p style={{ marginBottom: "0.5rem" }}><strong>Características destacadas:</strong></p>
                        <ul style={{ paddingLeft: "1.25rem", marginBottom: "1rem", lineHeight: 1.9 }}>
                            <li>Diseño gráfico de jerarquías con tablero interactivo (React Flow)</li>
                            <li>Asignación de pesos directa o mediante la escala de Saaty</li>
                            <li>Valoración colaborativa invitando expertos por correo electrónico</li>
                        </ul>
                        <p style={{ marginBottom: "0.4rem" }}><strong>Autor:</strong> José Andrés Alvarez Mora</p>
                        <p><strong>Director:</strong> PhD. Iván Fredy Jaramillo Chuqui · UTEQ, 2026</p>
                    </div>
                </Modal>
            )}

            {modal === "contact" && (
                <Modal title="✉️ Contacto" onClose={() => setModal(null)}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", fontSize: "0.9rem" }}>
                        <p className="text-secondary" style={{ lineHeight: 1.65, margin: 0 }}>
                            ¿Tienes dudas o comentarios sobre Calamary? Puedes escribirnos directamente al correo:
                        </p>
                        <a
                            href="mailto:jalvarezm7@uteq.edu.ec"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.6rem",
                                padding: "0.85rem 1.1rem",
                                borderRadius: "var(--border-radius)",
                                border: "1px solid var(--border-color)",
                                backgroundColor: "var(--surface-color)",
                                color: "var(--primary-color)",
                                fontWeight: 600,
                                textDecoration: "none",
                                fontSize: "0.9rem",
                                transition: "background-color 0.15s",
                            }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--primary-color-light, #eff6ff)")}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "var(--surface-color)")}
                        >
                            <span style={{ fontSize: "1.1rem" }}>📧</span>
                            jalvarezm7@uteq.edu.ec
                        </a>
                        <p className="text-secondary" style={{ fontSize: "0.8rem", margin: 0, lineHeight: 1.5 }}>
                            Te responderemos a la brevedad posible. También puedes hacer clic en el enlace para abrir tu cliente de correo directamente.
                        </p>
                    </div>
                </Modal>
            )
            }


        </div >
    )
}