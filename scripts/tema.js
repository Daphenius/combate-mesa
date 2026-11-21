// ═══════════════════════════════════════════════════════════════════════════
//  Combate da Mesa — tema claro/escuro
//  No modo "Acompanhar o Foundry", usa o esquema de cores da interface que
//  cada usuário escolheu nas configurações do Foundry (ou o do sistema
//  operacional, se lá estiver no padrão do navegador). O CSS troca as cores
//  pela classe "cm-claro" no body.
// ═══════════════════════════════════════════════════════════════════════════

import { cfg } from "./core.js";

function foundryClaro() {
  let esquema = "";
  try { esquema = game.settings.get("core", "uiConfig")?.colorScheme?.interface ?? ""; } catch { /* sem a configuração */ }
  if (esquema === "light") return true;
  if (esquema === "dark") return false;
  const b = document.body.classList;
  if (b.contains("theme-light")) return true;
  if (b.contains("theme-dark")) return false;
  return matchMedia?.("(prefers-color-scheme: light)").matches ?? false;
}

export function aplicarTema() {
  const modo = cfg("tema") ?? "auto";
  const claro = modo === "claro" ? true : modo === "escuro" ? false : foundryClaro();
  if (document.body.classList.contains("cm-claro") !== claro) document.body.classList.toggle("cm-claro", claro);
}

export function instalarTema() {
  aplicarTema();
  // o Foundry troca a classe do body ao mudar o esquema de cores
  new MutationObserver(aplicarTema).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  Hooks.on("clientSettingChanged", key => { if (key === "core.uiConfig") setTimeout(aplicarTema, 0); });
  matchMedia?.("(prefers-color-scheme: light)").addEventListener?.("change", aplicarTema);
}
