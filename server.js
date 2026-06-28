// FloraIntellect V2 — Backend
// Base: Node.js + Express + JSON local + APIs externas

import express from "express";
import cors from "cors";
import compression from "compression";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

const PORT = process.env.PORT || 3030;
function cargarPlantas() {
  const dataDir = join(__dirname, "data");
  const archivos = readdirSync(dataDir).filter(archivo =>
    /^plantas_\d+\.json$/.test(archivo)
  );

  let plantas = [];

  for (const archivo of archivos) {
    const contenido = readFileSync(join(dataDir, archivo), "utf-8");
    plantas = plantas.concat(JSON.parse(contenido));
  }

  return plantas;
}

function cargarVerificadas() {
  return JSON.parse(
    readFileSync(join(__dirname, "data", "plantas_verificadas.json"), "utf-8")
  );
}

const PLANTAS = cargarPlantas();
const VERIFICADAS = cargarVerificadas();

console.log(`[data] ${PLANTAS.length} plantas cargadas`);
console.log(`[data] ${VERIFICADAS.length} plantas verificadas cargadas`);

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "FloraIntellect V2",
    catalogo: PLANTAS.length,
    verificadas: VERIFICADAS.length,
    port: PORT
  });
});

app.get("/plantas", (_req, res) => {
  res.json({
    total: PLANTAS.length,
    plantas: PLANTAS
  });
});

app.get("/verificadas", (_req, res) => {
  res.json({
    total: VERIFICADAS.length,
    plantas: VERIFICADAS
  });
});

app.listen(PORT, () => {
  console.log(`FloraIntellect V2 corriendo en http://localhost:${PORT}`);
});