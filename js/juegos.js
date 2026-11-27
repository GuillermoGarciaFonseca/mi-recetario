import { ALERGENOS, DIETAS, NOMBRE_ALERGENO, motivo, etiquetaNombre } from "./reglas.js";

export const JUEGOS = {
  adivina: { nombre: "Adivina la receta", corto: "Ingredientes uno a uno. Acierta pronto.", como: "Van saliendo ingredientes. Cuantas menos pistas necesites, más puntos." },
  apto: { nombre: "¿Es apto?", corto: "Plato y dieta, sí o no, contra el reloj.", como: "Sale un plato y una dieta. Responde sí o no antes de que se acabe el tiempo." },
  memory: { nombre: "Memory", corto: "Cada plato con su categoría.", como: "Da la vuelta a dos cartas y empareja cada plato con su categoría." },
  cesta: { nombre: "La cesta de la compra", corto: "Recoge lo de la receta, esquiva alérgenos.", como: "Mueve la cesta y recoge solo los ingredientes de la receta. Los marcados en dorado llevan el alérgeno: si caen dentro, pierdes una vida." }
};

/* ---------- 3D (carga perezosa: si no hay WebGL, la web sigue funcionando) ---------- */
let modelosP = null;
const modelos = () => (modelosP ??= import("./modelos.js").catch(() => null));
export async function imagenIngredientes(nombres, ancho = 320, alto = 320, tipo) {
  const m = await modelos();
  if (!m) return null;
  try { return m.renderizar(nombres, { ancho, alto, tipo }); } catch { return null; }
}

/* ---------- Utilidades ---------- */
const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const icon = id => `<svg aria-hidden="true"><use href="#${id}"/></svg>`;
const barajar = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const azar = arr => arr[Math.floor(Math.random() * arr.length)];

function leerRecord(id) { try { return Number(localStorage.getItem("recetario-record-" + id)) || 0; } catch { return 0; } }
function guardarRecord(id, pts) {
  if (pts > leerRecord(id)) { try { localStorage.setItem("recetario-record-" + id, String(pts)); } catch { /* sin almacenamiento */ } return true; }
  return false;
}

// Imagen de un plato: su foto, o un bodegón 3D de sus ingredientes.
async function imagenPlato(r, ancho = 640, alto = 480) {
  if (r.foto) return { url: `fotos/${r.foto}`, render: false };
  return { url: await imagenIngredientes(r.ingredientes.slice(0, 3).map(i => i.nombre), ancho, alto), render: true };
}

function marco(el, id) {
  const j = JUEGOS[id];
  el.innerHTML = `
  <div class="juego wrap">
    <a class="volver tactil" href="#juegos">Volver a los juegos</a>
    <header class="juego-head">
      <div>
        <h1>${j.nombre}</h1>
        <p>${j.como}</p>
      </div>
      <dl class="marcador">
        <div><dt>Puntos</dt><dd data-puntos>0</dd></div>
        <div><dt>Tu récord</dt><dd data-record>${leerRecord(id)}</dd></div>
      </dl>
    </header>
    <div class="juego-zona" data-zona></div>
  </div>`;
  return { zona: el.querySelector("[data-zona]"), puntos: n => { el.querySelector("[data-puntos]").textContent = n; } };
}

function finPartida(zona, id, pts, texto, reiniciar) {
  const nuevo = guardarRecord(id, pts);
  zona.innerHTML = `
  <div class="fin">
    <p class="fin-pts">${pts} puntos</p>
    <p>${nuevo && pts > 0 ? "Nuevo récord en este dispositivo." : esc(texto)}</p>
    <div class="fin-acc">
      <button type="button" class="btn btn-primary" data-otra>Jugar otra vez</button>
      <a class="btn" href="#juegos">Elegir otro juego</a>
    </div>
  </div>`;
  zona.querySelector("[data-otra]").addEventListener("click", reiniciar);
  zona.querySelector("[data-otra]").focus();
  zona.closest(".juego").querySelector("[data-record]").textContent = leerRecord(id);
}

