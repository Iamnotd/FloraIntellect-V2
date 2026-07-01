import Groq from "groq-sdk";

const MODEL = "llama-3.3-70b-versatile";

function hasGroqApiKey() {
  return Boolean(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim());
}

function compactPlant(plant) {
  if (!plant) return null;
  return {
    id: plant.id,
    nombre_comun: plant.nombre_comun,
    nombre_cientifico: plant.nombre_cientifico,
    familia: plant.familia,
    descripcion: plant.descripcion,
    usos: plant.usos_medicinales || plant.usos || [],
    parte_usada: plant.parte_usada,
    preparacion: plant.preparacion,
    dosis: plant.dosis,
    contraindicaciones: plant.contraindicaciones,
    interacciones_farmacologicas: plant.interacciones_farmacologicas,
    nivel_evidencia: plant.nivel_evidencia,
    fuente_principal: plant.fuente_principal,
    fuente_url: plant.fuente_url,
  };
}

function samePlant(a, b) {
  if (!a || !b) return false;
  const aNames = [a.nombre_comun, a.nombre_cientifico].filter(Boolean).map(normalize);
  const bNames = [b.nombre_comun, b.nombre_cientifico].filter(Boolean).map(normalize);
  return aNames.some(name => bNames.includes(name));
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function findVerifiedPlant(matchedPlant, verificadas = []) {
  if (!matchedPlant) return null;
  return verificadas.find(plant => samePlant(plant, matchedPlant)) || null;
}

function sourcesForPlant(plant, isVerified) {
  if (!plant) return [];
  if (isVerified) {
    return [
      {
        nombre: plant.fuente_principal || "Fuente verificada",
        tipo: "fuente verificada",
        url: plant.fuente_url || "",
      },
    ];
  }
  return [{ nombre: "Catálogo FloraIntellect", tipo: "base local" }];
}

function buildSystemPrompt() {
  return `
Eres FloraIntellect, un asistente educativo sobre plantas medicinales.
Reglas obligatorias:
- Nunca inventes información médica, dosis, preparación, contraindicaciones ni fuentes.
- Prioriza los datos provenientes de plantas_verificadas.json cuando estén disponibles.
- Si una planta no está verificada, indícalo explícitamente.
- Mantén un tono educativo, claro y prudente.
- Nunca reemplaces consejo médico ni diagnóstico profesional.
- Responde siempre en español.
- Usa únicamente el contexto de planta proporcionado. Si falta un dato, di que no está disponible.
`.trim();
}

function buildUserPrompt(messages, plant, isVerified) {
  const last = messages.at(-1)?.content || "";
  return JSON.stringify({
    consulta_usuario: last,
    planta_encontrada: compactPlant(plant),
    estado_verificacion: isVerified ? "verificada" : "catalogo_no_verificado",
    instrucciones_salida: {
      formato: "json",
      propiedades: {
        reply: "Respuesta breve y educativa en español. No incluyas markdown.",
      },
    },
  });
}

function fallbackReply(plant, isVerified) {
  if (!plant) {
    return "Puedo orientarte de forma educativa sobre plantas medicinales, pero no encontré una coincidencia clara en la base local. Consultá a un profesional de salud antes de usar cualquier planta con fines medicinales.";
  }

  const usos = plant.usos_medicinales || plant.usos || [];
  const usosText = Array.isArray(usos) && usos.length
    ? usos.slice(0, 4).join(", ")
    : "usos registrados en la base local";
  const status = isVerified
    ? "Esta planta cuenta con fuente verificada en FloraIntellect."
    : "Esta planta pertenece al catálogo general y no aparece como verificada en la base curada.";

  return `${plant.nombre_comun} se asocia con ${usosText}. ${status} Esta información es educativa y no sustituye consejo médico.`;
}

function parseGroqReply(content, plant, isVerified) {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed.reply === "string" && parsed.reply.trim()) {
      return parsed.reply.trim();
    }
  } catch {
    // Groq puede devolver texto plano si el modelo no respeta JSON estricto.
  }
  return content?.trim() || fallbackReply(plant, isVerified);
}

export async function createGroqChatResponse({ messages, matchedPlant, verificadas }) {
  if (!hasGroqApiKey()) return null;

  const verifiedPlant = findVerifiedPlant(matchedPlant, verificadas);
  const plant = verifiedPlant || matchedPlant || null;
  const isVerified = Boolean(verifiedPlant);
  const fuentes = sourcesForPlant(plant, isVerified);

  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    max_tokens: 450,
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildUserPrompt(messages, plant, isVerified) },
    ],
    response_format: { type: "json_object" },
  });

  const content = completion.choices?.[0]?.message?.content || "";
  const reply = parseGroqReply(content, plant, isVerified);

  return {
    reply,
    plant: plant
      ? {
          ...plant,
          nivel_evidencia: plant.nivel_evidencia || (isVerified ? "verificada" : "catalogo"),
          advertencia: plant.advertencia || plant.contraindicaciones || "",
          fuentes,
          fuente_principal: plant.fuente_principal || fuentes[0]?.nombre || "",
          fuente_url: plant.fuente_url || fuentes[0]?.url || "",
        }
      : null,
    fuentes,
  };
}
