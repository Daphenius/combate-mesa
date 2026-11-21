// ═══════════════════════════════════════════════════════════════════════════
//  Combate da Mesa — modo de cartas (opcional)
//  Ligado em Configurações → Combate da Mesa → "Combate com cartas".
//  Cada combatente compra uma mão nova no início do próprio turno e age
//  jogando cartas, que usam as ações nativas do dnd5e.
// ═══════════════════════════════════════════════════════════════════════════

import { combateAtivo, combatenteDoAtor, isActiveGM, loc } from "../core.js";
import { regras } from "./config.js";
import { estadoCartas, novaMao, usaCartas } from "./baralho.js";
import { cartaEmUso, executarPedido, instalarAjuda, verificarArmadilha } from "./efeitos.js";
import { MaoCartas } from "./mao.js";
import { revelarCarta } from "./visual.js";

export { registrarConfigCartas } from "./config.js";
export { cartaEmUso } from "./efeitos.js";
export { movimentoExtra, usaCartas } from "./baralho.js";

let comprando = false;

// Mestre ativo: o combatente da vez ainda não comprou nesta rodada? Compra agora.
export async function conferirCompra() {
  if (!isActiveGM() || comprando) return;
  const combat = combateAtivo();
  const c = combat?.combatant;
  if (!c || !usaCartas(c)) return;
  if (estadoCartas(c).rodada === combat.round) return;
  comprando = true;
  try { await novaMao(c, combat); } catch (e) { console.error("Combate da Mesa | compra de cartas", e); } finally { comprando = false; }
}

/**
 * Liga o modo de cartas.
 * @param {Function} atualizarTudo  redesenho geral do módulo
 * @param {BarraAcoes} barra        a barra de ações (a mão mostra o mesmo combatente)
 * @returns {MaoCartas}
 */
export function instalarCartas(atualizarTudo, barra) {
  const mao = new MaoCartas(() => barra?.alvo?.() ?? null);

  // início de turno / de rodada / do combate
  Hooks.on("updateCombat", (combat, changes) => {
    if (!("turn" in changes || "round" in changes)) return;
    conferirCompra();
  });

  Hooks.on("createChatMessage", message => {
    revelarCarta(message);
    executarPedido(message);
    verificarArmadilha(message).catch(e => console.error("Combate da Mesa | armadilha", e));
  });

  // "Só cartas": no modo de cartas, o jogador age pelas cartas (reações continuam livres).
  Hooks.on("dnd5e.preUseActivity", activity => {
    if (game.user.isGM || cartaEmUso() || !regras().somenteCartas) return;
    const c = combatenteDoAtor(activity?.actor);
    if (!c || !usaCartas(c)) return;
    const tipo = activity?.activation?.type;
    if (!["action", "bonus"].includes(tipo)) return;
    ui.notifications.warn(loc("COMBATE.Cartas.aviso.soCartas"));
    return false;
  });

  instalarAjuda();
  conferirCompra();
  return mao;
}
