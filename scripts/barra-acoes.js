// ═══════════════════════════════════════════════════════════════════════════
//  Combate da Mesa — barra de ações (canto inferior)
//  Selos da economia do 5e no topo; cartas de ação embaixo. Cada carta chama
//  o uso nativo do item no dnd5e (item.use), então rolagens, espaços de magia,
//  munição e cartões de chat continuam sendo do sistema.
// ═══════════════════════════════════════════════════════════════════════════

import { ApplicationV2, HandlebarsApplicationMixin, MOD, PATH, cfg, combateAtivo, debounceRender, imagemDe, loc, tokenNoMapa } from "./core.js";
import { ACOES_BASICAS, usarAcaoBasica } from "./acoes-basicas.js";
import { alternar, ataquesRestantes, deslocamento, estado, movido, seloDoItem } from "./economia.js";
import { estadoMulti, usarMultiataque } from "./ataques.js";
import { movimentoExtra, usaCartas } from "./cartas/index.js";

const ABAS = [
  { id: "armas", icone: "fa-solid fa-khanda" },
  { id: "bonus", icone: "fa-solid fa-play" },
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
      abrirFicha: BarraAcoes.#abrirFicha,
      multiataque: BarraAcoes.#multiataque
    }
  };

  static PARTS = { barra: { template: `${PATH}/templates/barra-acoes.hbs` } };

  constructor(options) {
    super(options);
    this.agendar = debounceRender(this);
    this.filtro = ""; // busca por nome (magias, itens…), guardada entre redesenhos
  }

  // ───────────────────────── Posição (arrastar) ─────────────────────────

  // Põe a barra onde o jogador deixou (âncora embaixo, para crescer para cima).
  #aplicarPosicao() {
    const el = this.element;
    const pos = cfg("posicaoBarra") ?? {};
    if (!Number.isFinite(pos.left) || !Number.isFinite(pos.bottom)) {
      el.style.left = el.style.bottom = el.style.top = "";
      return;
    }
    const r = el.getBoundingClientRect();
    const left = Math.max(0, Math.min(pos.left, window.innerWidth - Math.min(r.width || 200, window.innerWidth)));
    const bottom = Math.max(0, Math.min(pos.bottom, window.innerHeight - 60));
    el.style.left = `${left}px`;
    el.style.bottom = `${bottom}px`;
    el.style.top = "auto";
  }

  #instalarArrasto(alca) {
    alca.addEventListener("dblclick", () => game.settings.set(MOD, "posicaoBarra", {}).then(() => this.#aplicarPosicao()));
    alca.addEventListener("pointerdown", ev => {
      if (ev.button !== 0) return;
      ev.preventDefault();
      const el = this.element;
      const r = el.getBoundingClientRect();
      const dx = ev.clientX - r.left, dy = r.bottom - ev.clientY;
      alca.setPointerCapture(ev.pointerId);
      el.classList.add("arrastando");
      const mover = e => {
        el.style.left = `${Math.max(0, Math.min(e.clientX - dx, window.innerWidth - r.width))}px`;
        el.style.bottom = `${Math.max(0, Math.min(window.innerHeight - e.clientY - dy, window.innerHeight - 60))}px`;
        el.style.top = "auto";
      };
      const soltar = () => {
        alca.removeEventListener("pointermove", mover);
        el.classList.remove("arrastando");
        game.settings.set(MOD, "posicaoBarra", { left: parseFloat(el.style.left) || 0, bottom: parseFloat(el.style.bottom) || 0 });
      };
      alca.addEventListener("pointermove", mover);
      alca.addEventListener("pointerup", soltar, { once: true });
      alca.addEventListener("pointercancel", soltar, { once: true });
    });
  }

  // Busca: esconde as cartas que não batem com o texto, sem redesenhar
  #filtrar() {
    const termo = this.filtro.trim().toLowerCase();
    for (const carta of this.element.querySelectorAll(".cmb-cartas .cmb-carta")) {
      const nome = carta.querySelector(".cmb-carta-nome")?.textContent.toLowerCase() ?? "";
      carta.hidden = !!termo && !nome.includes(termo);
    }
    for (const grupo of this.element.querySelectorAll(".cmb-grupo")) {
      grupo.hidden = !grupo.querySelector(".cmb-carta:not([hidden])");
    }
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    this.#aplicarPosicao();
    const alca = this.element.querySelector(".cmb-barra-alca");
    if (alca) this.#instalarArrasto(alca);
    const busca = this.element.querySelector(".cmb-busca input");
    if (busca) {
      busca.addEventListener("input", () => { this.filtro = busca.value; this.#filtrar(); });
      busca.addEventListener("keydown", ev => ev.stopPropagation()); // não aciona atalhos do Foundry
      if (this.filtro) this.#filtrar();
    }
  }

  // Quem a barra mostra:
  // mestre → o combatente da vez (NPC ou personagem de jogador);
  // jogador → o da vez, se for dele; senão o token dele selecionado; senão o primeiro dele no combate.
  alvo() {
    const combat = combateAtivo();
    if (!combat) return null;
    const atual = combat.combatant;
    // mestre: sempre o combatente da vez, seja NPC ou personagem de jogador
    if (game.user.isGM) return atual?.actor ? atual : null;
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
      // Ações bônus: tudo que gasta Ação Bônus, de qualquer tipo (magias, habilidades, armas, itens)
      if (aba === "bonus") entra = seloDoItem(item) === "bonus"
        && (t !== "spell" || magiaDisponivel(item))
        && (t !== "weapon" || item.system.equipped || actor.type !== "character");
      else if (aba === "armas") entra = t === "weapon" && (item.system.equipped || actor.type !== "character");
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
        // armas continuam liberadas enquanto sobrar ataque (Ataque Extra / Ataques múltiplos)
        esgotado: (selo && gastos[selo] && !(selo === "acao" && t === "weapon" && (gastos.ataques > 0 || gastos.extras > 0)))
          || (item.system.uses?.max && !item.system.uses.value),
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

    // Ataques do turno (Ataque Extra + Ataques múltiplos) e a habilidade Ataques múltiplos
    let ataques = null, multi = null;
    if (!modoCartas) {
      const r = ataquesRestantes(c);
      if (r.porAcao > 1 || r.extras > 0) ataques = {
        ...r, gasto: r.total <= 0,
        dica: loc("COMBATE.Ataques.barra.dica", { total: r.total, porAcao: r.porAcao, extras: r.extras })
      };
      const m = estadoMulti(actor);
      if (m.usos > 0) multi = {
        ...m, esgotado: m.restam <= 0 || !c.isOwner,
        dica: loc("COMBATE.Ataques.barra.multiDica", { n: m.extras, restam: m.restam, usos: m.usos, recarga: loc(`COMBATE.Ataques.recarga.${m.recarga}`) })
      };
    }

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
      tamanho: ["normal", "grande", "enorme"].includes(cfg("tamanhoBarra")) ? cfg("tamanhoBarra") : "grande",
      busca: !modoCartas && aba !== "basicas",
      filtro: this.filtro,
      minimizada: !!cfg("barraMinimizada"),
      nome: c.name,
      img: imagemDe(c),
      seuTurno,
      podeTerminar: seuTurno && c.isOwner,
      selos,
      ataques,
      multi,
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
    this.filtro = "";
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

  static #multiataque() { return usarMultiataque(this.alvo()); }
}
