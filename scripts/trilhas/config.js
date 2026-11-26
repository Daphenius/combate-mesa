// Combate da Mesa — Trilhas (movimento no mapa de batalha): configurações.
// Este arquivo não importa o core.js de propósito: os testes em tests/trilhas
// rodam em Node, sem o Foundry.

export const MODULE_ID = "combate-mesa";

/** Nome da configuração no Foundry: tudo do Trilhas começa com "trilhas". */
export const chaveConfig = chave => `trilhas${chave[0].toUpperCase()}${chave.slice(1)}`;

/** Chaves (lógicas) das configurações, na ordem em que aparecem no painel. */
export const CHAVES = [
  "ativo", "desviarAoArrastar", "mostrarAlcance", "mostrarDobro", "corAlcance", "mostrarRestante",
  "colorirRegua", "npcLimitarTurno", "npcEvitarTokens", "atributoDeslocamento", "deslocamentoPadrao"
];

/** Lê uma configuração do Trilhas. */
export function config(chave) {
  return game.settings.get(MODULE_ID, chaveConfig(chave));
}

/** O Trilhas está ligado? (muda só depois de recarregar, porque estende classes do Foundry) */
export function trilhasAtivo() {
  try { return config("ativo") !== false; } catch { return true; }
}

/** Texto traduzido (chaves em lang/trilhas.*.json, prefixo TRILHAS). */
export function t(chave, dados) {
  const completa = `TRILHAS.${chave}`;
  return dados ? game.i18n.format(completa, dados) : game.i18n.localize(completa);
}

/**
 * Registra as configurações (fora da lista padrão: elas aparecem na seção
 * "Movimento" do painel do Combate da Mesa). `aoMudar` é chamado quando algo
 * que afeta o desenho muda.
 */
export function registrarConfiguracoes(aoMudar) {
  const registrar = (chave, dados) => game.settings.register(MODULE_ID, chaveConfig(chave), {
    name: `TRILHAS.Settings.${chave}.Name`,
    hint: `TRILHAS.Settings.${chave}.Hint`,
    config: false,
    ...dados
  });

  registrar("ativo", { scope: "world", type: Boolean, default: true, requiresReload: true });
  registrar("desviarAoArrastar", { scope: "world", type: Boolean, default: true });
  registrar("mostrarAlcance", {
    scope: "client",
    type: String,
    default: "combate",
    choices: {
      combate: "TRILHAS.Settings.mostrarAlcance.combate",
      sempre: "TRILHAS.Settings.mostrarAlcance.sempre",
      nunca: "TRILHAS.Settings.mostrarAlcance.nunca"
    },
    onChange: aoMudar
  });
  registrar("mostrarDobro", { scope: "client", type: Boolean, default: false, onChange: aoMudar });
  registrar("corAlcance", { scope: "client", type: String, default: "#3fa7ff", onChange: aoMudar });
  registrar("mostrarRestante", { scope: "client", type: Boolean, default: true });
  registrar("colorirRegua", { scope: "world", type: Boolean, default: true });
  registrar("atributoDeslocamento", { scope: "world", type: String, default: "", onChange: aoMudar });
  registrar("deslocamentoPadrao", { scope: "world", type: Number, default: 0, onChange: aoMudar });
  registrar("npcLimitarTurno", { scope: "world", type: Boolean, default: true });
  registrar("npcEvitarTokens", { scope: "world", type: Boolean, default: true });
}
