const PLANTID_ENDPOINT =
  "https://plant.id/api/v3/identification?details=common_names,description,taxonomy";

function hasPlantIdKey() {
  return Boolean(process.env.PLANTID_KEY && process.env.PLANTID_KEY.trim());
}

function stripDataUrlPrefix(image) {
  return String(image || "").replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
}

function getFamily(details = {}) {
  const taxonomy = details.taxonomy || {};
  return taxonomy.family || details.family || "";
}

function getDescription(details = {}) {
  const description = details.description;
  if (!description) return "";
  if (typeof description === "string") return description;
  return description.value || "";
}

function normalizeSuggestion(suggestion) {
  const details = suggestion.details || {};
  const commonNames = Array.isArray(details.common_names)
    ? details.common_names.filter(Boolean)
    : [];
  const scientificName =
    suggestion.name ||
    suggestion.plant_name ||
    details.scientific_name ||
    "";

  return {
    encontrada: true,
    nombre: commonNames[0] || scientificName || "Planta identificada",
    nombres_comunes: commonNames,
    nombre_cientifico: scientificName,
    familia: getFamily(details),
    confianza: Math.round((suggestion.probability || 0) * 100),
    descripcion: getDescription(details),
  };
}

export async function identificarConPlantId({ imagen, tipo }) {
  if (!hasPlantIdKey()) return null;
  if (!imagen) {
    const error = new Error("imagen_requerida");
    error.status = 400;
    throw error;
  }

  const response = await fetch(PLANTID_ENDPOINT, {
    method: "POST",
    headers: {
      "Api-Key": process.env.PLANTID_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      images: [stripDataUrlPrefix(imagen)],
      similar_images: false,
      classification_level: "species",
    }),
  });

  if (!response.ok) {
    const error = new Error(`Plant.id HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  const suggestions = data.result?.classification?.suggestions || [];
  const best = suggestions[0];

  if (!best || !best.probability || best.probability < 0.15) {
    return {
      encontrada: false,
      nombre: "",
      nombres_comunes: [],
      nombre_cientifico: "",
      familia: "",
      confianza: 0,
      descripcion: "",
    };
  }

  return normalizeSuggestion(best);
}
