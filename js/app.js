import { CATEGORIAS, ALERGENOS, DIETAS, NOMBRE_ALERGENO, calcularEtiquetas } from "./reglas.js";
import { montarJuego, JUEGOS } from "./juegos.js";

/* ---------- Helpers ---------- */
const $ = id => document.getElementById(id);
const icon = (id, cls = "") => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
const norm = t => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const listaY = arr => arr.length < 2 ? arr.join("") : arr.slice(0, -1).join(", ") + " y " + arr.at(-1);

let RECETAS = [];

export function badgesDe(r) {
  const out = [];
  for (const d of DIETAS) {
    if (!r.tags.dieta.has(d.id)) continue;
    if (d.id === "vegetariano" && r.tags.dieta.has("vegano")) continue; // solo se muestra Vegano
    out.push(`<span class="badge ${d.cls}">${icon(d.icon)}${d.etiqueta}</span>`);
  }
  for (const a of ALERGENOS) if (r.tags.sin.has(a.id)) out.push(`<span class="badge t-alergeno">${icon(a.icon)}${a.etiqueta}</span>`);
  return out.join("");
}
const avisoTrazas = r => r.tags.avisos.length
  ? `<p class="traces">${icon("i-aviso")}Puede contener trazas de ${listaY(r.tags.avisos.map(a => NOMBRE_ALERGENO[a] || a))}</p>` : "";

function foto(r, cls = "") {
  const sec = r.seccion.toLowerCase();
  if (r.foto) return `<div class="photo ${sec} ${cls}"><img src="fotos/${esc(r.foto)}" alt="${esc(r.nombre)}" loading="lazy"></div>`;
  const ingr = r.ingredientes.slice(0, 3).map(i => esc(i.nombre)).join("<br>");
  return `<div class="photo ${sec} ${cls}">
    <span class="slot-note">Foto pendiente</span>
    <p class="ingr" aria-hidden="true">${ingr}</p>
  </div>`;
}

/* ---------- Estado de filtros ---------- */
const state = { q: "", seccion: "", categoria: "", sin: new Set(), dieta: new Set(), trazas: false };

function cumple(r, s = state) {
  if (s.seccion && r.seccion !== s.seccion) return false;
  if (s.categoria && r.categoria !== s.categoria) return false;
  for (const a of s.sin) {
    if (r.tags.sin.has(a)) continue;
    if (s.trazas && r.tags.soloTrazas.has(a)) continue;
    return false;
  }
  for (const d of s.dieta) if (!r.tags.dieta.has(d)) return false;
  if (s.q) {
    const hay = norm(r.nombre + " " + r.categoria + " " + r.ingredientes.map(i => i.nombre).join(" "));
    if (!hay.includes(norm(s.q))) return false;
  }
  return true;
}

function card(r) {
  const total = r.tiempo_preparacion_min + r.tiempo_coccion_min;
  return `<li class="card">
    ${foto(r)}
    <div class="card-body">
      <p class="where">${esc(r.seccion)}, ${esc(r.categoria.toLowerCase())}</p>
      <h3><a href="#receta-${esc(r.id)}">${esc(r.nombre)}</a></h3>
      <div class="meta"><span>${icon("i-reloj")}${total} min${r.tiempo_marinado_h ? ` + ${r.tiempo_marinado_h} h de marinado` : ""}</span><span>${icon("i-gorro")}${esc(r.dificultad)}</span></div>
      ${avisoTrazas(r)}
      <div class="badges">${badgesDe(r)}</div>
    </div>
  </li>`;
}

const toggleHTML = (item, group, cls) =>
  `<button type="button" class="toggle ${cls}" data-group="${group}" data-id="${item.id}" aria-pressed="false">${icon(item.icon)}${item.etiqueta}</button>`;

function syncPressed(root, s) {
  root.querySelectorAll(".toggle").forEach(b => {
    const set = b.dataset.group === "sin" ? s.sin : s.dieta;
    b.setAttribute("aria-pressed", set.has(b.dataset.id) ? "true" : "false");
  });
}

/* ---------- Frase-filtro ---------- */
const sState = { seccion: "Comidas", categoria: "Pescado y marisco", sin: new Set(["lactosa", "huevo"]), dieta: new Set() };

