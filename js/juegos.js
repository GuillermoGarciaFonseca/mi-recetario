import { ALERGENOS, DIETAS, NOMBRE_ALERGENO, motivo, etiquetaNombre } from "./reglas.js";

export const JUEGOS = {
  adivina: { nombre: "Adivina la receta", como: "Van saliendo ingredientes. Cuantas menos pistas necesites, más puntos." },
  apto: { nombre: "¿Es apto?", como: "Sale un plato y una dieta. Responde sí o no antes de que se acabe el tiempo." },
  memory: { nombre: "Memory de recetas", como: "Da la vuelta a dos cartas y empareja cada plato con su categoría." },
  cesta: { nombre: "La cesta de la compra", como: "Mueve la cesta y recoge solo los ingredientes de la receta. Esquiva los que llevan el alérgeno." }
};

/* ---------- Utilidades ---------- */
const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const icon = id => `<svg aria-hidden="true"><use href="#${id}"/></svg>`;
const barajar = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const azar = arr => arr[Math.floor(Math.random() * arr.length)];

function leerRecord(id) { try { return Number(localStorage.getItem("recetario-record-" + id)) || 0; } catch { return 0; } }
function guardarRecord(id, pts) {
  const antes = leerRecord(id);
  if (pts > antes) { try { localStorage.setItem("recetario-record-" + id, String(pts)); } catch { /* sin almacenamiento */ } return true; }
  return false;
}

function marco(el, id, extraClase = "") {
  const j = JUEGOS[id];
  el.innerHTML = `
  <div class="juego wrap ${extraClase}">
    <a class="volver" href="#minijuegos">Volver a los juegos</a>
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
  return {
    zona: el.querySelector("[data-zona]"),
    puntos: n => { el.querySelector("[data-puntos]").textContent = n; }
  };
}

function finPartida(zona, id, pts, texto, reiniciar) {
  const nuevo = guardarRecord(id, pts);
  zona.innerHTML = `
  <div class="fin">
    <p class="fin-pts">${pts} puntos</p>
    <p>${nuevo && pts > 0 ? "Nuevo récord en este dispositivo." : esc(texto)}</p>
    <div class="fin-acc">
      <button type="button" class="btn btn-primary" data-otra>Jugar otra vez</button>
      <a class="btn btn-ghost" href="#minijuegos">Elegir otro juego</a>
    </div>
  </div>`;
  zona.querySelector("[data-otra]").addEventListener("click", reiniciar);
  zona.querySelector("[data-otra]").focus();
  const rec = zona.closest(".juego").querySelector("[data-record]");
  rec.textContent = leerRecord(id);
}

function pocasRecetas(zona, n) {
  zona.innerHTML = `<div class="fin"><p>Este juego necesita al menos ${n} recetas. Añade alguna más y vuelve.</p><a class="btn btn-ghost" href="#recetas">Ver las recetas</a></div>`;
}

export function montarJuego(id, el, recetas) {
  return { adivina, apto, memory, cesta }[id](el, recetas);
}

/* ---------- 1. Adivina la receta ---------- */
function adivina(el, recetas) {
  const { zona, puntos } = marco(el, "adivina");
  if (recetas.length < 2) { pocasRecetas(zona, 2); return () => {}; }
  const RONDAS = Math.min(5, recetas.length);
  let ronda, total, orden;

  function empezar() {
    ronda = 0; total = 0; puntos(0);
    orden = barajar(recetas).slice(0, RONDAS);
    siguiente();
  }

  function siguiente() {
    if (ronda >= RONDAS) return finPartida(zona, "adivina", total, "Prueba otra vez: las recetas salen en otro orden.", empezar);
    const secreta = orden[ronda];
    const pistas = barajar(secreta.ingredientes);
    const opciones = barajar([secreta, ...barajar(recetas.filter(r => r.id !== secreta.id)).slice(0, 3)]);
    let vistas = 1, resuelta = false;

    zona.innerHTML = `
      <p class="ronda">Ronda ${ronda + 1} de ${RONDAS}</p>
      <div class="adivina">
        <div class="pistas-col">
          <h2>Pistas</h2>
          <ol class="pistas" data-pistas></ol>
          <button type="button" class="btn btn-ghost" data-mas>Otra pista</button>
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
      $p.innerHTML = pistas.slice(0, vistas).map(i => `<li>${esc(i.nombre)}</li>`).join("");
      $mas.disabled = vistas >= pistas.length || resuelta;
      $mas.textContent = vistas >= pistas.length ? "No hay más pistas" : `Otra pista (${pistas.length - vistas} más)`;
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
        if (o.dataset.id === secreta.id) o.classList.add("bien");
        else if (o === b) o.classList.add("mal");
      });
      vistas = pistas.length; pintar();
      $fb.innerHTML = (ok ? `Correcto, ${pts} puntos.` : `Era ${esc(secreta.nombre)}.`) +
        ` <button type="button" class="btn btn-primary" data-sig>${ronda + 1 < RONDAS ? "Siguiente" : "Ver resultado"}</button>`;
      const sig = zona.querySelector("[data-sig]");
      sig.addEventListener("click", () => { ronda++; siguiente(); });
      sig.focus();
    });
  }
  empezar();
  return () => {};
}

