// ═══════════════════════════════════════════════════════════════════════════
//  Combate da Mesa — modo de cartas: baralho e mão
//  A mão de cada combatente fica numa flag do próprio Combatant (documento
//  nativo): sincroniza sozinha com todos e some quando o combate acaba.
//  O baralho não é guardado: ele é montado da ficha a cada compra, então
//  sempre reflete o personagem de agora (subiu de nível, ganhou Ataque Extra…).
// ═══════════════════════════════════════════════════════════════════════════

import { MOD } from "../core.js";
import { cartasCustom, modoCartasLigado, quantidadesAtores, regras } from "./config.js";
import { IDS_TIPOS, opcoesHabilidade, quantidadeAuto } from "./tipos.js";

export const ESTADO_PADRAO = Object.freeze({
  mao: [],          // [{ uid, tipo, cid? }]
  guardada: null,   // uid da carta guardada para o próximo turno
  armadilha: null,  // carta virada na mesa, esperando um ataque
  rodada: null,     // rodada em que a mão foi comprada
  menos: 0,         // cartas a menos na próxima compra (carta −2)
  mov: 0            // deslocamentos extras ganhos por cartas neste turno
});

export function estadoCartas(combatant) {
  const f = combatant?.getFlag(MOD, "cartas") ?? {};
  return { ...ESTADO_PADRAO, ...f, mao: Array.isArray(f.mao) ? f.mao : [] };
}

export async function salvarCartas(combatant, mudancas) {
  const novo = { ...estadoCartas(combatant), ...mudancas };
  await combatant.setFlag(MOD, "cartas", novo);
  return novo;
}

// Bônus de movimento das cartas (em múltiplos do deslocamento), para a barra.
export function movimentoExtra(combatant) {
  if (!usaCartas(combatant)) return 0;
  return Math.max(0, Number(estadoCartas(combatant).mov) || 0);
}

// O combatente joga com cartas?
export function usaCartas(combatant) {
  if (!modoCartasLigado() || !combatant?.actor) return false;
  if (!combatant.hasPlayerOwner && !regras().inimigos) return false;
  return true;
}

// ───────────────────────── Composição do baralho ─────────────────────────

function ehClasse(actor, id) {
  return !!id && !!actor.classes?.[String(id).trim().toLowerCase()];
}

function customServe(def, actor) {
  switch (def.para) {
    case "pj": return actor.type === "character";
    case "npc": return actor.type !== "character";
    case "classe": return ehClasse(actor, def.classe);
    case "atores": return Array.isArray(def.atores) && (def.atores.includes(actor.id) || def.atores.includes(actor.uuid));
    default: return true;
  }
}

// Lista de cartas do baralho (com repetições), sem embaralhar.
export function composicao(actor) {
  const todos = quantidadesAtores();
  const proprio = todos[actor.id] ?? {};
  const padrao = todos[actor.type === "character" ? "_pj" : "_npc"] ?? {};
  const lista = [];
  const add = (n, carta) => { for (let i = 0; i < n; i++) lista.push({ ...carta }); };

  for (const tipo of IDS_TIPOS) {
    let n = proprio[tipo];
    if (!Number.isFinite(n)) n = padrao[tipo];
    if (!Number.isFinite(n)) n = quantidadeAuto(actor, tipo);
    // Transformar só existe para quem tem Forma Selvagem, mesmo no padrão geral
    if (tipo === "transformar" && !Number.isFinite(proprio[tipo]) && !quantidadeAuto(actor, tipo)) n = 0;
    n = Math.max(0, Math.min(20, Math.floor(n)));
    // Habilidade: n cópias de CADA habilidade da ficha
    if (tipo === "habilidade") {
      for (const item of opcoesHabilidade(actor)) add(n, { tipo, iid: item.id, nome: item.name, img: item.img });
    } else add(n, { tipo });
  }
  for (const def of cartasCustom()) {
    if (!def?.id || !customServe(def, actor)) continue;
    let n = proprio[`c_${def.id}`];
    if (!Number.isFinite(n)) n = Number(def.quantidade ?? 1);
    add(Math.max(0, Math.min(20, Math.floor(n))), { tipo: "custom", cid: def.id });
  }
  return lista;
}

function embaralhar(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const novaCarta = base => ({ ...base, uid: foundry.utils.randomID() });

// Compra n cartas novas do baralho do personagem.
// Sem repetir enquanto o baralho tiver cartas; se acabar, embaralha de novo.
// "repor": a compra extra (+2) sorteia de novo do baralho inteiro, então pode repetir.
export function comprar(actor, n, { garantirAtacar = false } = {}) {
  const base = composicao(actor);
  if (!base.length || n <= 0) return [];
  const saida = [];
  let monte = embaralhar(base);
  while (saida.length < n) {
    if (!monte.length) monte = embaralhar(base);
    saida.push(novaCarta(monte.pop()));
  }
  if (garantirAtacar && !saida.some(c => c.tipo === "atacar") && base.some(c => c.tipo === "atacar")) {
    saida[saida.length - 1] = novaCarta({ tipo: "atacar" });
  }
  return saida;
}

// ───────────────────────── Compra do turno ─────────────────────────

// Mão nova no início do turno do combatente. Só o mestre ativo chama.
export async function novaMao(combatant, combat) {
  if (!usaCartas(combatant)) return;
  const r = regras();
  const st = estadoCartas(combatant);
  const guardada = r.guardarCarta && st.guardada ? st.mao.find(c => c.uid === st.guardada) : null;
  const n = Math.max(0, Math.floor(Number(r.tamanhoMao) || 5) - (guardada ? 1 : 0) - (Number(st.menos) || 0));
  const compradas = comprar(combatant.actor, n, { garantirAtacar: r.atacarGarantido && !(guardada?.tipo === "atacar") });
  const mao = guardada ? [guardada, ...compradas] : compradas;
  await salvarCartas(combatant, { mao, guardada: null, rodada: combat.round, menos: 0, mov: 0 });
  return { mao, perdeu: Number(st.menos) || 0 };
}

export async function tirarDaMao(combatant, uid) {
  const st = estadoCartas(combatant);
  const carta = st.mao.find(c => c.uid === uid);
  if (!carta) return null;
  await salvarCartas(combatant, {
    mao: st.mao.filter(c => c.uid !== uid),
    guardada: st.guardada === uid ? null : st.guardada
  });
  return carta;
}
