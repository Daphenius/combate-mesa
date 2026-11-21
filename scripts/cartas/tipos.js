// ═══════════════════════════════════════════════════════════════════════════
//  Combate da Mesa — modo de cartas: tipos de carta
//  Cada tipo diz o ícone, a categoria (cor da moldura) e quantas cópias o
//  personagem recebe no baralho quando o mestre deixa no automático.
// ═══════════════════════════════════════════════════════════════════════════

import { loc } from "../core.js";
import { cartasCustom } from "./config.js";

// categoria → cor da moldura (ver styles/cartas.css)
export const TIPOS = {
  atacar:      { icone: "fa-solid fa-khanda",            categoria: "ataque" },
  magia:       { icone: "fa-solid fa-hat-wizard",        categoria: "magia" },
  item:        { icone: "fa-solid fa-flask",             categoria: "tatica" },
  mover:       { icone: "fa-solid fa-shoe-prints",       categoria: "movimento" },
  esconder:    { icone: "fa-solid fa-user-ninja",        categoria: "tatica" },
  transformar: { icone: "fa-solid fa-paw",               categoria: "especial" },
  esquivar:    { icone: "fa-solid fa-shield-halved",     categoria: "defesa" },
  disparada:   { icone: "fa-solid fa-person-running",    categoria: "movimento" },
  ajudar:      { icone: "fa-solid fa-handshake-angle",   categoria: "tatica" },
  agarrar:     { icone: "fa-solid fa-hand-fist",         categoria: "ataque" },
  armadilha:   { icone: "fa-solid fa-dungeon",           categoria: "armadilha" },
  mais2:       { icone: "fa-solid fa-layer-group",       categoria: "sorte", rotulo: "+2" },
  menos2:      { icone: "fa-solid fa-heart-crack",       categoria: "sorte", rotulo: "−2" },
  // uma carta para cada habilidade da ficha (Cura pelas Mãos, Retomar o Fôlego…)
  habilidade:  { icone: "fa-solid fa-star",              categoria: "habilidade" }
};

export const IDS_TIPOS = Object.keys(TIPOS);

// ───────────────────────── Leitura da ficha ─────────────────────────

const temAtividade = item => (item.system?.activities?.size ?? 0) > 0;
const atividadesDoTipo = (item, tipo) => [...(item.system?.activities ?? [])].filter(a => a.type === tipo);

export function magiaDisponivel(item) {
  const s = item.system;
  if (!s) return false;
  if (!s.canPrepare) return true;
  return (s.prepared ?? 0) > 0;
}

// Opções de ataque: armas (equipadas, para personagens) e habilidades com atividade de ataque.
export function opcoesAtaque(actor) {
  const lista = [];
  for (const item of actor?.items ?? []) {
    if (item.type === "spell") continue;
    if (item.type === "weapon" && actor.type === "character" && !item.system.equipped) continue;
    for (const act of atividadesDoTipo(item, "attack")) lista.push({ item, act });
  }
  return lista;
}

export function opcoesMagia(actor) {
  return (actor?.items ?? []).filter(i => i.type === "spell" && temAtividade(i) && magiaDisponivel(i));
}

export function opcoesItem(actor) {
  return (actor?.items ?? []).filter(i => ["consumable", "equipment", "tool", "loot"].includes(i.type)
    && temAtividade(i) && (i.type !== "consumable" || Number(i.system?.quantity ?? 1) > 0));
}

// Habilidades da ficha que viram cartas: talentos/características com atividade
// de Ação, Ação Bônus ou Reação que não sejam ataques (esses já são a carta Atacar)
// nem a Forma Selvagem (essa é a carta Transformar). Sem usos restantes não entra.
export function opcoesHabilidade(actor) {
  const forma = itemFormaSelvagem(actor);
  return (actor?.items ?? []).filter(item => {
    if (item.type !== "feat" || item === forma) return false;
    const acts = [...(item.system?.activities ?? [])];
    if (!acts.some(a => ["action", "bonus", "reaction"].includes(a.activation?.type))) return false;
    if (acts.every(a => a.type === "attack")) return false;
    const u = item.system?.uses;
    if (u?.max && !u.value) return false;
    return true;
  });
}