function pocasRecetas(zona, n) {
  zona.innerHTML = `<div class="fin"><p>Este juego necesita al menos ${n} recetas. Añade alguna más y vuelve.</p><a class="btn" href="#recetas">Ver las recetas</a></div>`;
}

export function montarJuego(id, el, recetas) {
  return { adivina, apto, memory, cesta }[id](el, recetas);
}

/* ---------- 1. Adivina la receta ---------- */
function adivina(el, recetas) {
  const { zona, puntos } = marco(el, "adivina");
  if (recetas.length < 2) { pocasRecetas(zona, 2); return () => {}; }
  const RONDAS = Math.min(5, recetas.length);
  let ronda, total, orden, vivo = true;

  function empezar() { ronda = 0; total = 0; puntos(0); orden = barajar(recetas).slice(0, RONDAS); siguiente(); }

  function siguiente() {
    if (ronda >= RONDAS) return finPartida(zona, "adivina", total, "Prueba otra vez: las recetas salen en otro orden.", empezar);
    const secreta = orden[ronda];
    const pistas = barajar(secreta.ingredientes);
    const opciones = barajar([secreta, ...barajar(recetas.filter(r => r.id !== secreta.id)).slice(0, 3)]);
    let vistas = 1, resuelta = false;

    zona.innerHTML = `
      <p class="ronda">Ronda ${ronda + 1} de ${RONDAS}</p>
      <div class="adivina">
        <div>
          <h2>Pistas</h2>
          <ol class="pistas" data-pistas></ol>
          <button type="button" class="btn" data-mas>Otra pista</button>
        </div>
        <div>
          <h2>¿Qué receta es?</h2>
          <div class="opciones" data-ops>
            ${opciones.map(o => `<button type="button" class="opcion" data-id="${esc(o.id)}">${esc(o.nombre)}</button>`).join("")}
          </div>
          <p class="feedback" data-fb aria-live="polite"></p>
        </div>
      </div>`;
    const $p = zona.querySelector("[data-pistas]"), $mas = zona.querySelector("[data-mas]"), $fb = zona.querySelector("[data-fb]");
    const pintar = () => {
      while ($p.children.length < vistas) {
        const ing = pistas[$p.children.length];
        const li = document.createElement("li");
        li.innerHTML = `<img alt=""><span>${esc(ing.nombre)}</span>`;
        $p.append(li);
        imagenIngredientes([ing.nombre], 248, 248, ing.tipo).then(url => { if (url && vivo) li.querySelector("img").src = url; else li.querySelector("img").remove(); });
      }
      $mas.disabled = vistas >= pistas.length || resuelta;
      $mas.textContent = vistas >= pistas.length ? "No hay más pistas" : `Otra pista (quedan ${pistas.length - vistas})`;
    };
    pintar();
    $mas.addEventListener("click", () => { vistas++; pintar(); });
    zona.querySelector("[data-ops]").addEventListener("click", e => {
      const b = e.target.closest(".opcion"); if (!b || resuelta) return;
      resuelta = true;
      const ok = b.dataset.id === secreta.id;
      const pts = ok ? Math.max(1, pistas.length - vistas + 1) * 10 : 0;
      total += pts; puntos(total);
      zona.querySelectorAll(".opcion").forEach(o => {
        o.disabled = true;
        if (o.dataset.id === secreta.id) o.classList.add("bien"); else if (o === b) o.classList.add("mal");
      });
      vistas = pistas.length; pintar();
      $fb.className = "feedback " + (ok ? "bien" : "mal");
      $fb.innerHTML = (ok ? `Correcto, ${pts} puntos.` : `Era ${esc(secreta.nombre)}.`) +
        ` <button type="button" class="btn btn-primary" data-sig>${ronda + 1 < RONDAS ? "Siguiente" : "Ver resultado"}</button>`;
      const sig = zona.querySelector("[data-sig]");
      sig.addEventListener("click", () => { ronda++; siguiente(); });
      sig.focus();
    });
  }
  empezar();
  return () => { vivo = false; };
}

