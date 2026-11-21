// ═══════════════════════════════════════════════════════════════════════════
//  Combate da Mesa — linha do tempo de iniciativa (topo da tela)
//  ApplicationV2 sem moldura. Quem joga agora vem primeiro; depois os
//  próximos e, após o selo da próxima rodada, quem já jogou.
// ═══════════════════════════════════════════════════════════════════════════

import { ApplicationV2, HandlebarsApplicationMixin, PATH, cfg, combateAtivo, debounceRender, esc, imagemDe, loc, tokenNoMapa } from "./core.js";

const D = () => CONST.TOKEN_DISPOSITIONS;

function classeDisposicao(c) {
  const d = c.token?.disposition;
  if (d === D().FRIENDLY) return "amigo";
  if (d === D().HOSTILE) return "hostil";
  if (d === D().SECRET) return "secreto";
  return "neutro";
}

// Vida de quem o usuário não controla: descrição em vez de número
function estadoVida(pct) {
  if (pct <= 0) return "caido";
  if (pct <= 25) return "critico";
  if (pct <= 50) return "sangrando";
  if (pct < 100) return "ferido";
  return "ileso";
}

export class LinhaTempo extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "cmb-linha-tempo",
    tag: "aside",
    classes: ["cmb-linha-tempo"],
    window: { frame: false, positioned: false },
    actions: {
      focar: LinhaTempo.#focar,
      anterior: LinhaTempo.#anterior,
      proximo: LinhaTempo.#proximo,
      terminarTurno: LinhaTempo.#terminarTurno
    }
  };

  static PARTS = { linha: { template: `${PATH}/templates/linha-tempo.hbs` } };

  constructor(options) {
    super(options);
    this.agendar = debounceRender(this);
  }

  deveAparecer() {
    return !!cfg("linhaTempo") && !!combateAtivo();
  }

  atualizar() {
    if (this.deveAparecer()) this.render({ force: true });
    else if (this.rendered) this.close({ animate: false });
  }

  #combatente(c, combat) {
    const actor = c.actor;
    const hp = actor?.system?.attributes?.hp;
    const max = Math.max(1, Number(hp?.effectiveMax ?? hp?.max) || 1);
    const pct = hp ? Math.max(0, Math.min(100, Math.round((Number(hp.value) || 0) / max * 100))) : null;
    const disp = classeDisposicao(c);
    const dono = c.isOwner;
    const modoVida = cfg("vidaInimigos");
    const ehInimigo = !dono && disp !== "amigo";
    let vida = null;
    if (pct !== null) {
      if (dono) vida = { pct, texto: `${hp.value}/${max}${hp.temp ? ` (+${hp.temp})` : ""}`, estado: estadoVida(pct) };
      else if (!ehInimigo || modoVida === "barra") vida = { pct, estado: estadoVida(pct) };
      else if (modoVida === "descricao") vida = { estado: estadoVida(pct), descricao: loc(`COMBATE.Vida.${estadoVida(pct)}`) };
    }
    const efeitos = (actor?.temporaryEffects ?? [])
      .filter(e => e.img && !e.disabled)
      .slice(0, 3)
      .map(e => ({ img: e.img, nome: e.name }));
    const mostrarIni = dono || game.user.isGM || !ehInimigo || cfg("iniciativaInimigos");
    const iniciativa = mostrarIni && Number.isFinite(c.initiative) ? String(c.initiative) : null;
    // Tudo o que não precisa ficar na tela vai para a dica ao passar o mouse
    const detalhes = [
      iniciativa !== null ? loc("COMBATE.Linha.dicaIniciativa", { n: iniciativa }) : null,
      vida?.texto ? loc("COMBATE.Linha.dicaVida", { pv: vida.texto }) : vida ? loc(`COMBATE.Vida.${vida.estado}`) : null
    ].filter(Boolean).join(" · ");
    const tooltip = `<strong>${esc(c.name)}</strong>${detalhes ? `<br>${esc(detalhes)}` : ""}`
      + (efeitos.length ? `<br><em>${efeitos.map(e => esc(e.nome)).join(", ")}</em>` : "");
    return {
      tooltip,
      id: c.id,
      nome: c.name,
      img: imagemDe(c),
      disp,
      ativo: c.id === combat.combatant?.id,
      derrotado: c.isDefeated,
      oculto: c.hidden,
      iniciativa,
      vida,
      efeitos,
      concentrando: actor?.statuses?.has?.("concentrating") ?? false
    };
  }

  async _prepareContext() {
    const combat = combateAtivo();
    if (!combat) return { vazio: true };
    const visiveis = combat.turns.filter(c => game.user.isGM || c.visible);
    const idx = Math.max(0, visiveis.findIndex(c => c.id === combat.combatant?.id));
    const agora = visiveis.slice(idx).map(c => this.#combatente(c, combat));
    const depois = visiveis.slice(0, idx).map(c => this.#combatente(c, combat));
    const meu = combat.combatant?.isOwner ?? false;
    return {
      rodada: combat.round,
      proximaRodada: combat.round + 1,
      agora,
      depois,
      podeControlar: game.user.isGM,
      podeTerminar: meu && !game.user.isGM
    };
  }

  static #focar(event, target) {
    const combat = combateAtivo();
    const c = combat?.combatants.get(target.closest("[data-id]")?.dataset.id);
    const token = tokenNoMapa(c);
    if (!token?.visible) return;
    canvas.animatePan({ x: token.center.x, y: token.center.y, duration: 300 });
    if (c.isOwner) token.control({ releaseOthers: !event.shiftKey });
  }

  static #anterior() { return combateAtivo()?.previousTurn(); }
  static #proximo() { return combateAtivo()?.nextTurn(); }
  static #terminarTurno() { return combateAtivo()?.nextTurn(); }
}