function fillSentenceCats() {
  const sel = $("s-cat");
  if (!CATEGORIAS[sState.seccion].includes(sState.categoria)) sState.categoria = "";
  sel.innerHTML = `<option value="">cualquier cosa</option>` + CATEGORIAS[sState.seccion].map(c => `<option>${c}</option>`).join("");
  sel.value = sState.categoria;
}
function updateSentenceCount() {
  const n = RECETAS.filter(r => cumple(r, { ...sState, q: "", trazas: false })).length;
  $("s-count").textContent = n ? plural(n, "receta encaja", "recetas encajan") : "Ninguna encaja todavía";
  $("s-go").textContent = n ? (n === 1 ? "Enséñamela" : "Enséñamelas") : "Ver la lista igualmente";
}

/* ---------- Listado ---------- */
function fillListCats() {
  const sel = $("f-cat");
  const secs = state.seccion ? [state.seccion] : ["Comidas", "Postres"];
  if (state.categoria && !secs.some(s => CATEGORIAS[s].includes(state.categoria))) state.categoria = "";
  sel.innerHTML = `<option value="">Todas las categorías</option>` +
    secs.map(s => `<optgroup label="${s}">${CATEGORIAS[s].map(c => `<option>${c}</option>`).join("")}</optgroup>`).join("");
  sel.value = state.categoria;
}

