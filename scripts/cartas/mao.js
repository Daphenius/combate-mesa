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
    id: "cmb-mao-cartas",
    tag: "section",
    classes: ["cmb-mao-cartas"],
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
    document.body.classList.toggle("cmb-modo-cartas", !!c);
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
        html: cartaHTML(info),
        dica: `<strong>${foundry.utils.escapeHTML(info.nome)}</strong><br>${foundry.utils.escapeHTML(info.descricao)}`,
        estilo: `--ang:${ang}deg; --desce:${desce}px;`
      };
    });
    return {
      nome: c.token?.name ?? c.name,
      cartas,
      vaziaMao: !n,
      pode,
      monte: composicao(c.actor, st.usadas).length,
      armadilhaHTML: st.armadilha ? cartaHTML(infoCarta(st.armadilha), { mini: true, oculta: true }) : "",
      defesas: st.defesa.map(d => {
        const info = infoCarta(d);
        const esc = foundry.utils.escapeHTML;
        return {
          html: cartaHTML(info, { mini: true }),
          dica: `<strong>${esc(info.nome)}</strong>${d.alvo ? ` → ${esc(d.alvo)}` : ""}<br>${esc(info.descricao)}<br><em>${esc(loc("COMBATE.Cartas.mao.ateTurno"))}</em>`
        };
      }),
      menos: Number(st.menos) || 0,
      mov: Number(st.mov) || 0,
      guardar: r.guardarCarta,
      guardadaHTML: st.guardada?.tipo ? cartaHTML(infoCarta(st.guardada), { mini: true }) : "",
      guardadaDica: st.guardada?.tipo ? `<strong>${foundry.utils.escapeHTML(infoCarta(st.guardada).nome)}</strong><br>${foundry.utils.escapeHTML(loc("COMBATE.Cartas.mao.guardadaVolta"))}` : loc("COMBATE.Cartas.mao.zonaGuardadaDica"),
      dicaGuardar: loc("COMBATE.Cartas.mao.dicaGuardar")
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    // botão direito numa carta da mão: vai para o campo "Guardada"
    this.element.querySelectorAll(".cmb-mao-carta").forEach(el => {
      el.addEventListener("contextmenu", ev => {
        ev.preventDefault();
        this.#guardar(el.dataset.uid);
      });
    });
    // clique na carta guardada: volta para a mão
    this.element.querySelector(".cmb-zona.guardada .cmb-zona-carta")?.addEventListener("click", () => this.#devolver());
  }

  // Leva a carta para o campo "Guardada" (se já tinha uma, a antiga volta para a mão)
  async #guardar(uid) {
    const c = this.alvo();
    if (!c?.isOwner || !regras().guardarCarta) return;
    const st = estadoCartas(c);
    const carta = st.mao.find(x => x.uid === uid);
    if (!carta) return;
    const antiga = st.guardada?.tipo ? [st.guardada] : [];
    await salvarCartas(c, { mao: [...st.mao.filter(x => x.uid !== uid), ...antiga], guardada: carta });
  }

  async #devolver() {
    const c = this.alvo();
    if (!c?.isOwner) return;
    const st = estadoCartas(c);
    if (!st.guardada?.tipo) return;
    await salvarCartas(c, { mao: [...st.mao, st.guardada], guardada: null });
  }

  static async #jogar(event, target) {
    const c = this.alvo();
    if (!c) return;
    if (!combateAtivo()) return;
    return jogarCarta(c, target.closest("[data-uid]")?.dataset.uid, event);
  }
}
