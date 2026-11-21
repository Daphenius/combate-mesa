// ═══════════════════════════════════════════════════════════════════════════
//  Combate da Mesa — economia de ações do D&D 5e
//  Ação, Ação Bônus, Reação e Movimento de cada combatente ficam numa flag
//  do próprio Combatant (documento nativo). Volta tudo no início do turno dele.
// ═══════════════════════════════════════════════════════════════════════════

import { MOD, cfg, combateAtivo, combatenteDoAtor, isActiveGM, loc } from "./core.js";
import { cartaEmUso, usaCartas } from "./cartas/index.js";

export const PADRAO = Object.freeze({ acao: false, bonus: false, reacao: false, disparada: false });

// tipo de ativação do dnd5e → selo do módulo
export const SELO_DO_TIPO = { action: "acao", bonus: "bonus", reaction: "reacao" };

export function estado(combatant) {
  return { ...PADRAO, ...(combatant?.getFlag(MOD, "economia") ?? {}) };
}

export async function definir(combatant, mudancas) {
  if (!combatant?.isOwner) return;
  const atual = estado(combatant);
  const novo = { ...atual, ...mudancas };
  if (Object.keys(novo).every(k => novo[k] === atual[k])) return;
  await combatant.setFlag(MOD, "economia", novo);
}

export const gastar = (combatant, selo) => definir(combatant, { [selo]: true });
export const alternar = (combatant, selo) => definir(combatant, { [selo]: !estado(combatant)[selo] });

// Selo que uma atividade gasta ("acao", "bonus", "reacao" ou null)
export function seloDaAtividade(activity) {
  return SELO_DO_TIPO[activity?.activation?.type] ?? null;
}

// Selo do item = o da primeira atividade que gasta algum selo
export function seloDoItem(item) {
  for (const a of item?.system?.activities ?? []) {
    const s = seloDaAtividade(a);
    if (s) return s;
  }
  return null;
}

// ───────────────────────── Movimento ─────────────────────────

// Deslocamento base do ator (o maior entre andar, voar, nadar, escalar, escavar)
export function deslocamento(actor) {
  const m = actor?.system?.attributes?.movement ?? {};
  const valores = ["walk", "fly", "swim", "climb", "burrow"].map(k => Number(m[k]) || 0);
  return { total: Math.max(0, ...valores), unidade: m.units || canvas?.grid?.units || "" };
}

// Quanto o token já andou neste turno, pelo histórico de movimento nativo do Foundry.
export function movido(tokenDoc) {
  try {
    const hist = tokenDoc?.movementHistory;
    if (!hist?.length) return 0;
    const r = tokenDoc.measureMovementPath(hist);
    return Math.max(0, Math.round((r?.distance ?? 0) * 10) / 10);
  } catch { return 0; }
}

// ───────────────────────── Ganchos ─────────────────────────

export function instalarEconomia(aoMudar) {
  // Com a "economia rígida", impede usar algo cujo selo já foi gasto.
  Hooks.on("dnd5e.preUseActivity", activity => {
    if (!cfg("economiaRigida") || cartaEmUso()) return;
    const selo = seloDaAtividade(activity);
    const c = combatenteDoAtor(activity?.actor);
    if (!selo || !c) return;
    if (usaCartas(c)) return; // no modo de cartas quem limita são as cartas
    if (estado(c)[selo]) {
      ui.notifications.warn(loc("COMBATE.Economia.jaGasto", { selo: loc(`COMBATE.Selo.${selo}`) }));
      return false;
    }
    const combat = combateAtivo();
    if (selo !== "reacao" && combat?.combatant?.id !== c.id) {
      ui.notifications.warn(loc("COMBATE.Economia.foraDoTurno"));
      return false;
    }
  });

  // Usou algo (pela barra, pela ficha, por macro…): apaga o selo.
  Hooks.on("dnd5e.postUseActivity", activity => {
    const selo = seloDaAtividade(activity);
    const c = combatenteDoAtor(activity?.actor);
    if (selo && c) gastar(c, selo);
  });

  // Início do turno: o mestre devolve os selos de quem vai jogar e limpa o rastro de movimento.
  Hooks.on("combatTurnChange", async combat => {
    aoMudar?.();
    if (!isActiveGM()) return;
    const c = combat.combatant;
    if (!c) return;
    try {
      if (c.getFlag(MOD, "economia")) await c.setFlag(MOD, "economia", { ...PADRAO });
      // Esquiva dura até o início do próximo turno de quem esquivou
      if (c.getFlag(MOD, "esquivou") && c.actor?.statuses?.has("dodging")) {
        await c.actor.toggleStatusEffect("dodging", { active: false });
      }
      if (c.getFlag(MOD, "esquivou")) await c.unsetFlag(MOD, "esquivou");
      if (c.token?.movementHistory?.length) await c.token.clearMovementHistory();
    } catch (e) { console.error("Combate da Mesa | início do turno", e); }
  });
}