function renderList() {
  const list = RECETAS.filter(r => cumple(r));
  $("r-grid").innerHTML = list.map(card).join("");
  $("r-empty").hidden = list.length > 0;
  $("r-grid").hidden = list.length === 0;
  $("r-count").textContent = plural(list.length, "receta", "recetas");

  const chips = [];
  if (state.q) chips.push(["q", "", `"${state.q}"`]);
  if (state.seccion) chips.push(["seccion", "", state.seccion]);
  if (state.categoria) chips.push(["categoria", "", state.categoria]);
  state.sin.forEach(a => chips.push(["sin", a, ALERGENOS.find(x => x.id === a).etiqueta]));
  state.dieta.forEach(d => chips.push(["dieta", d, DIETAS.find(x => x.id === d).etiqueta]));
  $("r-active").innerHTML = chips.map(([k, v, label]) =>
    `<button type="button" data-k="${k}" data-v="${v}" aria-label="Quitar ${esc(label)}">${esc(label)}${icon("i-x")}</button>`).join("") +
    (chips.length > 1 ? `<button type="button" class="clear" data-k="all">Quitar todo</button>` : "");
  $("f-n").textContent = chips.length ? `(${chips.length})` : "";

  if (!list.length) {
    const pistas = chips.map(([k, v, label]) => {
      const s = { ...state, sin: new Set(state.sin), dieta: new Set(state.dieta) };
      if (k === "sin") s.sin.delete(v); else if (k === "dieta") s.dieta.delete(v); else s[k] = "";
      return [label, RECETAS.filter(r => cumple(r, s)).length];
    }).filter(p => p[1] > 0).sort((a, b) => b[1] - a[1]);
    $("r-empty-hint").textContent = pistas.length
      ? `Si quitas "${pistas[0][0]}" aparecen ${plural(pistas[0][1], "receta", "recetas")}.`
      : "Quita algún filtro y vuelve a mirar.";
  }

  document.querySelectorAll("#f-seccion button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === state.seccion ? "true" : "false"));
  syncPressed($("f-alergeno"), state);
  syncPressed($("f-dieta"), state);
  $("f-trazas").checked = state.trazas;
  if ($("f-q").value !== state.q) $("f-q").value = state.q;
}

function renderSections() {
  const ej = RECETAS.some(r => r.ejemplo);
  $("sections").innerHTML = ["Comidas", "Postres"].map(sec => {
    const n = RECETAS.filter(r => r.seccion === sec).length;
    return `<div class="section-tile ${sec.toLowerCase()}">
      <h3>${sec}</h3>
      <p class="count">${plural(n, ej ? "receta de ejemplo" : "receta", ej ? "recetas de ejemplo" : "recetas")}</p>
      <div class="cats">${CATEGORIAS[sec].map(c => {
        const k = RECETAS.filter(r => r.categoria === c).length;
        return `<button type="button" class="cat" data-sec="${sec}" data-cat="${c}">${c} <span class="n">${k}</span></button>`;
      }).join("")}</div>
    </div>`;
  }).join("");
}

function aplicar(nuevo) {
  Object.assign(state, nuevo);
  fillListCats();
  renderList();
}
function irAlListado() {
  if (location.hash !== "#recetas") history.pushState(null, "", "#recetas");
  mostrar("inicio");
  $("recetas").scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth" });
  if (matchMedia("(max-width: 60rem)").matches) $("filters-wrap").open = false;
}

/* ---------- Ficha de receta ---------- */
function fecha(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

function renderReceta(r) {
  const alergenosDe = i => i.contiene.map(a => NOMBRE_ALERGENO[a] || a);
  const parecidas = RECETAS.filter(x => x.id !== r.id && x.categoria === r.categoria).concat(
    RECETAS.filter(x => x.id !== r.id && x.seccion === r.seccion && x.categoria !== r.categoria)).slice(0, 3);
  $("vista-receta").innerHTML = `
  <article class="ficha wrap">
    <a class="volver" href="#recetas">Volver a las recetas</a>
    <div class="ficha-top">
      ${foto(r, "ficha-foto")}
      <div class="ficha-head">
        <p class="where">${esc(r.seccion)}, ${esc(r.categoria.toLowerCase())}</p>
        <h1>${esc(r.nombre)}</h1>
        <dl class="datos">
          <div><dt>Preparación</dt><dd>${r.tiempo_preparacion_min} min</dd></div>
          ${r.tiempo_marinado_h ? `<div><dt>Marinado</dt><dd>${r.tiempo_marinado_h} h</dd></div>` : ""}
          <div><dt>Cocción</dt><dd>${r.tiempo_coccion_min} min</dd></div>
          <div><dt>Raciones</dt><dd>${r.raciones}</dd></div>
          <div><dt>Dificultad</dt><dd>${esc(r.dificultad)}</dd></div>
        </dl>
        <div class="badges">${badgesDe(r)}</div>
        ${avisoTrazas(r)}
        ${r.ejemplo ? `<p class="note-ex">${icon("i-aviso")}Receta de ejemplo</p>` : r.fecha_hecha ? `<p class="hecha">Hecha el ${fecha(r.fecha_hecha)}</p>` : ""}
      </div>
    </div>
    <div class="ficha-body">
      <section aria-labelledby="h-ingr">
        <h2 id="h-ingr">Ingredientes</h2>
        <ul class="ingredientes">
          ${r.ingredientes.map(i => `<li>
            <span class="cant">${esc(i.cantidad)}</span>
            <span class="nom">${esc(i.nombre)}${alergenosDe(i).length ? `<span class="al">contiene ${esc(listaY(alergenosDe(i)))}</span>` : ""}${i.trazas.length ? `<span class="al">trazas de ${esc(listaY(i.trazas.map(a => NOMBRE_ALERGENO[a] || a)))}</span>` : ""}</span>
          </li>`).join("")}
        </ul>
      </section>
      <section aria-labelledby="h-pasos">
        <h2 id="h-pasos">Paso a paso</h2>
        <ol class="pasos">${r.pasos.map(p => `<li>${esc(p)}</li>`).join("")}</ol>
        ${r.notas ? `<aside class="notas"><h3>Nota</h3><p>${esc(r.notas)}</p></aside>` : ""}
      </section>
    </div>
    ${parecidas.length ? `<section class="parecidas" aria-labelledby="h-par"><h2 id="h-par">Más ${esc(r.seccion.toLowerCase())}</h2><ul class="grid">${parecidas.map(card).join("")}</ul></section>` : ""}
  </article>`;
  document.title = `${r.nombre} | Mi Recetario`;
}

/* ---------- Router ---------- */
let pararJuego = null;
function mostrar(vista) {
  $("vista-inicio").hidden = vista !== "inicio";
  $("vista-receta").hidden = vista !== "receta";
  $("vista-juego").hidden = vista !== "juego";
  if (vista !== "juego" && pararJuego) { pararJuego(); pararJuego = null; }
  if (vista === "inicio") document.title = "Mi Recetario";
}

function route() {
  const h = location.hash.slice(1);
  if (h.startsWith("receta-")) {
    const r = RECETAS.find(x => x.id === h.slice(7));
    if (r) { renderReceta(r); mostrar("receta"); window.scrollTo(0, 0); return; }
  }
  if (h.startsWith("juego-") && JUEGOS[h.slice(6)]) {
    mostrar("juego");
    if (pararJuego) pararJuego();
    pararJuego = montarJuego(h.slice(6), $("vista-juego"), RECETAS);
    document.title = `${JUEGOS[h.slice(6)].nombre} | Mi Recetario`;
    window.scrollTo(0, 0);
    return;
  }
  mostrar("inicio");
  const target = h && document.getElementById(h);
  if (target) target.scrollIntoView();
  else window.scrollTo(0, 0);
}

/* ---------- Eventos ---------- */
function enlazar() {
  $("s-seccion").addEventListener("change", e => {
    sState.seccion = e.target.value; e.target.dataset.v = sState.seccion;
    sState.categoria = ""; fillSentenceCats(); updateSentenceCount();
  });
  $("s-cat").addEventListener("change", e => { sState.categoria = e.target.value; updateSentenceCount(); });
  $("s-tags").addEventListener("click", e => {
    const b = e.target.closest(".toggle"); if (!b) return;
    const set = b.dataset.group === "sin" ? sState.sin : sState.dieta;
    set.has(b.dataset.id) ? set.delete(b.dataset.id) : set.add(b.dataset.id);
    syncPressed($("s-tags"), sState); updateSentenceCount();
  });
  $("sentence").addEventListener("submit", e => {
    e.preventDefault();
    aplicar({ q: "", seccion: sState.seccion, categoria: sState.categoria, sin: new Set(sState.sin), dieta: new Set(sState.dieta), trazas: false });
    irAlListado();
  });
  $("sections").addEventListener("click", e => {
    const b = e.target.closest(".cat"); if (!b) return;
    aplicar({ q: "", seccion: b.dataset.sec, categoria: b.dataset.cat, sin: new Set(), dieta: new Set() });
    irAlListado();
  });
  document.querySelectorAll("[data-go]").forEach(a => a.addEventListener("click", e => {
    e.preventDefault();
    aplicar({ q: "", seccion: a.dataset.go, categoria: "", sin: new Set(), dieta: new Set() });
    irAlListado();
  }));
  $("f-q").addEventListener("input", e => { state.q = e.target.value.trim(); renderList(); });
  $("f-seccion").addEventListener("click", e => {
    const b = e.target.closest("button"); if (b) aplicar({ seccion: b.dataset.v });
  });
  $("f-cat").addEventListener("change", e => {
    const c = e.target.value;
    aplicar({ categoria: c, seccion: c ? Object.keys(CATEGORIAS).find(s => CATEGORIAS[s].includes(c)) : state.seccion });
  });
  ["f-alergeno", "f-dieta"].forEach(id => $(id).addEventListener("click", e => {
    const b = e.target.closest(".toggle"); if (!b) return;
    const set = b.dataset.group === "sin" ? state.sin : state.dieta;
    set.has(b.dataset.id) ? set.delete(b.dataset.id) : set.add(b.dataset.id);
    renderList();
  }));
  $("f-trazas").addEventListener("change", e => { state.trazas = e.target.checked; renderList(); });
  $("r-active").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    const { k, v } = b.dataset;
    if (k === "all") aplicar({ q: "", seccion: "", categoria: "", sin: new Set(), dieta: new Set() });
    else if (k === "sin") { state.sin.delete(v); renderList(); }
    else if (k === "dieta") { state.dieta.delete(v); renderList(); }
    else aplicar({ [k]: "" });
  });
  $("r-reset").addEventListener("click", () => aplicar({ q: "", seccion: "", categoria: "", sin: new Set(), dieta: new Set(), trazas: false }));
  window.addEventListener("hashchange", route);
}

