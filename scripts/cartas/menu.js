// ═══════════════════════════════════════════════════════════════════════════
//  Combate da Mesa — modo de cartas: menu do mestre
//  ApplicationV2 com abas nativas (templates/generic/tab-navigation.hbs) e
//  rodapé nativo. Duas abas: Cartas por personagem e Cartas personalizadas
//  (com efeito de item da ficha ou de macro do mestre). As regras ficam na
//  seção "Cartas" do painel de configurações do módulo.
// ═══════════════════════════════════════════════════════════════════════════

import { ApplicationV2, HandlebarsApplicationMixin, MOD, PATH, loc } from "../core.js";
import { cartasCustom, quantidadesAtores } from "./config.js";
import { IDS_TIPOS, TIPOS, quantidadeAuto } from "./tipos.js";

const PARA = ["todos", "pj", "npc", "classe", "atores"];
const EFEITO = ["chat", "item", "macro"];

export class MenuCartas extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "cmb-menu-cartas",
    tag: "form",
    classes: ["cmb-menu-cartas"],
    window: { title: "COMBATE.Cartas.Menu.titulo", icon: "fa-solid fa-layer-group", resizable: true },
    position: { width: 720, height: 680 },
    form: { handler: MenuCartas.#salvar, closeOnSubmit: true, submitOnChange: false },
    actions: {
      novaCarta: MenuCartas.#novaCarta,
      apagarCarta: MenuCartas.#apagarCarta,
      limparAtor: MenuCartas.#limparAtor
    }
  };

  static PARTS = {
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    personagens: { template: `${PATH}/templates/cartas/menu-personagens.hbs`, scrollable: [""] },
    personalizadas: { template: `${PATH}/templates/cartas/menu-personalizadas.hbs`, scrollable: [""] },
    footer: { template: "templates/generic/form-footer.hbs" }
  };

  static TABS = {
    primary: {
      tabs: [
        { id: "personagens", icon: "fa-solid fa-users" },
        { id: "personalizadas", icon: "fa-solid fa-wand-sparkles" }
      ],
      initial: "personagens",
      labelPrefix: "COMBATE.Cartas.Menu.aba"
    }
  };

  // rascunho: edições ainda não salvas (para não perder ao adicionar/remover cartas)
  #rascunho = null;

  #dados() {
    if (this.#rascunho) return this.#rascunho;
    return {
      atores: foundry.utils.deepClone(quantidadesAtores()),
      custom: foundry.utils.deepClone(cartasCustom())
    };
  }

  #lerForm() {
    const fd = new foundry.applications.ux.FormDataExtended(this.element).object;
    const d = foundry.utils.expandObject(fd);
    const atores = {};
    for (const [id, q] of Object.entries(d.atores ?? {})) {
      const limpo = {};
      for (const [k, v] of Object.entries(q ?? {})) if (Number.isFinite(v)) limpo[k] = Math.max(0, Math.min(20, Math.floor(v)));
      if (Object.keys(limpo).length) atores[id] = limpo;
    }
    const custom = Object.values(d.custom ?? {}).map(c => ({
      id: c.id || foundry.utils.randomID(),
      nome: String(c.nome ?? "").trim(),
      img: c.img || "",
      descricao: String(c.descricao ?? "").trim(),
      efeito: EFEITO.includes(c.efeito) ? c.efeito : "chat",
      item: String(c.item ?? "").trim(),
      macro: String(c.macro ?? "").trim(),
      gratis: !!c.gratis,
      quantidade: Number.isFinite(c.quantidade) ? Math.max(0, Math.min(20, Math.floor(c.quantidade))) : 1,
      para: PARA.includes(c.para) ? c.para : "todos",
      classe: String(c.classe ?? "").trim().toLowerCase(),
      atores: Array.isArray(c.atores) ? c.atores : (c.atores ? [c.atores] : [])
    }));
    return { atores, custom };
  }

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const d = this.#dados();
    const tipos = IDS_TIPOS.map(id => ({ id, icone: TIPOS[id].icone, nome: loc(`COMBATE.Cartas.tipo.${id}.nome`) }));

    const linha = (chave, nome, img, actor) => ({
      chave, nome, img,
      tipos: tipos.map(t => ({
        ...t,
        valor: d.atores[chave]?.[t.id] ?? "",
        auto: actor ? quantidadeAuto(actor, t.id) : loc("COMBATE.Cartas.Menu.auto")
      })),
      alterado: !!d.atores[chave] && Object.keys(d.atores[chave]).length > 0
    });
    const personagens = [
      linha("_pj", loc("COMBATE.Cartas.Menu.padraoPJ"), "icons/svg/mystery-man.svg", null),
      linha("_npc", loc("COMBATE.Cartas.Menu.padraoNPC"), "icons/svg/skull.svg", null),
      ...game.actors.filter(a => a.type === "character").sort((a, b) => a.name.localeCompare(b.name))
        .map(a => linha(a.id, a.name, a.img, a))
    ];

    const atoresOpcoes = Object.fromEntries(game.actors.contents
      .sort((a, b) => a.name.localeCompare(b.name)).map(a => [a.id, a.name]));
    const custom = d.custom.map((c, i) => ({
      ...c, i,
      efeitos: Object.fromEntries(EFEITO.map(e => [e, loc(`COMBATE.Cartas.Menu.efeito.${e}`)])),
      paras: Object.fromEntries(PARA.map(p => [p, loc(`COMBATE.Cartas.Menu.para.${p}`)])),
      atoresOpcoes,
      ehItem: c.efeito === "item", ehMacro: c.efeito === "macro",
      ehClasse: c.para === "classe", ehAtores: c.para === "atores"
    }));

    return {
      ...ctx,
      tabs: this._prepareTabs("primary"),
      modoCartas: !!game.settings.get(MOD, "modoCartas"),
      personagens,
      tipos,
      custom,
      buttons: [{ type: "submit", icon: "fa-solid fa-floppy-disk", label: "COMBATE.Cartas.Menu.salvar" }]
    };
  }

  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    if (context.tabs?.[partId]) context.tab = context.tabs[partId];
    return context;
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    // mudar o "efeito" ou "para quem" mostra/esconde os campos certos
    this.element.querySelectorAll("[data-recarregar]").forEach(el => el.addEventListener("change", () => {
      this.#rascunho = this.#lerForm();
      this.render();
    }));
    // soltar uma macro da barra ou do diretório no campo de macro
    this.element.querySelectorAll("input[data-macro]").forEach(el => {
      el.addEventListener("dragover", ev => ev.preventDefault());
      el.addEventListener("drop", ev => {
        ev.preventDefault();
        const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(ev);
        if (data?.type === "Macro" && data.uuid) el.value = data.uuid;
      });
    });
  }

  static async #novaCarta() {
    const d = this.#lerForm();
    d.custom.push({
      id: foundry.utils.randomID(), nome: loc("COMBATE.Cartas.Menu.novaNome"), img: "", descricao: "",
      efeito: "macro", item: "", macro: "", gratis: false, quantidade: 1, para: "todos", classe: "", atores: []
    });
    this.#rascunho = d;
    await this.render();
    this.changeTab?.("personalizadas", "primary");
  }

  static async #apagarCarta(event, target) {
    const d = this.#lerForm();
    d.custom.splice(Number(target.dataset.indice), 1);
    this.#rascunho = d;
    this.render();
  }

  static async #limparAtor(event, target) {
    const d = this.#lerForm();
    delete d.atores[target.dataset.chave];
    this.#rascunho = d;
    this.render();
  }

  static async #salvar() {
    const d = this.#lerForm();
    await game.settings.set(MOD, "cartasAtores", d.atores);
    await game.settings.set(MOD, "cartasCustom", { lista: d.custom });
    this.#rascunho = null;
    ui.notifications.info(loc("COMBATE.Cartas.Menu.salvo"));
  }
}
