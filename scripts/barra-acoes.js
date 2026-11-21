// ═══════════════════════════════════════════════════════════════════════════
//  Combate da Mesa — barra de ações (canto inferior)
//  Selos da economia do 5e no topo; cartas de ação embaixo. Cada carta chama
//  o uso nativo do item no dnd5e (item.use), então rolagens, espaços de magia,
//  munição e cartões de chat continuam sendo do sistema.
// ═══════════════════════════════════════════════════════════════════════════

import { ApplicationV2, HandlebarsApplicationMixin, MOD, PATH, cfg, combateAtivo, debounceRender, imagemDe, loc, tokenNoMapa } from "./core.js";
import { ACOES_BASICAS, usarAcaoBasica } from "./acoes-basicas.js";
import { alternar, deslocamento, estado, movido, seloDoItem } from "./economia.js";
import { movimentoExtra, usaCartas } from "./cartas/index.js";

const ABAS = [
  { id: "armas", icone: "fa-solid fa-khanda" },
  { id: "magias", icone: "fa-solid fa-hat-wizard" },
  { id: "habilidades", icone: "fa-solid fa-star" },
  { id: "itens", icone: "fa-solid fa-flask" },
  { id: "basicas", icone: "fa-solid fa-person-running" }
];

const SELO_ICONE = {
  acao: "fa-solid fa-diamond",
  bonus: "fa-solid fa-play",
  reacao: "fa-solid fa-rotate-left"
};

// Tooltip rico do próprio dnd5e (o mesmo da ficha)
function tooltipItem(item) {
  return `<section class="loading" data-uuid="${item.uuid}"><i class="fas fa-spinner fa-spin-pulse"></i></section>`;
}

function usos(item) {
  const u = item.system?.uses;
  if (u?.max) return `${u.value ?? 0}/${u.max}`;
  if (item.type === "consumable" && Number(item.system?.quantity) > 1) return `×${item.system.quantity}`;
  return null;
}

function temAtividade(item) {
  return (item.system?.activities?.size ?? 0) > 0;
}

function magiaDisponivel(item) {
  const s = item.system;
  if (!s) return false;
  if (!s.canPrepare) return true;
  return (s.prepared ?? 0) > 0;
}

