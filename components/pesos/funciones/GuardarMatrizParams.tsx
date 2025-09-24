import { supabase } from "@/lib/supabase"

interface GuardarMatrizParams {
  idmodelo: number
  nodopadre: number
  matrix: Record<string, number>
  pesos: Record<number, number>
}

// Guardar nueva matriz 
export const guardarMatriz = async ({ idmodelo, nodopadre, matrix, pesos }: GuardarMatrizParams) => {
  try {
    const { data, error } = await supabase
      .from("matrizsaaty")
      .insert([
        { idmodelo, nodopadre, matrix, pesos }
      ])
      .select()

    if (error) throw error
    return data
  } catch (err) {
    console.error("Error guardando matriz:", err)
    throw err
  }
}

// Actualizar matriz existente
export const actualizarMatriz = async ({ idmodelo, nodopadre, matrix, pesos }: GuardarMatrizParams) => {
  try {
    const { data, error } = await supabase
      .from("matrizsaaty")
      .update({ matrix, pesos })
      .eq("idmodelo", idmodelo)
      .eq("nodopadre", nodopadre)
      .select()

    if (error) throw error
    return data
  } catch (err) {
    console.error("Error actualizando matriz:", err)
    throw err
  }
}

// Cargar matriz desde Supabase
export const cargarMatriz = async (idmodelo: number, nodopadre: number) => {
  try {
    const { data, error } = await supabase
      .from("matrizsaaty")
      .select("*")
      .eq("idmodelo", idmodelo)
      .eq("nodopadre", nodopadre)
      .order("created_at", { ascending: false }) // la más reciente primero
      .limit(1)

    if (error) throw error

    if (!data || data.length === 0) return null

    return data[0] 
  } catch (err) {
    console.error("Error cargando matriz:", err)
    throw err
  }
}
