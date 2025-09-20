"use client"

import type { ReactNode } from "react"

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  width?: string // ancho opcional, ej: "400px", "50%", etc.
}

export default function Modal({ isOpen, onClose, title, children, width }: ModalProps) {
  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: width || "500px", maxWidth: "95%" }} // ancho por defecto 500px
      >
        <div className="modal-header">
          <h2 className="text-l font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: "0.25rem 0.5rem" }}
          >
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