export class BarraAcoes extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "cmb-barra-acoes",
    tag: "section",
    classes: ["cmb-barra-acoes"],
    window: { frame: false, positioned: false },
    actions: {
      usarItem: BarraAcoes.#usarItem,
      usarBasica: BarraAcoes.#usarBasica,
      aba: BarraAcoes.#aba,
      selo: BarraAcoes.#selo,
      minimizar: BarraAcoes.#minimizar,
      terminarTurno: BarraAcoes.#terminarTurno,
      abrirFicha: BarraAcoes.#abrirFicha
    }
  };

  static PARTS = { barra: { template: `${PATH}/templates/barra-acoes.hbs` } };

  constructor(options) {
    super(options);
    this.agendar = debounceRender(this);
  }

  // Quem a barra mostra:
  // mestre → o combatente da vez, se não for de um jogador (os NPCs dele);
  // jogador → o da vez, se for dele; senão o token dele selecionado; senão o primeiro dele no combate.
  alvo() {
    const combat = combateAtivo();
    if (!combat) return null;
    const atual = combat.combatant;
    if (game.user.isGM) return atual?.actor && !atual.hasPlayerOwner ? atual : null;
    if (atual?.isOwner && atual.actor) return atual;
    const meus = combat.combatants.filter(c => c.isOwner && c.actor && !c.isDefeated);
    const controlados = new Set(canvas.tokens?.controlled.map(t => t.id) ?? []);
    return meus.find(c => controlados.has(c.tokenId)) ?? meus.find(c => c.actorId === game.user.character?.id) ?? meus[0] ?? null;
  }

  deveAparecer() {
    return !!cfg("barraAcoes") && !!this.alvo();
  }

  atualizar() {
    const combate = !!combateAtivo();
    document.body.classList.toggle("cmb-em-combate", combate);
    document.body.classList.toggle("cmb-sem-hotbar", combate && !!cfg("esconderHotbar"));
    if (this.deveAparecer()) this.render({ force: true });
    else if (this.rendered) this.close({ animate: false });
  }

  #cartasItens(actor, aba, gastos) {
    const lista = [];
    for (const item of actor.items) {
      if (!temAtividade(item)) continue;
      const t = item.type;
      let entra = false;
      if (aba === "armas") entra = t === "weapon" && (item.system.equipped || actor.type !== "character");
      else if (aba === "magias") entra = t === "spell" && magiaDisponivel(item);
      else if (aba === "habilidades") entra = t === "feat";
      else if (aba === "itens") entra = ["consumable", "equipment", "tool", "loot"].includes(t);
      if (!entra) continue;
      const selo = seloDoItem(item);
      lista.push({
        id: item.id,
        nome: item.name,
        img: item.img,
        selo,
        seloIcone: SELO_ICONE[selo] ?? "fa-solid fa-hourglass",
        seloNome: selo ? loc(`COMBATE.Selo.${selo}`) : loc("COMBATE.Selo.especial"),
        usos: usos(item),
        nivel: t === "spell" ? (item.system.level ?? 0) : null,
        esgotado: (selo && gastos[selo]) || (item.system.uses?.max && !item.system.uses.value),
        tooltip: tooltipItem(item)
      });
    }
    const ordem = { acao: 0, bonus: 1, reacao: 2 };
    lista.sort((a, b) => ((a.nivel ?? 0) - (b.nivel ?? 0)) || ((ordem[a.selo] ?? 3) - (ordem[b.selo] ?? 3)) || a.nome.localeCompare(b.nome));
    return lista;
  }

  // Magias agrupadas por círculo, com os espaços de magia de cada um
  #gruposMagia(actor, cartas) {
    const grupos = new Map();
    for (const c of cartas) {
      const n = c.nivel ?? 0;
      if (!grupos.has(n)) {
        const slot = actor.system?.spells?.[`spell${n}`];
        grupos.set(n, {
          nivel: n,
          rotulo: n === 0 ? loc("COMBATE.Barra.truques") : loc("COMBATE.Barra.circulo", { n }),
          espacos: n > 0 && slot?.max ? Array.from({ length: slot.max }, (_, i) => ({ cheio: i < (slot.value ?? 0) })) : null,
          cartas: []
        });
      }
      grupos.get(n).cartas.push(c);
    }
    return [...grupos.values()].sort((a, b) => a.nivel - b.nivel);
  }

  async _prepareContext() {
    const c = this.alvo();
    if (!c) return { vazio: true };
    const actor = c.actor;
    const combat = combateAtivo();
    const gastos = estado(c);
    const aba = ABAS.some(a => a.id === cfg("aba")) ? cfg("aba") : "armas";
    const seuTurno = combat?.combatant?.id === c.id;

    const desl = deslocamento(actor);
    const modoCartas = usaCartas(c);
    // cartas Mover/Disparada somam deslocamentos extras
    const total = desl.total * ((gastos.disparada ? 2 : 1) + movimentoExtra(c));
    const andou = movido(c.token);
    const mov = total ? {
      total, andou: Math.min(andou, total), resta: Math.max(0, Math.round((total - andou) * 10) / 10),
      pct: Math.max(0, Math.min(100, Math.round((1 - andou / total) * 100))), unidade: desl.unidade, disparada: gastos.disparada
    } : null;

    const selos = ["acao", "bonus", "reacao"].map(s => ({
      id: s, icone: SELO_ICONE[s], nome: loc(`COMBATE.Selo.${s}`), curto: loc(`COMBATE.SeloCurto.${s}`), gasto: gastos[s]
    }));

    let cartas = [], grupos = null, basicas = null;
    if (modoCartas) {
      // a mão de cartas (cartas/mao.js) toma o lugar das abas
    } else if (aba === "basicas") {
      basicas = ACOES_BASICAS.map(a => ({
        ...a, nome: loc(`COMBATE.Basica.${a.id}.nome`), dica: loc(`COMBATE.Basica.${a.id}.dica`),
        seloIcone: SELO_ICONE[a.selo], esgotado: gastos[a.selo]
      }));
    } else {
      cartas = this.#cartasItens(actor, aba, gastos);
      if (aba === "magias") grupos = this.#gruposMagia(actor, cartas);
    }

    return {
      modoCartas,
      minimizada: !!cfg("barraMinimizada"),
      nome: c.name,
      img: imagemDe(c),
      seuTurno,
      podeTerminar: seuTurno && c.isOwner,
      selos,
      mov,
      abas: ABAS.map(a => ({ ...a, nome: loc(`COMBATE.Aba.${a.id}`), ativa: a.id === aba })),
      aba,
      cartas,
      grupos,
      basicas,
      vazioAba: !modoCartas && aba !== "basicas" && !cartas.length
    };
  }

  // ───────────────────────── Ações ─────────────────────────

  static async #usarItem(event, target) {
    const c = this.alvo();
    const item = c?.actor?.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    if (!item) return;
    // garante que o token do personagem é o selecionado (as rolagens usam ele como orador)
    const token = tokenNoMapa(c);
    if (token && !token.controlled && c.isOwner) token.control({ releaseOthers: true });
    return item.use({ event });
  }

  static async #usarBasica(event, target) {
    const c = this.alvo();
    if (!c?.actor) return;
    return usarAcaoBasica(target.dataset.acao, { actor: c.actor, combatant: c, token: tokenNoMapa(c), event });
  }

  static async #aba(event, target) {
    await game.settings.set(MOD, "aba", target.dataset.aba);
    this.render();
  }

  // Clique num selo: marca/desmarca à mão (para ajustes da mesa)
  static async #selo(event, target) {
    const c = this.alvo();
    if (c?.isOwner) await alternar(c, target.dataset.selo);
  }

  static async #minimizar() {
    await game.settings.set(MOD, "barraMinimizada", !cfg("barraMinimizada"));
    this.render();
  }

  static #terminarTurno() { return combateAtivo()?.nextTurn(); }

  static #abrirFicha() { return this.alvo()?.actor?.sheet?.render(true); }
}
