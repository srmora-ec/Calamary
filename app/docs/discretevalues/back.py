from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
import numpy as np
import os
import io
from contextlib import redirect_stdout
from supabase import create_client, Client
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
import math
import pprint
import copy
import random


app = FastAPI()

# Permitir CORS desde tu frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://calamary.vercel.app","http://localhost:3000"],  # o ["*"] para pruebas
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


class MatrixRequest(BaseModel):
    matrix: list[list[float]]
# Modelo de request
class MetodoParams(BaseModel):
    matrix: list[list[float]]
    weights: list[float] | None = None
    tipos: list[str] | None = None  # max / min

class MetodoRangoParams(BaseModel):
    # matrix es una lista 3D: [alternativa][criterio][[min, max]]
    matrix: list[list[list[float]]]
    weights: list[float] | None = None
    tipos: list[str] | None = None  # max / min


class MetodoTestParams(BaseModel):
    codigo: str            # Código Python completo con normalizar y agregar
    matrix: list[list[float]]
    weights: list[float] | None = None
    tipos: list[str] | None = None  # max / min

class Nodo(BaseModel):
    idnodo: int
    titulo: str
    criterioFinal: bool
    MAUT: dict | None = None


# Agregar en la sección de modelos de Pydantic (clases BaseModel)
class NormalizeRangeRequest(BaseModel):
    matrix_min: list[list[object]] # Matriz de valores mínimos
    matrix_max: list[list[object]] # Matriz de valores máximos
    criterios: list[Nodo]

class NormalizeRequest(BaseModel):
    matrix: list[list[object]] 
    criterios: list[Nodo]





def ahp_weights(matrix):
    # calcular autovalores y autovectores
    eigvals, eigvecs = np.linalg.eig(matrix)
    max_index = np.argmax(eigvals.real)
    max_eigval = eigvals[max_index].real
    weights = eigvecs[:, max_index].real
    weights = weights / weights.sum()  # normalizar
    
    # Consistency Index (CI)
    n = matrix.shape[0]
    CI = (max_eigval - n) / (n - 1)
    # Random Index (RI) según Saaty
    RI_dict = {1:0, 2:0, 3:0.58, 4:0.90, 5:1.12, 6:1.24, 7:1.32, 8:1.41, 9:1.45, 10:1.49, 11:1.51, 12:1.48, 13:1.56, 14:1.57, 15:1.59}
    RI = RI_dict.get(n, 1.59)
    CR = CI / RI if RI != 0 else 0
    
    return weights, CR

class ScoreRangeRequest(BaseModel):
    matrix_norm_min: list[list[float]]
    matrix_norm_promedio_min: list[list[float]] # Nuevo: Promedio usando curva MIN
    matrix_norm_promedio_max: list[list[float]] # Nuevo: Promedio usando curva MAX
    matrix_norm_max: list[list[float]]
    weights: list[float]

class SensitivityParams(BaseModel):
    matrix: list[list[float]]
    weights: list[float]
    tipos: list[str]  # max / min
    criterion_index: int  # Índice (base 0) del criterio que será variado
    step_size: float = 0.01 # Tamaño del paso para la iteración (ej: 0.01)


#genetica para asignación de pesos por Satty
#Basicamente extraemos laparte superior derecha lo otro lo calculamos matematicamente
SAATY_SCALE = np.array([
    1/9, 1/8, 1/7, 1/6, 1/5, 1/4, 1/3, 1/2,
    1,
    2, 3, 4, 5, 6, 7, 8, 9
])


def codifica_matrix(matrix):
    n = matrix.shape[0]
    genes = []
    for i in range(n):
        for j in range(i + 1, n):
            genes.append(matrix[i, j])
    return np.array(genes)

def decodifica_matrix(genes, n):
    matrix = np.ones((n, n))
    idx = 0
    for i in range(n):
        for j in range(i + 1, n):
            val = genes[idx]
            matrix[i, j] = val
            matrix[j, i] = 1 / val
            idx += 1
    return matrix

def ajuste_a_saaty(value):
    return SAATY_SCALE[np.argmin(np.abs(SAATY_SCALE - value))]


def fitness(genes, original_matriz):
    n = original_matriz.shape[0]
    matrix = decodifica_matrix(genes, n)

    _, CR = ahp_weights(matrix)
    distancia = np.linalg.norm(matrix - original_matriz)

    if CR > 0.10:
        return 1000 * CR + distancia
    else:
        return CR + 0.1 * distancia