/* ---------- 2. ¿Es apto? ---------- */
function apto(el, recetas) {
  const { zona, puntos } = marco(el, "apto");
  if (!recetas.length) { pocasRecetas(zona, 1); return () => {}; }
  const DURACION = 45;
  const ETIQUETAS = [...ALERGENOS.map(a => a.id), ...DIETAS.map(d => d.id)];
  let timer = null, keyHandler = null;

  function portada() {
    zona.innerHTML = `<div class="fin"><p>Tienes ${DURACION} segundos. También puedes responder con las teclas S y N.</p>
      <button type="button" class="btn btn-primary" data-empezar>Empezar</button></div>`;
    zona.querySelector("[data-empezar]").addEventListener("click", empezar);
  }

  function empezar() {
    let pts = 0, quedan = DURACION, racha = 0, actual;
    puntos(0);
    zona.innerHTML = `
      <div class="apto">
        <div class="photo" data-img></div>
        <div class="apto-lado">
          <p class="reloj" data-reloj role="timer" aria-label="Segundos restantes">${DURACION}</p>
          <div class="pregunta" data-preg aria-live="polite"></div>
          <div class="si-no">
            <button type="button" class="btn" data-r="si">Sí</button>
            <button type="button" class="btn" data-r="no">No</button>
          </div>
          <p class="feedback" data-fb aria-live="polite"></p>
        </div>
      </div>`;
    const $preg = zona.querySelector("[data-preg]"), $fb = zona.querySelector("[data-fb]"), $reloj = zona.querySelector("[data-reloj]"), $img = zona.querySelector("[data-img]");

    const nueva = () => {
      const r = azar(recetas), et = azar(ETIQUETAS);
      actual = { r, et, apta: r.tags.sin.has(et) || r.tags.dieta.has(et) };
      $preg.innerHTML = `<span class="plato">${esc(r.nombre)}</span><span class="es">¿Es ${esc(etiquetaNombre(et).toLowerCase())}?</span>`;
      imagenPlato(r).then(({ url, render }) => {
        if (actual?.r !== r) return;
        $img.className = "photo" + (render ? " render" : "");
        $img.innerHTML = url ? `<img src="${url}" alt="${esc(r.nombre)}">` : "";
      });
    };
    const responder = si => {
      if (!actual) return;
      const ok = si === actual.apta;
      if (ok) { racha++; pts += 10 + Math.min(racha - 1, 5) * 2; $fb.textContent = racha > 1 ? `Bien. Racha de ${racha}.` : "Bien."; $fb.className = "feedback bien"; }
      else {
        racha = 0;
        const m = actual.apta ? "sí lo es" : (motivo(actual.r, actual.et) || "no lo es");
        $fb.textContent = `No: ${actual.r.nombre}, ${m}.`; $fb.className = "feedback mal";
      }
      puntos(pts);
      nueva();
    };
    zona.querySelector(".si-no").addEventListener("click", e => { const b = e.target.closest("[data-r]"); if (b) responder(b.dataset.r === "si"); });
    keyHandler = e => { if (e.key === "s" || e.key === "S") responder(true); if (e.key === "n" || e.key === "N") responder(false); };
    document.addEventListener("keydown", keyHandler);
    nueva();
    timer = setInterval(() => {
      quedan--; $reloj.textContent = quedan;
      $reloj.classList.toggle("poco", quedan <= 10);
      if (quedan <= 0) { parar(); finPartida(zona, "apto", pts, "Cada acierto seguido suma un poco más.", empezar); }
    }, 1000);
  }
  function parar() {
    clearInterval(timer); timer = null;
    if (keyHandler) document.removeEventListener("keydown", keyHandler);
    keyHandler = null;
  }
  portada();
  return parar;
}

