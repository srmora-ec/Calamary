// pesosComPares.ts
export async function calculateAHP(matrix: number[][]) {
  try {
    alert("1224")
    const response = await fetch(`${process.env.NEXT_PUBLIC_URLFASTCALAMARY}/ahp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ matrix }),
    });

    if (!response.ok) {
      throw new Error(`Error en la API: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("evolvio")
    console.log(data)
    return {
      weights: data.weights,
      CR: data.CR,
    };
  } catch (error) {
    console.error("Error al calcular AHP:", error);
    return {
      weights: [],
      CR: 0,
    };
  }
}
