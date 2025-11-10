"use client"

import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { Tabs, Button, Table, Input, InputNumber, message, Spin, Upload, Select, Card, Row, Col, Drawer } from "antd"
import { UploadOutlined} from "@ant-design/icons"
import { Modelo, type ModeloData, type Nodo } from "@/types/modelo"
import ModeloSvgViewer from "@/components/modelo-svg-viewer"
import UnidimensionalSensitivityAnalysis from "@/components/AnalisisDeSensibilidad/unidimensional-sensitivity-analysis"
import UnidimensionalSensitivityMAUT from "@/components/AnalisisDeSensibilidad/UnidimensionalSensitivityMAUT"
import Modal from "@/components/Modal"
import { supabase } from "@/lib/supabase"
import * as XLSX from "xlsx"
import Image from "next/image"

type ModoValor = "unico" | "rango" //Representa si vamos a enviar a la api valores de min y max para cada una de las alternativas
//Esto debido a que según la literatura para modelos como SAW, TOPSIS, etc necesita el valor de la alternativa directa
//Pero maut se puede interpretar enviando min  mac

interface ValorUnico {//cuando es unico solo se envía el valor número o string, debido a los discretos
  tipo: "unico"
  valor: number | string
}

interface ValorRango {//Cuando es rango se envia el rango min y max
  tipo: "rango"
  min: number
  max: number
}

type ValorCriterio = ValorUnico | ValorRango //Es el valor que  vamos a usar para el modelo actual (Los que ya definí previamente)

interface AlternativaValores {
  [idCriterio: number]: ValorCriterio //Los valores para cada criterio
}

interface Alternativa { //La alternativa que se enviará junto a otras
  key: string //Clave de la alternativa para identificar
  nombre: string //El nombre de la alternativa
  valores: AlternativaValores //Valores que contienen una alternativa
}

interface Resultado { //Estructura para el resultado
  matriz_normalizada: number[][] //La matriz normalizada es decir los valores de la alternativa entre 1 y 0
  // matriz_ponderada: number[][] //Matriz normalizada y ponderada aun no está en uso
  puntuaciones: number[] // Las puntuaciones de cada una de las alternativas
  ranking: number[] //Ranking en deshuso ordenamos nomás con las puntuaciones
  result_min?: number[][]//PAra cuando es maut, el resultado del minimo
  result_max?: number[][]//Para cuando es maut el resultado del max
  result_promedio_min?: number[][]//Para cuando es maut el resultado de los valores promedio con la funcion de utilidad minima
  result_promedio_max?: number[][]//Para cuando es maut el resultado de los valores del promedio con la función de utilidad maxima
  score_min?: number[]//El puntaje del minimo
  score_avg?: number[]//El punaje del promedio
  score_max?: number[]//El punaje del maximo
}