def genetic_ahp(
    original_matriz,
    pop_size=50,
    generations=200,
    mutation_rate=0.15,
    CR_threshold=0.10
):
    n = original_matriz.shape[0]
    gene_length = n * (n - 1) // 2

    original_genes = codifica_matrix(original_matriz)

    # Población inicial: pequeñas perturbaciones PERO proyectadas
    population = []
    for _ in range(pop_size):
        g = original_genes.copy()
        for i in range(gene_length):
            if random.random() < 0.2:
                g[i] = ajuste_a_saaty(
                    g[i] * random.choice([0.5, 1, 2])
                )
        population.append(g)

    best_solution = original_genes.copy()
    best_score = fitness(best_solution, original_matriz)

    for _ in range(generations):
        population.sort(key=lambda g: fitness(g, original_matriz))
        population = population[:pop_size // 2]

        current_best = population[0]
        if fitness(current_best, original_matriz) < best_score:
            best_solution = current_best.copy()
            best_score = fitness(best_solution, original_matriz)

        _, CR = ahp_weights(decodifica_matrix(best_solution, n))
        if CR <= CR_threshold:
            break

        children = []
        while len(children) < pop_size // 2:
            p1, p2 = random.sample(population, 2)
            cut = random.randint(1, gene_length - 1)
            child = np.concatenate((p1[:cut], p2[cut:]))

            # Mutación DISCRETA Saaty
            if random.random() < mutation_rate:
                idx = random.randint(0, gene_length - 1)
                current = child[idx]
                pos = np.where(SAATY_SCALE == ajuste_a_saaty(current))[0][0]
                step = random.choice([-1, 1])
                new_pos = np.clip(pos + step, 0, len(SAATY_SCALE) - 1)
                child[idx] = SAATY_SCALE[new_pos]

            children.append(child)

        population.extend(children)

    return decodifica_matrix(best_solution, n)


@app.post("/geneticAHP")
def geneticAhp(req: MatrixRequest):
    matrix = np.array(req.matrix, dtype=float)
    matrix = genetic_ahp(matrix)
    w, cr = ahp_weights(matrix)

    return {
        "optimized_matrix": matrix.tolist(),
        "weights": w.tolist(),
        "CR": cr
    }


# ------------------ ENDPOINT PARA EJECUTAR FUNCIONES DE MÉTODOS ------------------
# ------------------ ENDPOINT PARA EJECUTAR FUNCIONES GUARDADAS ------------------
@app.post("/run-method/{method_name}/{func_name}")
def run_method_function(method_name: str, func_name: str, params: MetodoParams):
    """
    Ejecuta dinámicamente una función (func_name) guardada dentro del código Python
    asociado a un método (method_name) almacenado en Supabase.
    Detecta automáticamente los argumentos requeridos por la función.
    """
    print(f"Ejecutando '{func_name}' del método '{method_name}'")

    # 1️⃣ Obtener código desde Supabase
    try:
        response = (
            supabase.table("metodos")
            .select("codigo")
            .eq("nombre", method_name.strip())
            .execute()
        )

        if not response.data:
            raise HTTPException(status_code=404, detail=f"Método '{method_name}' no encontrado")

        codigo = response.data[0]["codigo"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al consultar Supabase: {str(e)}")

    # 2️⃣ Preparar entorno controlado con módulos necesarios
    global_env = {"np": np}
    local_env = {}

    # 3️⃣ Ejecutar el código del método
    try:
        exec(codigo, global_env, local_env)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al cargar código del método: {str(e)}")

    # 4️⃣ Verificar si la función existe
    if func_name not in local_env or not callable(local_env[func_name]):
        raise HTTPException(status_code=404, detail=f"Función '{func_name}' no encontrada en el método '{method_name}'")

    func = local_env[func_name]

    # 5️⃣ Obtener los nombres de los parámetros que requiere la función
    import inspect
    func_args = inspect.signature(func).parameters.keys()

    # 6️⃣ Construir los argumentos según lo disponible
    args = []
    for arg in func_args:
        if arg == "matrix":
            args.append(params.matrix)
        elif arg == "weights":
            args.append(params.weights)
        elif arg == "tipos":
            args.append(params.tipos)
        else:
            raise HTTPException(status_code=400, detail=f"Parámetro inesperado '{arg}' en la función '{func_name}'")

    # 7️⃣ Ejecutar la función con seguridad
    try:
        buffer = io.StringIO()
        with redirect_stdout(buffer):
            result = func(*args)
        output_prints = buffer.getvalue().strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al ejecutar la función '{func_name}': {str(e)}")
    print(output_prints)
    # 8️⃣ Devolver respuesta estandarizada
    return {
        "method": method_name,
        "function": func_name,
        "args_used": list(func_args),
        "result": result,
        "prints": output_prints
    }

class CriterionNode(BaseModel):
    """Representa un nodo en la jerarquía AHP"""
    id: str  # Identificador único (ej: "C1", "C1.1", "C1.2")
    name: str  # Nombre del criterio
    local_weight: float  # Peso local respecto a su padre
    global_weight: float  # Peso global (producto de pesos ancestros)
    children: list['CriterionNode'] = []  # Subcriterios hijos
    column_index: int = None  # Índice en la matriz (solo para hojas)

class SensitivityParamsAHP(BaseModel):
    matrix: list[list[float]]
    hierarchy: list[CriterionNode]  # Jerarquía de criterios
    tipos: list[str]
    criterion_id: str  # ID del criterio a variar (ej: "C1" o "C1.2")
    step_size: float

class ScoreRangeRequestWSI(BaseModel):
    matrix_norm_min: list[list[float]]
    matrix_norm_promedio_min: list[list[float]] # Nuevo: Promedio usando curva MIN
    matrix_norm_promedio_max: list[list[float]] # Nuevo: Promedio usando curva MAX
    matrix_norm_max: list[list[float]]
    hierarchy: list[CriterionNode]  # Jerarquía de criterios
    criterion_id: str 

@app.post("/run-method/{method_name}/{func_name}")
def run_method_function(method_name: str, func_name: str, params: MetodoParams):
    """
    Ejecuta dinámicamente una función (func_name) guardada dentro del código Python
    asociado a un método (method_name) almacenado en Supabase.
    Detecta automáticamente los argumentos requeridos por la función.
    """
    print(f"Ejecutando '{func_name}' del método '{method_name}'")

    # 1️⃣ Obtener código desde Supabase
    try:
        response = (
            supabase.table("metodos")
            .select("codigo")
            .eq("nombre", method_name.strip())
            .execute()
        )

        if not response.data:
            raise HTTPException(status_code=404, detail=f"Método '{method_name}' no encontrado")

        codigo = response.data[0]["codigo"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al consultar Supabase: {str(e)}")

    # 2️⃣ Preparar entorno controlado con módulos necesarios
    global_env = {"np": np}
    local_env = {}

    # 3️⃣ Ejecutar el código del método
    try:
        exec(codigo, global_env, local_env)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al cargar código del método: {str(e)}")

    # 4️⃣ Verificar si la función existe
    if func_name not in local_env or not callable(local_env[func_name]):
        raise HTTPException(status_code=404, detail=f"Función '{func_name}' no encontrada en el método '{method_name}'")

    func = local_env[func_name]

    # 5️⃣ Obtener los nombres de los parámetros que requiere la función
    import inspect
    func_args = inspect.signature(func).parameters.keys()

    # 6️⃣ Construir los argumentos según lo disponible
    args = []
    for arg in func_args:
        if arg == "matrix":
            args.append(params.matrix)
        elif arg == "weights":
            args.append(params.weights)
        elif arg == "tipos":
            args.append(params.tipos)
        else:
            raise HTTPException(status_code=400, detail=f"Parámetro inesperado '{arg}' en la función '{func_name}'")

    # 7️⃣ Ejecutar la función con seguridad
    try:
        buffer = io.StringIO()
        with redirect_stdout(buffer):
            result = func(*args)
        output_prints = buffer.getvalue().strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al ejecutar la función '{func_name}': {str(e)}")

    # 8️⃣ Devolver respuesta estandarizada
    return {
        "method": method_name,
        "function": func_name,
        "args_used": list(func_args),
        "result": result,
        "prints": output_prints
    }

# Endpoint modificado
@app.post("/run-sensitivity/{method_name}/local-unidimensional")
def run_local_unidimensional_sensitivity_ahp(method_name: str, params: SensitivityParamsAHP):
    """
    Realiza el Análisis de Sensibilidad Unidimensional respetando la estructura jerárquica AHP.
    Permite variar cualquier criterio (padre o hijo) y propaga los cambios según la lógica AHP.
    """
    import inspect
    pp = pprint.PrettyPrinter(indent=2, width=120)

    print("\n=== INICIO ANÁLISIS LOCAL UNIDIMENSIONAL AHP ===")
    print(f"Método: {method_name}")
    print(f"Criterio a variar: {params.criterion_id}")
    print(f"Tamaño de paso: {params.step_size}")

    # --- 1️⃣ Obtener código del método ---
    try:
        response = (
            supabase.table("metodos")
            .select("codigo")
            .eq("nombre", method_name.strip())
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail=f"Método '{method_name}' no encontrado")
        codigo = response.data[0]["codigo"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al consultar Supabase: {str(e)}")

    # --- 2️⃣ Ejecutar el código del método ---
    global_env = {"np": np, "math": math}
    local_env = {}
    try:
        exec(codigo, global_env, local_env)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al cargar código del método: {str(e)}")

    if "normalizar" not in local_env or "agregar" not in local_env:
        raise HTTPException(status_code=400, detail="El método no tiene funciones 'normalizar' o 'agregar' definidas.")

    normalizar_func = local_env["normalizar"]
    agregar_func = local_env["agregar"]

    # --- 3️⃣ Funciones auxiliares para manejar jerarquía AHP ---
    def find_criterion_by_id(nodes: list[CriterionNode], target_id: str):
        """Busca un criterio por ID en la jerarquía"""
        for node in nodes:
            if node.id == target_id:
                return node
            if node.children:
                found = find_criterion_by_id(node.children, target_id)
                if found:
                    return found
        return None

    def find_parent_and_siblings(nodes: list[CriterionNode], target_id: str, parent=None):
        """Encuentra el padre y hermanos de un criterio"""
        for node in nodes:
            if node.id == target_id:
                if parent is None:
                    # Es un nodo raíz, sus hermanos son los otros nodos raíz
                    siblings = [n for n in nodes if n.id != target_id]
                    return None, siblings, nodes
                else:
                    siblings = [n for n in parent.children if n.id != target_id]
                    return parent, siblings, parent.children
            if node.children:
                result = find_parent_and_siblings(node.children, target_id, node)
                if result[0] is not None or result[1]:
                    return result
        return None, [], []

    def get_leaf_weights(nodes: list[CriterionNode]) -> list[float]:
        """Extrae los pesos globales de todas las hojas en orden de column_index"""
        leaves = []
        
        def collect_leaves(node_list):
            for node in node_list:
                if not node.children:  # Es hoja
                    leaves.append((node.column_index, node.global_weight))
                else:
                    collect_leaves(node.children)
        
        collect_leaves(nodes)
        leaves.sort(key=lambda x: x[0])  # Ordenar por column_index
        return [w for _, w in leaves]

    def recalculate_global_weights(nodes: list[CriterionNode], parent_global_weight: float = 1.0):
        """Recalcula los pesos globales después de cambiar pesos locales"""
        for node in nodes:
            node.global_weight = node.local_weight * parent_global_weight
            if node.children:
                recalculate_global_weights(node.children, node.global_weight)

    # --- 4️⃣ Encontrar el criterio objetivo ---
    target_criterion = find_criterion_by_id(params.hierarchy, params.criterion_id)
    if not target_criterion:
        raise HTTPException(status_code=404, detail=f"Criterio '{params.criterion_id}' no encontrado en la jerarquía")

    parent, siblings, all_siblings_including_target = find_parent_and_siblings(params.hierarchy, params.criterion_id)
    
    initial_local_weight = target_criterion.local_weight
    print(f"\nPeso local inicial del criterio '{target_criterion.name}': {initial_local_weight}")
    print(f"Peso global inicial: {target_criterion.global_weight}")
    print(f"Número de hermanos: {len(siblings)}")

    # --- 5️⃣ Calcular rango factible para el peso LOCAL ---
    n_siblings = len(all_siblings_including_target)
    w_min_eps = 0.0001
    
    if n_siblings > 1:
        # El máximo que puede tomar este criterio es quitándole a todos los hermanos
        sibling_local_weights = [s.local_weight for s in siblings]
        min_sibling = min(sibling_local_weights) if sibling_local_weights else 0
        w_local_max_feasible = initial_local_weight + (n_siblings - 1) * min_sibling
    else:
        w_local_max_feasible = 1.0

    w_local_max_feasible = float(min(w_local_max_feasible, 1.0))
    w_local_min_feasible = max(0.0, w_min_eps)
    
    print(f"Rango factible del peso LOCAL: [{w_local_min_feasible:.4f}, {w_local_max_feasible:.4f}]")

    # --- 6️⃣ Normalización inicial ---
    initial_weights = get_leaf_weights(params.hierarchy)
    print(f"\nPesos globales iniciales (hojas): {[round(w, 4) for w in initial_weights]}")

    try:
        norm_args = inspect.signature(normalizar_func).parameters.keys()
        call_args = []
        for arg in norm_args:
            if arg == "matrix":
                call_args.append(params.matrix)
            elif arg == "weights":
                call_args.append(initial_weights)
            elif arg == "tipos":
                call_args.append(params.tipos)
            else:
                raise HTTPException(status_code=400, detail=f"Argumento inesperado '{arg}' en normalizar().")
        norm_matrix = normalizar_func(*call_args)
        print("\nMatriz normalizada correctamente")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error durante la normalización: {str(e)}")

    # --- 7️⃣ Equal Apportionment en jerarquía AHP ---
    def calc_weights_equal_apportion_ahp(new_local_weight: float) -> list[float]:
        """
        Ajusta el peso local del criterio objetivo y redistribuye entre hermanos.
        Luego recalcula todos los pesos globales y retorna los pesos de las hojas.
        """
        hierarchy_copy = copy.deepcopy(params.hierarchy)
        
        # Encontrar el criterio en la copia
        target_copy = find_criterion_by_id(hierarchy_copy, params.criterion_id)
        _, siblings_copy, all_siblings_copy = find_parent_and_siblings(hierarchy_copy, params.criterion_id)
        
        # Calcular redistribución
        delta_w = initial_local_weight - new_local_weight
        
        if len(siblings_copy) > 0:
            change_per_sibling = delta_w / len(siblings_copy)
            
            # Aplicar cambios
            target_copy.local_weight = new_local_weight
            for sibling in siblings_copy:
                sibling.local_weight += change_per_sibling
        else:
            # Es el único criterio en su nivel
            target_copy.local_weight = new_local_weight
        
        # Recalcular pesos globales
        recalculate_global_weights(hierarchy_copy)
        
        # Extraer pesos de hojas
        return get_leaf_weights(hierarchy_copy)

    # --- 8️⃣ Calcular ranking inicial ---
    try:
        agregar_args = inspect.signature(agregar_func).parameters.keys()
        call_args = []
        for arg in agregar_args:
            if arg == "matrix":
                call_args.append(norm_matrix)
            elif arg == "weights":
                call_args.append(initial_weights)
            elif arg == "tipos":
                call_args.append(params.tipos)
            else:
                raise HTTPException(status_code=400, detail=f"Argumento inesperado '{arg}' en agregar().")
        initial_scores = agregar_func(*call_args)
        initial_ranking_idx = np.argsort(initial_scores)[::-1]
        initial_best_alt_idx = int(initial_ranking_idx[0])
        print(f"\nPuntajes iniciales: {np.round(initial_scores, 4).tolist()}")
        print(f"Alternativa con mejor puntaje inicial: #{initial_best_alt_idx + 1}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al calcular el ranking inicial: {str(e)}")

    # --- 9️⃣ Generar secuencias de pesos locales ---
    step = float(params.step_size)
    w_down = np.arange(initial_local_weight, w_local_min_feasible - step/2, -step)
    w_up = np.arange(initial_local_weight, w_local_max_feasible + step/2, step)
    print(f"\nTotal pasos hacia abajo: {len(w_down)}, hacia arriba: {len(w_up)}")

    # --- 🔟 Búsqueda de quiebres ---
    def find_first_break(seq, direction):
        prev_w = None
        for w_local in seq:
            current_weights = calc_weights_equal_apportion_ahp(float(w_local))
            
            # Llamada dinámica a agregar()
            call_args = []
            for arg in agregar_args:
                if arg == "matrix":
                    call_args.append(norm_matrix)
                elif arg == "weights":
                    call_args.append(current_weights)
                elif arg == "tipos":
                    call_args.append(params.tipos)
            
            current_scores = agregar_func(*call_args)
            current_best = int(np.argsort(current_scores)[::-1][0])
            
            print(f"[{direction}] w_local={w_local:.4f} | Pesos globales={[round(w,4) for w in current_weights]} | Mejor alt={current_best+1}")
            
            if current_best != initial_best_alt_idx:
                print(f"--> ⚠️ Quiebre detectado en {direction} (w_local={w_local:.4f}), anterior estable={prev_w}")
                return prev_w
            prev_w = float(w_local)
        
        print(f"--> Sin quiebre detectado hacia {direction}")
        return None

    print("\nBuscando quiebre hacia ABAJO:")
    last_stable_down = find_first_break(w_down, "↓")
    print("\nBuscando quiebre hacia ARRIBA:")
    last_stable_up = find_first_break(w_up, "↑")

    # --- 1️⃣1️⃣ Cálculo del rango estable ---
    stability_lower = last_stable_down if last_stable_down is not None else w_local_min_feasible
    stability_upper = last_stable_up if last_stable_up is not None else w_local_max_feasible

    if last_stable_down is None and last_stable_up is None:
        stability_interval = [round(w_local_min_feasible, 4), round(w_local_max_feasible, 4)]
    elif last_stable_down is None and last_stable_up is not None and last_stable_up == initial_local_weight:
        stability_interval = [round(initial_local_weight, 4), round(initial_local_weight, 4)]
    elif last_stable_down is not None and last_stable_up is None:
        stability_interval = [round(stability_lower, 4), round(w_local_max_feasible, 4)]
    else:
        stability_interval = [round(stability_lower, 4), round(stability_upper, 4)]

    print(f"\n=== RESULTADOS ===")
    print(f"Criterio analizado: {target_criterion.name} (ID: {params.criterion_id})")
    print(f"Alternativa inicial: #{initial_best_alt_idx + 1}")
    print(f"Intervalo de estabilidad (peso LOCAL): {stability_interval}")
    print("=== FIN ===\n")

    return {
        "criterion_id": params.criterion_id,
        "criterion_name": target_criterion.name,
        "initial_local_weight": round(initial_local_weight, 4),
        "initial_global_weight": round(target_criterion.global_weight, 4),
        "initial_best_alternative": int(initial_best_alt_idx + 1),
        "stability_local_interval": stability_interval,
        "is_parent_criterion": len(target_criterion.children) > 0
    }

# ------------------ NUEVO ENDPOINT: SENSIBILIDAD POR CAMBIO EN EL RANKING COMPLETO ------------------
@app.post("/run-sensitivity/{method_name}/hight-unidimensional")
def run_local_unidimensional_sensitivity_ranking_ahp(method_name: str, params: SensitivityParamsAHP):
    """
    Realiza el Análisis de Sensibilidad Unidimensional.
    Detecta el quiebre cuando *cualquier* alternativa cambia de posición en el ranking completo (High Sensitivity).
    """
    import inspect
    pp = pprint.PrettyPrinter(indent=2, width=120)

    print("\n=== INICIO ANÁLISIS LOCAL UNIDIMENSIONAL AHP - RANKING COMPLETO (HIGH SENSITIVITY) ===")
    print(f"Método: {method_name}")
    print(f"Criterio a variar: {params.criterion_id}")
    print(f"Tamaño de paso: {params.step_size}")

    # --- 1️⃣ Obtener código del método ---
    try:
        response = (
            supabase.table("metodos")
            .select("codigo")
            .eq("nombre", method_name.strip())
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail=f"Método '{method_name}' no encontrado")
        codigo = response.data[0]["codigo"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al consultar Supabase: {str(e)}")

    # --- 2️⃣ Ejecutar el código del método ---
    global_env = {"np": np, "math": math}
    local_env = {}
    try:
        exec(codigo, global_env, local_env)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al cargar código del método: {str(e)}")

    if "normalizar" in local_env and "agregar" in local_env:
        normalizar_func = local_env["normalizar"]
        agregar_func = local_env["agregar"]
    else:
        raise HTTPException(status_code=400, detail="El método no tiene funciones 'normalizar' o 'agregar' definidas.")


    # --- 3️⃣ Funciones auxiliares (Reutilización de AHP) ---
    def find_criterion_by_id(nodes: list[CriterionNode], target_id: str):
        """Busca un criterio por ID en la jerarquía"""
        for node in nodes:
            if node.id == target_id:
                return node
            if node.children:
                found = find_criterion_by_id(node.children, target_id)
                if found:
                    return found
        return None

    def find_parent_and_siblings(nodes: list[CriterionNode], target_id: str, parent=None):
        """Encuentra el padre y hermanos de un criterio"""
        for node in nodes:
            if node.id == target_id:
                if parent is None:
                    siblings = [n for n in nodes if n.id != target_id]
                    return None, siblings, nodes
                else:
                    siblings = [n for n in parent.children if n.id != target_id]
                    return parent, siblings, parent.children
            if node.children:
                result = find_parent_and_siblings(node.children, target_id, node)
                if result[0] is not None or result[1]:
                    return result
        return None, [], []

    def get_leaf_weights(nodes: list[CriterionNode]) -> list[float]:
        """Extrae los pesos globales de todas las hojas en orden de column_index"""
        leaves = []
        
        def collect_leaves(node_list):
            for node in node_list:
                if not node.children:  # Es hoja
                    leaves.append((node.column_index, node.global_weight))
                else:
                    collect_leaves(node.children)
        
        collect_leaves(nodes)
        leaves.sort(key=lambda x: x[0])  # Ordenar por column_index
        return [w for _, w in leaves]

    def recalculate_global_weights(nodes: list[CriterionNode], parent_global_weight: float = 1.0):
        """Recalcula los pesos globales después de cambiar pesos locales"""
        for node in nodes:
            node.global_weight = node.local_weight * parent_global_weight
            if node.children:
                recalculate_global_weights(node.children, node.global_weight)

    # --- 4️⃣ Encontrar el criterio objetivo ---
    target_criterion = find_criterion_by_id(params.hierarchy, params.criterion_id)
    if not target_criterion:
        raise HTTPException(status_code=404, detail=f"Criterio '{params.criterion_id}' no encontrado en la jerarquía")

    parent, siblings, all_siblings_including_target = find_parent_and_siblings(params.hierarchy, params.criterion_id)
    
    initial_local_weight = target_criterion.local_weight
    
    # --- 5️⃣ Calcular rango factible para el peso LOCAL ---
    n_siblings = len(all_siblings_including_target)
    w_min_eps = 0.0001
    
    if n_siblings > 1:
        sibling_local_weights = [s.local_weight for s in siblings]
        min_sibling = min(sibling_local_weights) if sibling_local_weights else 0
        w_local_max_feasible = initial_local_weight + (n_siblings - 1) * min_sibling
    else:
        w_local_max_feasible = 1.0

    w_local_max_feasible = float(min(w_local_max_feasible, 1.0))
    w_local_min_feasible = max(0.0, w_min_eps)
    
    print(f"Rango factible del peso LOCAL: [{w_local_min_feasible:.4f}, {w_local_max_feasible:.4f}]")

    # --- 6️⃣ Normalización inicial ---
    initial_weights = get_leaf_weights(params.hierarchy)

    try:
        norm_args = inspect.signature(normalizar_func).parameters.keys()
        call_args = []
        for arg in norm_args:
            if arg == "matrix":
                call_args.append(params.matrix)
            elif arg == "weights":
                call_args.append(initial_weights)
            elif arg == "tipos":
                call_args.append(params.tipos)
            else:
                raise HTTPException(status_code=400, detail=f"Argumento inesperado '{arg}' en normalizar().")
        norm_matrix = normalizar_func(*call_args)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error durante la normalización: {str(e)}")

    # --- 7️⃣ Equal Apportionment en jerarquía AHP ---
    def calc_weights_equal_apportion_ahp(new_local_weight: float) -> list[float]:
        """
        Ajusta el peso local del criterio objetivo y redistribuye entre hermanos.
        """
        hierarchy_copy = copy.deepcopy(params.hierarchy)
        target_copy = find_criterion_by_id(hierarchy_copy, params.criterion_id)
        _, siblings_copy, _ = find_parent_and_siblings(hierarchy_copy, params.criterion_id)
        
        delta_w = initial_local_weight - new_local_weight
        
        if len(siblings_copy) > 0:
            change_per_sibling = delta_w / len(siblings_copy)
            target_copy.local_weight = new_local_weight
            for sibling in siblings_copy:
                sibling.local_weight += change_per_sibling
        else:
            target_copy.local_weight = new_local_weight
        
        recalculate_global_weights(hierarchy_copy)
        return get_leaf_weights(hierarchy_copy)

    # --- 8️⃣ Calcular ranking inicial ---
    try:
        agregar_args = inspect.signature(agregar_func).parameters.keys()
        call_args = []
        for arg in agregar_args:
            if arg == "matrix":
                call_args.append(norm_matrix)
            elif arg == "weights":
                call_args.append(initial_weights)
            elif arg == "tipos":
                call_args.append(params.tipos)
            else:
                raise HTTPException(status_code=400, detail=f"Argumento inesperado '{arg}' en agregar().")
        
        initial_scores = agregar_func(*call_args)
        initial_ranking_idx = np.argsort(initial_scores)[::-1].tolist() # Ranking completo de índices
        
        print(f"\nPuntajes iniciales: {np.round(initial_scores, 4).tolist()}")
        print(f"Ranking inicial (índices+1): {[i + 1 for i in initial_ranking_idx]}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al calcular el ranking inicial: {str(e)}")

    # --- 9️⃣ Generar secuencias de pesos locales ---
    step = float(params.step_size)
    w_down = np.arange(initial_local_weight, w_local_min_feasible - step/2, -step)
    w_up = np.arange(initial_local_weight, w_local_max_feasible + step/2, step)
    
    # --- 🔟 Búsqueda de quiebres (Ranking Completo) ---
    def find_first_ranking_break(seq, direction, initial_ranking):
        prev_w = None
        for w_local in seq:
            current_weights = calc_weights_equal_apportion_ahp(float(w_local))
            
            # Llamada dinámica a agregar()
            call_args = []
            for arg in agregar_args:
                if arg == "matrix":
                    call_args.append(norm_matrix)
                elif arg == "weights":
                    call_args.append(current_weights)
                elif arg == "tipos":
                    call_args.append(params.tipos)
            
            current_scores = agregar_func(*call_args)
            current_ranking_idx = np.argsort(current_scores)[::-1].tolist()
            
            # Comparar el ranking completo (lista de índices)
            is_ranking_stable = (current_ranking_idx == initial_ranking)
            
            # Imprimir el ranking para visualización
            current_ranking_alt = [i + 1 for i in current_ranking_idx]
            
            # Nota: Los pesos globales de hoja son un array numpy, se convierten a lista para imprimir
            print(f"[{direction}] w_local={w_local:.4f} | Ranking={current_ranking_alt} | Estable={is_ranking_stable}")
            
            if not is_ranking_stable:
                print(f"--> ⚠️ Quiebre de RANKING detectado en {direction} (w_local={w_local:.4f}), anterior estable={prev_w}")
                return prev_w
            prev_w = float(w_local)
        
        print(f"--> Sin quiebre de RANKING detectado hacia {direction}")
        return prev_w # Devuelve el último valor estable

    print("\nBuscando quiebre de RANKING hacia ABAJO:")
    last_stable_down = find_first_ranking_break(w_down, "↓", initial_ranking_idx)
    
    print("\nBuscando quiebre de RANKING hacia ARRIBA:")
    last_stable_up = find_first_ranking_break(w_up, "↑", initial_ranking_idx)

    # --- 1️⃣1️⃣ Cálculo del rango estable ---
    stability_lower = last_stable_down if last_stable_down is not None else w_local_min_feasible
    stability_upper = last_stable_up if last_stable_up is not None else w_local_max_feasible

    # NOTA: La lógica del AHP original devolvía el *último* valor estable (`prev_w`). 
    # Usaremos esa lógica para construir el intervalo.

    if last_stable_down is None and last_stable_up is None:
        stability_interval = [round(w_local_min_feasible, 4), round(w_local_max_feasible, 4)]
    elif last_stable_down is None and last_stable_up is not None:
        # Estable desde el min factible hasta el último estable hacia arriba
        stability_interval = [round(w_local_min_feasible, 4), round(stability_upper, 4)]
    elif last_stable_down is not None and last_stable_up is None:
        # Estable desde el último estable hacia abajo hasta el max factible
        stability_interval = [round(stability_lower, 4), round(w_local_max_feasible, 4)]
    else:
        stability_interval = [round(stability_lower, 4), round(stability_upper, 4)]
        
    # Caso especial: Si solo fue estable en el punto inicial
    if last_stable_down is not None and last_stable_up is not None and stability_lower > stability_upper:
        stability_interval = [round(initial_local_weight, 4), round(initial_local_weight, 4)]

    print(f"\n=== RESULTADOS (RANKING COMPLETO) ===")
    print(f"Criterio analizado: {target_criterion.name} (ID: {params.criterion_id})")
    print(f"Ranking inicial: {[i + 1 for i in initial_ranking_idx]}")
    print(f"Intervalo de estabilidad (peso LOCAL): {stability_interval}")
    print("=== FIN ===\n")

    return {
        "criterion_id": params.criterion_id,
        "criterion_name": target_criterion.name,
        "initial_local_weight": round(initial_local_weight, 4),
        "initial_global_weight": round(target_criterion.global_weight, 4),
        "initial_ranking": [int(i + 1) for i in initial_ranking_idx],
        "stability_local_interval": stability_interval,
        "is_parent_criterion": len(target_criterion.children) > 0
    }


@app.post("/run-sensitivity/{method_name}/local-unidimensionalv2")
def run_local_unidimensional_sensitivity_ahp_v2(method_name: str, params: SensitivityParamsAHP):
    """
    Variante extendida del análisis de sensibilidad unidimensional (AHP).
    - Recorre todo el rango sin detenerse en el primer quiebre.
    - Devuelve cómo cambia el ranking de las alternativas en cada paso.
    """
    import inspect
    pp = pprint.PrettyPrinter(indent=2, width=120)
    print("\n=== INICIO ANÁLISIS LOCAL UNIDIMENSIONAL v2 (AHP) ===")

    # Obtener código del método desde Supabase
    try:
        response = (
            supabase.table("metodos")
            .select("codigo")
            .eq("nombre", method_name.strip())
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail=f"Método '{method_name}' no encontrado")
        codigo = response.data[0]["codigo"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al consultar Supabase: {str(e)}")

    # Ejecutar código
    global_env = {"np": np, "math": math}
    local_env = {}
    try:
        exec(codigo, global_env, local_env)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al cargar código del método: {str(e)}")

    if "normalizar" not in local_env or "agregar" not in local_env:
        raise HTTPException(status_code=400, detail="El método no tiene funciones 'normalizar' o 'agregar' definidas.")

    normalizar_func = local_env["normalizar"]
    agregar_func = local_env["agregar"]

    # Funciones auxiliares
    def find_criterion_by_id(nodes, target_id):
        for node in nodes:
            if node.id == target_id:
                return node
            if node.children:
                found = find_criterion_by_id(node.children, target_id)
                if found:
                    return found
        return None

    def find_parent_and_siblings(nodes, target_id, parent=None):
        for node in nodes:
            if node.id == target_id:
                if parent is None:
                    siblings = [n for n in nodes if n.id != target_id]
                    return None, siblings, nodes
                else:
                    siblings = [n for n in parent.children if n.id != target_id]
                    return parent, siblings, parent.children
            if node.children:
                result = find_parent_and_siblings(node.children, target_id, node)
                if result[0] is not None or result[1]:
                    return result
        return None, [], []

    def get_leaf_weights(nodes):
        leaves = []
        def collect(node_list):
            for n in node_list:
                if not n.children:
                    leaves.append((n.column_index, n.global_weight))
                else:
                    collect(n.children)
        collect(nodes)
        leaves.sort(key=lambda x: x[0])
        return [w for _, w in leaves]

    def recalc_global(nodes, parent_weight=1.0):
        for node in nodes:
            node.global_weight = node.local_weight * parent_weight
            if node.children:
                recalc_global(node.children, node.global_weight)

    # Preparar jerarquía
    target = find_criterion_by_id(params.hierarchy, params.criterion_id)
    parent, siblings, all_siblings = find_parent_and_siblings(params.hierarchy, params.criterion_id)
    initial_local_weight = target.local_weight
    step = float(params.step_size)
    print(f"\nAnalizando criterio '{target.name}' con paso={step}")

    n_siblings = len(all_siblings)
    w_min_eps = 0.0001
    if n_siblings > 1:
        sibling_local_weights = [s.local_weight for s in siblings]
        min_sibling = min(sibling_local_weights) if sibling_local_weights else 0
        w_max = min(1.0, initial_local_weight + (n_siblings - 1) * min_sibling)
    else:
        w_max = 1.0
    w_min = max(0.0, w_min_eps)

    # Normalización inicial
    initial_weights = get_leaf_weights(params.hierarchy)
    norm_args = inspect.signature(normalizar_func).parameters.keys()
    call_args = []
    for arg in norm_args:
        if arg == "matrix":
            call_args.append(params.matrix)
        elif arg == "weights":
            call_args.append(initial_weights)
        elif arg == "tipos":
            call_args.append(params.tipos)
    norm_matrix = normalizar_func(*call_args)

    # Función de redistribución
    def calc_weights(new_local_weight):
        hierarchy_copy = copy.deepcopy(params.hierarchy)
        t = find_criterion_by_id(hierarchy_copy, params.criterion_id)
        _, s_copy, _ = find_parent_and_siblings(hierarchy_copy, params.criterion_id)
        delta = initial_local_weight - new_local_weight
        if s_copy:
            change = delta / len(s_copy)
            t.local_weight = new_local_weight
            for s in s_copy:
                s.local_weight += change
        else:
            t.local_weight = new_local_weight
        recalc_global(hierarchy_copy)
        return get_leaf_weights(hierarchy_copy)

    # Calcular todo el rango
    w_range = np.arange(w_min, w_max + step/2, step)
    rankings = []
    for w_local in w_range:
        current_weights = calc_weights(float(w_local))
        agregar_args = inspect.signature(agregar_func).parameters.keys()
        call_args = []
        for arg in agregar_args:
            if arg == "matrix":
                call_args.append(norm_matrix)
            elif arg == "weights":
                call_args.append(current_weights)
            elif arg == "tipos":
                call_args.append(params.tipos)
        scores = agregar_func(*call_args)
        ranking_idx = np.argsort(scores)[::-1].tolist()
        rankings.append({
            "peso_local": round(float(w_local), 4),
            "pesos_globales": [round(w, 4) for w in current_weights],
            "ranking": [int(i + 1) for i in ranking_idx],
            "mejor_alternativa": int(ranking_idx[0] + 1)
        })

    print("\n=== ANÁLISIS FINALIZADO ===")

    return {
        "criterion_id": params.criterion_id,
        "criterion_name": target.name,
        "initial_local_weight": round(initial_local_weight, 4),
        "rango_local": [round(w_min, 4), round(w_max, 4)],
        "total_pasos": len(w_range),
        "resultados": rankings
    }

# ------------------ ENDPOINT PARA EJECUTAR FUNCIONES DE MÉTODOS POR RANGO ------------------
# @app.post("/run-method-rango/{method_name}")
# def run_method_rango(method_name: str, params: MetodoRangoParams):
#     """
#     Ejecuta las funciones 'normalizar' y 'agregar' para valores de rango (min, avg, max).
#     Aplica el método tres veces (min, promedio, max) y devuelve los resultados.
#     """
#     print(f"Ejecutando rango para '{method_name}'")

#     # 1  Obtener código desde Supabase
#     try:
#         response = (
#             supabase.table("metodos")
#             .select("codigo")
#             .eq("nombre", method_name.strip())
#             .execute()
#         )

#         if not response.data:
#             raise HTTPException(status_code=404, detail=f"Método '{method_name}' no encontrado")

#         codigo = response.data[0]["codigo"]
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error al consultar Supabase: {str(e)}")

#     # 2 Preparar entorno controlado
#     global_env = {"np": np}
#     local_env = {}

#     # 3 Ejecutar el código para registrar funciones
#     try:
#         exec(codigo, global_env, local_env)
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error al cargar código del método: {str(e)}")

#     # 4 Verificar si las funciones existen
#     if "normalizar" not in local_env or not callable(local_env["normalizar"]):
#         raise HTTPException(status_code=404, detail=f"Función 'normalizar' no encontrada en el método '{method_name}'")
#     if "agregar" not in local_env or not callable(local_env["agregar"]):
#         raise HTTPException(status_code=404, detail=f"Función 'agregar' no encontrada en el método '{method_name}'")

#     normalizar_func = local_env["normalizar"]
#     agregar_func = local_env["agregar"]

#     # 5 Preparar matrices (min, avg, max)
#     matrix_ranges = params.matrix
    
#     # Transformar la lista de rangos 3D a tres matrices 2D (min, avg, max)
#     matrix_min = []
#     matrix_avg = []
#     matrix_max = []
    
#     for alt_ranges in matrix_ranges:
#         alt_min = []
#         alt_avg = []
#         alt_max = []
#         for range_val in alt_ranges:
#             # range_val is [min_value, max_value]
#             min_val = range_val[0]
#             max_val = range_val[1]
#             avg_val = (min_val + max_val) / 2.0
            
#             alt_min.append(min_val)
#             alt_avg.append(avg_val)
#             alt_max.append(max_val)
            
#         matrix_min.append(alt_min)
#         matrix_avg.append(alt_avg)
#         matrix_max.append(alt_max)
    
#     # Preparar datos para el cálculo
#     np_weights = np.array(params.weights, dtype=float) if params.weights else None
#     tipos = params.tipos

#     # 6 Ejecutar las funciones para Min, Avg, Max
#     results = {}
#     output_prints = ""
    
#     scenarios = [
#         ("min", matrix_min), 
#         ("avg", matrix_avg), 
#         ("max", matrix_max)
#     ]
    
#     try:
#         buffer = io.StringIO()
#         with redirect_stdout(buffer):
#             for name, matrix in scenarios:
#                 print(f"\n--- Ejecutando Escenario: {name.upper()} ---")
                
#                 # Normalización
#                 # Nota: Las funciones 'normalizar' esperan una lista 2D, no numpy array.
#                 norm_result = normalizar_func(matrix, tipos) 
                
#                 # Agregación
#                 # Nota: Las funciones 'agregar' esperan lista 2D y pesos en lista 1D.
#                 agg_result = agregar_func(norm_result, np_weights.tolist() if np_weights is not None else None)
                
#                 results[f"matriz_normalizada_{name}"] = norm_result
#                 results[f"puntuaciones_{name}"] = agg_result
                
#         output_prints = buffer.getvalue().strip()
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error al ejecutar funciones en el escenario rango: {str(e)}")

#     # 7️⃣ Construir el resultado final
#     return {
#         "method": method_name,
#         "function": "normalizar/agregar_rango",
#         "results": results,
#         "prints": output_prints
#     }

@app.post("/maut/normalizar")
def normalize_with_utilities(req: NormalizeRequest):
    """
    Normaliza una matriz usando las funciones de utilidad de cada nodo criterioFinal.
    Ahora incluye soporte para funciones simples (lineal/dual) y valores discretos.
    """
    # La matriz de entrada puede contener números (para lineal) o strings (para discreto)
    matrix = np.array(req.matrix, dtype=object) # Cambiar a dtype=object para manejar strings y floats
    criterios = [n for n in req.criterios if n.criterioFinal]

    # Validación
    if not criterios:
        raise HTTPException(status_code=400, detail="No se encontraron criterios finales para normalizar.")

    # Inicializar con el tipo de objeto para manejar strings/floats en la entrada si es necesario
    normalized_matrix = np.zeros_like(matrix, dtype=float)

    try:
        buffer = io.StringIO()
        with redirect_stdout(buffer):
            for j, nodo in enumerate(criterios):
                if not nodo.MAUT:
                    raise HTTPException(status_code=400, detail=f"Nodo '{nodo.titulo}' no tiene función de utilidad definida.")
                
                # --- Lógica de Normalización MAUT ---
                
                # Caso 1: Función Lineal/Dual (Valores Continuos)
                if nodo.MAUT.get("tipoFuncion") == "simple" and "funcionSimple" in nodo.MAUT:
                    
                    # Usamos la función simple por defecto para MAUT (solo una curva)
                    if "funcionSimple" not in nodo.MAUT or not nodo.MAUT["funcionSimple"].get("puntos"):
                        raise HTTPException(status_code=400, detail=f"Nodo '{nodo.titulo}' (Lineal) no tiene puntos definidos.")

                    puntos = nodo.MAUT["funcionSimple"]["puntos"]
                    # Asegurar que los puntos estén ordenados por X
                    puntos = sorted(puntos, key=lambda p: p["x"])

                    for i, valor_str in enumerate(matrix[:, j]):
                        try:
                            valor = float(valor_str)
                        except ValueError:
                            raise HTTPException(status_code=400, detail=f"El criterio '{nodo.titulo}' es continuo, pero el valor de la alternativa {i+1} ('{valor_str}') no es un número válido.")
                        
                        # Normalización por utilidad piecewise lineal
                        if valor <= puntos[0]["x"]:
                            normalized_matrix[i, j] = puntos[0]["y"]
                        elif valor >= puntos[-1]["x"]:
                            normalized_matrix[i, j] = puntos[-1]["y"]
                        else:
                            # Encontrar segmento donde se ubica el valor
                            for k in range(len(puntos) - 1):
                                x1, y1 = puntos[k]["x"], puntos[k]["y"]
                                x2, y2 = puntos[k + 1]["x"], puntos[k + 1]["y"]
                                if x1 <= valor <= x2:
                                    # Evitar división por cero
                                    if (x2 - x1) == 0:
                                        normalized_matrix[i, j] = y1
                                    else:
                                        pendiente = (y2 - y1) / (x2 - x1)
                                        normalized_matrix[i, j] = y1 + pendiente * (valor - x1)
                                    break
                
                # Caso 2: Valores Discretos (Categóricos)
                elif nodo.MAUT.get("tipoFuncion") == "discreta" and "funcionDiscreta" in nodo.MAUT:
                    
                    valores_discretos = nodo.MAUT["funcionDiscreta"].get("valores", [])
                    if not valores_discretos:
                         raise HTTPException(status_code=400, detail=f"Nodo '{nodo.titulo}' (Discreto) no tiene valores discretos definidos.")

                    # Crear un mapa para búsqueda rápida
                    mapa_utilidades = {v['nombre'].lower(): v for v in valores_discretos}

                    for i, nombre_valor_alternativa in enumerate(matrix[:, j]):
                        nombre_limpio = str(nombre_valor_alternativa).strip().lower()

                        if nombre_limpio not in mapa_utilidades:
                            raise HTTPException(status_code=400, 
                                detail=f"El criterio '{nodo.titulo}' es discreto. El valor de la alternativa {i+1} ('{nombre_valor_alternativa}') no coincide con ningún valor discreto configurado: {', '.join(mapa_utilidades.keys())}")
                        
                        utilidad_data = mapa_utilidades[nombre_limpio]
                        u_min = utilidad_data.get("utilidadMin", 0.0)
                        u_max = utilidad_data.get("utilidadMax", 0.0)
                        
                        # Normalización: Usar el promedio de la utilidad mínima y máxima
                        normalized_value = (u_min + u_max) / 2.0
                        normalized_matrix[i, j] = normalized_value
                        
                        print(f"Normalizando {nodo.titulo}: '{nombre_valor_alternativa}' -> ({u_min} + {u_max}) / 2 = {normalized_value}")


                # Caso 3: Función Programada (código Python definido por el usuario)
                elif nodo.MAUT.get("tipoFuncion") == "programada" and "funcionProgramada" in nodo.MAUT:
                    codigo = nodo.MAUT["funcionProgramada"].get("codigo", "").strip()
                    if not codigo:
                        raise HTTPException(status_code=400, detail=f"Nodo '{nodo.titulo}' (Programada) no tiene código definido.")
                    fn_code = "def _utilidad_programada(x):\n" + "\n".join(f"    {line}" for line in codigo.splitlines())
                    local_fn_env: dict = {}
                    try:
                        exec(fn_code, {"math": math, "__builtins__": {}}, local_fn_env)
                    except Exception as e:
                        raise HTTPException(status_code=400, detail=f"Error al compilar función programada del nodo '{nodo.titulo}': {str(e)}")
                    for i, valor_str in enumerate(matrix[:, j]):
                        try:
                            valor = float(valor_str)
                        except (ValueError, TypeError):
                            raise HTTPException(status_code=400, detail=f"El criterio '{nodo.titulo}' usa función programada, pero el valor de la alternativa {i+1} ('{valor_str}') no es un número válido.")
                        try:
                            resultado = local_fn_env["_utilidad_programada"](valor)
                        except Exception as e:
                            raise HTTPException(status_code=400, detail=f"Error al ejecutar función programada del nodo '{nodo.titulo}' con x={valor}: {str(e)}")
                        if not isinstance(resultado, (int, float)) or not math.isfinite(resultado):
                            raise HTTPException(status_code=400, detail=f"La función programada del nodo '{nodo.titulo}' devolvió un valor no numérico: {resultado}")
                        normalized_matrix[i, j] = float(max(0.0, min(1.0, resultado)))
                        print(f"Normalizando {nodo.titulo} (Programada): x={valor} -> u={normalized_matrix[i, j]:.4f}")

                else:
                     raise HTTPException(status_code=400, detail=f"Nodo '{nodo.titulo}' tiene un tipo de función ('{nodo.MAUT.get('tipoFuncion')}') no soportado o incompleto.")

        output_prints = buffer.getvalue().strip()

    except HTTPException:
        raise # Re-lanzar HTTPExceptions (errores 400 ya definidos)
    except Exception as e:
        # Capturar otros errores de procesamiento
        raise HTTPException(status_code=500, detail=f"Error interno en normalización MAUT: {str(e)}")

    return {
        "method": "MAUT",
        "function": "normalizar",
        "result": normalized_matrix.tolist(),
        "prints": output_prints or ""
    }

@app.post("/maut/normalizar/rango")
def normalize_with_utilities_range(req: NormalizeRangeRequest):
    """
    Normaliza dos matrices de entrada (min, max) para MAUT, calculando también el promedio,
    usando las funciones de utilidad de cada criterio final.
    Devuelve las matrices normalizadas para los escenarios min, promedio_min, promedio_max y max.
    """
    matrix_min = np.array(req.matrix_min, dtype=object)
    matrix_max = np.array(req.matrix_max, dtype=object)
    criterios = [n for n in req.criterios if n.criterioFinal]

    # Validación básica de dimensiones
    if matrix_min.shape != matrix_max.shape:
        raise HTTPException(status_code=400, detail="Las dimensiones de 'matrix_min' y 'matrix_max' no coinciden.")
    if not criterios:
        raise HTTPException(status_code=400, detail="No se encontraron criterios finales para normalizar.")
    if matrix_min.shape[1] != len(criterios):
         raise HTTPException(status_code=400, detail="El número de columnas en la matriz no coincide con el número de criterios finales.")

    # Inicialización de matrices de resultados (ACTUALIZADO: Reemplazo de 'avg' por 'promedio_min' y 'promedio_max')
    num_alternativas, num_criterios = matrix_min.shape
    normalized_matrix_min = np.zeros((num_alternativas, num_criterios), dtype=float)
    normalized_matrix_promedio_min = np.zeros((num_alternativas, num_criterios), dtype=float) 
    normalized_matrix_promedio_max = np.zeros((num_alternativas, num_criterios), dtype=float)
    normalized_matrix_max = np.zeros((num_alternativas, num_criterios), dtype=float)

    def _calculate_utility(value, nodo, scenario="avg"):
        """Función auxiliar para calcular la utilidad de un valor dado el nodo y escenario."""
        maut = nodo.MAUT
        
        # Caso 1: Función Lineal Simple (misma función para min/max/promedio)
        if maut.get("tipoFuncion") == "simple" and "funcionSimple" in maut:
            puntos = maut["funcionSimple"].get("puntos")
            if not puntos:
                raise HTTPException(status_code=400, detail=f"Nodo '{nodo.titulo}' (Lineal Simple) no tiene puntos definidos.")
            
            puntos = sorted(puntos, key=lambda p: p["x"])
            
            if value <= puntos[0]["x"]:
                return puntos[0]["y"]
            elif value >= puntos[-1]["x"]:
                return puntos[-1]["y"]
            else:
                for k in range(len(puntos) - 1):
                    x1, y1 = puntos[k]["x"], puntos[k]["y"]
                    x2, y2 = puntos[k + 1]["x"], puntos[k + 1]["y"]
                    if x1 <= value <= x2:
                        if (x2 - x1) == 0:
                            return y1
                        else:
                            pendiente = (y2 - y1) / (x2 - x1)
                            return y1 + pendiente * (value - x1)
            return 0.0 # Valor por defecto si no se encuentra
        
        # Caso 2: Función Lineal Dual (función específica para min/max, se mapea para los escenarios de promedio)
        elif maut.get("tipoFuncion") == "dual" and "funcionDual" in maut:
            
            puntos_func = None
            
            # Mapeo de escenarios a la función dual:
            if scenario in ("min", "promedio_min"): # promediomin usa la curva 'min'
                puntos_func = maut["funcionDual"].get("min", {}).get("puntos")
                scenario_name = "min"
            elif scenario in ("max", "promedio_max", "avg"): # promediomax y avg usan la curva 'max'
                puntos_func = maut["funcionDual"].get("max", {}).get("puntos")
                scenario_name = "max"
            else:
                 raise HTTPException(status_code=400, detail=f"Escenario '{scenario}' no soportado para función dual.")

            
            if not puntos_func:
                raise HTTPException(status_code=400, detail=f"Nodo '{nodo.titulo}' (Dual) no tiene puntos de función '{scenario_name}' definidos.")
            
            puntos_func = sorted(puntos_func, key=lambda p: p["x"])

            if value <= puntos_func[0]["x"]:
                return puntos_func[0]["y"]
            elif value >= puntos_func[-1]["x"]:
                return puntos_func[-1]["y"]
            else:
                for k in range(len(puntos_func) - 1):
                    x1, y1 = puntos_func[k]["x"], puntos_func[k]["y"]
                    x2, y2 = puntos_func[k + 1]["x"], puntos_func[k + 1]["y"]
                    if x1 <= value <= x2:
                        if (x2 - x1) == 0:
                            return y1
                        else:
                            pendiente = (y2 - y1) / (x2 - x1)
                            return y1 + pendiente * (value - x1)
            return 0.0

        # Caso 3: Valores Discretos (utilidad específica para min/max, y la utilidad PROMEDIO para los escenarios intermedios)
        elif maut.get("tipoFuncion") == "discreta" and "funcionDiscreta" in maut:
            
            valores_discretos = maut["funcionDiscreta"].get("valores", [])
            if not valores_discretos:
                 raise HTTPException(status_code=400, detail=f"Nodo '{nodo.titulo}' (Discreto) no tiene valores discretos definidos.")

            nombre_limpio = str(value).strip().lower()
            mapa_utilidades = {v['nombre'].lower(): v for v in valores_discretos}

            if nombre_limpio not in mapa_utilidades:
                raise HTTPException(status_code=400, 
                    detail=f"El criterio '{nodo.titulo}' es discreto. El valor de la alternativa ('{value}') no coincide con ningún valor discreto configurado: {', '.join(mapa_utilidades.keys())}")
            
            utilidad_data = mapa_utilidades[nombre_limpio]
            u_min = utilidad_data.get("utilidadMin", 0.0)
            u_max = utilidad_data.get("utilidadMax", 0.0)
            
            if scenario == "min":
                return u_min
            elif scenario == "max":
                return u_max
            elif scenario in ("avg", "promedio_min", "promedio_max"): # <--- CORRECCIÓN APLICADA AQUÍ: promediomin y promediomax usan la utilidad promedio
                # Normalización para promedio: Usar el promedio de la utilidad mínima y máxima
                return (u_min + u_max) / 2.0
            
            return 0.0 # Debe ser inalcanzable
        
        # Caso 4: Función Programada (código Python definido por el usuario)
        elif maut.get("tipoFuncion") == "programada" and "funcionProgramada" in maut:
            codigo = maut["funcionProgramada"].get("codigo", "").strip()
            if not codigo:
                raise HTTPException(status_code=400, detail=f"Nodo '{nodo.titulo}' (Programada) no tiene código definido.")
            try:
                valor_float = float(value)
            except (ValueError, TypeError):
                raise HTTPException(status_code=400, detail=f"El criterio '{nodo.titulo}' usa función programada (continua), pero el valor '{value}' no es un número válido.")
            # Ejecutar el cuerpo de la función como "def utilidad(x): <codigo>"
            fn_code = f"def _utilidad_programada(x):\n" + "\n".join(f"    {line}" for line in codigo.splitlines())
            local_env: dict = {}
            try:
                exec(fn_code, {"math": math, "__builtins__": {}}, local_env)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Error al compilar función programada del nodo '{nodo.titulo}': {str(e)}")
            try:
                resultado = local_env["_utilidad_programada"](valor_float)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Error al ejecutar función programada del nodo '{nodo.titulo}' con x={valor_float}: {str(e)}")
            if not isinstance(resultado, (int, float)) or not math.isfinite(resultado):
                raise HTTPException(status_code=400, detail=f"La función programada del nodo '{nodo.titulo}' devolvió un valor no numérico o infinito: {resultado}")
            return float(max(0.0, min(1.0, resultado)))

        else:
            raise HTTPException(status_code=400, detail=f"Nodo '{nodo.titulo}' tiene un tipo de función ('{maut.get('tipoFuncion')}') no soportado o incompleto.")

    try:
        buffer = io.StringIO()
        with redirect_stdout(buffer):
            for j, nodo in enumerate(criterios):
                if not nodo.MAUT:
                    raise HTTPException(status_code=400, detail=f"Nodo '{nodo.titulo}' no tiene función de utilidad definida.")
                
                # Procesar cada alternativa (fila) para el criterio j (columna)
                for i in range(num_alternativas):
                    
                    valor_min_str = matrix_min[i, j]
                    valor_max_str = matrix_max[i, j]
                    
                    # 1. Escenario Mínimo (Min) - Usa valor mínimo y función 'min'
                    if nodo.MAUT.get("tipoFuncion") == "discreta":
                        normalized_matrix_min[i, j] = _calculate_utility(valor_min_str, nodo, "min")
                    else:
                        try:
                            valor_min = float(valor_min_str)
                        except ValueError:
                            raise HTTPException(status_code=400, detail=f"El criterio '{nodo.titulo}' es continuo, pero el valor mínimo de la alternativa {i+1} ('{valor_min_str}') no es un número válido.")
                        normalized_matrix_min[i, j] = _calculate_utility(valor_min, nodo, "min")
                        
                    # 4. Escenario Máximo (Max) - Usa valor máximo y función 'max'
                    if nodo.MAUT.get("tipoFuncion") == "discreta":
                        normalized_matrix_max[i, j] = _calculate_utility(valor_max_str, nodo, "max")
                    else:
                        try:
                            valor_max = float(valor_max_str)
                        except ValueError:
                            raise HTTPException(status_code=400, detail=f"El criterio '{nodo.titulo}' es continuo, pero el valor máximo de la alternativa {i+1} ('{valor_max_str}') no es un número válido.")
                        normalized_matrix_max[i, j] = _calculate_utility(valor_max, nodo, "max")
                        
                    # 2. Escenario Promedio Min (Promedio_Min) - Usa valor promedio y función 'min'
                    if nodo.MAUT.get("tipoFuncion") == "discreta":
                        # Para discretos, usa la utilidad promedio (Corregido)
                        normalized_matrix_promedio_min[i, j] = _calculate_utility(valor_min_str, nodo, "promedio_min")
                        print(f"Normalizando {nodo.titulo} (Discreto/Promedio_Min): '{valor_min_str}' -> {normalized_matrix_promedio_min[i, j]}")
                    else:
                        # Para lineales, se promedian los valores de la alternativa y se aplica la curva 'min'.
                        valor_avg = (valor_min + valor_max) / 2.0
                        normalized_matrix_promedio_min[i, j] = _calculate_utility(valor_avg, nodo, "promedio_min")

                    # 3. Escenario Promedio Max (Promedio_Max) - Usa valor promedio y función 'max'
                    if nodo.MAUT.get("tipoFuncion") == "discreta":
                        # Para discretos, usa la utilidad promedio (Corregido)
                        normalized_matrix_promedio_max[i, j] = _calculate_utility(valor_max_str, nodo, "promedio_max")
                        print(f"Normalizando {nodo.titulo} (Discreto/Promedio_Max): '{valor_max_str}' -> {normalized_matrix_promedio_max[i, j]}")
                    else:
                        # Para lineales, se promedian los valores de la alternativa y se aplica la curva 'max'.
                        # El valor promedio (valor_avg) ya está calculado.
                        normalized_matrix_promedio_max[i, j] = _calculate_utility(valor_avg, nodo, "promedio_max")

        output_prints = buffer.getvalue().strip()

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno en normalización MAUT de rango: {str(e)}")

    # Retorno de los 4 escenarios (ACTUALIZADO)
    return {
        "method": "MAUT",
        "function": "normalizar_rango",
        "result_min": normalized_matrix_min.tolist(),
        "result_promedio_min": normalized_matrix_promedio_min.tolist(),
        "result_promedio_max": normalized_matrix_promedio_max.tolist(),
        "result_max": normalized_matrix_max.tolist(),
        "prints": output_prints or ""
    }

 # ------------------ ENDPOINT PARA CALCULAR PUNTAJE FINAL MAUT (RANGO) ------------------
# ------------------ ENDPOINT PARA CALCULAR PUNTAJE FINAL MAUT (RANGO) ------------------
@app.post("/maut/puntaje/rango")
def calculate_maut_range_score(req: ScoreRangeRequest):
    """
    Calcula los puntajes finales (scores) para los escenarios MIN, AVG, y MAX
    multiplicando las matrices normalizadas (utilidades) por el vector de pesos.
    El puntaje promedio (AVG) se calcula promediando los puntajes de los escenarios 
    promedio_min y promedio_max.
    """
    # 1. Convertir a arrays de numpy para cálculo matricial
    try:
        matrix_norm_min = np.array(req.matrix_norm_min, dtype=float)
        matrix_norm_promedio_min = np.array(req.matrix_norm_promedio_min, dtype=float)
        matrix_norm_promedio_max = np.array(req.matrix_norm_promedio_max, dtype=float)
        matrix_norm_max = np.array(req.matrix_norm_max, dtype=float)
        weights = np.array(req.weights, dtype=float)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al convertir matrices/pesos a números: {str(e)}")

    # 2. Validaciones básicas
    if weights.ndim != 1 or weights.shape[0] != matrix_norm_min.shape[1]:
        raise HTTPException(status_code=400, detail="El número de pesos no coincide con el número de criterios.")
    if (matrix_norm_min.shape != matrix_norm_promedio_min.shape or 
        matrix_norm_min.shape != matrix_norm_promedio_max.shape or 
        matrix_norm_min.shape != matrix_norm_max.shape):
        raise HTTPException(status_code=400, detail="Las dimensiones de las matrices normalizadas no coinciden entre sí.")

    try:
        # 3. Cálculo de puntajes individuales
        # Score = M_norm @ W
        score_min = matrix_norm_min @ weights
        score_max = matrix_norm_max @ weights
        
        # Calcular los puntajes de los escenarios intermedios
        score_promedio_min = matrix_norm_promedio_min @ weights
        score_promedio_max = matrix_norm_promedio_max @ weights
        
        # Calcular el puntaje promedio final como la media de los dos puntajes intermedios (REQUERIMIENTO PRINCIPAL)
        score_avg = (score_promedio_min + score_promedio_max) / 2.0


        # 4. Formato de resultados
        results = {
            "score_min": score_min.tolist(),
            "score_avg": score_avg.tolist(),
            "score_max": score_max.tolist(),
            # Incluir los puntajes intermedios para mayor transparencia/depuración
            "score_promedio_min": score_promedio_min.tolist(),
            "score_promedio_max": score_promedio_max.tolist(),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en el cálculo matricial: {str(e)}")

    return {
        "method": "MAUT",
        "function": "calcular_puntaje_rango",
        "result": results,
    }



@app.post("/maut/sensitivity/local-unidimensionalx")
def maut_local_unidimensional_sensitivity(req: ScoreRangeRequest):
    """
    Análisis de sensibilidad unidimensional (Equal Apportionment)
    para el modelo MAUT/RANGO, utilizando las matrices:
    - matrix_norm_min
    - matrix_norm_promedio_min
    - matrix_norm_promedio_max
    - matrix_norm_max
    """
    import pprint
    pp = pprint.PrettyPrinter(indent=2, width=120)

    print("\n=== INICIO ANÁLISIS LOCAL UNIDIMENSIONAL - MAUT/RANGO ===")

    # --- 1️⃣ Validaciones iniciales ---
    try:
        matrix_min = np.array(req.matrix_norm_min, dtype=float)
        matrix_prom_min = np.array(req.matrix_norm_promedio_min, dtype=float)
        matrix_prom_max = np.array(req.matrix_norm_promedio_max, dtype=float)
        matrix_max = np.array(req.matrix_norm_max, dtype=float)
        weights = np.array(req.weights, dtype=float)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error en formato de datos: {str(e)}")

    if weights.ndim != 1:
        raise HTTPException(status_code=400, detail="Los pesos deben ser un vector unidimensional.")
    if not (matrix_min.shape == matrix_prom_min.shape == matrix_prom_max.shape == matrix_max.shape):
        raise HTTPException(status_code=400, detail="Todas las matrices normalizadas deben tener las mismas dimensiones.")
    if matrix_min.shape[1] != len(weights):
        raise HTTPException(status_code=400, detail="El número de pesos no coincide con el número de criterios.")

    num_alt, num_crit = matrix_min.shape

    # --- 2️⃣ Parámetros de sensibilidad ---
    idx_j = getattr(req, "criterion_index", 0)
    step = getattr(req, "step_size", 0.01)
    w_min_eps = 0.0001
    initial_weights = weights.copy().astype(float)
    w_j_initial = initial_weights[idx_j]

    print(f"\nCriterio analizado: {idx_j} | Peso inicial: {w_j_initial}")
    print(f"Paso: {step}")

    # --- 3️⃣ Rango factible ---
    if num_crit > 1:
        others = np.delete(initial_weights, idx_j)
        min_other = np.min(others)
        w_j_max_feasible = w_j_initial + (num_crit - 1) * min_other
    else:
        w_j_max_feasible = 1.0

    w_j_max_feasible = float(min(w_j_max_feasible, 1.0))
    w_j_min_feasible = max(0.0, w_min_eps)

    print(f"Rango factible de w_j: [{w_j_min_feasible:.4f}, {w_j_max_feasible:.4f}]")

    # --- 4️⃣ Equal Apportionment ---
    def calc_weights_equal_apportion(w_j_new: float) -> np.ndarray:
        if num_crit == 1:
            return np.array([w_j_new], dtype=float)
        delta_w = w_j_initial - w_j_new
        change_per_other = delta_w / (num_crit - 1)
        new_w = initial_weights.copy()
        new_w[idx_j] = w_j_new
        for i in range(num_crit):
            if i != idx_j:
                new_w[i] = initial_weights[i] + change_per_other
        return new_w

    # --- 5️⃣ Función de puntaje MAUT ---
    def calc_scores(maut_weights: np.ndarray):
        score_min = matrix_min @ maut_weights
        score_max = matrix_max @ maut_weights
        score_prom_min = matrix_prom_min @ maut_weights
        score_prom_max = matrix_prom_max @ maut_weights
        score_avg = (score_prom_min + score_prom_max) / 2.0
        return {
            "score_min": score_min,
            "score_avg": score_avg,
            "score_max": score_max
        }

    # --- 6️⃣ Puntaje inicial ---
    initial_scores = calc_scores(initial_weights)
    score_avg_init = initial_scores["score_avg"]
    ranking_init_idx = np.argsort(score_avg_init)[::-1]
    best_alt_init = int(ranking_init_idx[0])

    print(f"\nRanking inicial (puntaje AVG): {np.round(score_avg_init, 4).tolist()}")
    print(f"Mejor alternativa inicial: #{best_alt_init + 1}")

    # --- 7️⃣ Secuencias ---
    w_down = np.arange(w_j_initial, w_min_eps - step / 2, -step)
    w_up = np.arange(w_j_initial, w_j_max_feasible + step / 2, step)
    print(f"\nPasos hacia abajo: {len(w_down)} | hacia arriba: {len(w_up)}")

    # --- 8️⃣ Búsqueda de quiebres ---
    def find_first_break(seq, direction):
        prev_w = None
        for w in seq:
            current_weights = calc_weights_equal_apportion(float(w))
            current_scores = calc_scores(current_weights)
            score_avg = current_scores["score_avg"]
            current_best = int(np.argsort(score_avg)[::-1][0])
            print(f"[{direction}] w_j={w:.4f} | Mejor alt={current_best+1} | Pesos={np.round(current_weights, 4)}")

            if current_best != best_alt_init:
                # ✅ CORRECCIÓN: devolver el valor del quiebre, no el anterior
                print(f"⚠️ Quiebre detectado hacia {direction} en w_j={w:.4f}")
                return w
            prev_w = float(w)

        print(f"→ Sin quiebre detectado hacia {direction}")
        return None

    print("\nBuscando quiebre hacia ABAJO:")
    last_stable_down = find_first_break(w_down, "↓")

    print("\nBuscando quiebre hacia ARRIBA:")
    last_stable_up = find_first_break(w_up, "↑")

    # --- 9️⃣ Intervalo estable ---
    # ✅ Si no hay quiebre hacia abajo, usar el valor mínimo factible (0.0001)
    stability_lower = last_stable_down if last_stable_down is not None else w_j_min_feasible

    # ✅ Si no hay quiebre hacia arriba, usar el valor máximo factible
    stability_upper = last_stable_up if last_stable_up is not None else w_j_max_feasible

    # ✅ Corrección de casos especiales
    if last_stable_down is None and last_stable_up is None:
        stability_interval = [round(w_j_min_feasible, 4), round(w_j_max_feasible, 4)]
    elif last_stable_down is None and last_stable_up is not None:
        stability_interval = [round(w_j_min_feasible, 4), round(stability_upper, 4)]
    elif last_stable_down is not None and last_stable_up is None:
        stability_interval = [round(stability_lower, 4), round(w_j_max_feasible, 4)]
    else:
        stability_interval = [round(stability_lower, 4), round(stability_upper, 4)]

    print(f"\n=== RESULTADOS MAUT/RANGO ===")
    print(f"Alternativa inicial: #{best_alt_init + 1}")
    print(f"Intervalo de estabilidad local: {stability_interval}")
    print("=== FIN ===\n")

    return {
        "method": "MAUT",
        "mode": "rango",
        "initial_best_alternative": int(best_alt_init + 1),
        "stability_local_interval": stability_interval,
    }



# class CriterionNode(BaseModel):
#     id: str
#     name: str
#     local_weight: float
#     global_weight: float
#     children: list = []
#     column_index: int

class ScoreRangeRequestWSI(BaseModel):
    matrix_norm_min: list[list[float]]
    matrix_norm_promedio_min: list[list[float]]
    matrix_norm_promedio_max: list[list[float]]
    matrix_norm_max: list[list[float]]
    hierarchy: list[CriterionNode]
    criterion_id: str
    step_size: float = 0.01

def find_criterion_by_id(nodes: list[CriterionNode], target_id: str):
    """Busca un criterio por ID en la jerarquía"""
    for node in nodes:
        if node.id == target_id:
            return node
        if node.children:
            found = find_criterion_by_id(node.children, target_id)
            if found:
                return found
    return None

def find_parent_and_siblings(nodes: list[CriterionNode], target_id: str, parent=None):
    """Encuentra el padre y hermanos de un criterio"""
    for node in nodes:
        if node.id == target_id:
            if parent is None:
                # Es un nodo raíz, sus hermanos son los otros nodos raíz
                siblings = [n for n in nodes if n.id != target_id]
                return None, siblings, nodes
            else:
                siblings = [n for n in parent.children if n.id != target_id]
                return parent, siblings, parent.children
        if node.children:
            result = find_parent_and_siblings(node.children, target_id, node)
            if result[0] is not None or result[1] or result[2]:
                return result
    return None, [], []

def get_leaf_weights(nodes: list[CriterionNode]) -> list[float]:
    """Extrae los pesos globales de todas las hojas en orden de column_index"""
    leaves = []
    
    def collect_leaves(node_list):
        for node in node_list:
            if not node.children:  # Es hoja
                leaves.append((node.column_index, node.global_weight))
            else:
                collect_leaves(node.children)
    
    collect_leaves(nodes)
    leaves.sort(key=lambda x: x[0])  # Ordenar por column_index
    return [w for _, w in leaves]

def recalculate_global_weights(nodes: list[CriterionNode], parent_global_weight: float = 1.0):
    """Recalcula los pesos globales después de cambiar pesos locales"""
    for node in nodes:
        node.global_weight = node.local_weight * parent_global_weight
        if node.children:
            recalculate_global_weights(node.children, node.global_weight)

# --- Función de Equal Apportionment con Jerarquía (Adaptada para MAUT) ---
def calc_weights_equal_apportion_ahp_maut(
    new_local_weight: float,
    initial_local_weight: float,
    hierarchy_param: list[CriterionNode],
    criterion_id: str
) -> np.ndarray:
    """
    Ajusta el peso local del criterio objetivo y redistribuye entre hermanos.
    Luego recalcula todos los pesos globales y retorna los pesos de las hojas (vector NumPy).
    """
    hierarchy_copy = copy.deepcopy(hierarchy_param)
    
    # Encontrar el criterio en la copia
    target_copy = find_criterion_by_id(hierarchy_copy, criterion_id)
    _, siblings_copy, all_siblings_copy = find_parent_and_siblings(hierarchy_copy, criterion_id)
    
    # Calcular redistribución
    delta_w = initial_local_weight - new_local_weight
    
    if len(siblings_copy) > 0:
        change_per_sibling = delta_w / len(siblings_copy)
        
        # Aplicar cambios
        target_copy.local_weight = new_local_weight
        for sibling in siblings_copy:
            sibling.local_weight += change_per_sibling
    else:
        # Es el único criterio en su nivel (su peso local siempre debe ser 1.0 si es la raíz
        # o el único hijo de un padre, pero se acepta la variación para el análisis)
        target_copy.local_weight = new_local_weight
    
    # Recalcular pesos globales
    recalculate_global_weights(hierarchy_copy)
    
    # Extraer pesos de hojas (que son el vector final para la agregación MAUT)
    return np.array(get_leaf_weights(hierarchy_copy), dtype=float)


# --- Endpoint de FastAPI Modificado ---

# app = FastAPI() # Asumiendo que ya tienes una instancia de FastAPI
@app.post("/maut/sensitivity/local-unidimensional")
def maut_local_unidimensional_sensitivity(req: ScoreRangeRequestWSI):
    """
    Análisis de sensibilidad unidimensional (Equal Apportionment)
    para el modelo MAUT/RANGO con jerarquía.
    """
    pp = pprint.PrettyPrinter(indent=2, width=120)

    print("\n=== INICIO ANÁLISIS LOCAL UNIDIMENSIONAL - MAUT/RANGO con Jerarquía ===")

    # --- 1️⃣ Validaciones y Preparación de Matrices ---
    try:
        matrix_min = np.array(req.matrix_norm_min, dtype=float)
        matrix_prom_min = np.array(req.matrix_norm_promedio_min, dtype=float)
        matrix_prom_max = np.array(req.matrix_norm_promedio_max, dtype=float)
        matrix_max = np.array(req.matrix_norm_max, dtype=float)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error en formato de datos de matrices: {str(e)}")
    
    # Extraer pesos iniciales de las hojas
    initial_weights = np.array(get_leaf_weights(req.hierarchy), dtype=float)

    if not (matrix_min.shape == matrix_prom_min.shape == matrix_prom_max.shape == matrix_max.shape):
        raise HTTPException(status_code=400, detail="Todas las matrices normalizadas deben tener las mismas dimensiones.")
        
    num_crit_leaves = len(initial_weights)
    if matrix_min.shape[1] != num_crit_leaves:
        raise HTTPException(status_code=400, detail=f"El número de pesos de hoja ({num_crit_leaves}) no coincide con el número de columnas de la matriz ({matrix_min.shape[1]}).")

    num_alt, num_crit = matrix_min.shape # num_crit ahora es num_crit_leaves

    # --- 2️⃣ Parámetros de sensibilidad y Criterio Objetivo ---
    target_criterion = find_criterion_by_id(req.hierarchy, req.criterion_id)
    if not target_criterion:
        raise HTTPException(status_code=404, detail=f"Criterio '{req.criterion_id}' no encontrado en la jerarquía")
        
    parent, siblings, all_siblings_including_target = find_parent_and_siblings(req.hierarchy, req.criterion_id)

    step = float(req.step_size)
    w_min_eps = 0.0001
    initial_local_weight = target_criterion.local_weight
    
    print(f"\nCriterio a variar: {target_criterion.name} (ID: {req.criterion_id})")
    print(f"Peso local inicial: {initial_local_weight:.4f}")
    print(f"Paso: {step}")

    # --- 3️⃣ Rango factible (basado en peso LOCAL) ---
    n_siblings = len(all_siblings_including_target)
    
    if n_siblings > 1:
        sibling_local_weights = [s.local_weight for s in siblings]
        min_sibling = min(sibling_local_weights) if sibling_local_weights else 0
        # Fórmula: w_j_initial + suma_de_pesos_hermanos (en el caso peor: (n-1)*min_sibling)
        # Se calcula la suma de los otros, y se le suma el peso inicial.
        sum_of_others_initial = sum(sibling_local_weights)
        w_local_max_feasible = initial_local_weight + sum_of_others_initial
    else:
        w_local_max_feasible = 1.0

    w_local_max_feasible = float(min(w_local_max_feasible, 1.0))
    w_local_min_feasible = max(0.0, w_min_eps)

    print(f"Rango factible del peso LOCAL: [{w_local_min_feasible:.4f}, {w_local_max_feasible:.4f}]")
    print(f"Pesos globales iniciales (hojas): {[round(w, 4) for w in initial_weights.tolist()]}")
    
    # --- 4️⃣ Equal Apportionment (usa la función jerárquica) ---
    def calc_weights_for_maut(w_local_new: float) -> np.ndarray:
        return calc_weights_equal_apportion_ahp_maut(
            w_local_new,
            initial_local_weight,
            req.hierarchy,
            req.criterion_id
        )

    # --- 5️⃣ Función de puntaje MAUT ---
    def calc_scores(maut_weights: np.ndarray):
        score_min = matrix_min @ maut_weights
        score_max = matrix_max @ maut_weights
        score_prom_min = matrix_prom_min @ maut_weights
        score_prom_max = matrix_prom_max @ maut_weights
        score_avg = (score_prom_min + score_prom_max) / 2.0
        return {
            "score_min": score_min,
            "score_avg": score_avg,
            "score_max": score_max
        }

    # --- 6️⃣ Puntaje inicial ---
    initial_scores = calc_scores(initial_weights)
    score_avg_init = initial_scores["score_avg"]
    ranking_init_idx = np.argsort(score_avg_init)[::-1]
    best_alt_init = int(ranking_init_idx[0])

    print(f"\nRanking inicial (puntaje AVG): {np.round(score_avg_init, 4).tolist()}")
    print(f"Mejor alternativa inicial: #{best_alt_init + 1}")

    # --- 7️⃣ Secuencias ---
    w_down = np.arange(initial_local_weight, w_local_min_feasible - step / 2, -step)
    w_up = np.arange(initial_local_weight, w_local_max_feasible + step / 2, step)
    print(f"\nPasos hacia abajo: {len(w_down)} | hacia arriba: {len(w_up)}")

    # --- 8️⃣ Búsqueda de quiebres ---
    def find_first_break(seq, direction):
        prev_w = None
        for w_local in seq:
            current_weights = calc_weights_for_maut(float(w_local))
            current_scores = calc_scores(current_weights)
            score_avg = current_scores["score_avg"]
            current_best = int(np.argsort(score_avg)[::-1][0])
            
            print(f"[{direction}] w_local={w_local:.4f} | Mejor alt={current_best+1} | Pesos Hoja={np.round(current_weights, 4)}")

            if current_best != best_alt_init:
                # Se devuelve el valor de quiebre
                print(f"--> ⚠️ Quiebre detectado hacia {direction} en w_local={w_local:.4f}")
                return w_local
            prev_w = float(w_local)

        print(f"--> Sin quiebre detectado hacia {direction}")
        return None

    print("\nBuscando quiebre hacia ABAJO:")
    break_w_down = find_first_break(w_down, "↓")

    print("\nBuscando quiebre hacia ARRIBA:")
    break_w_up = find_first_break(w_up, "↑")

    # --- 9️⃣ Intervalo estable ---
    stability_lower = break_w_down if break_w_down is not None else w_local_min_feasible
    stability_upper = break_w_up if break_w_up is not None else w_local_max_feasible

    # NOTA: En sensibilidad, el intervalo estable son los valores ANTES del quiebre.
    # El método AHP devuelve el 'prev_w' (último estable). El código MAUT original devolvía el 'w' (quiebre).
    # Ajusté la lógica para que 'find_first_break' devuelva el valor de quiebre (`w`), y luego
    # el cálculo del intervalo se ajusta para usar el valor de quiebre como límite (porque el intervalo
    # estable es estrictamente menor/mayor que el punto de quiebre, aunque en la práctica por el paso
    # se usa el punto de quiebre o el límite factible).
    
    # Aquí se usan los límites factibles si no hay quiebre, o el valor de quiebre si existe,
    # que es una aproximación razonable con pasos discretos.

    if break_w_down is None:
        stability_lower_result = w_local_min_feasible
    else:
        # El límite inferior estable es el valor ANTERIOR al quiebre detectado
        stability_lower_result = max(w_local_min_feasible, break_w_down + step) if break_w_down < initial_local_weight else initial_local_weight
    
    if break_w_up is None:
        stability_upper_result = w_local_max_feasible
    else:
        # El límite superior estable es el valor ANTERIOR al quiebre detectado
        stability_upper_result = min(w_local_max_feasible, break_w_up - step) if break_w_up > initial_local_weight else initial_local_weight

    # Refinar el intervalo estable para la salida
    if break_w_down is None and break_w_up is None:
        final_interval = [round(w_local_min_feasible, 4), round(w_local_max_feasible, 4)]
    elif break_w_down is None:
        final_interval = [round(w_local_min_feasible, 4), round(break_w_up - step, 4)]
    elif break_w_up is None:
        final_interval = [round(break_w_down + step, 4), round(w_local_max_feasible, 4)]
    else:
        final_interval = [round(break_w_down + step, 4), round(break_w_up - step, 4)]
        
    # El código original de AHP devolvía el último valor estable. Usaremos la lógica del AHP.
    # Si 'find_first_break' devuelve el valor de quiebre:
    # - Para 'down', el último estable es 'quiebre + step' (si quiebre < inicial) o 'w_local_min_feasible'.
    # - Para 'up', el último estable es 'quiebre - step' (si quiebre > inicial) o 'w_local_max_feasible'.
    
    # Reutilizando la lógica del AHP para la salida final (aunque la función interna devuelve el quiebre)
    
    # El AHP devolvía el valor 'prev_w' (último estable). Para mantener la coherencia con tu primer
    # código, y dado que no se ve el código AHP completo (solo el endpoint), asumiré que el
    # 'last_stable_down/up' del AHP era el último valor *antes* del quiebre.
    # Ajustaré la variable `break_w_down/up` para que reflejen eso en la lógica de cálculo del intervalo
    
    # Si `break_w_down` es el valor de quiebre, el último estable antes es `break_w_down + step`.
    last_stable_down = break_w_down + step if break_w_down is not None and break_w_down < initial_local_weight else initial_local_weight
    # Si `break_w_up` es el valor de quiebre, el último estable antes es `break_w_up - step`.
    last_stable_up = break_w_up - step if break_w_up is not None and break_w_up > initial_local_weight else initial_local_weight
    
    # Se ajustan los límites para el intervalo final, usando los límites factibles si no hay quiebre.
    stability_lower_final = last_stable_down if break_w_down is not None else w_local_min_feasible
    stability_upper_final = last_stable_up if break_w_up is not None else w_local_max_feasible

    # Final Interval Calculation (usando los límites estables)
    if break_w_down is None and break_w_up is None:
        final_interval = [round(w_local_min_feasible, 4), round(w_local_max_feasible, 4)]
    elif break_w_down is not None and break_w_up is not None:
        final_interval = [round(stability_lower_final, 4), round(stability_upper_final, 4)]
    elif break_w_down is not None and break_w_up is None:
        final_interval = [round(stability_lower_final, 4), round(w_local_max_feasible, 4)]
    elif break_w_down is None and break_w_up is not None:
        final_interval = [round(w_local_min_feasible, 4), round(stability_upper_final, 4)]
        
    # En el caso especial de que el punto de inicio sea el único estable
    if break_w_down is not None and break_w_up is not None and stability_lower_final > stability_upper_final:
        final_interval = [round(initial_local_weight, 4), round(initial_local_weight, 4)]

    print(f"\n=== RESULTADOS MAUT/RANGO ===")
    print(f"Criterio analizado: {target_criterion.name} (ID: {req.criterion_id})")
    print(f"Alternativa inicial: #{best_alt_init + 1}")
    print(f"Intervalo de estabilidad (peso LOCAL): {final_interval}")
    print("=== FIN ===\n")

    return {
        "criterion_id": req.criterion_id,
        "criterion_name": target_criterion.name,
        "initial_local_weight": round(initial_local_weight, 4),
        "initial_best_alternative": int(best_alt_init + 1),
        "stability_local_interval": final_interval,
        "is_parent_criterion": len(target_criterion.children) > 0
    }

@app.post("/maut/sensitivity/hight-unidimensional")
def maut_hight_unidimensional_sensitivity(req: ScoreRangeRequestWSI):
    """
    Análisis de sensibilidad unidimensional (Equal Apportionment) para MAUT/RANGO con jerarquía.
    Detecta el quiebre cuando *cualquier alternativa* cambia de posición en el ranking (High Sensitivity).
    """
    pp = pprint.PrettyPrinter(indent=2, width=120)

    print("\n=== INICIO ANÁLISIS HIGH SENSITIVITY - MAUT/RANGO con Jerarquía ===")

    # --- 1️⃣ Validaciones y Preparación de Matrices ---
    try:
        matrix_min = np.array(req.matrix_norm_min, dtype=float)
        matrix_prom_min = np.array(req.matrix_norm_promedio_min, dtype=float)
        matrix_prom_max = np.array(req.matrix_norm_promedio_max, dtype=float)
        matrix_max = np.array(req.matrix_norm_max, dtype=float)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error en formato de datos de matrices: {str(e)}")
    
    # Extraer pesos iniciales de las hojas
    initial_weights = np.array(get_leaf_weights(req.hierarchy), dtype=float)

    if not (matrix_min.shape == matrix_prom_min.shape == matrix_prom_max.shape == matrix_max.shape):
        raise HTTPException(status_code=400, detail="Todas las matrices normalizadas deben tener las mismas dimensiones.")
        
    num_crit_leaves = len(initial_weights)
    if matrix_min.shape[1] != num_crit_leaves:
        raise HTTPException(status_code=400, detail=f"El número de pesos de hoja ({num_crit_leaves}) no coincide con el número de columnas de la matriz ({matrix_min.shape[1]}).")

    num_alt, num_crit = matrix_min.shape

    # --- 2️⃣ Parámetros de sensibilidad y Criterio Objetivo ---
    target_criterion = find_criterion_by_id(req.hierarchy, req.criterion_id)
    if not target_criterion:
        raise HTTPException(status_code=404, detail=f"Criterio '{req.criterion_id}' no encontrado en la jerarquía")
        
    parent, siblings, all_siblings_including_target = find_parent_and_siblings(req.hierarchy, req.criterion_id)

    step = float(req.step_size)
    w_min_eps = 0.0001
    initial_local_weight = target_criterion.local_weight
    
    print(f"\nCriterio a variar: {target_criterion.name} (ID: {req.criterion_id})")
    print(f"Peso local inicial: {initial_local_weight:.4f}")
    print(f"Paso: {step}")

    # --- 3️⃣ Rango factible (basado en peso LOCAL) ---
    n_siblings = len(all_siblings_including_target)
    
    if n_siblings > 1:
        sibling_local_weights = [s.local_weight for s in siblings]
        min_sibling = min(sibling_local_weights) if sibling_local_weights else 0
        sum_of_others_initial = sum(sibling_local_weights)
        w_local_max_feasible = initial_local_weight + sum_of_others_initial
    else:
        w_local_max_feasible = 1.0

    w_local_max_feasible = float(min(w_local_max_feasible, 1.0))
    w_local_min_feasible = max(0.0, w_min_eps)

    print(f"Rango factible del peso LOCAL: [{w_local_min_feasible:.4f}, {w_local_max_feasible:.4f}]")
    
    # --- 4️⃣ Equal Apportionment (usa la función jerárquica) ---
    def calc_weights_for_maut(w_local_new: float) -> np.ndarray:
        return calc_weights_equal_apportion_ahp_maut(
            w_local_new,
            initial_local_weight,
            req.hierarchy,
            req.criterion_id
        )

    # --- 5️⃣ Función de puntaje MAUT ---
    def calc_scores(maut_weights: np.ndarray):
        # La puntuación MAUT para el ranking se basa en el promedio de las puntuaciones
        score_min = matrix_min @ maut_weights
        score_max = matrix_max @ maut_weights
        score_prom_min = matrix_prom_min @ maut_weights
        score_prom_max = matrix_prom_max @ maut_weights
        score_avg = (score_prom_min + score_prom_max) / 2.0
        return score_avg 

    # --- 6️⃣ Puntaje y Ranking inicial ---
    initial_scores_avg = calc_scores(initial_weights)
    initial_ranking_idx = np.argsort(initial_scores_avg)[::-1].tolist()
    initial_best_alt_idx = int(initial_ranking_idx[0])

    print(f"\nRanking inicial (índices+1): {[i + 1 for i in initial_ranking_idx]}")
    
    # --- 7️⃣ Secuencias ---
    step = float(req.step_size)
    w_down = np.arange(initial_local_weight, w_local_min_feasible - step / 2, -step)
    w_up = np.arange(initial_local_weight, w_local_max_feasible + step / 2, step)
    print(f"\nPasos hacia abajo: {len(w_down)} | hacia arriba: {len(w_up)}")

    # --- 8️⃣ Búsqueda de quiebres (Ranking Completo) ---
    def find_first_ranking_break(seq, direction, initial_ranking):
        prev_w = None
        for w_local in seq:
            current_weights = calc_weights_for_maut(float(w_local))
            current_scores_avg = calc_scores(current_weights)
            current_ranking_idx = np.argsort(current_scores_avg)[::-1].tolist()
            
            # Comparar el ranking completo (lista de índices)
            is_ranking_stable = (current_ranking_idx == initial_ranking)
            
            current_ranking_alt = [i + 1 for i in current_ranking_idx]
            
            print(f"[{direction}] w_local={w_local:.4f} | Ranking={current_ranking_alt} | Estable={is_ranking_stable}")

            if not is_ranking_stable:
                print(f"--> ⚠️ Quiebre de RANKING detectado en {direction} (w_local={w_local:.4f}), anterior estable={prev_w}")
                return prev_w # Devolver el último valor estable
            prev_w = float(w_local)
        
        print(f"--> Sin quiebre de RANKING detectado hacia {direction}")
        return prev_w # Devuelve el último valor estable si no hubo quiebre

    print("\nBuscando quiebre de RANKING hacia ABAJO:")
    last_stable_down = find_first_ranking_break(w_down, "↓", initial_ranking_idx)

    print("\nBuscando quiebre de RANKING hacia ARRIBA:")
    last_stable_up = find_first_ranking_break(w_up, "↑", initial_ranking_idx)

    # --- 9️⃣ Intervalo estable ---
    # Usamos el último valor estable, o el límite factible si no hubo quiebre
    stability_lower = last_stable_down if last_stable_down is not None else w_local_min_feasible
    stability_upper = last_stable_up if last_stable_up is not None else w_local_max_feasible

    if last_stable_down is None and last_stable_up is None:
        final_interval = [round(w_local_min_feasible, 4), round(w_local_max_feasible, 4)]
    elif last_stable_down is None and last_stable_up is not None:
        final_interval = [round(w_local_min_feasible, 4), round(stability_upper, 4)]
    elif last_stable_down is not None and last_stable_up is None:
        final_interval = [round(stability_lower, 4), round(w_local_max_feasible, 4)]
    else:
        final_interval = [round(stability_lower, 4), round(stability_upper, 4)]
        
    # Caso especial: Si solo fue estable en el punto inicial
    if last_stable_down is not None and last_stable_up is not None and stability_lower > stability_upper:
        final_interval = [round(initial_local_weight, 4), round(initial_local_weight, 4)]

    print(f"\n=== RESULTADOS HIGH SENSITIVITY (MAUT/RANGO) ===")
    print(f"Criterio analizado: {target_criterion.name} (ID: {req.criterion_id})")
    print(f"Ranking inicial: {[i + 1 for i in initial_ranking_idx]}")
    print(f"Intervalo de estabilidad (peso LOCAL): {final_interval}")
    print("=== FIN ===\n")

    return {
        "criterion_id": req.criterion_id,
        "criterion_name": target_criterion.name,
        "initial_local_weight": round(initial_local_weight, 4),
        # Devolver el ranking completo para la visualización de alta sensibilidad
        "initial_ranking": [int(i + 1) for i in initial_ranking_idx], 
        "stability_local_interval": final_interval,
        "is_parent_criterion": len(target_criterion.children) > 0
    }

# ------------------ ENDPOINT DE PRUEBA ------------------
@app.post("/test-metodo")
def test_metodo(params: MetodoTestParams):
    """
    Ejecuta las funciones `normalizar` y `agregar` del código Python recibido.
    Devuelve los resultados para ambas funciones.
    """
    codigo = params.codigo
    matrix = np.array(params.matrix, dtype=float)
    weights = np.array(params.weights, dtype=float) if params.weights else None
    tipos = params.tipos

    global_env = {"np": np}  # módulos disponibles
    local_env = {}

    # 1️⃣ Ejecutar el código recibido
    try:
        exec(codigo, global_env, local_env)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al ejecutar el código: {str(e)}")

    # 2️⃣ Verificar que existan las funciones
    if "normalizar" not in local_env or not callable(local_env["normalizar"]):
        raise HTTPException(status_code=400, detail="Función 'normalizar' no encontrada en el código")
    if "agregar" not in local_env or not callable(local_env["agregar"]):
        raise HTTPException(status_code=400, detail="Función 'agregar' no encontrada en el código")

    normalizar_func = local_env["normalizar"]
    agregar_func = local_env["agregar"]

    # 3️⃣ Ejecutar las funciones y capturar prints
    try:
        buffer = io.StringIO()
        with redirect_stdout(buffer):
            norm_result = normalizar_func(matrix, tipos)
            agg_result = agregar_func(norm_result, weights)
        output_prints = buffer.getvalue().strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al ejecutar funciones: {str(e)}")

    return {
        "normalizar": norm_result,
        "agregar": agg_result,
        "prints": output_prints
    }

@app.post("/ahp")
def calculate_ahp(req: MatrixRequest):
    matrix = np.array(req.matrix, dtype=float)
    print(matrix)
    w, cr = ahp_weights(matrix)
    print("Pesos criterios:", np.round(w, 3), "CR:", round(cr, 3))

    return {"weights": w.tolist(), "CR": cr}

# Modelo para recibir la información del correo
class EmailRequest(BaseModel):
    to: EmailStr
    subject: str
    html_content: str

@app.post("/send-email")
async def send_email(request: EmailRequest):
    try:
        print('Iniciando envío de email...')
        
        # API key directamente (solo para pruebas)
        # sendgrid_api_key = ""
        # print(f'API Key configurada: {sendgrid_api_key[:10]}...')  # Solo mostrar primeros 10 caracteres
        
        if not sendgrid_api_key:
            print('Error: SendGrid API key no válida')
            raise HTTPException(status_code=500, detail="SendGrid API key no configurada")
        
        message = Mail(
            from_email="jalvarezm7@uteq.edu.ec",  # Prueba con un email genérico
            to_emails=request.to,
            subject=request.subject,
            html_content=request.html_content
        )
        print('Mensaje creado...')
        print(f'From: calamary@uteq.edu.ec')
        print(f'To: {request.to}')
        print(f'Subject: {request.subject}')

        SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
        print('Cliente SendGrid inicializado...')
        
        response = sg.send(message)
        print(f'Email enviado exitosamente. Status code: {response.status_code}')
        print(response.status_code)
        return {"status": "success", "code": response.status_code}
        
    except Exception as e:
        print(f'Error al enviar email: {str(e)}')
        raise HTTPException(status_code=500, detail=f"Error al enviar email: {str(e)}")



@app.get("/")
@app.head("/")
async def read_root():
    return {"message": "FastAPI funcionando correctamente"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000)) 
    uvicorn.run(app, host="0.0.0.0", port=port)