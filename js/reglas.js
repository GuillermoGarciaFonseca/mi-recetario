// Módulo de reglas dietéticas: la única fuente de verdad sobre si una receta es apta.
// Las etiquetas nunca se escriben a mano: salen de los ingredientes (tipo y alérgenos).

export const CATEGORIAS = {
  Comidas: ["Carnes", "Pescado y marisco", "Legumbres", "Verduras", "Arroces y pastas", "Huevos", "Sopas y cremas", "Ensaladas"],
  Postres: ["Tartas y bizcochos", "Galletas y masas", "Postres de cuchara", "Helados y fríos", "Frutas", "Chocolate"]
};

export const ALERGENOS = [
  { id: "gluten", etiqueta: "Sin gluten", icon: "i-gluten" },
  { id: "lactosa", etiqueta: "Sin lactosa", icon: "i-lactosa" },
  { id: "huevo", etiqueta: "Sin huevo", icon: "i-huevo" },
  { id: "frutos_secos", etiqueta: "Sin frutos secos", icon: "i-frutos" }
];

export const DIETAS = [
  { id: "vegetariano", etiqueta: "Vegetariano", icon: "i-hoja", cls: "t-veg" },
  { id: "vegano", etiqueta: "Vegano", icon: "i-brote", cls: "t-veg" },
  { id: "pescetariano", etiqueta: "Pescetariano", icon: "i-pez", cls: "t-pesc" },
  { id: "carnivoro", etiqueta: "Carnívoro", icon: "i-carne", cls: "t-carne" }
];

// Los 14 alérgenos de declaración obligatoria en la UE, con su nombre para los avisos.
export const NOMBRE_ALERGENO = {
  gluten: "gluten", crustaceos: "crustáceos", huevo: "huevo", pescado: "pescado", cacahuetes: "cacahuetes",
  soja: "soja", lactosa: "lactosa", frutos_secos: "frutos secos", apio: "apio", mostaza: "mostaza",
  sesamo: "sésamo", sulfitos: "sulfitos", altramuces: "altramuces", moluscos: "moluscos"
};

export const TIPOS = ["vegetal", "lacteo", "huevo", "miel", "pescado", "marisco", "carne"];

export function calcularEtiquetas(receta) {
  const ings = receta.ingredientes;
  const tipos = new Set(ings.map(i => i.tipo));
  const contiene = a => ings.some(i => i.contiene.includes(a));
  const trazas = a => !contiene(a) && ings.some(i => i.trazas.includes(a));

  const carne = tipos.has("carne");
  const mar = tipos.has("pescado") || tipos.has("marisco");
  const animal = carne || mar || tipos.has("lacteo") || tipos.has("huevo") || tipos.has("miel");

  const dieta = new Set();
  if (!animal) dieta.add("vegano");
  if (!carne && !mar) dieta.add("vegetariano");
  if (!carne && mar) dieta.add("pescetariano");
  if (carne) dieta.add("carnivoro");

  const sin = new Set();
  const soloTrazas = new Set();
  for (const { id } of ALERGENOS) {
    if (contiene(id)) continue;
    if (trazas(id)) soloTrazas.add(id);
    else sin.add(id);
  }

  const avisos = [...new Set(ings.flatMap(i => i.trazas))].filter(a => !contiene(a));
  return { dieta, sin, soloTrazas, avisos };
}

// Explica por qué una receta NO es apta para una etiqueta (para el juego ¿Es apto?).
export function motivo(receta, etiqueta) {
  const ings = receta.ingredientes;
  const al = ALERGENOS.find(a => a.id === etiqueta);
  if (al) {
    const c = ings.find(i => i.contiene.includes(etiqueta));
    if (c) return `lleva ${c.nombre}`;
    const t = ings.find(i => i.trazas.includes(etiqueta));
    if (t) return `${t.nombre} puede tener trazas`;
    return "";
  }
  const de = tipo => ings.find(i => i.tipo === tipo);
  const animal = de("carne") || de("pescado") || de("marisco") || de("lacteo") || de("huevo") || de("miel");
  if (etiqueta === "vegano" && animal) return `lleva ${animal.nombre}`;
  if (etiqueta === "vegetariano") { const x = de("carne") || de("pescado") || de("marisco"); if (x) return `lleva ${x.nombre}`; }
  if (etiqueta === "pescetariano") { if (de("carne")) return `lleva ${de("carne").nombre}`; return "no lleva pescado ni marisco"; }
  if (etiqueta === "carnivoro") return "no lleva carne";
  return "";
}

export function etiquetaNombre(id) {
  return (ALERGENOS.find(a => a.id === id) || DIETAS.find(d => d.id === id)).etiqueta;
}