export default function AlternativasPage() {
  const { idmodelo } = useParams()//El id del modelo actual
  const [modelo, setModelo] = useState<Modelo | null>(null) //El modelo actual
  const [loading, setLoading] = useState(true) //Esto luego lo quiero usar
  const [alternativas, setAlternativas] = useState<Alternativa[]>([])//Las alternativas cargadas
  const [modoValor, setModoValor] = useState<ModoValor>("unico") //El modo de valor dependerá del tipo de modelo
  const [resultado, setResultado] = useState<Resultado | null>(null) //El resultado del modelo con las alternativas
  const [evaluando, setEvaluando] = useState(false) //El estado de que se esta evaluando
  // const fileInputRef = useRef<HTMLInputElement>(null)
  const [validacionMAUT, setValidacionMAUT] = useState<string | null>(null) //El modelo maut necestia que cada criterio final tenga definida su función de utilidad. 
  //Por ese esta variable tiene como objetivo poner el estado (Se completó la validación?)
  const [sensitivityModalOpen, setOpenSensitivityModal] = useState(false) //Esto es solo para ver si abrimos el modal para el analisis de sensibilidad
  const [selectedAnalysisType, setSelectedAnalysisType] = useState<"unidimensional" | "multidimensional" | null>(null) //Para escoger el tipo de analisis
  const [openModel, setOpenModel] = useState(false);
  const criteriosFinales = modelo?.getCriteriosFinales() || []//Para cargar los criterios finales del modelo

  useEffect(() => {
    if (modelo && modelo.getData().metodo === "MAUT") {//Verificamos si el modelo es maut
      const resumen = modelo.obtenerResumenValidacionMAUT() //Obtenemos el redumen de maut. (Que funciones faltan)
      const validacion = modelo.verificarFuncionesUtilidad()//Obtenemos validación de si esta bien el maut o no

      if (!validacion.valido) {//Si no es valido
        setValidacionMAUT(resumen)//Asignamos el resumen
      } else {
        setValidacionMAUT(null)//No ponemos resumen
      }
    } else {
      setValidacionMAUT(null)//No ponemos resumen
    }
  }, [modelo])//Cada que el modelo cambie

  useEffect(() => {
    if (modelo) {//Si ya tengo un modelo
      const nuevoModo = modelo.getMetodo() === "MAUT" ? "rango" : "unico" //Establezo el modo según si es MAUT o no
      if (modoValor !== nuevoModo) { // Si el modo actual es diferente al nuevo hago el cambio
        setModoValor(nuevoModo) // Se guarda el nuevo modo
        setAlternativas([]) //Se resetean las alternativas
        setResultado(null) //Se resetean los resultados
      }
    }
  }, [modelo])//Esto se ejecuta cada que cambia un modelo

  useEffect(() => {
    const fetchModelo = async () => {//Cargar el modelo de la base de datos
      setLoading(true)//Establecemos el loading

      const { data, error } = await supabase.rpc("get_modelo_with_nodos", {//hacemos la consulta en la base de datos
        p_idmodelo: Number(idmodelo), //con elidmodelo que abre el componente
      })
      if (error) {//Si algo sale mal
        console.error("Error cargando modelo:", error) //Ponemos el error
        message.error("Error al cargar el modelo") //Aquí debo de poner un mensaje... Capaz meto notificaciones de antdesing
        setLoading(false)
        return
      }

      if (data) {//Una vez resivimos el modelo
        const mapped: ModeloData = {//Lo mapeamos
          id: data.modelo.id?.toString(),
          nombre: data.modelo.nombre,
          descripcion: data.modelo.descripcion,
          orientacion: data.modelo.orientacion,
          linea: data.modelo.linea,
          publico: data.modelo.publico,
          metodo: data.modelo.metodo,
          nodos: {
            nodes: (data.modelo.nodos?.nodes ?? []).map((n: any) => ({
              idnodo: n.idnodo,
              posx: n.posx,
              posy: n.posy,
              titulo: n.titulo,
              idpadre: n.idpadre,
              descripcion: n.descripcion,
              peso: n.peso,
              pesofinal: n.pesofinal,
              acortado: n.acortado,
              beneficio: n.beneficio,
              min: n.min,
              max: n.max,
              criterioFinal: n.criterioFinal,
              MAUT: n.MAUT,
            })),
          },
        }

        const modeloObj = new Modelo(mapped)//El modelo lo guardamos como objeto modelo 
        setModelo(modeloObj)// Lo establecemos como modelo actual
      }
      setLoading(false)//Finalizamos el spinner
    }

    fetchModelo()//Llamamos la funcion
  }, [idmodelo])//Estop cada vez que ambie el id del modelo

  const prepareAPIData = () => {//Cuando queremos obtener pùntaje de las alternativas debemos preparar los datos para la api
    if (!modelo) return null//Si no hay modelo no se hace nada

    modelo.calcularPesosFinales() //Primero obtenemos los pesos finales
    //Es decir que si la estructura del modelo mcdm sigue la estructura ahp con jerarquía. Eso quiere decir que los nodos tienen un peso
    //y un peso final. Este metodo solo hace que en el modelo el peso final se actualiza
    const criteriosFinales = modelo.getCriteriosFinales()//Como a actualizamos los pesos genrales, este metodo devuelve todos los nodos
    //Que son criterios finales es decir que no tienen hijos

    const matrix = alternativas.map((alt) =>//A la api le enviamos estos valores como una variablke llamada matrix
      criteriosFinales.map((crit) => {//Esos criterios finales lo mapeamos
        const val = alt.valores[crit.idnodo]//Y en val meteremos el valor de la alternativa en la posición del criterio
        //Las alternativas y criterios finales ya van en orden de izquierda a derecha
        return val.tipo === "unico" ? (val.valor as number) : (val.min + val.max) / 2 //En caso de que sea univo enviamos el valor y si es rango elpromedio
      }),
    )

    const tipos = criteriosFinales.map((crit) => (crit.beneficio ? "max" : "min")) //Los tipos es solo si se busca maximizar o minimizar
    //Es importante para la api

    return { matrix, tipos }
  }

  const openSensitivityAnalysis = (type: "unidimensional" | "multidimensional") => {//Para abrir el modalque hace el analisis de sensibilidad
    setSelectedAnalysisType(type)//Guardamos el tipo
    setOpenSensitivityModal(true)//Ponemos en true para abri el modal
  }

  const EvaluarAlternativas = async () => {//Ejecutamos el metodo para obtener los resultados
    if (alternativas.length < 2) {//Necesitamos minimo 2 alternativas (Si fueran menos no tendría sentido jaja)
      return
    }
    setEvaluando(true)//Aplicamos el evaluando para el efecto de carga

    if (modelo?.getMetodo() == "MAUT") {//Si el modelo es maut
      try {
        if (validacionMAUT) {//Verificamos que este validado [Realmente podría quitar esto pues la validación se hace antes]
          message.error("No se puede evaluar. Faltan funciones de utilidad en los criterios finales (MAUT)")//Cambiar el mensaje por ant
          setEvaluando(false)//Ponemos el evaluando en false
          return
        }

        modelo?.calcularPesosFinales() //Calculamos los pesos finales en caso de que haya cambiado algo del modelo

        if (modoValor === "rango") {//Si el modo es rango  o sea maut no solo se envíamatrix, sino que se envia matrixmin y matrixmax
          const matrix_min = alternativas.map((alt) =>//Resorremos las alternativas
            criteriosFinales.map((crit) => {//Por cada alternativa recorremos los criterios finales
              const val = alt.valores[crit.idnodo]//Sacamos el valor de la alternativa para el criterioa tratar

              if (crit.MAUT?.tipoFuncion === "discreta") {//Para cuando es discreta
                return val.tipo === "rango" ? val.min?.toString() || "" : ""//Emviamos el min
              }

              if (val.tipo === "rango") {
                return val.min//Si no es discreto se envía el valor y ya
              }
              return 0
            }),
          )

          const matrix_max = alternativas.map((alt) =>//Para el max recorremos las alternativas
            criteriosFinales.map((crit) => {//Recorremos los criteriosfinales
              const val = alt.valores[crit.idnodo]//sacamos el valor de laalternativa en elcriterio

              if (crit.MAUT?.tipoFuncion === "discreta") {//Si es discreta
                return val.tipo === "rango" ? val.max?.toString() || "" : ""//Sacamos el min. Los discretos solo tienen un valor directo,
                //Debido a que su valor discreto ya esta configurado para min y max
              }

              if (val.tipo === "rango") {
                return val.max//Si no es discreto envíamos max
              }
              return 100//Si algo dalio mal enviamos 100
            }),
          )

          const criterios = criteriosFinales.map((crit) => ({//Guardamos los criterios con el siguiente formato. Que son lso valores que necesita la api
            idnodo: crit.idnodo,
            titulo: crit.titulo,
            criterioFinal: crit.criterioFinal,
            min: crit.min,
            max: crit.max,
            MAUT: crit.MAUT,
          }))

          const resNormalizacion = await fetch(`${process.env.NEXT_PUBLIC_URLFASTCALAMARY}/maut/normalizar/rango`, {//Llamamos la api
            method: "POST",//
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ matrix_min, matrix_max, criterios }),//Enviamos los daots
          })

          if (!resNormalizacion.ok) {
            const errorText = await resNormalizacion.text()//Si algo sale mal debería poner una notificación de ant desing
            throw new Error(errorText)
          }

          const dataNormalizacion = await resNormalizacion.json()//Convertimos el resultado en json
          const matrizMin = dataNormalizacion.result_min//Extraemon el resultado min
          const matrizPromedioMin = dataNormalizacion.result_promedio_min //El promedio con la funcion min
          const matrizPromedioMax = dataNormalizacion.result_promedio_max// El promedio con la función max
          const matrizMax = dataNormalizacion.result_max //El valor max

          const weights = criteriosFinales.map((crit) => crit.pesofinal || 0)//Extraemos los pesos de los criterios finales
          //Esto porque para calcular lospuntajes necesitamos los pesos

          const resPuntaje = await fetch(`${process.env.NEXT_PUBLIC_URLFASTCALAMARY}/maut/puntaje/rango`, {//Usamos la api para calcular puntaje
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({//Se envian las matrices obtenidas de la normalización junto a la de los pesos
              matrix_norm_min: matrizMin,
              matrix_norm_promedio_min: matrizPromedioMin,
              matrix_norm_promedio_max: matrizPromedioMax,
              matrix_norm_max: matrizMax,
              weights,
            }),
          })

          if (!resPuntaje.ok) {
            const errorText = await resPuntaje.text()//Debo incluir alert de antdesing
            throw new Error(errorText)
          }

          const dataPuntaje = await resPuntaje.json()//Convertimos el resultadoa un json
          const scoreMin = dataPuntaje.result.score_min//Sacamos el puntaje del minimo
          const scoreAvg = dataPuntaje.result.score_avg//El puntaje del promedio
          const scoreMax = dataPuntaje.result.score_max//Elpuntaje del maximo

          const combinedData = scoreAvg.map((score: number, idx: number) => ({//Combinamos toda la tada para tenerlo ordenado
            score,
            scoreMin: scoreMin[idx],
            scoreMax: scoreMax[idx],
            idx,
            alternativa: alternativas[idx],
            matrizMin: matrizMin[idx],
            matrizPromedioMin: matrizPromedioMin[idx],
            matrizPromedioMax: matrizPromedioMax[idx],
            matrizMax: matrizMax[idx],
          }))

          combinedData.sort((a: any, b: any) => b.score - a.score)//Ordenamos la data de mayor a menor en base a score
          //Volvemos a separar una vez ordenado
          const alternativasOrdenadas = combinedData.map((item: any) => item.alternativa)
          const puntuacionesOrdenadas = combinedData.map((item: any) => item.score)
          const puntuacionesMinOrdenadas = combinedData.map((item: any) => item.scoreMin)
          const puntuacionesMaxOrdenadas = combinedData.map((item: any) => item.scoreMax)
          const matrizMinOrdenada = combinedData.map((item: any) => item.matrizMin)
          const matrizPromedioMinOrdenada = combinedData.map((item: any) => item.matrizPromedioMin)
          const matrizPromedioMaxOrdenada = combinedData.map((item: any) => item.matrizPromedioMax)
          const matrizMaxOrdenada = combinedData.map((item: any) => item.matrizMax)

          // Calculamos matriz ponderada usando score_avg
          const matrizPonderada: number[][] = puntuacionesOrdenadas.map((score: any) => [score])

          setAlternativas(alternativasOrdenadas)//Re ordenamos las alternativas

          setResultado({
            matriz_normalizada: [], // No se usa en modo rango
            // matriz_ponderada: matrizPonderada,
            puntuaciones: puntuacionesOrdenadas,
            ranking: combinedData.map((_: { score: number }, i: number) => i + 1), //Da un ranking enumeración 1,2,3,4,5,etc
            result_min: matrizMinOrdenada,
            result_promedio_min: matrizPromedioMinOrdenada,
            result_promedio_max: matrizPromedioMaxOrdenada,
            result_max: matrizMaxOrdenada,
            score_min: puntuacionesMinOrdenadas,
            score_avg: puntuacionesOrdenadas,
            score_max: puntuacionesMaxOrdenadas,
          })

          message.success("Evaluación MAUT (rango) completada exitosamente")//El mensaje no esta funcionando tengoque cambiarlo por algo de ant
          setEvaluando(false)
          return
        }
      } catch (error) {
        console.error("[v0] Error ejecutando evaluación MAUT:", error)
        message.error(
          `Error al ejecutar la evaluación MAUT: ${error instanceof Error ? error.message : "Error desconocido"}`,
        )
      } finally {
        setEvaluando(false)
      }
      return
    }

    try {
      modelo?.calcularPesosFinales()//Calculamos pesos finales

      const matrix = alternativas.map((alt) =>//Sacamos la matrix para enviar a la api, recorriendo cada alternativa
        criteriosFinales.map((crit) => {//Recorremos cada criterio
          const val = alt.valores[crit.idnodo]//sacamosel valordelcriterio
          return val.tipo === "unico" ? (val.valor as number) : 0
        }),
      )

      const tipos = criteriosFinales.map((crit) => (crit.beneficio ? "max" : "min"))//Extraemos los criterios ginales del modelo
      const weights = criteriosFinales.map((crit) => crit.pesofinal || 0) //Extraemos los pesos de los criterios finales

      const resNormalizacion = await fetch(
        `${process.env.NEXT_PUBLIC_URLFASTCALAMARY}/run-method/${modelo?.getData().metodo}/normalizar`,//llamamos la api
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matrix, weights, tipos }),
        },
      )
      if (!resNormalizacion.ok) throw new Error(await resNormalizacion.text())
      const dataNormalizacion = await resNormalizacion.json()//Ponemos los resultados en un json
      const matrizNormalizada = dataNormalizacion.result//Sacamos el result

      const resAgregacion = await fetch(
        `${process.env.NEXT_PUBLIC_URLFASTCALAMARY}/run-method/${modelo?.getData().metodo}/agregar`,//Llamamos la api para agregación
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matrix: matrizNormalizada, weights, tipos }),
        },
      )
      if (!resAgregacion.ok) throw new Error(await resAgregacion.text())
      const dataAgregacion: { result: number[] } = await resAgregacion.json()//Covertimos a json
      const scores = dataAgregacion.result//Extraemos el resultado

      const combinedData = scores.map((score, idx) => ({ //Combinamos la data
        score,
        idx,
        alternativa: alternativas[idx],
        matrizNormalizada: matrizNormalizada[idx],
      }))

      combinedData.sort((a, b) => b.score - a.score)//Ordenamos de mayor a mejor
      //Separamos una vez ordenada
      const alternativasOrdenadas = combinedData.map((item) => item.alternativa)
      const puntuacionesOrdenadas = combinedData.map((item) => item.score)
      const matrizNormalizadaOrdenada = combinedData.map((item) => item.matrizNormalizada)

      // const matrizPonderada: number[][] = matrizNormalizadaOrdenada.map((fila: number[]) =>
      //   fila.map((valor, idx) => valor * weights[idx]),
      // )

      setAlternativas(alternativasOrdenadas)//Guardamos las alternativas con el nuevo orden

      setResultado({
        matriz_normalizada: matrizNormalizadaOrdenada,
        // matriz_ponderada: matrizPonderada,
        puntuaciones: puntuacionesOrdenadas,
        ranking: combinedData.map((_, i) => i + 1),//Ponemosn ranking 1,2,3,4,56
      })

      message.success("Evaluación completada exitosamente")//Cambiar mensaje por algo de ant desing
    } catch (error) {
      console.error(" Error ejecutando evaluación:", error)
      message.error("Error al ejecutar la evaluación")
    } finally {
      setEvaluando(false)
    }
  }
  //Estemetodo permite generar un valor por defecto para cuando agregamosuna nueva alternativa por criterio
  const getValorInicialParaCriterio = (criterio: Nodo, modo: ModoValor): ValorCriterio => {//Debe recibir el criterio y el modo 

    if (modo === "unico") {
      // if (isMautDiscreto) {
      //   return {
      //     tipo: "unico",
      //     valor: criterio.MAUT!.funcionDiscreta!.valores[0].nombre,
      //   }
      // }
      return {
        tipo: "unico",
        valor: criterio.min || 0,//Devolvemos 
      }
    } else {
      const isMautDiscreto =//Si es maut y es discreto se trabaja de una manera
        modelo?.getMetodo() === "MAUT" && //El modelo es maut?
        criterio.MAUT?.tipoFuncion === "discreta" &&//El criterio es de tipo de funcion discreto, es decir son valores cualitativos
        criterio.MAUT.funcionDiscreta?.valores.length//La función discreta tiene al menos un valor agregado? Se cvumple todo eso? entonces true

      if (isMautDiscreto) {//Si es discreto
        const defaultValue = criterio.MAUT!.funcionDiscreta!.valores[0].nombre as unknown as number//El primer valor seleccionado será el valor por defecto
        return {
          tipo: "rango",
          min: defaultValue,
          max: defaultValue,
        }
      }
      return {//Si no es discreto
        tipo: "rango",
        min: criterio.min || 0,
        max: criterio.max || 100,
      }
    }
  }

  const agregarAlternativa = () => { //Para agregar la alternativa
    const nuevaAlternativa: Alternativa = { //Estructura de la alternativa
      key: `alt-${Date.now()}`,//Un key para la facilidad
      nombre: `Alternativa ${alternativas.length + 1}`,//El nombre de la alternativapordefecto
      valores: {},//Valores
    }

    criteriosFinales.forEach((criterio) => {//Asignamos un valor acada criterio
      nuevaAlternativa.valores[criterio.idnodo] = getValorInicialParaCriterio(criterio, modoValor)//Usamos la función para tener un valor por defecto
    })

    setAlternativas([...alternativas, nuevaAlternativa])//Agregamos la nueva alternativa
    setResultado(null)//Reestablecemos los resultados (Ya que al ser nuevas alternativas ese valor puede cambiar)
    message.success("Alternativa agregada")//Mostramos un mensaje (Ahora no funciona)
  }

  const eliminarAlternativa = (key: string) => {//Eliminar una alternativa
    setAlternativas(alternativas.filter((alt) => alt.key !== key))//Volvemos a guardar en alternativas todas las alternativas diferentes a las seleccionada
    setResultado(null)//Establecemos los resultados en null (Ta qye alk ser una alternativa ese valor puede cambiar)
    message.success("Alternativa eliminada")//Mostramos un mensaje (Ahora no funciona)
  }

  //Para cambiar el valor de un criterio 
  const actualizarValorUnico = (key: string, idCriterio: number, valor: number | string) => {
    //Recibimos la key de la alternativa y el id del criterio ademas del valor que se va a cambiar
    setAlternativas(
      alternativas.map((alt) => {//Recorremos las alternativas
        if (alt.key === key) {//Si la alternativa es la que vamos a cambiar haremos esto:
          return {
            ...alt,//Cambiaremos esa alternativa
            valores: {//Ese valor
              ...alt.valores,
              [idCriterio]: {//En ese criterio 
                tipo: "unico",
                valor,//Cambiamos el valor
              },
            },
          }
        }
        return alt//Y devolvemos el valor
      }),
    )
    setResultado(null)//Establecemos los resultados en nada puesto que al cambiar la alternativa lo podemos cambiar 
  }

  const actualizarValorRango = (//Ahora actualizaremos para cuando es maut o rango (Que es lomismo)
    keyAlternativa: string,//La alternativa
    idCriterio: number, //El valor del criterio que vamos a cambiar
    campo: "min" | "max",//Si es elminimo o el maximo
    valor: number | string,//Si es string o number (Cualitativo o cuantitativo)
  ) => {
    setAlternativas(//Establecemos la alternativa
      alternativas.map((alt) => {//Recorremoslas alternativas 
        if (alt.key === keyAlternativa) {//si una alternativa se parece a la key
          const valorActual = alt.valores[idCriterio]//Buscamoselcriterio a cambiar
          const currentMin = valorActual.tipo === "rango" ? valorActual.min : 0//Establecemos el valor actual en variables
          const currentMax = valorActual.tipo === "rango" ? valorActual.max : 100//Lo mismo para elmáximo 

          const newMin = campo === "min" ? (valor as unknown as number) : currentMin //Colocamos el nuevo valor en min, si no se puede dejamos el anterior 
          const newMax = campo === "max" ? (valor as unknown as number) : currentMax//Colocamos nuevo valor en max 

          const nuevoValor: ValorRango = {//Armamos el nuevo valor con el newmin y el new max
            tipo: "rango",
            min: newMin,
            max: newMax,
          }

          return {//Establecemos las alternativas con el nuevo valor
            ...alt,
            valores: {
              ...alt.valores,
              [idCriterio]: nuevoValor,
            },
          }
        }
        return alt
      }),
    )
    setResultado(null)//Resultados en null porque pueden cambiar
  }

  const actualizarNombre = (key: string, nuevoNombre: string) => {//Para actualizar el nombre
    setAlternativas(//Establecemos la alternativa con el nuevo nombre
      alternativas.map((alt) => {//Recorremos las alternativas 
        if (alt.key === key) {//Hasta encontrar la que tiene key de la alternativa actual
          return { ...alt, nombre: nuevoNombre }//Retornamos la alternativa con elnuevo Nombre
        }
        return alt//Retornamos la alternativa
      }),
    )
  }
  // Función que maneja la carga de un archivo Excel
  const handleExcelUpload = (file: File) => {
    // Se crea un lector de archivos del navegador
    const reader = new FileReader()

    // Cuando el lector termine de leer el archivo...
    reader.onload = (e) => {
      try {
        // Se obtiene el contenido binario del archivo cargado
        const data = e.target?.result

        // Se utiliza la librería XLSX para leer el archivo Excel en formato binario
        const workbook = XLSX.read(data, { type: "binary" })

        // Se obtiene el nombre de la primera hoja del libro
        const sheetName = workbook.SheetNames[0]

        // Se obtiene la hoja correspondiente del libro
        const worksheet = workbook.Sheets[sheetName]

        // Se convierte la hoja en una matriz de arrays (filas y columnas)
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

        // Se valida que el Excel tenga al menos una fila de encabezado y una de datos
        if (jsonData.length < 2) {
          message.error("El archivo Excel debe tener al menos una fila de encabezados y una fila de datos")//Debo cambiar el mensaje por uno que valga
          return
        }

        // Arreglo donde se guardarán las nuevas alternativas extraídas del Excel
        const nuevasAlternativas: Alternativa[] = []

        //  Si el modelo es MAUT (usa min y max)
        if (modelo?.getMetodo() === "MAUT") {
          // Se recorren las filas del Excel (saltando la cabecera)
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i]
            if (!row || row.length === 0) continue // Se omiten filas vacías

            // Se obtiene el nombre de la alternativa (columna 0)
            const nombreAlternativa = row[0]?.toString() || `Alternativa ${i}`

            // Se crea un objeto de tipo Alternativa con su clave, nombre y valores vacíos
            const nuevaAlternativa: Alternativa = {
              key: `alt-${Date.now()}-${i}`,
              nombre: nombreAlternativa,
              valores: {},
            }

            // Índice de columna en el Excel (1 porque la 0 es el nombre)
            let excelColIdx = 1

            // Se recorren los criterios finales del modelo
            criteriosFinales.forEach((criterio) => {
              const valorMin = row[excelColIdx]      // Columna del valor mínimo
              const valorMax = row[excelColIdx + 1]  // Columna del valor máximo

              // Si el criterio tiene función MAUT discreta (con categorías nominales)
              if (criterio.MAUT?.tipoFuncion === "discreta") {
                // Se obtienen los valores de texto (por ejemplo: "Bajo", "Medio", "Alto")
                const valorMinStr = valorMin?.toString().trim() || ""
                const valorMaxStr = valorMax?.toString().trim() || ""
                const opcionesDiscretas = criterio.MAUT.funcionDiscreta?.valores || []

                // Se buscan las opciones coincidentes en la función discreta
                const opcionMin = opcionesDiscretas.find(
                  (op) => op.nombre.toLowerCase() === valorMinStr.toLowerCase()
                )
                const opcionMax = opcionesDiscretas.find(
                  (op) => op.nombre.toLowerCase() === valorMaxStr.toLowerCase()
                )

                // Se guarda el rango seleccionado en los valores de la alternativa
                nuevaAlternativa.valores[criterio.idnodo] = {
                  tipo: "rango",
                  min: (opcionMin?.nombre as unknown as number) || (opcionesDiscretas[0]?.nombre as unknown as number),
                  max: (opcionMax?.nombre as unknown as number) || (opcionesDiscretas[0]?.nombre as unknown as number),
                }
              } else {
                // Si es una función continua (numérica), se convierten los valores a número
                const numMin = typeof valorMin === "number" ? valorMin : Number.parseFloat(valorMin?.toString() || "0")
                const numMax = typeof valorMax === "number" ? valorMax : Number.parseFloat(valorMax?.toString() || "100")

                // Se asigna el rango numérico al criterio correspondiente
                nuevaAlternativa.valores[criterio.idnodo] = {
                  tipo: "rango",
                  min: !isNaN(numMin) ? numMin : criterio.min || 0,
                  max: !isNaN(numMax) ? numMax : criterio.max || 100,
                }
              }

              // Se avanza dos columnas (una para min y otra para max)
              excelColIdx += 2
            })

            // Se agrega la nueva alternativa procesada a la lista
            nuevasAlternativas.push(nuevaAlternativa)
          }
        }
        //Caso contrario: modelo normal (no rango)
        else {
          // Se obtienen los encabezados (criterios) de la primera fila, excepto la primera columna
          const headers = jsonData[0].slice(1)

          // Si hay una diferencia entre las columnas del Excel y los criterios del modelo, se advierte
          if (headers.length !== criteriosFinales.length) {
            message.warning(
              `El Excel tiene ${headers.length} columnas de criterios, pero el modelo tiene ${criteriosFinales.length} criterios finales. Se intentará hacer coincidir por nombre.`,
            )
          }

          // Se recorren las filas de datos
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i]
            if (!row || row.length === 0) continue

            const nombreAlternativa = row[0]?.toString() || `Alternativa ${i}`

            // Se crea la nueva alternativa vacía
            const nuevaAlternativa: Alternativa = {
              key: `alt-${Date.now()}-${i}`,
              nombre: nombreAlternativa,
              valores: {},
            }

            // Se recorren los criterios para llenar sus valores
            criteriosFinales.forEach((criterio, criterioIdx) => {
              const excelColIdx = criterioIdx + 1 // Columna correspondiente
              const valor = row[excelColIdx]

              // Si el modelo es MAUT con función discreta
              if (modelo?.getMetodo() === "MAUT" && criterio.MAUT?.tipoFuncion === "discreta") {
                const valorStr = valor?.toString().trim() || ""
                const opcionesDiscretas = criterio.MAUT.funcionDiscreta?.valores || []

                // Se busca el valor discreto que coincide por nombre
                const opcionEncontrada = opcionesDiscretas.find(
                  (op) => op.nombre.toLowerCase() === valorStr.toLowerCase(),
                )

                // Se guarda el valor discreto seleccionado
                nuevaAlternativa.valores[criterio.idnodo] = {
                  tipo: "unico",
                  valor: opcionEncontrada?.nombre || opcionesDiscretas[0]?.nombre || "",
                }
              }
              // Si el criterio es numérico
              else {
                if (valor !== undefined && valor !== null && valor !== "") {
                  const numValor = typeof valor === "number" ? valor : Number.parseFloat(valor.toString())

                  nuevaAlternativa.valores[criterio.idnodo] = {
                    tipo: "unico",
                    valor: !isNaN(numValor) ? numValor : criterio.min || 0,
                  }
                } else {
                  // Si no hay valor en la celda, se usa el mínimo del criterio
                  nuevaAlternativa.valores[criterio.idnodo] = {
                    tipo: "unico",
                    valor: criterio.min || 0,
                  }
                }
              }
            })

            // Se agrega la alternativa procesada al arreglo final
            nuevasAlternativas.push(nuevaAlternativa)
          }
        }

        // Se actualiza el estado con las nuevas alternativas
        setAlternativas(nuevasAlternativas)

        // Se limpia cualquier resultado anterior
        setResultado(null)

        // Se muestra mensaje de éxito con la cantidad de alternativas cargadas (Debo cambiarlo por algo que valga)
        message.success(`Se cargaron ${nuevasAlternativas.length} alternativas desde el Excel`)
      } catch (error) {
        // Si algo falla en la lectura o conversión, se captura el error
        console.error("Error procesando Excel:", error)
        message.error("Error al procesar el archivo Excel")
      }
    }

    // Se inicia la lectura del archivo Excel como cadena binaria
    reader.readAsBinaryString(file)

    // Retorna false para evitar que el archivo se cargue automáticamente en un control de formulario
    return false
  }

  //Esto para cargarlas columnas que van en la tabla de alternativas. Es decir las columnas que van entre nombre y acciones
  const renderValorUnicoCell = (criterio: Nodo, valorCriterio: ValorCriterio, record: Alternativa) => {
    //Necesita el criterio, el valor que contiene y la alternativa
    //     if (modelo?.getMetodo() === "MAUT" && criterio.MAUT?.tipoFuncion === "discreta") {//Si es maut y discreta
    //       const opcionesDiscretas = criterio.MAUT.funcionDiscreta?.valores || []//Sacamos las opciones del criterio
    //       const valorSeleccionado =//Guardamos el valor seleccionado 
    //         valorCriterio?.tipo === "unico" && typeof valorCriterio.valor === "string"
    //           ? valorCriterio.valor
    //           : opcionesDiscretas[0]?.nombre || ""

    //       return (//Entonces retornamos el select que usan los valores discretos
    //         <Select
    //           value={valorSeleccionado}
    //           onChange={(val) => actualizarValorUnico(record.key, criterio.idnodo, val)}
    //           className="w-full"
    //           options={opcionesDiscretas.map((op) => ({
    //             label: op.nombre,
    //             value: op.nombre,
    //           }))}
    //         />
    //       )
    //     }
    // //Si no es maut entonces será 
    const valor =
      valorCriterio?.tipo === "unico" && typeof valorCriterio.valor === "number"
        ? valorCriterio.valor//Ponemos el valor enviado o el valorminimo
        : criterio.min || 0

    return (
      <InputNumber //Se retorna elinput number del modelo
        value={valor}
        onChange={(val) => actualizarValorUnico(record.key, criterio.idnodo, val || 0)}
        min={criterio.min || 0}
        max={criterio.max || 100}
        className="w-full"
      />
    )
  }

  //Esto para cargarlas columnas que van en la tabla de alternativas. Pero para cuando es rango
  const renderRangeCell = (criterio: Nodo, valorCriterio: ValorCriterio, record: Alternativa, campo: "min" | "max") => {
    const isMautDiscreto = modelo?.getMetodo() === "MAUT" && criterio.MAUT?.tipoFuncion === "discreta"//Verificamos si es discreto

    if (isMautDiscreto) {//Si es discreto
      const opcionesDiscretas = criterio.MAUT?.funcionDiscreta?.valores || []//Sacamos las posibles opciones
      const rawValue = valorCriterio?.tipo === "rango" ? (campo === "min" ? valorCriterio.min : valorCriterio.max) : ""

      const valorSeleccionado =
        opcionesDiscretas.find((op) => op.nombre === rawValue)?.nombre || opcionesDiscretas[0]?.nombre || ""//Obtenemos el valor seleccionado

      return (//Devolvemos el select con el valor seleccionado
        <Select
          value={valorSeleccionado}
          onChange={(val) => actualizarValorRango(record.key, criterio.idnodo, campo, val)}
          className="w-full"
          options={opcionesDiscretas.map((op) => ({
            label: op.nombre,
            value: op.nombre,
          }))}
        />
      )
    }
    //Si no es discreto
    const valor =
      valorCriterio?.tipo === "rango"//Sacamos el valora tratar
        ? campo === "min"
          ? valorCriterio.min
          : valorCriterio.max
        : campo === "min"
          ? criterio.min || 0
          : criterio.max || 100

    return (//Devolvemos el InputNumber con elvalor correspondiente
      <InputNumber
        value={valor}
        onChange={(val) => actualizarValorRango(record.key, criterio.idnodo, campo, val || 0)}
        min={criterio.min || 0}
        max={criterio.max || 100}
        className="w-full"
      />
    )
  }
  //Las columnas que se pondrán en la tabla para añadir alternativas
  const columnasValores =
    modoValor === "unico"//Si es unico 
      ? criteriosFinales.map((criterio: Nodo) => ({//Recorremos los criterios finales
        title: criterio.titulo,//Guardamos los datos de la tabla
        dataIndex: ["valores", criterio.idnodo],
        key: `criterio-${criterio.idnodo}`,
        width: 150,//El ancho
        render: (valorCriterio: ValorCriterio, record: Alternativa) =>
          renderValorUnicoCell(criterio, valorCriterio, record),//Renderizamos lo que corresponde
      }))
      : criteriosFinales.flatMap((criterio: Nodo) => [//Si es rango
        {//Renderizamos para el min y el maximo
          title: `${criterio.titulo} (Min)`,
          dataIndex: ["valores", criterio.idnodo],
          key: `criterio-${criterio.idnodo}-min`,
          width: 150,
          render: (valorCriterio: ValorCriterio, record: Alternativa) =>
            renderRangeCell(criterio, valorCriterio, record, "min"),
        },
        {
          title: `${criterio.titulo} (Max)`,
          dataIndex: ["valores", criterio.idnodo],
          key: `criterio-${criterio.idnodo}-max`,
          width: 150,
          render: (valorCriterio: ValorCriterio, record: Alternativa) =>
            renderRangeCell(criterio, valorCriterio, record, "max"),
        },
      ])

  const columns = [
    {//Columnas que iran en la tabla 
      title: "Alternativa",//Para el nombre de la alternativa
      dataIndex: "nombre",
      key: "nombre",
      width: 200,
      render: (text: string, record: Alternativa) => (
        <Input
          value={text}
          onChange={(e) => actualizarNombre(record.key, e.target.value)}
          placeholder="Nombre de alternativa"
        />
      ),
    },
    ...columnasValores,//Las columnas de intermedio
    {//Columna de acciones
      title: "Acciones",
      key: "acciones",
      width: 100,
      render: (_: any, record: Alternativa) => (
        <Button type="text" danger onClick={() => eliminarAlternativa(record.key)}>
          Eliminar
        </Button>
      ),
    },
  ]

  const columnasNormalizadas = [//Lo que va en las columnas normalizadas
    {//Alternativa de nombre
      title: "Alternativa",
      dataIndex: "nombre",
      key: "nombre",
      width: 200,
      fixed: "left" as const,
    },
    ...criteriosFinales.flatMap((criterio: Nodo, idx: number) =>
      modoValor === "rango" && resultado?.result_min
        ? [
          {
            title: `${criterio.titulo} (Mín)`,
            dataIndex: `criterio_${idx}_min`,
            key: `criterio_${idx}_min`,
            width: 120,
            render: (value: number) => value?.toFixed(4) || "0.0000",//Renderizamos rangos 
          },
          {
            title: `${criterio.titulo} (Máx)`,
            dataIndex: `criterio_${idx}_max`,
            key: `criterio_${idx}_max`,
            width: 120,
            render: (value: number) => value?.toFixed(4) || "0.0000",
          },
        ]
        : [
          {
            title: criterio.titulo,
            dataIndex: `criterio_${idx}`,
            key: `criterio_${idx}`,
            width: 120,
            render: (value: number) => value?.toFixed(4) || "0.0000",// Renderizamos unicos
          },
        ],
    ),
  ]// Los datos normalizados que se mostrarán en la tabla
  const datosNormalizados = resultado // Verificamos si existe un resultado de evaluación
    ? alternativas.map((alt, idx) => { // Recorremos todas las alternativas evaluadas

      // Creamos un objeto base que contendrá la información de la alternativa
      const baseData: { [key: string]: any } = {
        key: alt.key,      // Identificador único de la alternativa
        nombre: alt.nombre, // Nombre de la alternativa
      }

      // Si el modo actual es "rango" (es decir, modelo MAUT) y existen resultados mínimos
      if (modoValor === "rango" && resultado.result_min) {
        // Recorremos los criterios finales del modelo
        criteriosFinales.forEach((_, criterioIdx) => {
          // Guardamos los valores normalizados mínimos para este criterio y alternativa
          baseData[`criterio_${criterioIdx}_min`] = resultado.result_min?.[idx]?.[criterioIdx] || 0
          // Guardamos los valores normalizados máximos
          baseData[`criterio_${criterioIdx}_max`] = resultado.result_max?.[idx]?.[criterioIdx] || 0
        })
      }
      // Si no es rango (modelos como SAW, TOPSIS, etc.)
      else {
        // Recorremos los criterios finales
        criteriosFinales.forEach((_, criterioIdx) => {
          // Asignamos los valores normalizados únicos (sin rango)
          baseData[`criterio_${criterioIdx}`] = resultado.matriz_normalizada[idx]?.[criterioIdx] || 0
        })
      }

      // Devolvemos la fila completa de datos normalizados (una por alternativa)
      return baseData
    })
    // Si no existe resultado aún, devolvemos un arreglo vacío
    : []

  const columnasResultados = [
    {
      title: "Ranking",//Titulo que aparecera en la cabezera
      dataIndex: "ranking",
      key: "ranking",
      width: 100,
      render: (ranking: number) => (
        <div className="flex items-center justify-center">
          <span className="text-lg font-bold">{ranking}</span>{/* Muestra el número en grande y centrado */}
        </div>
      ),
    },
    {
      title: "Alternativa",
      dataIndex: "nombre",//Campo con el nombre
      key: "nombre",
      width: 250,
    },
    ...(modoValor === "rango" && resultado?.score_min
      ? [
        {
          title: "Puntaje (Mín)",
          dataIndex: "puntuacion_min",
          key: "puntuacion_min",
          width: 150,
          render: (puntuacion: number) => <div className="font-semibold text-blue-400">{puntuacion?.toFixed(4)}</div>,
        },
        {
          title: "Puntaje (Avg)",
          dataIndex: "puntuacion",
          key: "puntuacion",
          width: 150,
          render: (puntuacion: number) => <div className="font-semibold text-blue-600">{puntuacion?.toFixed(4)}</div>,
        },
        {
          title: "Puntaje (Máx)",
          dataIndex: "puntuacion_max",
          key: "puntuacion_max",
          width: 150,
          render: (puntuacion: number) => <div className="font-semibold text-blue-800">{puntuacion?.toFixed(4)}</div>,
        },
      ]
      : [
        {
          title: "Puntuación",
          dataIndex: "puntuacion",
          key: "puntuacion",
          width: 150,
          render: (puntuacion: number) => <div className="font-semibold text-blue-600">{puntuacion.toFixed(4)}</div>,
        },
      ]),
    // {
    //   title: "Porcentaje",
    //   dataIndex: "porcentaje",
    //   key: "porcentaje",
    //   width: 150,
    //   render: (porcentaje: number) => (
    //     <div className="w-full">
    //       <div className="flex items-center gap-2">
    //         <div className="flex-1 bg-gray-200 rounded-full h-6 overflow-hidden">
    //           <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${porcentaje}%` }} />
    //         </div>
    //         <span className="text-sm font-medium">{porcentaje.toFixed(1)}%</span>
    //       </div>
    //     </div>
    //   ),
    // },
  ]

  const datosResultados = resultado//Si hay resultado
    ? resultado.ranking.map((rank, idx) => ({//Recorremos los resultados
      key: alternativas[idx].key,
      nombre: alternativas[idx].nombre,
      puntuacion: resultado.puntuaciones[idx],//Sacamos las puntuaciones
      puntuacion_min: resultado.score_min?.[idx] || 0,
      puntuacion_max: resultado.score_max?.[idx] || 0,
      ranking: rank,
      porcentaje:
        modoValor === "rango" && resultado.score_avg
          ? (resultado.score_avg[idx] / Math.max(...(resultado.score_avg || [1]))) * 100
          : (resultado.puntuaciones[idx] / Math.max(...resultado.puntuaciones)) * 100,
    }))
    : []

  const tabItems = [//Lo que hay en cada tab
    {
      key: "1",
      label: "Alternativas",
      children: (
        <div className="space-y-4">
          {/*  Cabecera de gestión */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <Row gutter={[16, 16]} align="middle" justify="space-between">
              {/* Título */}
              <Col xs={24} md={8} lg={6}>
                <h3 className="text-lg font-semibold text-center md:text-left">
                  Gestión de Alternativas
                </h3>
              </Col>

              {/* Botones (responsivos) */}
              <Col xs={24} md={16} lg={18}>
                <Row gutter={[8, 8]} justify="end" wrap>
                  <Col xs={24} sm={12} md="auto">
                    <Upload accept=".xlsx,.xls" beforeUpload={handleExcelUpload} showUploadList={false}>
                      <Button block icon={<UploadOutlined />}>
                        Cargar desde Excel
                      </Button>
                    </Upload>
                  </Col>

                  <Col xs={24} sm={12} md="auto">
                    <Button block type="primary" onClick={agregarAlternativa}>
                      Agregar Alternativa
                    </Button>
                  </Col>

                  <Col xs={24} sm={12} md="auto">
                    <Button
                      block
                      type="primary"
                      onClick={EvaluarAlternativas}
                      disabled={alternativas.length < 2 || !!validacionMAUT}
                      loading={evaluando}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Evaluar Alternativas
                    </Button>
                  </Col>
                </Row>
              </Col>
            </Row>
          </div>

          {/* Validación MAUT (si aplica) */}
          {validacionMAUT && (
            <div className="space-y-2 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              <p className="font-medium">
                ⚠️ <strong>No se puede evaluar</strong> porque faltan funciones de utilidad (Método{" "}
                <strong>MAUT</strong>):
              </p>
              <div className="whitespace-pre-line text-sm">{validacionMAUT}</div>
              <p className="text-sm mt-2 text-red-600">
                Por favor, configura las funciones de utilidad para todos los criterios finales en el tablero del modelo
                antes de evaluar.
              </p>
            </div>
          )}

          {/*  Tabla de alternativas */}
          <div className="bg-white rounded-lg border overflow-x-auto">
            <Table
              columns={columns}
              dataSource={alternativas}
              pagination={false}
              scroll={{ x: "max-content" }}
            />
          </div>

          {/* Resumen inferior */}
          <div className="text-sm text-gray-500">
            <p>
              <strong>Criterios finales:</strong> {criteriosFinales.length}
            </p>
            <p>
              <strong>Alternativas:</strong> {alternativas.length}
            </p>
            <p>
              <strong>Modo actual:</strong>{" "}
              {modoValor === "unico" ? "Valor único por criterio" : "Rango (mín-máx) por criterio"}
            </p>
            <p className="mt-2 text-xs text-gray-400">
              <strong>Formato Excel:</strong> Primera columna = nombres de alternativas, siguientes columnas = valores
              para cada criterio (en modo rango: criterio1_min, criterio1_max, criterio2_min, criterio2_max, ...).
              <strong> Para MAUT discreto:</strong> el valor debe coincidir con el nombre de la opción discreta
              configurada.
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "2",
      label: "Evaluación (Normalizada)",
      children: (
        <div className="space-y-4">
          {evaluando ? (
            <div className="flex items-center justify-center p-12">
              <Spin size="large" />
            </div>
          ) : resultado ? (
            <>
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-2">Matriz Normalizada</h3>
                <p className="text-sm text-gray-600">
                  Valores normalizados de cada criterio para todas las alternativas
                  {modoValor === "rango" && " (mostrando solo Min y Máx)"}
                </p>
              </div>
              <div className="bg-white rounded-lg border">
                <Table
                  columns={columnasNormalizadas}
                  dataSource={datosNormalizados}
                  pagination={false}
                  scroll={{ x: "max-content" }}
                />
              </div>
              <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded">
                <p>
                  <strong>Información:</strong> La normalización ajusta todos los valores a una escala común (0-1) para
                  permitir comparaciones justas entre criterios con diferentes rangos.
                  {modoValor === "rango" && " Los valores promedio se calculan internamente pero no se muestran aquí."}
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-gray-400">
              <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <p className="text-lg">No hay resultados disponibles</p>
              <p className="text-sm">Agrega al menos 2 alternativas y haz clic en "Evaluar Alternativas"</p>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "3",
      label: "Resultados",
      children: (
        <div className="space-y-4">
          {evaluando ? (
            <div className="flex items-center justify-center p-12">
              <Spin size="large" />
            </div>
          ) : resultado ? (
            <>
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-2">
                  Clasificación Final - Método {modelo?.getData().metodo || "SAW"}
                </h3>
                <p className="text-sm text-gray-600">
                  Ranking de alternativas basado en puntuaciones ponderadas
                  {modoValor === "rango" && " (Mín, Avg, Máx)"}
                </p>
              </div>
              <div className="bg-white rounded-lg border">
                <Table
                  columns={columnasResultados}
                  dataSource={datosResultados}
                  pagination={false}
                  rowClassName={(record) =>
                    record.ranking === 1 ? "bg-green-50" : record.ranking === 2 ? "bg-blue-50" : ""
                  }
                />
              </div>
              <br />
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 rounded-lg border-2 border-yellow-300">
                  <div className="text-3xl mb-2">🥇</div>
                  <div className="text-sm text-gray-600">Mejor Alternativa</div>
                  <div className="font-bold text-lg">{datosResultados[0]?.nombre}</div>
                  <div className="text-sm text-gray-500">Puntuación: {datosResultados[0]?.puntuacion.toFixed(4)}</div>
                </div>
                {datosResultados[1] && (
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-lg border-2 border-gray-300">
                    <div className="text-3xl mb-2">🥈</div>
                    <div className="text-sm text-gray-600">Segunda Mejor</div>
                    <div className="font-bold text-lg">{datosResultados[1]?.nombre}</div>
                    <div className="text-sm text-gray-500">Puntuación: {datosResultados[1]?.puntuacion.toFixed(4)}</div>
                  </div>
                )}
                {datosResultados[2] && (
                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg border-2 border-orange-300">
                    <div className="text-3xl mb-2">🥉</div>
                    <div className="text-sm text-gray-600">Tercera Mejor</div>
                    <div className="font-bold text-lg">{datosResultados[2]?.nombre}</div>
                    <div className="text-sm text-gray-500">Puntuación: {datosResultados[2]?.puntuacion.toFixed(4)}</div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-gray-400">
              <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <p className="text-lg">No hay resultados disponibles</p>
              <p className="text-sm">Agrega al menos 2 alternativas y haz clic en "Evaluar Alternativas"</p>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "4",
      label: "Análisis de Sensibilidad",
      disabled: alternativas.length < 2,
      children: (
        <div className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Análisis de Sensibilidad</h3>
            <p className="text-sm text-gray-600">
              Analiza cómo cambios en los pesos de los criterios afectan la clasificación de alternativas
            </p>
          </div>
          <br />

          <div className="grid grid-cols-1 gap-6">
            <Card hoverable onClick={() => openSensitivityAnalysis("unidimensional")} style={{ cursor: "pointer" }}>
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-lg font-semibold">Análisis de Sensibilidad de Peso Unidimensional</h4>
                    <p className="text-sm text-gray-600 mt-2">
                      Evalúa cómo cambia la mejor alternativa cuando varía el peso de un criterio específico mientras
                      los demás permanecen constantes.
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">Haz clic para analizar la estabilidad de un criterio individual</p>
              </div>
            </Card>

            <Card
              hoverable
              onClick={() => openSensitivityAnalysis("multidimensional")}
              style={{ cursor: "pointer", opacity: 0.6 }}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-lg font-semibold">Análisis de Sensibilidad de Peso de Alta Dimensión</h4>
                    <p className="text-sm text-gray-600 mt-2">
                      Evalúa cómo cambia la clasificación cuando múltiples pesos varían simultáneamente, permitiendo
                      análisis más complejos.
                    </p>
                  </div>
                </div>
                <div className="bg-gray-100 text-gray-800 px-3 py-1 rounded text-xs w-fit">
                  Análisis Multidimensional (Próximamente)
                </div>
                <p className="text-xs text-gray-500">Funcionalidad en desarrollo</p>
              </div>
            </Card>
          </div>
        </div>
      ),
    },
  ]

  const onClose = () => {
    setOpenModel(false);
  };

  return (
    <div className="flex h-screen">
      <div
        className={`border-r bg-white flex flex-col transition-all duration-300 ease-in-out`}
      >
        <div className="fixed top-4 right-4 z-50 flex items-center space-x-4">
          <button
            onClick={() => {
              setOpenModel(true)
            }}
            className="focus:outline-none cursor-pointer"
          >
            <Image
              src="/arbol.png"
              alt="Botón de play"
              width={40}
              height={40}
            />
          </button>
        </div>
        <Drawer
          title={`Modelo`}
          placement="left"
          size={"large"}
          onClose={onClose}
          open={openModel}
        >
          <ModeloSvgViewer
            nodos={modelo?.getNodos() || []}
            orientacion={modelo?.getOrientacion() || "h"}
            linea={modelo?.getLinea() || 1}
            nombreModelo={modelo?.getData().nombre || ""}
          />
        </Drawer>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        <Tabs items={tabItems} defaultActiveKey="1" />
      </div>

      <Modal
        isOpen={sensitivityModalOpen}
        onClose={() => {
          setOpenSensitivityModal(false)
          setSelectedAnalysisType(null)
        }}
        title={
          selectedAnalysisType === "unidimensional"
            ? "Análisis de Sensibilidad de Peso Unidimensional"
            : "Análisis de Sensibilidad Multidimensional"
        }
        width="900px"
      >
        {selectedAnalysisType === "unidimensional" && modelo && modelo.getMetodo() === "MAUT" && (
          <UnidimensionalSensitivityMAUT
            alternativas={alternativas}
            criterios={modelo.getNodos()}
            metodoNombre={modelo.getMetodo()}
            hierarchy={modelo.getData().nodos.nodes}
            matrixNormMin={resultado?.result_min || []}
            matrixNormPromedioMin={resultado?.result_promedio_min || []}
            matrixNormPromedioMax={resultado?.result_promedio_max || []}
            matrixNormMax={resultado?.result_max || []}
          />
        )}
        {selectedAnalysisType === "unidimensional" && modelo && modelo.getMetodo() !== "MAUT" && (
          <UnidimensionalSensitivityAnalysis
            alternativas={alternativas}
            criterios={modelo.getNodos()}
            tipos={modelo.getCriteriosFinales().map((c) => (c.beneficio ? "max" : "min"))}
            metodoNombre={modelo.getMetodo()}
            hierarchy={modelo.getData().nodos.nodes}
            matrix={prepareAPIData()?.matrix || []}
          />
        )}
        {selectedAnalysisType === "multidimensional" && (
          <div className="p-4 text-center text-gray-500">
            <p>Funcionalidad en desarrollo</p>
          </div>
        )}
      </Modal>
    </div>
  )
}