/* ---------- 2. ¿Es apto? ---------- */
function apto(el, recetas) {
  const { zona, puntos } = marco(el, "apto");
  if (!recetas.length) { pocasRecetas(zona, 1); return () => {}; }
  const DURACION = 45;
  const ETIQUETAS = [...ALERGENOS.map(a => a.id), ...DIETAS.map(d => d.id)];
  let timer = null, keyHandler = null;

  function portada() {
    zona.innerHTML = `<div class="fin"><p>Tienes ${DURACION} segundos. Puedes responder con las teclas S y N.</p>
      <button type="button" class="btn btn-primary" data-empezar>Empezar</button></div>`;
    zona.querySelector("[data-empezar]").addEventListener("click", empezar);
  }

  function empezar() {
    let pts = 0, quedan = DURACION, racha = 0, actual;
    puntos(0);
    zona.innerHTML = `
      <div class="apto">
        <div class="reloj" data-reloj role="timer" aria-label="Tiempo restante">${DURACION}</div>
        <div class="pregunta" data-preg aria-live="polite"></div>
        <div class="si-no">
          <button type="button" class="btn btn-si" data-r="si">Sí</button>
          <button type="button" class="btn btn-no" data-r="no">No</button>
        </div>
        <p class="feedback" data-fb aria-live="polite"></p>
      </div>`;
    const $preg = zona.querySelector("[data-preg]"), $fb = zona.querySelector("[data-fb]"), $reloj = zona.querySelector("[data-reloj]");

    const nueva = () => {
      const r = azar(recetas), et = azar(ETIQUETAS);
      const apta = r.tags.sin.has(et) || r.tags.dieta.has(et);
      actual = { r, et, apta };
      $preg.innerHTML = `<span class="plato">${esc(r.nombre)}</span><span class="es">¿Es <b>${esc(etiquetaNombre(et).toLowerCase())}</b>?</span>`;
    };
    const responder = si => {
      if (!actual) return;
      const ok = si === actual.apta;
      if (ok) { racha++; pts += 10 + Math.min(racha - 1, 5) * 2; $fb.textContent = racha > 1 ? `Bien, racha de ${racha}.` : "Bien."; $fb.className = "feedback bien"; }
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
      if (quedan <= 0) {
        parar();
        finPartida(zona, "apto", pts, "Cada acierto seguido suma un poco más.", empezar);
      }
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
      { par: r.id, texto: r.nombre, tipo: "plato", sec: r.seccion },
      { par: r.id, texto: r.categoria, tipo: "categoria", sec: r.seccion }
    ]));
    let abiertas = [], hechas = 0, movs = 0;
    puntos(0);
    zona.innerHTML = `<p class="ronda" data-movs aria-live="polite">0 movimientos</p>
      <div class="memory" style="--cols:${cartas.length > 8 ? 4 : 3}">
        ${cartas.map((c, i) => `<button type="button" class="carta" data-i="${i}" aria-label="Carta ${i + 1}, boca abajo">
          <span class="dorso">${icon("i-olla")}</span>
          <span class="cara ${c.tipo} ${c.sec.toLowerCase()}"><small>${c.tipo === "plato" ? "Plato" : "Categoría"}</small>${esc(c.texto)}</span>
        </button>`).join("")}
      </div>`;
    const $movs = zona.querySelector("[data-movs]");
    const botones = [...zona.querySelectorAll(".carta")];
    const etiquetar = (b, c) => b.setAttribute("aria-label", `${c.tipo === "plato" ? "Plato" : "Categoría"}: ${c.texto}`);

    zona.querySelector(".memory").addEventListener("click", e => {
      const b = e.target.closest(".carta");
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
        if (hechas === elegidas.length) setTimeout(() => finPartida(zona, "memory", pts, "Menos movimientos, más puntos.", empezar), 600);
      } else {
        espera = setTimeout(() => {
          for (const k of [a, d]) { botones[k].classList.remove("abierta"); botones[k].setAttribute("aria-label", `Carta ${k + 1}, boca abajo`); }
          abiertas = []; espera = null;
        }, 900);
      }
    });
  }
  empezar();
  return () => { clearTimeout(espera); };
}

