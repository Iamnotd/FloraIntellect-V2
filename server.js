// ======================================================
// FloraIntellect V2
// Backend Base
// ======================================================

import express from "express";
import cors from "cors";
import compression from "compression";
import dotenv from "dotenv";

import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createGroqChatResponse } from "./services/groq.js";

dotenv.config();

// ======================================================
// Configuración
// ======================================================

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

const PORT = process.env.PORT || 3030;

// ======================================================
// Middlewares
// ======================================================

app.use(cors());

app.use(compression());

app.use(
  express.json({
    limit: "12mb",
  })
);

// Servir archivos del frontend
app.use(express.static(__dirname));

// ======================================================
// Carga de datos
// ======================================================

function cargarPlantas() {
  const carpeta = join(__dirname, "data");

  const archivos = readdirSync(carpeta).filter((archivo) =>
    /^plantas_\d+\.json$/.test(archivo)
  );

  let plantas = [];

  for (const archivo of archivos) {
    const contenido = readFileSync(
      join(carpeta, archivo),
      "utf8"
    );

    plantas = plantas.concat(JSON.parse(contenido));
  }

  return plantas;
}

function cargarVerificadas() {
  return JSON.parse(
    readFileSync(
      join(__dirname, "data", "plantas_verificadas.json"),
      "utf8"
    )
  );
}

const PLANTAS = cargarPlantas();
const VERIFICADAS = cargarVerificadas();

console.log(`[data] ${PLANTAS.length} plantas cargadas`);
console.log(`[data] ${VERIFICADAS.length} plantas verificadas cargadas`);

// ======================================================
// Rutas
// ======================================================

// Frontend
app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "index.html"));
});

// Estado
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "FloraIntellect V2",
    catalogo: PLANTAS.length,
    verificadas: VERIFICADAS.length,
    port: PORT,
  });
});

// Catálogo completo
app.get("/plantas", (req, res) => {
  res.json({
    total: PLANTAS.length,
    plantas: PLANTAS,
  });
});

// Plantas verificadas
app.get("/verificadas", (req, res) => {
  res.json({
    total: VERIFICADAS.length,
    plantas: VERIFICADAS,
  });
});

// ======================================================
// Endpoints de demostracion
// Pendientes de reemplazar por integraciones reales de IA
// y servicios de identificacion en una fase futura.
// ======================================================

const QUIZ_DEMO = [
  {
    pregunta: "Que planta se usa tradicionalmente para molestias digestivas leves?",
    opciones: [
      { id: "manzanilla", texto: "Manzanilla" },
      { id: "eucalipto", texto: "Eucalipto" },
      { id: "romero", texto: "Romero" },
      { id: "lavanda", texto: "Lavanda" },
    ],
    correcta_id: "manzanilla",
    planta: {
      nombre: "Manzanilla",
      cientifico: "Matricaria chamomilla",
    },
  },
  {
    pregunta: "Que planta es conocida por su uso en vaporizaciones respiratorias?",
    opciones: [
      { id: "aloe", texto: "Aloe vera" },
      { id: "eucalipto", texto: "Eucalipto" },
      { id: "valeriana", texto: "Valeriana" },
      { id: "menta", texto: "Menta" },
    ],
    correcta_id: "eucalipto",
    planta: {
      nombre: "Eucalipto",
      cientifico: "Eucalyptus globulus",
    },
  },
  {
    pregunta: "Que planta suele asociarse con apoyo para el descanso?",
    opciones: [
      { id: "jengibre", texto: "Jengibre" },
      { id: "valeriana", texto: "Valeriana" },
      { id: "calendula", texto: "Calendula" },
      { id: "boldo", texto: "Boldo" },
    ],
    correcta_id: "valeriana",
    planta: {
      nombre: "Valeriana",
      cientifico: "Valeriana officinalis",
    },
  },
  {
    pregunta: "Que planta se usa comunmente en geles para irritaciones leves de piel?",
    opciones: [
      { id: "aloe", texto: "Aloe vera" },
      { id: "menta", texto: "Menta" },
      { id: "tilo", texto: "Tilo" },
      { id: "anis", texto: "Anis" },
    ],
    correcta_id: "aloe",
    planta: {
      nombre: "Aloe vera",
      cientifico: "Aloe vera",
    },
  },
  {
    pregunta: "Que raiz se usa tradicionalmente para nauseas leves?",
    opciones: [
      { id: "romero", texto: "Romero" },
      { id: "jengibre", texto: "Jengibre" },
      { id: "salvia", texto: "Salvia" },
      { id: "ortiga", texto: "Ortiga" },
    ],
    correcta_id: "jengibre",
    planta: {
      nombre: "Jengibre",
      cientifico: "Zingiber officinale",
    },
  },
];