/* ---------- 3. Memory ---------- */
function memory(el, recetas) {
  const { zona, puntos } = marco(el, "memory");
  let espera = null;

  function empezar() {
    const porCat = new Map();
    for (const r of barajar(recetas)) if (!porCat.has(r.categoria)) porCat.set(r.categoria, r);
    const elegidas = [...porCat.values()].slice(0, 6);
    if (elegidas.length < 3) return pocasRecetas(zona, 3);
    const cartas = barajar(elegidas.flatMap(r => [
      { par: r.id, texto: r.nombre, tipo: "plato", r },
      { par: r.id, texto: r.categoria, tipo: "categoria", r }
    ]));
    let abiertas = [], hechas = 0, movs = 0;
    puntos(0);
    zona.innerHTML = `<p class="ronda" data-movs aria-live="polite">0 movimientos</p>
      <div class="memory" style="--cols:${cartas.length > 8 ? 4 : 3}">
        ${cartas.map((c, i) => `<button type="button" class="carta-m" data-i="${i}" aria-label="Carta ${i + 1}, boca abajo">
          <span class="giro">
            <span class="dorso">R</span>
            ${c.tipo === "plato"
              ? `<span class="cara plato" data-cara="${i}"><img alt=""><span>${esc(c.texto)}</span></span>`
              : `<span class="cara categoria"><small>Categoría</small><span>${esc(c.texto)}</span></span>`}
          </span>
        </button>`).join("")}
      </div>`;
    // Imágenes de los platos (foto o bodegón 3D)
    cartas.forEach((c, i) => {
      if (c.tipo !== "plato") return;
      imagenPlato(c.r, 360, 300).then(({ url, render }) => {
        const cara = zona.querySelector(`[data-cara="${i}"]`); if (!cara) return;
        if (render) cara.classList.add("render");
        if (url) cara.querySelector("img").src = url; else cara.querySelector("img").remove();
      });
    });
    const $movs = zona.querySelector("[data-movs]");
    const botones = [...zona.querySelectorAll(".carta-m")];
    const etiquetar = (b, c) => b.setAttribute("aria-label", `${c.tipo === "plato" ? "Plato" : "Categoría"}: ${c.texto}`);

    zona.querySelector(".memory").addEventListener("click", e => {
      const b = e.target.closest(".carta-m");
      if (!b || espera || b.classList.contains("abierta")) return;
      const i = Number(b.dataset.i), c = cartas[i];
      b.classList.add("abierta"); etiquetar(b, c);
      abiertas.push(i);
      if (abiertas.length < 2) return;
      movs++; $movs.textContent = `${movs} ${movs === 1 ? "movimiento" : "movimientos"}`;
      const [a, d] = abiertas;
      if (cartas[a].par === cartas[d].par && a !== d) {
        botones[a].classList.add("hecha"); botones[d].classList.add("hecha");
        botones[a].disabled = botones[d].disabled = true;
        hechas++; abiertas = [];
        const pts = Math.max(10, hechas * 20 - (movs - hechas) * 4);
        puntos(pts);
        if (hechas === elegidas.length) setTimeout(() => finPartida(zona, "memory", pts, "Menos movimientos, más puntos.", empezar), 700);
      } else {
        espera = setTimeout(() => {
          for (const k of [a, d]) { botones[k].classList.remove("abierta"); botones[k].setAttribute("aria-label", `Carta ${k + 1}, boca abajo`); }
          abiertas = []; espera = null;
        }, 1000);
      }
    });
  }
  empezar();
  return () => { clearTimeout(espera); };
}