/* ---------- 4. La cesta de la compra ---------- */
function cesta(el, recetas) {
  const { zona, puntos } = marco(el, "cesta", "juego-cesta");
  let raf = 0, limpiar = () => {};

  function preparar() {
    // Receta pedida y un alérgeno que ella no lleva pero otras sí.
    const candidatas = barajar(recetas.filter(r => r.ingredientes.length >= 3));
    for (const receta of candidatas) {
      const enReceta = new Set(receta.ingredientes.map(i => i.nombre));
      const ajenos = recetas.filter(r => r.id !== receta.id).flatMap(r => r.ingredientes).filter(i => !enReceta.has(i.nombre));
      const posibles = [...new Set(ajenos.flatMap(i => i.contiene))].filter(a => receta.tags.sin.has(a) || !receta.ingredientes.some(i => i.contiene.includes(a)));
      if (ajenos.length >= 3 && posibles.length) {
        const evitar = azar(posibles);
        const unicos = [...new Map(ajenos.map(i => [i.nombre, i])).values()];
        return { receta, evitar, ajenos: unicos };
      }
    }
    return null;
  }

  function portada() {
    const p = preparar();
    if (!p) return pocasRecetas(zona, 3);
    zona.innerHTML = `<div class="fin">
      <p class="fin-pts">${esc(p.receta.nombre)}</p>
      <p>Recoge sus ${p.receta.ingredientes.length} ingredientes. Los que llevan <b>${esc(NOMBRE_ALERGENO[p.evitar])}</b> salen en amarillo: si caen en la cesta, pierdes una vida.</p>
      <p class="ayuda">Mueve la cesta con el dedo, el ratón o las flechas.</p>
      <button type="button" class="btn btn-primary" data-empezar>Empezar</button></div>`;
    zona.querySelector("[data-empezar]").addEventListener("click", () => jugar(p));
  }

  function jugar({ receta, evitar, ajenos }) {
    zona.innerHTML = `
      <div class="cesta-juego">
        <div class="cesta-lienzo"><canvas data-c aria-label="Zona de juego: cae comida y la cesta la recoge"></canvas></div>
        <aside class="lista-compra">
          <h2>${esc(receta.nombre)}</h2>
          <p class="vidas" data-vidas aria-live="polite"></p>
          <ul data-lista>${receta.ingredientes.map(i => `<li data-n="${esc(i.nombre)}">${icon("i-check")}${esc(i.nombre)}</li>`).join("")}</ul>
          <p class="evita">${icon("i-aviso")}Evita: ${esc(NOMBRE_ALERGENO[evitar])}</p>
        </aside>
      </div>`;
    const canvas = zona.querySelector("[data-c]"), ctx = canvas.getContext("2d");
    const css = getComputedStyle(document.documentElement);
    const C = k => css.getPropertyValue(k).trim();
    const COL = { fondo: C("--color-paper-2"), tinta: C("--color-ink"), blanco: C("--color-white"), mango: C("--color-mango"), tomate: C("--color-tomate"), lima: C("--color-lima"), font: C("--font-body") };
    let W = 0, H = 0, dpr = 1;
    const medir = () => {
      const box = canvas.parentElement.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = box.width; H = Math.min(520, Math.max(380, window.innerHeight * 0.6));
      canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    medir();

    const faltan = new Set(receta.ingredientes.map(i => i.nombre));
    const items = [];
    let x = W / 2, objetivoX = W / 2, vidas = 3, pts = 0, t0 = performance.now(), ultimo = t0, proximo = 0, flash = null;
    const CW = Math.min(140, W * 0.32), CH = 34;
    const $vidas = zona.querySelector("[data-vidas]");
    const pintarVidas = () => { $vidas.textContent = `Vidas: ${vidas} de 3`; };
    pintarVidas(); puntos(0);

    const teclas = new Set();
    const kd = e => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { teclas.add(e.key); e.preventDefault(); } };
    const ku = e => teclas.delete(e.key);
    const mover = e => { const r = canvas.getBoundingClientRect(); objetivoX = e.clientX - r.left; };
    canvas.addEventListener("pointermove", mover);
    canvas.addEventListener("pointerdown", e => { mover(e); canvas.setPointerCapture?.(e.pointerId); });
    document.addEventListener("keydown", kd); document.addEventListener("keyup", ku);
    window.addEventListener("resize", medir);
    canvas.style.touchAction = "none";
    limpiar = () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", kd); document.removeEventListener("keyup", ku);
      window.removeEventListener("resize", medir);
    };

    const nuevoItem = () => {
      const pendientes = receta.ingredientes.filter(i => faltan.has(i.nombre));
      const roll = Math.random();
      let ing, tipo;
      if (pendientes.length && roll < 0.45) { ing = azar(pendientes); tipo = "bueno"; }
      else {
        const conAl = ajenos.filter(i => i.contiene.includes(evitar));
        if (conAl.length && roll < 0.72) { ing = azar(conAl); tipo = "alergeno"; }
        else { ing = azar(ajenos); tipo = ing.contiene.includes(evitar) ? "alergeno" : "otro"; }
      }
      ctx.font = `700 15px ${COL.font}`;
      const w = ctx.measureText(ing.nombre).width + 28;
      const seg = (performance.now() - t0) / 1000;
      items.push({ nombre: ing.nombre, tipo, w, x: w / 2 + Math.random() * Math.max(1, W - w), y: -20, v: 110 + Math.random() * 50 + seg * 2.2 });
    };

    const pill = (cx, cy, w, h, fill) => {
      const r = h / 2;
      ctx.beginPath();
      ctx.moveTo(cx - w / 2 + r, cy - h / 2); ctx.lineTo(cx + w / 2 - r, cy - h / 2);
      ctx.arc(cx + w / 2 - r, cy, r, -Math.PI / 2, Math.PI / 2); ctx.lineTo(cx - w / 2 + r, cy + h / 2);
      ctx.arc(cx - w / 2 + r, cy, r, Math.PI / 2, -Math.PI / 2); ctx.closePath();
      ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = COL.tinta; ctx.stroke();
    };

    const terminar = gano => {
      limpiar();
      const bonus = gano ? Math.max(0, 60 - Math.round((performance.now() - t0) / 1000)) * 2 : 0;
      pts += bonus; puntos(pts);
      finPartida(zona, "cesta", pts, gano ? `Cesta completa. ${bonus} puntos extra por rapidez.` : "Se acabaron las vidas. Fíjate en los amarillos.", portada);
    };

    const paso = ahora => {
      const dt = Math.min(0.05, (ahora - ultimo) / 1000); ultimo = ahora;
      if (teclas.has("ArrowLeft")) objetivoX -= 420 * dt;
      if (teclas.has("ArrowRight")) objetivoX += 420 * dt;
      objetivoX = Math.max(CW / 2, Math.min(W - CW / 2, objetivoX));
      x += (objetivoX - x) * Math.min(1, dt * 14);

      if (ahora >= proximo) { nuevoItem(); proximo = ahora + Math.max(520, 1000 - (ahora - t0) / 60); }
      const cy = H - CH / 2 - 10;
      for (let k = items.length - 1; k >= 0; k--) {
        const it = items[k];
        it.y += it.v * dt;
        const toca = it.y + 14 >= cy - CH / 2 && it.y - 14 <= cy + CH / 2 && Math.abs(it.x - x) < CW / 2 + it.w / 4;
        if (toca) {
          items.splice(k, 1);
          if (it.tipo === "bueno" && faltan.has(it.nombre)) {
            faltan.delete(it.nombre); pts += 10;
            zona.querySelector(`[data-lista] li[data-n="${CSS.escape(it.nombre)}"]`)?.classList.add("hecho");
            flash = { c: COL.lima, t: ahora };
          } else if (it.tipo === "alergeno") { vidas--; pintarVidas(); flash = { c: COL.tomate, t: ahora }; }
          else { pts = Math.max(0, pts - 5); flash = { c: COL.tomate, t: ahora }; }
          puntos(pts);
          if (!faltan.size) return terminar(true);
          if (vidas <= 0) return terminar(false);
        } else if (it.y > H + 30) items.splice(k, 1);
      }

      ctx.fillStyle = COL.fondo; ctx.fillRect(0, 0, W, H);
      ctx.font = `700 15px ${COL.font}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (const it of items) {
        pill(it.x, it.y, it.w, 30, it.tipo === "alergeno" ? COL.mango : COL.blanco);
        ctx.fillStyle = COL.tinta; ctx.fillText(it.nombre, it.x, it.y + 1);
      }
      const brillo = flash && ahora - flash.t < 250;
      pill(x, cy, CW, CH, brillo ? flash.c : COL.tomate);
      ctx.fillStyle = COL.tinta; ctx.font = `700 15px ${COL.font}`; ctx.fillText("cesta", x, cy + 1);
      raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
  }

  portada();
  return () => limpiar();
}
