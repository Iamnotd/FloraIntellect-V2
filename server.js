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
// Inicio servidor
// ======================================================

app.listen(PORT, () => {
  console.log("");
  console.log("=====================================");
  console.log("🌿 FloraIntellect V2 iniciado");
  console.log(`🚀 http://localhost:${PORT}`);
  console.log("=====================================");
});