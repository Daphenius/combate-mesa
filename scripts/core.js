// ═══════════════════════════════════════════════════════════════════════════
//  Combate da Mesa — utilidades comuns
//  Módulo Foundry VTT V14, sistema dnd5e 6
// ═══════════════════════════════════════════════════════════════════════════

export const MOD = "combate-mesa";
export const PATH = `modules/${MOD}`;

export const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// Texto no idioma do usuário; {nome} é trocado pelo valor em data.
export function loc(key, data) {
  const s = game.i18n?.localize?.(key) ?? key;
  if (!data) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => Object.hasOwn(data, k) ? String(data[k] ?? "") : m);
}

export function cfg(key) {
  try { return game.settings.get(MOD, key); } catch { return undefined; }
}

// Só um mestre grava dados compartilhados (evita gravação dobrada com dois mestres on-line).
export const isActiveGM = () => !!game.users.activeGM?.isSelf;

// Combate em andamento na cena que o usuário está vendo.
export function combateAtivo() {
  const c = game.combat;
  return c?.started ? c : null;
}

// Combatente de um ator no combate (compara pelo uuid: atores de token não vinculado são sintéticos).
export function combatenteDoAtor(actor, combat = combateAtivo()) {
  if (!actor || !combat) return null;
  return combat.combatants.find(c => c.actor?.uuid === actor.uuid) ?? null;
}

// O token no mapa atual de um combatente (ou null se ele está em outra cena).
export function tokenNoMapa(combatant) {
  const t = combatant?.token?.object;
  return t && t.scene === canvas.scene ? t : null;
}

// Imagem do combatente: retrato da ficha (padrão) ou imagem do token, conforme a configuração.
// Sem retrato próprio (ícone genérico do Foundry), usa a do token.
export function imagemDe(combatant) {
  const token = combatant?.img;
  if (cfg("imagem") === "token") return token;
  const retrato = combatant?.actor?.img;
  if (!retrato || retrato === CONST.DEFAULT_TOKEN || retrato.includes("mystery-man")) return token;
  return retrato;
}

export function esc(s) {
  return foundry.utils.escapeHTML(String(s ?? ""));
}

// Agenda um redesenho só (várias mudanças seguidas viram uma).
export function debounceRender(app, ms = 60) {
  return foundry.utils.debounce(() => app.atualizar(), ms);
}

// Respeita "reduzir movimento" do sistema operacional e o modo de desempenho "Baixo" do Foundry.
export function movimentoReduzido() {
  if (matchMedia?.("(prefers-reduced-motion: reduce)").matches) return true;
  let modo = null;
  try { modo = game.settings.get("core", "performanceMode"); } catch { /* sem a configuração */ }
  modo ??= canvas?.performance?.mode;
  return Number.isInteger(modo) && modo <= (CONST.CANVAS_PERFORMANCE_MODES?.LOW ?? 0);
}
