// ═══════════════════════════════════════════════════════════════════════════
//  Combate da Mesa — modo de cartas: a mão (no lugar da hotbar)
//  Mostra as cartas do mesmo combatente que a barra de ações mostra.
//  Clique joga a carta; botão direito guarda a carta para o próximo turno.
// ═══════════════════════════════════════════════════════════════════════════

import { ApplicationV2, HandlebarsApplicationMixin, PATH, combateAtivo, debounceRender, loc } from "../core.js";
import { regras } from "./config.js";
import { composicao, estadoCartas, salvarCartas, usaCartas } from "./baralho.js";
import { jogarCarta, podeJogar } from "./efeitos.js";
import { infoCarta } from "./tipos.js";
import { cartaHTML } from "./visual.js";

export class MaoCartas extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "cm-mao-cartas",
    tag: "section",
    classes: ["cm-mao-cartas"],
    window: { frame: false, positioned: false },
    actions: { jogar: MaoCartas.#jogar }
  };

  static PARTS = { mao: { template: `${PATH}/templates/cartas/mao.hbs` } };

  /** @param {() => Combatant|null} alvo  quem a barra de ações está mostrando */
  constructor(alvo, options) {
    super(options);
    this.alvoBarra = alvo;
    this.agendar = debounceRender(this);
  }

  alvo() {
    const c = this.alvoBarra?.();
    return c && usaCartas(c) ? c : null;
  }

  atualizar() {
    const c = this.alvo();
    document.body.classList.toggle("cm-modo-cartas", !!c);
    if (c) this.render({ force: true });
    else if (this.rendered) this.close({ animate: false });
  }

  async _prepareContext() {
    const c = this.alvo();
    if (!c) return { vazio: true };
    const st = estadoCartas(c);
    const r = regras();
    const pode = podeJogar(c);
    const n = st.mao.length;
    const cartas = st.mao.map((carta, i) => {
      const info = infoCarta(carta);
      // leque: as cartas abrem a partir do centro
      const meio = (n - 1) / 2;
      const ang = n > 1 ? (i - meio) * Math.min(6, 30 / n) : 0;
      const desce = Math.abs(i - meio) * Math.abs(i - meio) * 2.5;
      return {
        uid: carta.uid,
        html: cartaHTML(info, { classes: st.guardada === carta.uid ? "guardada" : "" }),
        dica: `<strong>${foundry.utils.escapeHTML(info.nome)}</strong><br>${foundry.utils.escapeHTML(info.descricao)}`,
        estilo: `--ang:${ang}deg; --desce:${desce}px;`
      };
    });
    return {
      nome: c.token?.name ?? c.name,
      cartas,
      vaziaMao: !n,
      pode,
      monte: composicao(c.actor).length,
      armadilha: !!st.armadilha,
      armadilhaHTML: st.armadilha ? cartaHTML(infoCarta(st.armadilha), { mini: true, oculta: true }) : "",
      menos: Number(st.menos) || 0,
      mov: Number(st.mov) || 0,
      guardar: r.guardarCarta,
      dicaGuardar: loc("COMBATE.Cartas.mao.dicaGuardar")
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    // botão direito: guardar/soltar a carta para o próximo turno
    this.element.querySelectorAll(".cm-mao-carta").forEach(el => {
      el.addEventListener("contextmenu", ev => {
        ev.preventDefault();
        this.#guardar(el.dataset.uid);
      });
    });
  }

  async #guardar(uid) {
    const c = this.alvo();
    if (!c?.isOwner || !regras().guardarCarta) return;
    const st = estadoCartas(c);
    await salvarCartas(c, { guardada: st.guardada === uid ? null : uid });
  }

  static async #jogar(event, target) {
    const c = this.alvo();
    if (!c) return;
    if (!combateAtivo()) return;
    return jogarCarta(c, target.closest("[data-uid]")?.dataset.uid, event);
  }
}
