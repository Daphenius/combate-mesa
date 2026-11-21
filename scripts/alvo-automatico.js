// ═══════════════════════════════════════════════════════════════════════════
//  Combate da Mesa — alvo ao clicar
//  Quando o jogador usa algo que precisa de alvo (carta Atacar, Agarrar, Ajudar,
//  Proteger, uma habilidade, magia ou ataque da barra) e não marcou ninguém,
//  ele é avisado e o próximo clique num token marca esse token como alvo
//  (a mesma marcação nativa da ferramenta "Alvo", via Token#setTarget).
//  Fora disso os cliques continuam normais, para não atrapalhar.
//  Modos (configuração "alvoAoClicar"):
//   - pedir (padrão): só quando uma ação pede alvo
//   - sempre: clicar no token de outro sempre marca alvo (mestre: só no combate,
//     e nunca o token da vez)
//   - desligado
//  Shift+clique soma alvos; Esc cancela o pedido.
// ═══════════════════════════════════════════════════════════════════════════

import { cfg, combateAtivo, loc } from "./core.js";

const CLIQUE_MAX_PX = 6;     // mais que isso é arrastar, não clicar
const CLIQUE_MAX_MS = 450;
const ESPERA_MS = 30000;     // o pedido de alvo expira sozinho

let pedido = null;           // { resolver, aviso, timer }

function modo() {
  return cfg("alvoAoClicar") ?? "pedir";
}

// Token visível mais acima no ponto do clique (coordenadas da cena)
function tokenNoPonto(p) {
  let achado = null;
  for (const t of canvas.tokens?.placeables ?? []) {
    if (!t.visible || !t.renderable || t.isPreview) continue;
    if (t.document.hidden && !game.user.isGM) continue;
    if (!t.bounds?.contains(p.x, p.y)) continue;
    if (!achado || (t.zIndex ?? 0) >= (achado.zIndex ?? 0)) achado = t;
  }
  return achado;
}

// Modo "sempre": quais cliques viram alvo sem pedido
function marcaSemPedido(token) {
  if (modo() !== "sempre") return false;
  if (game.user.isGM) {
    const combate = combateAtivo();
    return !!combate && combate.combatant?.tokenId !== token.id;
  }
  return !token.document.isOwner;
}

function marcar(token, somar) {
  if (typeof token.setTarget === "function") {
    token.setTarget(true, { releaseOthers: !somar, groupSelection: false });
    return;
  }
  // reserva para versões sem Token#setTarget
  const ids = somar ? [...game.user.targets.map(t => t.id), token.id] : [token.id];
  game.user.updateTokenTargets?.(ids);
}

function encerrarPedido(token) {
  const p = pedido;
  if (!p) return;
  pedido = null;
  clearTimeout(p.timer);
  document.body.classList.remove("cmb-escolhendo-alvo");
  try { if (p.aviso) ui.notifications.remove(p.aviso); } catch { /* aviso já sumiu */ }
  p.resolver(token ?? null);
}

/**
 * Pede para o jogador clicar no token alvo. Resolve com o token marcado,
 * ou null se cancelar (Esc), expirar ou se o recurso estiver desligado.
 * Se já houver alvo marcado, resolve na hora com ele.
 */
export function pedirAlvo({ nome = "" } = {}) {
  const atual = game.user.targets.first();
  if (atual) return Promise.resolve(atual);
  if (modo() === "desligado" || !canvas.ready) return Promise.resolve(null);
  encerrarPedido(null);
  return new Promise(resolver => {
    const texto = nome ? loc("COMBATE.Alvo.cliqueCom", { nome }) : loc("COMBATE.Alvo.clique");
    const aviso = ui.notifications.info(texto);
    pedido = { resolver, aviso, timer: setTimeout(() => encerrarPedido(null), ESPERA_MS) };
    document.body.classList.add("cmb-escolhendo-alvo");
    // a camada de tokens precisa estar ativa para o clique chegar
    if (!canvas.tokens.active) canvas.tokens.activate();
  });
}

// A atividade do dnd5e precisa de uma criatura como alvo?
export function precisaAlvo(activity) {
  if (!activity) return false;
  if (activity.type === "attack") return true;
  const afeta = activity.target?.affects?.type;
  if (!afeta || ["self", "space", "object"].includes(afeta)) return false;
  if (activity.target?.template?.type) return false; // área: usa o modelo
  if (activity.range?.units === "self") return false;
  return true;
}

export function instalarAlvoAutomatico() {
  let inicio = null;

  const aoApertar = ev => {
    inicio = ev.button === 0 ? { x: ev.clientX, y: ev.clientY, t: performance.now() } : null;
  };

  const aoSoltar = ev => {
    const i = inicio;
    inicio = null;
    if (!i || ev.button !== 0 || !canvas.ready) return;
    if (Math.hypot(ev.clientX - i.x, ev.clientY - i.y) > CLIQUE_MAX_PX) return;
    if (performance.now() - i.t > CLIQUE_MAX_MS) return;
    // só com a camada de tokens e a ferramenta de seleção (a ferramenta "Alvo" já faz isso)
    if (!canvas.tokens?.active || game.activeTool !== "select") return;
    if (canvas.controls?.ruler?.active) return;
    const p = canvas.canvasCoordinatesFromClient?.({ x: ev.clientX, y: ev.clientY });
    if (!p) return;
    const token = tokenNoPonto(p);
    if (!token) return;
    if (pedido) {
      marcar(token, ev.shiftKey);
      ui.notifications.info(loc("COMBATE.Alvo.marcado", { nome: token.name }));
      encerrarPedido(token);
    } else if (marcaSemPedido(token)) marcar(token, ev.shiftKey);
  };

  // o elemento <canvas> do tabuleiro só recebe cliques feitos na cena (não na interface)
  const ligar = () => {
    const el = document.getElementById("board");
    if (!el || el.dataset.cmbAlvo) return;
    el.dataset.cmbAlvo = "1";
    el.addEventListener("pointerdown", aoApertar, true);
    el.addEventListener("pointerup", aoSoltar, true);
  };
  ligar();
  Hooks.on("canvasReady", ligar);
  document.addEventListener("keydown", ev => { if (ev.key === "Escape" && pedido) encerrarPedido(null); });

  // Ataque, magia ou habilidade com alvo, usado sem ninguém marcado (no combate):
  // avisa e deixa o próximo clique escolher o alvo. Não bloqueia o uso, porque
  // no dnd5e a rolagem de ataque/dano (que lê o alvo) vem depois, no cartão do chat.
  Hooks.on("dnd5e.preUseActivity", activity => {
    if (modo() === "desligado" || !combateAtivo() || game.user.targets.size || pedido) return;
    if (!precisaAlvo(activity)) return;
    pedirAlvo({ nome: activity.item?.name ?? activity.name ?? "" });
  });
}
