// app/dashboard/page.tsx o pages/dashboard.tsx
"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export default function DashboardPage() {
  const [modelos, setModelos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadModelos = async () => {
      setLoading(true)
      const { data, error } = await supabase.from("modelos").select("*")
      if (error) console.error(error)
      else setModelos(data)
      setLoading(false)
    }

    loadModelos()
  }, [])

  if (loading) return <p>Cargando...</p>

  return (
    <div>
      <h1>Dashboard</h1>
      <ul>
        {modelos.map((m) => (
          <li key={m.id}>{m.nombre}</li>
        ))}
      </ul>
    </div>
  )
}
