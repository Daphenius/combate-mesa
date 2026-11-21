// ═══════════════════════════════════════════════════════════════════════════
//  Combate da Mesa — animação de ataque no mapa
//  Dispara com o cartão de ataque do dnd5e (ChatMessage do tipo "attack"),
//  que chega a todos os clientes: cada um anima localmente, sem socket.
//  Usa só o que o Foundry já tem: CanvasAnimation e o texto flutuante nativo.
//  O número do dano já é mostrado pelo próprio dnd5e quando o dano é aplicado.
// ═══════════════════════════════════════════════════════════════════════════

import { cfg, loc, movimentoReduzido } from "./core.js";

const { CanvasAnimation } = foundry.canvas.animation;

const COR = { acerto: 0xf0d48a, critico: 0xffb22e, erro: 0xb8b8b8, falha: 0xd05050 };

// Animações em andamento por token, para não empilhar duas no mesmo token
const ocupados = new WeakSet();

function centro(token) {
  return token.center ?? { x: token.x + token.w / 2, y: token.y + token.h / 2 };
}

function texto(token, conteudo, cor, grande = false) {
  try {
    const c = centro(token);
    canvas.interface.createScrollingText({ x: c.x, y: c.y - token.h * 0.35 }, conteudo, {
      anchor: CONST.TEXT_ANCHOR_POINTS.TOP,
      direction: CONST.TEXT_ANCHOR_POINTS.TOP,
      distance: token.h * 0.6,
      fontSize: grande ? 40 : 30,
      fill: cor,
      stroke: 0x1a1008,
      strokeThickness: 5,
      jitter: 0.15,
      duration: grande ? 2200 : 1600
    });
  } catch (e) { console.warn("Combate da Mesa | texto flutuante", e); }
}

// Desloca o sprite do token (só o visual; o documento não muda) e devolve ao lugar.
async function deslocarSprite(token, ontick, duracao, nome) {
  const mesh = token?.mesh;
  if (!mesh || ocupados.has(token)) return;
  ocupados.add(token);
  const base = { x: mesh.x, y: mesh.y };
  const prog = { t: 0 };
  try {
    await CanvasAnimation.animate([{ parent: prog, attribute: "t", from: 0, to: 1 }], {
      name: `${nome}.${token.id}`,
      duration: duracao,
      ontick: () => {
        if (mesh.destroyed) return;
        const d = ontick(prog.t);
        mesh.position.set(base.x + d.x, base.y + d.y);
      }
    });
  } finally {
    ocupados.delete(token);
    if (!mesh.destroyed) mesh.position.set(base.x, base.y);
    token.renderFlags?.set({ refreshPosition: true });
  }
}

// Avanço corpo a corpo: vai rápido na direção do alvo e volta.
function investida(atacante, alvo) {
  const a = centro(atacante), b = centro(alvo);
  const dx = b.x - a.x, dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 1;
  const alcance = Math.min(dist * 0.45, canvas.grid.size * 0.45);
  const ux = dx / dist * alcance, uy = dy / dist * alcance;
  return deslocarSprite(atacante, t => {
    // sobe rápido até 35% do tempo, depois volta suave
    const k = t < 0.35 ? CanvasAnimation.easeOutCircle(t / 0.35) : 1 - CanvasAnimation.easeInOutCosine((t - 0.35) / 0.65);
    return { x: ux * k, y: uy * k };
  }, 420, "cm-investida");
}

// Tremor do alvo ao ser atingido
function tremor(alvo, forte = false) {
  const amp = canvas.grid.size * (forte ? 0.1 : 0.06);
  return deslocarSprite(alvo, t => {
    const queda = 1 - t;
    return { x: Math.sin(t * Math.PI * (forte ? 10 : 8)) * amp * queda, y: 0 };
  }, forte ? 520 : 380, "cm-tremor");
}

// Esquiva do alvo quando o ataque erra: um passo de lado e volta
function esquiva(alvo, atacante) {
  const a = centro(atacante), b = centro(alvo);
  const dx = b.x - a.x, dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 1;
  const px = -dy / dist * canvas.grid.size * 0.18, py = dx / dist * canvas.grid.size * 0.18;
  return deslocarSprite(alvo, t => {
    const k = Math.sin(t * Math.PI);
    return { x: px * k, y: py * k };
  }, 380, "cm-esquiva");
}

