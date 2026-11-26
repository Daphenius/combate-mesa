// ═══════════════════════════════════════════════════════════════════════════
//  Combate da Mesa — Trilhas: movimento do token no mapa de batalha
//  (antes era o módulo separado "Trilhas da Mesa")
//  - arrastar desviando de paredes, portas e terreno intransponível (A*)
//  - alcance do turno pintado no mapa (Alt+R)
//  - "faltam X" na régua
//  - NPC anda sozinho até o cursor (Alt+M, mestre)
//  - comportamento de Região "Terreno intransponível"
//  Usa o movimento nativo do Foundry 14: só estende Token#findMovementPath e
//  a régua do token. Pode ser desligado em Movimento, no painel do módulo.
// ═══════════════════════════════════════════════════════════════════════════

import { combatenteDoAtor } from "../core.js";
import { adicionarSecao } from "../settings.js";
import { estado } from "../economia.js";
import { movimentoExtra } from "../cartas/index.js";
import { CHAVES, MODULE_ID, chaveConfig, registrarConfiguracoes, t, trilhasAtivo } from "./config.js";
import { estenderToken } from "./token.js";
import { estenderRegua, TEMPLATE_ROTULO } from "./regua.js";
import { invalidarGrades } from "./grade.js";
import { alternarAlcance, atualizarAlcance, registrarGanchosDoAlcance } from "./alcance.js";
import { moverAteCursor } from "./npc.js";
import { registrarIntransponivel } from "./terreno.js";
import { definirFatorDoTurno } from "./deslocamento.js";

/** init: configurações, seção do painel, comportamento de Região e atalhos. */
export function registrarTrilhas() {
  registrarConfiguracoes(atualizarAlcance);
  adicionarSecao({ id: "trilhas", icone: "fa-solid fa-route", chaves: CHAVES.map(chaveConfig) });
  // sempre registrado, para Regiões já configuradas não quebrarem com o Trilhas desligado
  registrarIntransponivel();

  game.keybindings.register(MODULE_ID, "moverAteCursor", {
    name: "TRILHAS.Atalhos.moverAteCursor.Name",
    hint: "TRILHAS.Atalhos.moverAteCursor.Hint",
    editable: [{ key: "KeyM", modifiers: ["Alt"] }],
    restricted: true,
    onDown: () => {
      if (!trilhasAtivo()) return false;
      moverAteCursor();
      return true;
    }
  });
  game.keybindings.register(MODULE_ID, "alternarAlcance", {
    name: "TRILHAS.Atalhos.alternarAlcance.Name",
    hint: "TRILHAS.Atalhos.alternarAlcance.Hint",
    editable: [{ key: "KeyR", modifiers: ["Alt"] }],
    onDown: () => {
      if (!trilhasAtivo()) return false;
      const ligado = alternarAlcance();
      ui.notifications.info(t(ligado ? "Alcance.Ligado" : "Alcance.Desligado"));
      return true;
    }
  });

  foundry.applications.handlebars.loadTemplates([TEMPLATE_ROTULO]);
}

/** setup: o sistema (D&D 5e) já trocou as classes de Token e régua; estendemos as dele. */
export function estenderTrilhas() {
  if (!trilhasAtivo()) return;
  CONFIG.Token.objectClass = estenderToken(CONFIG.Token.objectClass);
  CONFIG.Token.rulerClass = estenderRegua(CONFIG.Token.rulerClass);
}

/** ready: ganchos de redesenho e a ligação com a economia do combate. */
export function instalarTrilhas() {
  if (!trilhasAtivo()) return;

  // Disparada (dobro) e cartas Mover/Disparada do combate aumentam o movimento do turno
  definirFatorDoTurno(actor => {
    const c = combatenteDoAtor(actor);
    if (!c) return 1;
    return (estado(c).disparada ? 2 : 1) + movimentoExtra(c);
  });

  registrarGanchosDoAlcance();
  Hooks.on("updateCombatant", atualizarAlcance); // Disparada, cartas de movimento

  // Paredes, portas e Regiões mudam o mapa: o que foi calculado deixa de valer.
  const mudouOMapa = () => { invalidarGrades(); atualizarAlcance(); };
  for (const doc of ["Wall", "Region", "RegionBehavior"]) {
    for (const acao of ["create", "update", "delete"]) Hooks.on(`${acao}${doc}`, mudouOMapa);
  }
  Hooks.on("updateScene", (scene, mudancas) => {
    if ("grid" in mudancas || "width" in mudancas || "height" in mudancas || "padding" in mudancas) mudouOMapa();
  });
  Hooks.on("canvasReady", invalidarGrades);
  Hooks.on("updateToken", (doc, mudancas) => {
    // Custo pode depender do ator ou do tamanho; casas ocupadas são recalculadas a cada pedido.
    if ("width" in mudancas || "height" in mudancas || "shape" in mudancas || "actorId" in mudancas) invalidarGrades();
  });
}