/* ---------- 4. La cesta de la compra (escena 3D) ---------- */
function cesta(el, recetas) {
  const { zona, puntos } = marco(el, "cesta");
  let limpiar = () => {};

  function preparar() {
    for (const receta of barajar(recetas.filter(r => r.ingredientes.length >= 3))) {
      const enReceta = new Set(receta.ingredientes.map(i => i.nombre));
      const ajenos = [...new Map(recetas.filter(r => r.id !== receta.id).flatMap(r => r.ingredientes).filter(i => !enReceta.has(i.nombre)).map(i => [i.nombre, i])).values()];
      const posibles = [...new Set(ajenos.flatMap(i => i.contiene))].filter(a => !receta.ingredientes.some(i => i.contiene.includes(a)));
      if (ajenos.length >= 3 && posibles.length) return { receta, evitar: azar(posibles), ajenos };
    }
    return null;
  }

  function portada() {
    limpiar();
    const p = preparar();
    if (!p) return pocasRecetas(zona, 3);
    zona.innerHTML = `<div class="fin">
      <p class="fin-pts">${esc(p.receta.nombre)}</p>
      <p>Recoge sus ${p.receta.ingredientes.length} ingredientes. Los que llevan ${esc(NOMBRE_ALERGENO[p.evitar])} caen con un aro dorado: si entran en la cesta, pierdes una vida.</p>
      <p class="ayuda">Mueve la cesta con el dedo, el ratón o las flechas del teclado.</p>
      <button type="button" class="btn btn-primary" data-empezar>Empezar</button></div>`;
    zona.querySelector("[data-empezar]").addEventListener("click", () => jugar(p));
  }

  async function jugar({ receta, evitar, ajenos }) {
    zona.innerHTML = `<div class="fin"><p>Preparando la cocina...</p></div>`;
    const mod = await modelos();
    if (!mod) { zona.innerHTML = `<div class="fin"><p>Este navegador no puede mostrar 3D. Prueba con otro o actualízalo.</p></div>`; return; }
    const { THREE, crearModelo, escenaBase } = mod;

    zona.innerHTML = `
      <div class="cesta-juego">
        <div class="cesta-lienzo"><canvas data-c aria-label="Zona de juego: caen ingredientes y la cesta los recoge"></canvas></div>
        <aside class="lista-compra">
          <h2>${esc(receta.nombre)}</h2>
          <p class="vidas" data-vidas aria-live="polite"></p>
          <ul data-lista>${receta.ingredientes.map(i => `<li data-n="${esc(i.nombre)}"><img alt=""><span>${esc(i.nombre)}</span></li>`).join("")}</ul>
          <p class="evita">${icon("i-aviso")}Evita: ${esc(NOMBRE_ALERGENO[evitar])}</p>
        </aside>
      </div>`;
    receta.ingredientes.forEach(i => imagenIngredientes([i.nombre], 80, 80, i.tipo).then(url => {
      const img = zona.querySelector(`[data-n="${CSS.escape(i.nombre)}"] img`); if (img && url) img.src = url;
    }));

    const canvas = zona.querySelector("[data-c]");
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); }
    catch { zona.innerHTML = `<div class="fin"><p>Este navegador no puede mostrar 3D.</p></div>`; return; }
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    const scene = escenaBase(renderer);
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 1.2, 16); camera.lookAt(0, 0, 0);

    let W = 10, H = 10;
    const medir = () => {
      const w = canvas.parentElement.clientWidth, h = Math.min(560, Math.max(400, window.innerHeight * 0.62));
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
      H = 2 * Math.tan((camera.fov * Math.PI / 180) / 2) * 16; W = H * camera.aspect;
    };
    medir();

    // Cesta de mimbre
    const perfil = [[0.001, 0], [1.1, 0], [1.5, 0.2], [1.75, 0.9], [1.85, 1.05], [1.7, 1.05], [1.6, 0.9], [1.35, 0.25], [0.001, 0.15]].map(([x, y]) => new THREE.Vector2(x, y));
    const geoCesta = new THREE.LatheGeometry(perfil, 64);
    const pos = geoCesta.attributes.position, col = new Float32Array(pos.count * 3), v = new THREE.Vector3(), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); const a = Math.atan2(v.z, v.x); const t = 0.5 + 0.5 * Math.sin(a * 36) * Math.sin(v.y * 22); c.setRGB(0.55 + t * 0.12, 0.38 + t * 0.08, 0.2 + t * 0.04).convertSRGBToLinear(); col.set([c.r, c.g, c.b], i * 3); }
    geoCesta.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const cestaM = new THREE.Mesh(geoCesta, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }));
    const asa = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.08, 12, 48, Math.PI), new THREE.MeshPhysicalMaterial({ color: 0x7a5530, roughness: 0.8 }));
    asa.position.y = 1.0;
    const cestaG = new THREE.Group(); cestaG.add(cestaM, asa); cestaG.rotation.x = 0.35; cestaG.scale.setScalar(0.9);
    scene.add(cestaG);

    // Etiquetas con el nombre
    const etiqueta = (texto, dorado) => {
      const cv = document.createElement("canvas"), ctx = cv.getContext("2d");
      const fs = 44; ctx.font = `600 ${fs}px Manrope, system-ui, sans-serif`;
      const w = Math.ceil(ctx.measureText(texto).width) + 48; cv.width = w; cv.height = 76;
      ctx.font = `600 ${fs}px Manrope, system-ui, sans-serif`;
      ctx.fillStyle = dorado ? "rgba(226,194,122,0.95)" : "rgba(7,13,25,0.78)";
      ctx.beginPath(); ctx.roundRect(0, 0, w, 76, 38); ctx.fill();
      ctx.fillStyle = dorado ? "#0A1426" : "#F2F4F8"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(texto, w / 2, 40);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
      s.scale.set(w / 76 * 0.38, 0.38, 1); s.renderOrder = 2;
      return s;
    };
    const prototipos = new Map();
    const proto = ing => { if (!prototipos.has(ing.nombre)) prototipos.set(ing.nombre, crearModelo(ing.nombre, ing.tipo)); return prototipos.get(ing.nombre); };

    const faltan = new Set(receta.ingredientes.map(i => i.nombre));
    const items = [];
    let x = 0, objetivoX = 0, vidas = 3, pts = 0, t0 = performance.now(), ultimo = t0, proximo = 0, raf = 0, flash = 0;
    const $vidas = zona.querySelector("[data-vidas]");
    const pintarVidas = () => { $vidas.textContent = `Vidas: ${vidas} de 3`; };
    pintarVidas(); puntos(0);

    const teclas = new Set();
    const kd = e => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { teclas.add(e.key); e.preventDefault(); } };
    const ku = e => teclas.delete(e.key);
    const mover = e => { const r = canvas.getBoundingClientRect(); objetivoX = ((e.clientX - r.left) / r.width - 0.5) * W; };
    canvas.addEventListener("pointermove", mover);
    canvas.addEventListener("pointerdown", e => { mover(e); canvas.setPointerCapture?.(e.pointerId); });
    document.addEventListener("keydown", kd); document.addEventListener("keyup", ku);
    window.addEventListener("resize", medir);
    limpiar = () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", kd); document.removeEventListener("keyup", ku);
      window.removeEventListener("resize", medir);
      scene.traverse(o => { o.geometry?.dispose?.(); if (o.material) { o.material.map?.dispose?.(); o.material.dispose?.(); } });
      renderer.dispose();
      limpiar = () => {};
    };

    const nuevoItem = () => {
      const pendientes = receta.ingredientes.filter(i => faltan.has(i.nombre));
      const roll = Math.random();
      let ing;
      if (pendientes.length && roll < 0.45) ing = azar(pendientes);
      else { const conAl = ajenos.filter(i => i.contiene.includes(evitar)); ing = conAl.length && roll < 0.72 ? azar(conAl) : azar(ajenos); }
      const tipo = faltan.has(ing.nombre) && receta.ingredientes.some(i => i.nombre === ing.nombre) ? "bueno" : ing.contiene.includes(evitar) ? "alergeno" : "otro";
      const g = new THREE.Group();
      const m = proto(ing).clone(); m.scale.multiplyScalar(0.95); g.add(m);
      if (tipo === "alergeno") {
        const aro = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.05, 12, 48), new THREE.MeshPhysicalMaterial({ color: 0xe2c27a, metalness: 0.8, roughness: 0.25, emissive: 0x3a2a08 }));
        aro.rotation.x = Math.PI / 2.4; g.add(aro);
      }
      const et = etiqueta(ing.nombre, tipo === "alergeno"); et.position.y = -1.25; g.add(et);
      const seg = (performance.now() - t0) / 1000;
      g.position.set((Math.random() - 0.5) * (W - 2.4), H / 2 + 1.2, 0);
      scene.add(g);
      items.push({ g, m, tipo, nombre: ing.nombre, v: 2.6 + Math.random() * 1.0 + seg * 0.045, rx: (Math.random() - 0.5) * 2, ry: (Math.random() - 0.5) * 2.5 });
    };
    const quitar = it => { scene.remove(it.g); it.g.traverse(o => { if (o.isSprite) { o.material.map.dispose(); o.material.dispose(); } }); };

    const terminar = gano => {
      const bonus = gano ? Math.max(0, 60 - Math.round((performance.now() - t0) / 1000)) * 2 : 0;
      pts += bonus; puntos(pts);
      limpiar();
      finPartida(zona, "cesta", pts, gano ? `Cesta completa. ${bonus} puntos extra por rapidez.` : "Se acabaron las vidas. Fíjate en los aros dorados.", portada);
    };

    const paso = ahora => {
      const dt = Math.min(0.05, (ahora - ultimo) / 1000); ultimo = ahora;
      if (teclas.has("ArrowLeft")) objetivoX -= W * 0.9 * dt;
      if (teclas.has("ArrowRight")) objetivoX += W * 0.9 * dt;
      const lim = W / 2 - 1.7;
      objetivoX = Math.max(-lim, Math.min(lim, objetivoX));
      x += (objetivoX - x) * Math.min(1, dt * 12);
      const yC = -H / 2 + 1.1;
      cestaG.position.set(x, yC, 0);
      cestaG.rotation.z = (objetivoX - x) * -0.04;
      if (ahora - flash < 220) cestaM.material.emissive.setHex(flash > 0 && cestaM.userData.ok ? 0x1d4a2c : 0x4a1d1d); else cestaM.material.emissive.setHex(0x000000);

      if (ahora >= proximo) { nuevoItem(); proximo = ahora + Math.max(560, 1100 - (ahora - t0) / 55); }
      for (let k = items.length - 1; k >= 0; k--) {
        const it = items[k];
        it.g.position.y -= it.v * dt;
        it.m.rotation.x += it.rx * dt; it.m.rotation.y += it.ry * dt;
        const dy = it.g.position.y - (yC + 1.0), dx = Math.abs(it.g.position.x - x);
        if (dy < 0.4 && dy > -0.6 && dx < 1.55) {
          items.splice(k, 1); quitar(it);
          if (it.tipo === "bueno" && faltan.has(it.nombre)) {
            faltan.delete(it.nombre); pts += 10; cestaM.userData.ok = true;
            zona.querySelector(`[data-lista] li[data-n="${CSS.escape(it.nombre)}"]`)?.classList.add("hecho");
          } else if (it.tipo === "alergeno") { vidas--; pintarVidas(); cestaM.userData.ok = false; }
          else { pts = Math.max(0, pts - 5); cestaM.userData.ok = false; }
          flash = ahora; puntos(pts);
          if (!faltan.size) return terminar(true);
          if (vidas <= 0) return terminar(false);
        } else if (it.g.position.y < -H / 2 - 1.5) { items.splice(k, 1); quitar(it); }
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
  }

  portada();
  return () => limpiar();
}
