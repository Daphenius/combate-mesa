// ═══════════════════════════════════════════════════════════════════════════
//  Combate da Mesa — menu do mestre: ataques por personagem
//  Ataques por ação (Ataque Extra) e a habilidade Ataques múltiplos de cada
//  personagem, com padrões para PJs e NPCs. ApplicationV2 + rodapé nativo.
// ═══════════════════════════════════════════════════════════════════════════

import { ApplicationV2, HandlebarsApplicationMixin, MOD, PATH, loc } from "./core.js";
import { RECARGAS, configAtores } from "./ataques.js";
import { numeroAtaques } from "./cartas/tipos.js";

const CAMPOS = ["porAcao", "usos", "extras"];

export class MenuAtaques extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "cmb-menu-ataques",
    tag: "form",
    classes: ["cmb-menu-ataques", "cmb-menu-cartas"],
    window: { title: "COMBATE.Ataques.menu.titulo", icon: "fa-solid fa-khanda", resizable: true },
    position: { width: 700, height: 640 },
    form: { handler: MenuAtaques.#salvar, closeOnSubmit: true, submitOnChange: false },
    actions: { limparAtor: MenuAtaques.#limparAtor }
  };

  static PARTS = {
    corpo: { template: `${PATH}/templates/menu-ataques.hbs`, scrollable: [".cmb-menu-lista"] },
    footer: { template: "templates/generic/form-footer.hbs" }
  };

  #rascunho = null;

  #lerForm() {
    const fd = new foundry.applications.ux.FormDataExtended(this.element).object;
    const d = foundry.utils.expandObject(fd);
    const atores = {};
    for (const [id, q] of Object.entries(d.atores ?? {})) {
      const limpo = {};
      for (const k of CAMPOS) {
        const v = q?.[k];
        if (v !== "" && v !== null && v !== undefined && Number.isFinite(Number(v))) limpo[k] = Math.max(0, Math.min(20, Math.floor(Number(v))));
      }
      if (RECARGAS.includes(q?.recarga)) limpo.recarga = q.recarga;
      if (Object.keys(limpo).length) atores[id] = limpo;
    }
    return atores;
  }

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const d = this.#rascunho ?? foundry.utils.deepClone(configAtores());
    const recargas = r => [{ valor: "", rotulo: loc("COMBATE.Ataques.menu.padrao"), marcado: !r },
      ...RECARGAS.map(v => ({ valor: v, rotulo: loc(`COMBATE.Ataques.recarga.${v}`), marcado: v === r }))];
    const linha = (chave, nome, img, actor) => {
      const v = d[chave] ?? {};
      return {
        chave, nome, img,
        porAcao: v.porAcao ?? "", usos: v.usos ?? "", extras: v.extras ?? "",
        autoPorAcao: actor ? Math.max(1, numeroAtaques(actor) || 1) : loc("COMBATE.Ataques.menu.auto"),
        recargas: recargas(v.recarga),
        alterado: Object.keys(v).length > 0
      };
    };
    const personagens = [
      linha("_pj", loc("COMBATE.Ataques.menu.padraoPJ"), "icons/svg/mystery-man.svg", null),
      linha("_npc", loc("COMBATE.Ataques.menu.padraoNPC"), "icons/svg/skull.svg", null),
      ...game.actors.filter(a => a.type === "character").sort((a, b) => a.name.localeCompare(b.name))
        .map(a => linha(a.id, a.name, a.img, a))
    ];
    return {
      ...ctx,
      personagens,
      buttons: [{ type: "submit", icon: "fa-solid fa-floppy-disk", label: "COMBATE.Ataques.menu.salvar" }]
    };
  }

  static async #limparAtor(event, target) {
    const d = this.#lerForm();
    delete d[target.dataset.chave];
    this.#rascunho = d;
    this.render();
  }

  static async #salvar() {
    await game.settings.set(MOD, "ataquesAtores", this.#lerForm());
    this.#rascunho = null;
    ui.notifications.info(loc("COMBATE.Ataques.menu.salvo"));
  }
}
