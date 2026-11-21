// ═══════════════════════════════════════════════════════════════════════════
//  Combate da Mesa — painel de configurações
//  Formulário ApplicationV2 aberto pelo botão nativo do módulo em
//  Configurações > Configurar Módulos (game.settings.registerMenu).
//  O mestre vê tudo; cada jogador vê só o que vale para ele.
// ═══════════════════════════════════════════════════════════════════════════

import { ApplicationV2, HandlebarsApplicationMixin, MOD, PATH, loc } from "./core.js";
import { SECOES } from "./settings.js";

function definicao(key) {
  return game.settings.settings.get(`${MOD}.${key}`);
}

function podeEditar(def) {
  return def.scope !== "world" || game.user.isGM;
}

export class ConfigMenu extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "cm-config",
    tag: "form",
    classes: ["cm-config"],
    window: { title: "COMBATE.Config.titulo", icon: "fa-solid fa-swords", contentClasses: ["cm-config-conteudo"] },
    position: { width: 640, height: "auto" },
    form: { handler: ConfigMenu.#salvar, closeOnSubmit: true },
    actions: { secao: ConfigMenu.#secao, padrao: ConfigMenu.#padrao }
  };

  static PARTS = { corpo: { template: `${PATH}/templates/config.hbs` } };

  #secaoAtiva = null;

  #campo(key) {
    const def = definicao(key);
    if (!def || !podeEditar(def)) return null;
    const valor = game.settings.get(MOD, key);
    const campo = {
      key, valor,
      nome: loc(def.name), dica: def.hint ? loc(def.hint) : "",
      mundo: def.scope === "world",
      recarrega: !!def.requiresReload
    };
    if (def.choices) {
      campo.tipo = "opcoes";
      campo.opcoes = Object.entries(def.choices).map(([v, rotulo]) => ({ valor: v, rotulo: loc(rotulo), marcado: v === valor }));
    } else if (def.type === Boolean) campo.tipo = "chave";
    else if (def.type === Number) campo.tipo = "numero";
    else campo.tipo = "texto";
    return campo;
  }

  async _prepareContext() {
    const secoes = SECOES.map(s => ({
      ...s,
      nome: loc(`COMBATE.Config.secao.${s.id}.nome`),
      descricao: loc(`COMBATE.Config.secao.${s.id}.descricao`),
      campos: s.chaves.map(k => this.#campo(k)).filter(Boolean)
    })).filter(s => s.campos.length);
    if (!secoes.some(s => s.id === this.#secaoAtiva)) this.#secaoAtiva = secoes[0]?.id ?? null;
    for (const s of secoes) s.ativa = s.id === this.#secaoAtiva;
    return { secoes, isGM: game.user.isGM };
  }

  // Troca de seção sem redesenhar (mantém o que já foi mexido no formulário)
  static #secao(event, target) {
    this.#secaoAtiva = target.dataset.secao;
    for (const el of this.element.querySelectorAll("[data-secao]")) {
      el.classList.toggle("ativa", el.dataset.secao === this.#secaoAtiva);
    }
  }

  // Volta os campos visíveis ao padrão (ainda precisa salvar)
  static #padrao() {
    for (const s of SECOES) for (const key of s.chaves) {
      const def = definicao(key);
      if (!def || !podeEditar(def)) continue;
      const campos = this.element.querySelectorAll(`[name="${key}"]`);
      for (const el of campos) {
        if (el.type === "checkbox") el.checked = !!def.default;
        else if (el.type === "radio") el.checked = el.value === String(def.default);
        else el.value = def.default ?? "";
      }
    }
    ui.notifications.info(loc("COMBATE.Config.padraoAviso"));
  }

  static async #salvar(event, form, formData) {
    const dados = formData.object;
    let recarregar = false;
    for (const s of SECOES) for (const key of s.chaves) {
      const def = definicao(key);
      if (!def || !podeEditar(def) || !(key in dados || def.type === Boolean)) continue;
      let valor = dados[key];
      if (def.type === Boolean) valor = !!valor;
      else if (def.type === Number) valor = Number(valor);
      if (valor === game.settings.get(MOD, key)) continue;
      await game.settings.set(MOD, key, valor);
      if (def.requiresReload) recarregar = true;
    }
    if (!recarregar) return;
    const SettingsConfig = foundry.applications.settings?.SettingsConfig;
    if (SettingsConfig?.reloadConfirm) await SettingsConfig.reloadConfirm({ world: true });
    else ui.notifications.warn(loc("COMBATE.Config.recarregar"));
  }
}

export function registrarMenu() {
  game.settings.registerMenu(MOD, "painel", {
    name: "COMBATE.Config.menu.Name",
    label: "COMBATE.Config.menu.Label",
    hint: "COMBATE.Config.menu.Hint",
    icon: "fa-solid fa-sliders",
    type: ConfigMenu,
    restricted: false
  });
}
