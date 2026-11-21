// ═══════════════════════════════════════════════════════════════════════════
//  Combate da Mesa — modo de cartas: visual da carta e revelação
//  A revelação (carta que gira e mostra a face no meio da tela) foi
//  inspirada no visualizador de cartas do orcnog, feita do zero só com CSS.
//  Ela nasce da mensagem de chat da carta, que chega a todos os clientes.
// ═══════════════════════════════════════════════════════════════════════════

import { MOD, cfg, esc, movimentoReduzido } from "../core.js";
import { infoCarta } from "./tipos.js";

// HTML de uma carta (face ou verso). Usado na mão, no chat e na revelação.
export function cartaHTML(info, { mini = false, oculta = false, classes = "" } = {}) {
  if (oculta) return `<div class="cmb-c verso ${mini ? "mini" : ""} ${classes}"><div class="cmb-c-verso"><i class="fa-solid fa-dragon"></i></div></div>`;
  const arte = info.img
    ? `<img src="${esc(info.img)}" alt="">`
    : `<i class="${esc(info.icone)}"></i>${info.rotulo ? `<b class="cmb-c-rotulo">${esc(info.rotulo)}</b>` : ""}`;
  return `<div class="cmb-c ${esc(info.categoria)} ${mini ? "mini" : ""} ${classes}">
    <div class="cmb-c-nome">${esc(info.nome)}</div>
    <div class="cmb-c-arte">${arte}</div>
    <div class="cmb-c-tipo">[ ${esc(info.tipoNome)} ]</div>
    <div class="cmb-c-texto">${esc(info.descricao)}</div>
  </div>`;
}

// ───────────────────────── Revelação ─────────────────────────

const fila = [];
let mostrando = false;

function proxima() {
  const item = fila.shift();
  if (!item) { mostrando = false; return; }
  mostrando = true;
  const { info, oculta, quem } = item;
  const el = document.createElement("div");
  el.className = "cmb-revelar";
  el.innerHTML = `<div class="cmb-revelar-quem">${esc(quem)}</div>
    <div class="cmb-revelar-giro ${oculta ? "fica-verso" : ""}">
      <div class="cmb-revelar-face frente">${oculta ? cartaHTML(info, { oculta: true }) : cartaHTML(info)}</div>
      <div class="cmb-revelar-face tras">${cartaHTML(info, { oculta: true })}</div>
    </div>`;
  let fechou = false;
  const fechar = () => {
    if (fechou) return;
    fechou = true;
    el.classList.add("saindo");
    setTimeout(() => { el.remove(); proxima(); }, 350);
  };
  el.addEventListener("click", fechar);
  document.body.append(el);
  setTimeout(fechar, oculta ? 1600 : 2600);
}

export function revelarCarta(message) {
  const dados = message.getFlag(MOD, "carta");
  if (!dados || !cfg("revelarCartas") || movimentoReduzido()) return;
  // carta de NPC escondido no rastreador: só o mestre vê
  const c = game.combat?.combatants.get(message.getFlag(MOD, "combatant"));
  if (c?.hidden && !game.user.isGM) return;
  const info = infoCarta(dados);
  if (!info) return;
  fila.push({ info, oculta: !!message.getFlag(MOD, "oculta"), quem: message.alias ?? message.speaker?.alias ?? "" });
  if (fila.length > 4) fila.splice(0, fila.length - 4);
  if (!mostrando) proxima();
}