const CHAT_SYMPTOM_KEYWORDS = {
  insomnio: ["insomnio", "dormir", "sueño", "descanso", "sedante", "relajante", "ansiedad", "nervios"],
  ansiedad: ["ansiedad", "estres", "nervios", "nervioso", "relajante", "sedante", "tranquilizante"],
  gastritis: ["gastritis", "digestivo", "estomago", "acidez", "ardor", "reflujo", "dispepsia"],
  digestion: ["digestivo", "digestion", "estomago", "gases", "flatulencia", "colitis", "pesadez"],
  nauseas: ["nauseas", "nausea", "vomitos", "antiemetico", "mareo", "cinetosis"],
  gripe: ["gripe", "gripa", "resfriado", "catarro", "tos", "congestion", "respiratorio", "bronquial"],
  tos: ["tos", "antitusivo", "respiratorio", "bronquial", "expectorante", "congestion"],
  piel: ["piel", "quemadura", "herida", "cicatrizante", "dermatitis", "acne", "irritacion"],
  dolor: ["dolor", "analgesico", "antiinflamatorio", "inflamacion", "migraña", "cabeza"],
};

function normalizarTexto(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokensBusqueda(texto) {
  const base = normalizarTexto(texto)
    .split(" ")
    .filter((token) => token.length > 2);

  const expandidos = new Set(base);
  for (const token of base) {
    const keywords = CHAT_SYMPTOM_KEYWORDS[token];
    if (keywords) keywords.forEach((keyword) => expandidos.add(keyword));
  }

  return [...expandidos];
}

function textoPlanta(planta) {
  return normalizarTexto([
    planta.nombre_comun,
    planta.nombre_cientifico,
    planta.familia,
    Array.isArray(planta.usos) ? planta.usos.join(" ") : planta.usos,
    planta.preparacion,
    planta.contraindicaciones,
    planta.parte_usada,
  ].filter(Boolean).join(" "));
}

function puntuarPlanta(planta, consulta, tokens) {
  const nombreComun = normalizarTexto(planta.nombre_comun);
  const nombreCientifico = normalizarTexto(planta.nombre_cientifico);
  const usos = normalizarTexto(Array.isArray(planta.usos) ? planta.usos.join(" ") : planta.usos);
  const blob = textoPlanta(planta);

  let score = 0;
  if (nombreComun && consulta.includes(nombreComun)) score += 12;
  if (nombreCientifico && consulta.includes(nombreCientifico)) score += 10;

  for (const token of tokens) {
    if (nombreComun.split(" ").includes(token)) score += 7;
    else if (nombreComun.includes(token)) score += 5;
    if (nombreCientifico.includes(token)) score += 4;
    if (usos.includes(token)) score += 4;
    else if (blob.includes(token)) score += 1;
  }

  return score;
}

function buscarPlantaParaChat(mensaje) {
  const consulta = normalizarTexto(mensaje);
  const tokens = tokensBusqueda(mensaje);
  if (!consulta || !tokens.length) return null;

  let mejor = null;
  let mejorScore = 0;

  for (const planta of PLANTAS) {
    const score = puntuarPlanta(planta, consulta, tokens);
    if (score > mejorScore) {
      mejor = planta;
      mejorScore = score;
    }
  }

  return mejorScore >= 4 ? mejor : null;
}

function crearRespuestaPlanta(planta, mensaje) {
  const usos = Array.isArray(planta.usos) ? planta.usos.slice(0, 4) : [];
  const usosTexto = usos.length ? usos.join(", ") : "usos tradicionales registrados";
  const sources = [
    { nombre: "Catálogo FloraIntellect", tipo: "base local" },
  ];

  return {
    reply: `Encontré una coincidencia para "${mensaje}": ${planta.nombre_comun}. En el catálogo se asocia con ${usosTexto}. Esta información es educativa y no sustituye orientación médica.`,
    plant: {
      ...planta,
      nivel_evidencia: planta.nivel_evidencia || "catalogo",
      advertencia: planta.contraindicaciones || "",
      fuentes: sources,
      fuente_principal: "Catálogo FloraIntellect",
    },
    sources,
    fuentes: sources,
  };
}

// Demo: respuesta local sin IA real. Se mantiene "fuentes" por compatibilidad
// con app.js y "sources" por claridad para futuras integraciones.
app.post("/chat", async (req, res) => {
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const last = messages.at(-1)?.content || "tu consulta";
  const match = buscarPlantaParaChat(last);

  try {
    const groqResponse = await createGroqChatResponse({
      messages,
      matchedPlant: match,
      verificadas: VERIFICADAS,
    });

    if (groqResponse) {
      res.json(groqResponse);
      return;
    }
  } catch (error) {
    console.error("[chat] Groq no disponible, usando modo demo:", error.message);
  }

  if (match) {
    res.json(crearRespuestaPlanta(match, last));
    return;
  }

  res.json({
    reply: `Respuesta de demostracion: recibi tu consulta sobre "${last}". Para la demo, FloraIntellect muestra informacion educativa y recomienda contrastar cualquier uso medicinal con fuentes verificadas y personal de salud.`,
    plant: null,
    sources: ["OMS", "TRAMIL"],
    fuentes: [
      { nombre: "OMS", tipo: "referencia educativa" },
      { nombre: "TRAMIL", tipo: "referencia etnobotanica" },
    ],
  });
});

// Demo: identificacion simulada. La imagen se ignora hasta integrar un
// servicio real de vision o reconocimiento botanico.
app.post("/identificar", (req, res) => {
  res.json({
    encontrada: true,
    nombre: "Manzanilla",
    nombres_comunes: ["Manzanilla"],
    nombre_cientifico: "Matricaria chamomilla",
    familia: "Asteraceae",
    confianza: 87,
    descripcion:
      "Identificacion simulada para demostracion. La manzanilla es una planta medicinal conocida por sus capitulos florales aromaticos.",
    advertencia:
      "Uso educativo. No sustituye diagnostico medico ni confirma la especie real de la imagen.",
    datos_verificados: true,
    nivel_evidencia: "media",
    fuente: "OMS / TRAMIL",
    respuesta:
      "Preparacion: infusion suave de flores secas en agua caliente. Contraindicaciones: evitar en caso de alergia a plantas de la familia Asteraceae. Interacciones: consultar con personal de salud si se toman anticoagulantes, sedantes u otros medicamentos.",
  });
});

// Demo: banco local de 5 preguntas. El frontend actual espera una pregunta
// por solicitud, por eso se devuelve una seleccion aleatoria del arreglo.
app.get("/quiz", (req, res) => {
  const index = Math.floor(Math.random() * QUIZ_DEMO.length);
  res.json(QUIZ_DEMO[index]);
});

// ======================================================
// Inicio servidor
// ======================================================

app.listen(PORT, () => {
  console.log("");
  console.log("=====================================");
  console.log("🌿 FloraIntellect V2 iniciado");
  console.log(`🚀 http://localhost:${PORT}`);
  console.log("=====================================");
});