/* ---------- Arranque ---------- */
async function iniciar() {
  try {
    const res = await fetch("data/recetas.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(res.status);
    RECETAS = await res.json();
  } catch (err) {
    $("r-count").textContent = "No se han podido cargar las recetas";
    $("r-empty").hidden = false;
    $("r-empty-hint").textContent = "Recarga la página. Si sigue igual, revisa que data/recetas.json esté publicado.";
    $("r-reset").hidden = true;
    return;
  }
  RECETAS.forEach(r => { r.tags = calcularEtiquetas(r); });
  const ej = RECETAS.some(r => r.ejemplo);
  $("aviso-ejemplo").hidden = !ej;
  $("pie-ejemplo").hidden = !ej;

  fillSentenceCats();
  $("s-tags").innerHTML = ALERGENOS.map(a => toggleHTML(a, "sin", "t-alergeno")).join("") + DIETAS.map(d => toggleHTML(d, "dieta", d.cls)).join("");
  syncPressed($("s-tags"), sState);
  updateSentenceCount();
  $("f-alergeno").innerHTML = ALERGENOS.map(a => toggleHTML(a, "sin", "t-alergeno")).join("");
  $("f-dieta").innerHTML = DIETAS.map(d => toggleHTML(d, "dieta", d.cls)).join("");
  renderSections();
  fillListCats();
  renderList();
  if (matchMedia("(max-width: 60rem)").matches) $("filters-wrap").open = false;
  enlazar();
  route();
}
iniciar();