// Brilho vermelho rápido no alvo atingido
function lampejo(alvo, cor = 0xff6050) {
  const mesh = alvo?.mesh;
  if (!mesh) return;
  const original = mesh.tint;
  mesh.tint = cor;
  setTimeout(() => {
    if (mesh.destroyed) return;
    mesh.tint = original;
    alvo.renderFlags?.set({ refreshMesh: true });
  }, 180);
}

// Projétil para ataques à distância: uma faísca dourada com rastro
async function projetil(atacante, alvo, cor) {
  const a = centro(atacante), b = centro(alvo);
  const g = new PIXI.Graphics();
  g.beginFill(cor, 0.35).drawCircle(0, 0, canvas.grid.size * 0.12).endFill();
  g.beginFill(cor, 1).drawCircle(0, 0, canvas.grid.size * 0.06).endFill();
  g.position.set(a.x, a.y);
  canvas.interface.addChild(g);
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  try {
    await CanvasAnimation.animate([
      { parent: g, attribute: "x", to: b.x },
      { parent: g, attribute: "y", to: b.y }
    ], { name: `cm-projetil.${foundry.utils.randomID()}`, duration: Math.min(650, 180 + dist * 0.6), easing: CanvasAnimation.easeInCircle });
  } finally {
    g.destroy();
  }
}

function resolverToken(uuidToken) {
  if (!uuidToken) return null;
  const doc = fromUuidSync(uuidToken, { strict: false });
  return doc?.parent === canvas.scene ? doc.object : null;
}

async function animarAtaque(message) {
  if (!cfg("animacoes") || movimentoReduzido() || !canvas.ready) return;
  const atacante = message.speaker?.token ? canvas.tokens.get(message.speaker.token) : null;
  if (!atacante?.visible) return;
  const roll = message.rolls?.[0];
  const alvos = (message.system?.targets ?? []).map(t => ({ token: resolverToken(t.token), ac: t.ac })).filter(t => t.token);
  // o resultado só aparece para quem pode ver (configuração de visibilidade do dnd5e)
  let mostrar = true;
  try { mostrar = message.shouldDisplayChallenge !== false; } catch { /* versão sem a propriedade */ }

  if (!alvos.length) { // atacou sem alvo marcado: só o golpe no ar
    return investida(atacante, { center: { x: atacante.center.x + canvas.grid.size, y: atacante.center.y }, x: 0, y: 0, w: 0, h: 0 });
  }

  const longe = alvos.some(t => Math.hypot(t.token.center.x - atacante.center.x, t.token.center.y - atacante.center.y) > canvas.grid.size * 1.8);
  const critico = !!roll?.isCritical, falha = !!roll?.isFumble;

  if (longe) await Promise.all(alvos.map(t => projetil(atacante, t.token, critico ? COR.critico : COR.acerto)));
  else investida(atacante, alvos[0].token);
  if (!longe) await new Promise(r => setTimeout(r, 150));

  for (const { token: alvo, ac } of alvos) {
    if (!alvo.visible) continue;
    const acertou = falha ? false : critico ? true : (Number.isFinite(ac) && roll ? roll.total >= ac : null);
    if (!mostrar || acertou === null) { tremor(alvo); continue; }
    if (critico) {
      tremor(alvo, true); lampejo(alvo, 0xffa040);
      texto(alvo, loc("COMBATE.Animacao.critico"), COR.critico, true);
    } else if (acertou) {
      tremor(alvo); lampejo(alvo);
      texto(alvo, loc("COMBATE.Animacao.acerto"), COR.acerto);
    } else {
      esquiva(alvo, atacante);
      texto(alvo, loc(falha ? "COMBATE.Animacao.falha" : "COMBATE.Animacao.erro"), falha ? COR.falha : COR.erro);
    }
  }
}

export function instalarAnimacao() {
  Hooks.on("createChatMessage", message => {
    if (message.type !== "attack") return;
    animarAtaque(message).catch(e => console.warn("Combate da Mesa | animação de ataque", e));
  });
}