export function itemFormaSelvagem(actor) {
  return (actor?.items ?? []).find(i => i.system?.identifier === "wild-shape" || /wild shape|forma selvagem/i.test(i.name)) ?? null;
}

const NUMEROS = { two: 2, three: 3, four: 4, five: 5, dois: 2, duas: 2, "três": 3, tres: 3, quatro: 4, cinco: 5 };

// Quantos ataques o personagem faz com a ação de Ataque (Ataque Extra, Ataques Múltiplos…)
export function numeroAtaques(actor) {
  if (!actor) return 0;
  if (!opcoesAtaque(actor).length) return 0;
  let n = 1;
  for (const item of actor.items) {
    const id = item.system?.identifier ?? "";
    const nome = item.name ?? "";
    if (id === "three-extra-attacks") n = Math.max(n, 4);
    else if (id === "two-extra-attacks") n = Math.max(n, 3);
    else if (id.includes("extra-attack") || /extra attack|ataque extra/i.test(nome)) n = Math.max(n, 2);
    else if (/multiattack|multiataque|ataques? m[úu]ltiplos/i.test(nome)) {
      const txt = String(item.system?.description?.value ?? "").toLowerCase();
      const m = txt.match(/\b(two|three|four|five|dois|duas|três|tres|quatro|cinco)\b/);
      n = Math.max(n, NUMEROS[m?.[1]] ?? 2);
    }
  }
  // Guerreiro: 3 ataques no 11º nível, 4 no 20º (quando a ficha não tem o item)
  const guerreiro = actor.classes?.fighter?.system?.levels ?? 0;
  if (guerreiro >= 20) n = Math.max(n, 4);
  else if (guerreiro >= 11) n = Math.max(n, 3);
  return n;
}

// Quantidade automática de cada tipo no baralho
export function quantidadeAuto(actor, tipo) {
  if (!actor) return 0;
  switch (tipo) {
    case "atacar": return numeroAtaques(actor);
    case "magia": return opcoesMagia(actor).length ? 2 : 0;
    case "item": return opcoesItem(actor).length ? 1 : 0;
    case "mover": return 2;
    case "transformar": return itemFormaSelvagem(actor) ? 2 : 0;
    case "agarrar": return 1;
    case "habilidade": return opcoesHabilidade(actor).length ? 1 : 0; // cópias de cada habilidade
    default: return 1;
  }
}

// ───────────────────────── Dados para exibir ─────────────────────────

// Uma carta na mão é só { uid, tipo, cid? }. Aqui ela ganha nome, texto e visual.
export function infoCarta(carta) {
  if (!carta) return null;
  if (carta.tipo === "custom") {
    const def = cartasCustom().find(c => c.id === carta.cid);
    return {
      ...carta,
      nome: def?.nome || loc("COMBATE.Cartas.custom.semNome"),
      descricao: def?.descricao || "",
      img: def?.img || null,
      icone: "fa-solid fa-wand-sparkles",
      categoria: def?.efeito === "macro" ? "mestre" : "especial",
      tipoNome: loc(def?.efeito === "macro" ? "COMBATE.Cartas.categoria.mestre" : "COMBATE.Cartas.categoria.personalizada")
    };
  }
  if (carta.tipo === "habilidade") {
    return {
      ...carta,
      nome: carta.nome || loc("COMBATE.Cartas.tipo.habilidade.nome"),
      descricao: loc("COMBATE.Cartas.tipo.habilidade.texto"),
      img: carta.img || null,
      icone: TIPOS.habilidade.icone,
      categoria: "habilidade",
      tipoNome: loc("COMBATE.Cartas.categoria.habilidade")
    };
  }
  const t = TIPOS[carta.tipo] ?? { icone: "fa-solid fa-question", categoria: "especial" };
  return {
    ...carta,
    nome: loc(`COMBATE.Cartas.tipo.${carta.tipo}.nome`),
    descricao: loc(`COMBATE.Cartas.tipo.${carta.tipo}.texto`),
    img: null,
    icone: t.icone,
    rotulo: t.rotulo ?? null,
    categoria: t.categoria,
    tipoNome: loc(`COMBATE.Cartas.categoria.${t.categoria}`)
  };
}
