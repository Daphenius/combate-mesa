// ═══════════════════════════════════════════════════════════════════════════
//  Combate da Mesa — configurações registradas no Foundry
//  Todas ficam fora da lista padrão (config: false) e aparecem no painel
//  próprio do módulo (config-menu.js), aberto por um botão registrado com
//  game.settings.registerMenu, o caminho nativo para menus de módulo.
// ═══════════════════════════════════════════════════════════════════════════

import { MOD } from "./core.js";

// Seções do painel, na ordem em que aparecem. Outras partes do módulo podem
// acrescentar seções com adicionarSecao() durante o "init".
export const SECOES = [
  { id: "interface", icone: "fa-solid fa-table-columns", chaves: ["tema", "tamanhoBarra", "linhaTempo", "barraAcoes", "imagem", "esconderHotbar", "alvoAoClicar", "limparAlvo"] },
  { id: "regras", icone: "fa-solid fa-scale-balanced", chaves: ["economiaRigida", "vidaInimigos", "iniciativaInimigos", "dadosEmCena"] },
  { id: "cena", icone: "fa-solid fa-clapperboard", chaves: ["animacoes", "anuncio", "camera", "marcador", "resultados"] }
];

export function adicionarSecao(secao) {
  SECOES.push(secao);
}

export function registerSettings(onChange) {
  const reg = (key, scope, o) => game.settings.register(MOD, key, {
    scope, config: false,
    name: `COMBATE.Settings.${key}.Name`, hint: `COMBATE.Settings.${key}.Hint`,
    onChange: () => onChange?.(key),
    ...o
  });

  // mundo (o mestre decide)
  reg("linhaTempo", "world", { type: Boolean, default: true });
  reg("barraAcoes", "world", { type: Boolean, default: true });
  reg("economiaRigida", "world", { type: Boolean, default: false });
  reg("vidaInimigos", "world", {
    type: String, default: "descricao",
    choices: {
      descricao: "COMBATE.Settings.vidaInimigos.descricao",
      barra: "COMBATE.Settings.vidaInimigos.barra",
      oculto: "COMBATE.Settings.vidaInimigos.oculto"
    }
  });
  reg("imagem", "world", {
    type: String, default: "retrato",
    choices: { retrato: "COMBATE.Settings.imagem.retrato", token: "COMBATE.Settings.imagem.token" }
  });
  reg("iniciativaInimigos", "world", { type: Boolean, default: false });
  reg("camera", "world", {
    type: String, default: "dono",
    choices: {
      ninguem: "COMBATE.Settings.camera.ninguem",
      dono: "COMBATE.Settings.camera.dono",
      todos: "COMBATE.Settings.camera.todos"
    }
  });
  reg("marcador", "world", { type: Boolean, default: true, requiresReload: true });
  reg("resultados", "world", { type: Boolean, default: true });
  reg("esconderHotbar", "world", { type: Boolean, default: true });
  reg("dadosEmCena", "world", { type: Boolean, default: true });
  reg("limparAlvo", "world", { type: Boolean, default: true });
  reg("alvoAoClicar", "world", {
    type: String, default: "pedir",
    choices: { pedir: "COMBATE.Settings.alvoAoClicar.pedir", sempre: "COMBATE.Settings.alvoAoClicar.sempre", desligado: "COMBATE.Settings.alvoAoClicar.desligado" }
  });

  // cada usuário
  reg("tema", "client", {
    type: String, default: "auto",
    choices: { auto: "COMBATE.Settings.tema.auto", escuro: "COMBATE.Settings.tema.escuro", claro: "COMBATE.Settings.tema.claro" }
  });
  reg("tamanhoBarra", "client", {
    type: String, default: "grande",
    choices: { normal: "COMBATE.Settings.tamanhoBarra.normal", grande: "COMBATE.Settings.tamanhoBarra.grande", enorme: "COMBATE.Settings.tamanhoBarra.enorme" }
  });
  reg("animacoes", "client", { type: Boolean, default: true });
  reg("anuncio", "client", { type: Boolean, default: true });

  // memória da interface (não aparece em lugar nenhum)
  game.settings.register(MOD, "barraMinimizada", { scope: "client", config: false, type: Boolean, default: false });
  game.settings.register(MOD, "aba", { scope: "client", config: false, type: String, default: "armas" });
  // onde o jogador arrastou a barra ({ left, bottom } em px; vazio = canto inferior esquerdo)
  game.settings.register(MOD, "posicaoBarra", { scope: "client", config: false, type: Object, default: {} });
}
