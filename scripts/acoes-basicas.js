// ═══════════════════════════════════════════════════════════════════════════
//  Combate da Mesa — ações que todo personagem tem (Disparada, Esquiva…)
//  O dnd5e não cria itens para elas, então a barra cuida disso com recursos
//  nativos: condição "Esquivando" do sistema, teste de perícia do sistema e
//  um cartão no chat.
// ═══════════════════════════════════════════════════════════════════════════

import { MOD, cfg, combateAtivo, esc, loc } from "./core.js";
import { definir, estado } from "./economia.js";
import { cartaEmUso } from "./cartas/index.js";

export const ACOES_BASICAS = [
  { id: "disparada", icone: "fa-solid fa-person-running", selo: "acao" },
  { id: "esquiva", icone: "fa-solid fa-shield-halved", selo: "acao" },
  { id: "desengajar", icone: "fa-solid fa-person-walking-arrow-right", selo: "acao" },
  { id: "ajudar", icone: "fa-solid fa-handshake-angle", selo: "acao" },
  { id: "esconder", icone: "fa-solid fa-user-ninja", selo: "acao" },
  { id: "procurar", icone: "fa-solid fa-magnifying-glass", selo: "acao" },
  { id: "preparar", icone: "fa-solid fa-hourglass-half", selo: "acao" },
  { id: "usarObjeto", icone: "fa-solid fa-hand-holding", selo: "acao" }
];

async function cartao(actor, token, acao, extra = "") {
  const nome = esc(token?.name ?? actor.name);
  const content = `<div class="cmb-chat-acao"><i class="${acao.icone}"></i>
    <div><strong>${nome}</strong> ${esc(loc(`COMBATE.Basica.${acao.id}.chat`))}${extra}</div></div>`;
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor, token: token?.document ?? token }), content });
}

export async function usarAcaoBasica(id, { actor, combatant, token, event }) {
  const acao = ACOES_BASICAS.find(a => a.id === id);
  if (!acao || !actor) return;
  const combat = combateAtivo();
  if (combatant && cfg("economiaRigida") && !cartaEmUso()) {
    if (estado(combatant)[acao.selo]) {
      ui.notifications.warn(loc("COMBATE.Economia.jaGasto", { selo: loc(`COMBATE.Selo.${acao.selo}`) }));
      return;
    }
    if (combat?.combatant?.id !== combatant.id) {
      ui.notifications.warn(loc("COMBATE.Economia.foraDoTurno"));
      return;
    }
  }

  switch (id) {
    case "disparada":
      if (combatant) await definir(combatant, { [acao.selo]: true, disparada: true });
      return cartao(actor, token, acao);
    case "esquiva":
      await actor.toggleStatusEffect("dodging", { active: true });
      if (combatant) {
        await definir(combatant, { [acao.selo]: true });
        await combatant.setFlag(MOD, "esquivou", true);
      }
      return cartao(actor, token, acao);
    case "esconder":
      if (combatant) await definir(combatant, { [acao.selo]: true });
      return actor.rollSkill({ skill: "ste", event });
    case "procurar":
      if (combatant) await definir(combatant, { [acao.selo]: true });
      return actor.rollSkill({ skill: "prc", event });
    case "ajudar": {
      if (combatant) await definir(combatant, { [acao.selo]: true });
      const alvo = game.user.targets.first();
      const extra = alvo ? ` <em>→ ${esc(alvo.name)}</em>` : "";
      return cartao(actor, token, acao, extra);
    }
    default:
      if (combatant) await definir(combatant, { [acao.selo]: true });
      return cartao(actor, token, acao);
  }
}
