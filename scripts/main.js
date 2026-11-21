// ═══════════════════════════════════════════════════════════════════════════
//  Combate da Mesa — inicialização
//  Módulo Foundry VTT V14, sistema dnd5e 6
// ═══════════════════════════════════════════════════════════════════════════

import { MOD, PATH, cfg } from "./core.js";
import { registerSettings } from "./settings.js";
import { aplicarTema, instalarTema } from "./tema.js";
import { registrarMenu } from "./config-menu.js";
import { instalarEconomia } from "./economia.js";
import { instalarAnimacao } from "./animacao.js";
import { instalarAnuncio } from "./anuncio.js";
import { instalarPlacar, ResultadosCombate } from "./resultados.js";
import { LinhaTempo } from "./linha-tempo.js";
import { BarraAcoes } from "./barra-acoes.js";
import { instalarAlvoAutomatico } from "./alvo-automatico.js";
import { instalarDadosEmCena } from "./dados-em-cena.js";
import { conferirCompra, instalarCartas, registrarConfigCartas } from "./cartas/index.js";

const UI = { linha: null, barra: null, mao: null };

function atualizarTudo() {
  UI.linha?.agendar();
  UI.barra?.agendar();
  UI.mao?.agendar();
}

Hooks.once("init", () => {
  registerSettings(key => { if (key === "tema") aplicarTema(); atualizarTudo(); });
  // modo de cartas (opcional): ao mudar as regras, redesenha e confere a compra do turno
  registrarConfigCartas(() => { atualizarTudo(); conferirCompra(); });
  registrarMenu();
  // partes reaproveitadas pelos modelos (retrato da linha do tempo, carta da barra)
  foundry.applications.handlebars.loadTemplates([`${PATH}/templates/retrato.hbs`, `${PATH}/templates/carta.hbs`, `${PATH}/templates/config.hbs`]);

  // Marcador de turno nativo do Foundry: só trocamos a imagem padrão (quando o mestre
  // não escolheu outra nas configurações do Rastreador de Combate). A animação
  // continua sendo escolhida lá, entre as nativas.
  if (cfg("marcador")) CONFIG.Combat.fallbackTurnMarker = `${PATH}/assets/marcador-runa.svg`;

  game.keybindings.register(MOD, "alternarBarra", {
    name: "COMBATE.Keybind.alternarBarra.Name",
    hint: "COMBATE.Keybind.alternarBarra.Hint",
    editable: [{ key: "KeyB", modifiers: ["Shift"] }],
    onDown: () => {
      game.settings.set(MOD, "barraMinimizada", !cfg("barraMinimizada")).then(() => UI.barra?.agendar());
      return true;
    }
  });
});

Hooks.once("ready", () => {
  instalarTema();
  UI.linha = new LinhaTempo();
  UI.barra = new BarraAcoes();
  UI.mao = instalarCartas(atualizarTudo, UI.barra);

  instalarEconomia(atualizarTudo);
  instalarAnimacao();
  instalarAnuncio();
  instalarPlacar();
  instalarAlvoAutomatico();
  instalarDadosEmCena();

  // Mudanças no combate e nos combatentes
  for (const h of ["createCombat", "updateCombat", "deleteCombat", "createCombatant", "updateCombatant", "deleteCombatant", "canvasReady"]) {
    Hooks.on(h, atualizarTudo);
  }

  // Mudanças em quem está no combate (vida, efeitos, itens, token)
  const noCombate = actor => !!actor && !!game.combat?.combatants.some(c => c.actor?.uuid === actor.uuid);
  Hooks.on("updateActor", actor => { if (noCombate(actor)) atualizarTudo(); });
  for (const h of ["createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) {
    Hooks.on(h, effect => { if (noCombate(effect.target ?? effect.parent)) atualizarTudo(); });
  }
  for (const h of ["createItem", "updateItem", "deleteItem"]) {
    Hooks.on(h, item => { if (noCombate(item.parent)) UI.barra.agendar(); });
  }
  Hooks.on("updateToken", doc => { if (doc.combatant) atualizarTudo(); });
  Hooks.on("moveToken", doc => { if (doc.combatant) UI.barra.agendar(); });
  Hooks.on("controlToken", () => { if (!game.user.isGM) UI.barra.agendar(); });

  atualizarTudo();

  game.modules.get(MOD).api = {
    linhaTempo: UI.linha,
    barraAcoes: UI.barra,
    maoCartas: UI.mao,
    resultados: combat => new ResultadosCombate({ combat }).render({ force: true })
  };
});
