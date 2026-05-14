"use client"

import Image from "next/image"

export default function GraciasPage() {
    return (
        <div
            style={{
                minHeight: "100vh",
                backgroundColor: "var(--surface-color)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "2rem",
            }}
        >
            <div
                className="card"
                style={{
                    width: "100%",
                    maxWidth: "700px",
                    textAlign: "center",
                    padding: "3rem 2rem",
                    border: "1px solid var(--border-color)",
                    backgroundColor: "var(--card-background, #fff)",
                    boxShadow: "0 4px 18px rgba(0,0,0,0.06)",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        justifyContent: "center",
                        marginBottom: "1.5rem",
                    }}
                >
                    <Image
                        src="/logo.png"
                        alt="Calamary"
                        width={72}
                        height={72}
                        priority
                    />
                </div>

                <h1
                    className="text-primary"
                    style={{
                        fontSize: "clamp(2rem, 5vw, 3.5rem)",
                        fontWeight: 800,
                        marginBottom: "1rem",
                        lineHeight: 1.1,
                    }}
                >
                    Gracias por su participación
                </h1>

                <p
                    className="text-secondary"
                    style={{
                        fontSize: "1rem",
                        lineHeight: 1.8,
                        maxWidth: "520px",
                        margin: "0 auto",
                    }}
                >
                    Sus respuestas han sido registradas correctamente.
                </p>
            </div>
        </div>
    )
}