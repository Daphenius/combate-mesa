// ═══════════════════════════════════════════════════════════════════════════
//  Combate da Mesa — anúncio de turno e início do combate
//  Uma faixa de estandarte atravessa a tela; a câmera vai até o token.
//  O som fica com o tema de som de combate nativo do Foundry
//  (Configurações do Rastreador de Combate), para não tocar dois sons.
// ═══════════════════════════════════════════════════════════════════════════

import { cfg, esc, imagemDe, loc, movimentoReduzido, tokenNoMapa } from "./core.js";

let fila = Promise.resolve();
let pendentes = 0;

function mostrarFaixa({ titulo, subtitulo, img, classe = "" }) {
  const el = document.createElement("div");
  el.className = `cmb-anuncio ${classe}`;
  el.innerHTML = `
    <div class="cmb-anuncio-faixa">
      ${img ? `<img class="cmb-anuncio-retrato" src="${esc(img)}" alt="">` : ""}
      <div class="cmb-anuncio-texto">
        ${subtitulo ? `<span class="cmb-anuncio-sub">${esc(subtitulo)}</span>` : ""}
        <span class="cmb-anuncio-titulo">${esc(titulo)}</span>
      </div>
    </div>`;
  document.body.append(el);
  const dur = movimentoReduzido() ? 1400 : 2100;
  return new Promise(resolve => setTimeout(() => {
    el.classList.add("cmb-saindo");
    setTimeout(() => { el.remove(); resolve(); }, 350);
  }, dur));
}

// Se o mestre passar vários turnos de uma vez, as faixas antigas são puladas.
function enfileirar(dados) {
  if (pendentes >= 3) return fila;
  pendentes++;
  fila = fila.then(() => mostrarFaixa(dados)).catch(() => {}).finally(() => pendentes--);
  return fila;
}

function focarCamera(combatant) {
  const modo = cfg("camera");
  if (modo === "ninguem") return;
  if (modo === "dono" && !combatant.isOwner) return;
  const token = tokenNoMapa(combatant);
  if (!token?.visible) return;
  canvas.animatePan({ x: token.center.x, y: token.center.y, duration: 450 });
  if (combatant.isOwner && !game.user.isGM) token.control({ releaseOthers: true });
}

export function instalarAnuncio() {
  Hooks.on("combatTurnChange", (combat, prior, current) => {
    if (!combat.started) return;
    const c = combat.combatant;
    if (!c) return;
    const comecou = (!prior?.round) && current?.round === 1;
    const visivel = game.user.isGM || c.visible;
    if (visivel) focarCamera(c);
    if (!cfg("anuncio")) return;
    if (comecou) enfileirar({ titulo: loc("COMBATE.Anuncio.inicio"), subtitulo: loc("COMBATE.Anuncio.rolem"), classe: "cmb-inicio" });
    else if (current?.round !== prior?.round) enfileirar({ titulo: loc("COMBATE.Anuncio.rodada", { n: current.round }), classe: "cmb-rodada" });
    if (!visivel) return;
    const seu = c.isOwner && !game.user.isGM;
    enfileirar({
      titulo: seu ? loc("COMBATE.Anuncio.seuTurno") : c.name,
      subtitulo: seu ? c.name : loc("COMBATE.Anuncio.turnoDe"),
      img: imagemDe(c),
      classe: seu ? "cmb-seu" : ""
    });
  });
}
