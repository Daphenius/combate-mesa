// ═══════════════════════════════════════════════════════════════════════════
//  Combate da Mesa — ataques por ação e Ataques múltiplos (modo padrão)
//  - Ataques por ação: quantos ataques com arma a Ação de Ataque dá (Ataque
//    Extra do 5e). O primeiro ataque gasta a Ação; os outros saem de graça
//    até acabar. Automático pela ficha ou ajustado pelo mestre por personagem.
//  - Ataques múltiplos: habilidade combinada entre mestre e jogador. O jogador
//    ativa na barra X vezes (por turno, combate ou descanso) e cada vez ganha
//    Y ataques extras neste turno.
//  Tudo em configurações nativas (menu próprio do mestre) e flags nativas.
// ═══════════════════════════════════════════════════════════════════════════

import { MOD, cfg, combateAtivo, esc, loc } from "./core.js";
import { definir, estado } from "./economia.js";
import { numeroAtaques } from "./cartas/tipos.js";

export const RECARGAS = ["turno", "combate", "curto", "longo"];
const PADRAO_MULTI = { usos: 0, extras: 1, recarga: "combate" };
const FLAG_MULTI = "multiataque";

export function registrarAtaques(onChange, MenuAtaques) {
  game.settings.register(MOD, "ataquesAtores", {
    scope: "world", config: false, type: Object, default: {}, onChange: () => onChange?.("ataquesAtores")
  });
  game.settings.registerMenu(MOD, "menuAtaques", {
    name: "COMBATE.Ataques.menu.Name",
    label: "COMBATE.Ataques.menu.Label",
    hint: "COMBATE.Ataques.menu.Hint",
    icon: "fa-solid fa-khanda",
    type: MenuAtaques,
    restricted: true
  });
}

export function configAtores() {
  return cfg("ataquesAtores") ?? {};
}

const num = v => (v === "" || v === null || v === undefined) ? NaN : Number(v);

// Configuração final de um ator: a dele por cima do padrão (PJ ou NPC)
export function configAtaques(actor) {
  const todos = configAtores();
  const padrao = todos[actor?.type === "character" ? "_pj" : "_npc"] ?? {};
  const proprio = todos[actor?.id] ?? {};
  const pega = k => Number.isFinite(num(proprio[k])) ? num(proprio[k]) : (Number.isFinite(num(padrao[k])) ? num(padrao[k]) : NaN);
  const recarga = RECARGAS.includes(proprio.recarga) ? proprio.recarga : (RECARGAS.includes(padrao.recarga) ? padrao.recarga : PADRAO_MULTI.recarga);
  const porAcao = pega("porAcao");
  const usos = pega("usos");
  const extras = pega("extras");
  return {
    porAcao: Number.isFinite(porAcao) ? Math.max(1, Math.min(10, Math.floor(porAcao))) : Math.max(1, numeroAtaques(actor) || 1),
    usos: Number.isFinite(usos) ? Math.max(0, Math.min(20, Math.floor(usos))) : PADRAO_MULTI.usos,
    extras: Number.isFinite(extras) ? Math.max(1, Math.min(10, Math.floor(extras))) : PADRAO_MULTI.extras,
    recarga
  };
}

export const ataquesPorAcao = actor => configAtaques(actor).porAcao;

// Ataque com arma feito como Ação (é o que o Ataque Extra multiplica)
export function ehAtaqueArma(activity) {
  return activity?.type === "attack" && activity?.activation?.type === "action" && activity?.item?.type === "weapon";
}

// ───────────────────────── Ataques múltiplos ─────────────────────────

function chaveRecarga(recarga, combat = combateAtivo()) {
  if (recarga === "turno") return combat ? `${combat.id}.${combat.round}.${combat.turn}` : "fora";
  if (recarga === "combate") return combat?.id ?? "fora";
  return "descanso"; // curto/longo: zera no descanso (gancho abaixo)
}

// Quantas vezes já usou (no período da recarga) e quantas restam
export function estadoMulti(actor) {
  const conf = configAtaques(actor);
  const f = actor?.getFlag(MOD, FLAG_MULTI) ?? {};
  const usados = f.chave === chaveRecarga(conf.recarga) ? (Number(f.usados) || 0) : 0;
  return { ...conf, usados, restam: Math.max(0, conf.usos - usados) };
}

export async function usarMultiataque(combatant) {
  const actor = combatant?.actor;
  if (!actor || !combatant.isOwner) return;
  const combat = combateAtivo();
  if (cfg("economiaRigida") && combat?.combatant?.id !== combatant.id) {
    ui.notifications.warn(loc("COMBATE.Economia.foraDoTurno"));
    return;
  }
  const m = estadoMulti(actor);
  if (!m.usos) return;
  if (!m.restam) { ui.notifications.warn(loc("COMBATE.Ataques.multi.esgotado")); return; }
  await actor.setFlag(MOD, FLAG_MULTI, { usados: m.usados + 1, chave: chaveRecarga(m.recarga, combat) });
  const st = estado(combatant);
  await definir(combatant, { extras: (Number(st.extras) || 0) + m.extras });
  const token = combatant.token;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor, token }),
    content: `<div class="cmb-chat-acao"><i class="fa-solid fa-burst"></i><div>${loc("COMBATE.Ataques.multi.chat", {
      nome: `<strong>${esc(token?.name ?? actor.name)}</strong>`, n: m.extras, restam: m.restam - 1, usos: m.usos
    })}</div></div>`
  });
}

export function instalarAtaques() {
  // descanso: zera os Ataques múltiplos que recarregam no descanso
  Hooks.on("dnd5e.restCompleted", (actor, result) => {
    if (!actor?.isOwner || !actor.getFlag(MOD, FLAG_MULTI)) return;
    const { recarga } = configAtaques(actor);
    const longo = !!(result?.longRest ?? result?.type === "long");
    if (recarga === "curto" || (recarga === "longo" && longo)) actor.unsetFlag(MOD, FLAG_MULTI);
  });
}
