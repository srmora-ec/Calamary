"use client"

import React, { useState } from "react";

function PowerMethod(matrix: number[][], maxIter = 100, tol = 1e-6) {
  const n = matrix.length;
  let v = Array(n).fill(1 / n); // vector inicial

  for (let k = 0; k < maxIter; k++) {
    // multiplicar A * v
    let Av = Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        Av[i] += matrix[i][j] * v[j];
      }
    }

    // normalizar
    const sum = Av.reduce((a, b) => a + b, 0);
    const vNext = Av.map((x) => x / sum);

    // comprobar convergencia
    const diff = vNext.reduce((acc, val, i) => acc + Math.abs(val - v[i]), 0);
    v = vNext;
    if (diff < tol) break;
  }

  return v;
}

const EigenCalculator: React.FC = () => {
  const [size, setSize] = useState(3);
  const [matrix, setMatrix] = useState<number[][]>(
    Array.from({ length: 3 }, () => Array(3).fill(1))
  );
  const [result, setResult] = useState<number[] | null>(null);

  const handleSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSize = parseInt(e.target.value);
    if (newSize > 0) {
      setSize(newSize);
      setMatrix(Array.from({ length: newSize }, () => Array(newSize).fill(1)));
      setResult(null);
    }
  };

  const handleInputChange = (i: number, j: number, value: string) => {
    const newMatrix = matrix.map((row) => [...row]);
    newMatrix[i][j] = parseFloat(value) || 0;
    setMatrix(newMatrix);
  };

  const calculateEigen = () => {
    const priorities = PowerMethod(matrix);
    setResult(priorities);
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Cálculo de Autovector Principal</h2>

      <label className="block mb-2">
        Tamaño de la matriz:
        <input
          type="number"
          min="2"
          value={size}
          onChange={handleSizeChange}
          className="ml-2 border p-1 rounded"
        />
      </label>

      <div className="grid gap-2 mb-4">
        {matrix.map((row, i) => (
          <div key={i} className="flex gap-2">
            {row.map((val, j) => (
              <input
                key={j}
                type="number"
                step="any"
                value={val}
                onChange={(e) => handleInputChange(i, j, e.target.value)}
                className="w-20 border p-1 rounded text-center"
              />
            ))}
          </div>
        ))}
      </div>

      <button
        onClick={calculateEigen}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        Calcular Prioridades
      </button>

      {result && (
        <div className="mt-4">
          <h3 className="font-semibold">Vector de Prioridades:</h3>
          <ul>
            {result.map((val, idx) => (
              <li key={idx}>
                {`w${idx + 1}: ${val.toFixed(6)}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default EigenCalculator;
