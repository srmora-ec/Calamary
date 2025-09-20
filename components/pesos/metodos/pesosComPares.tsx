// Tabla de Random Index (RI) hasta n = 15 (Saaty)
const RI_TABLE: Record<number, number> = {
  1: 0.0,
  2: 0.0,
  3: 0.58,
  4: 0.9,
  5: 1.12,
  6: 1.24,
  7: 1.32,
  8: 1.41,
  9: 1.45,
  10: 1.49,
  11: 1.51,
  12: 1.48,
  13: 1.56,
  14: 1.57,
  15: 1.59,
}

function PowerMethod(matrix: number[][], maxIter = 100, tol = 1e-6) {
  const n = matrix.length
  let v = Array(n).fill(1 / n)

  for (let k = 0; k < maxIter; k++) {
    // Av = A * v
    const Av = Array(n).fill(0)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        Av[i] += matrix[i][j] * v[j]
      }
    }

    // Normalizar
    const sum = Av.reduce((a, b) => a + b, 0)
    const vNext = Av.map((x) => x / sum)

    // Convergencia
    const diff = vNext.reduce((acc, val, i) => acc + Math.abs(val - v[i]), 0)
    v = vNext
    if (diff < tol) break
  }

  return v
}

export function calculateAHP(matrix: number[][]) {
  const n = matrix.length

  // Calcular vector de prioridades
  const w = PowerMethod(matrix)

  // λ_max aproximado: (A*w)_i / w_i promedio
  const Aw = Array(n).fill(0)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      Aw[i] += matrix[i][j] * w[j]
    }
  }
  const lambda_max = Aw.reduce((acc, val, i) => acc + val / w[i], 0) / n

  // Consistencia
  const CI = (lambda_max - n) / (n - 1)
  const RI = RI_TABLE[n] ?? 1.59 // si n > 15 usar 1.59 como aprox
  const CR = RI === 0 ? 0 : CI / RI

  return {
    weights: w,
    lambda_max,
    CI,
    CR,
  }
}
