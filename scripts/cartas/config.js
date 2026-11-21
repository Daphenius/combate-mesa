// ═══════════════════════════════════════════════════════════════════════════
//  Combate da Mesa — modo de cartas: configurações
//  Tudo nas configurações nativas do Foundry (game.settings), no mesmo
//  namespace do módulo. As regras aparecem na seção "Cartas" do painel de
//  configurações do Combate da Mesa; as cartas de cada personagem e as
//  cartas personalizadas ficam no menu "Cartas de combate".
// ═══════════════════════════════════════════════════════════════════════════

import { MOD, cfg } from "../core.js";
import { adicionarSecao } from "../settings.js";
import { MenuCartas } from "./menu.js";

// chave da regra → chave da configuração
const CHAVES = {
  tamanhoMao: "cartasTamanhoMao",
  atacarGarantido: "cartasAtacarGarantido",
  guardarCarta: "cartasGuardar",
  inimigos: "cartasInimigos",
  somenteCartas: "cartasSomente",
  foraDoTurno: "cartasForaDoTurno"
};

export const REGRAS_PADRAO = Object.freeze({
  tamanhoMao: 5,          // cartas compradas no início de cada turno
  atacarGarantido: true,  // sempre vem pelo menos uma Atacar (se o personagem ataca)
  guardarCarta: true,     // o jogador pode guardar 1 carta para o próximo turno
  inimigos: true,         // NPCs do mestre também jogam com cartas
  somenteCartas: true,    // no modo cartas, jogadores só agem pelas cartas
  foraDoTurno: false      // permite jogar cartas fora do próprio turno
});

export function registrarConfigCartas(onChange) {
  const reg = (key, scope, o) => game.settings.register(MOD, key, {
    scope, config: false,
    name: `COMBATE.Cartas.Settings.${key}.Name`, hint: `COMBATE.Cartas.Settings.${key}.Hint`,
    onChange: () => onChange?.(key),
    ...o
  });

  reg("modoCartas", "world", { type: Boolean, default: false });
  for (const [regra, key] of Object.entries(CHAVES)) {
    const padrao = REGRAS_PADRAO[regra];
    reg(key, "world", typeof padrao === "number" ? { type: Number, default: padrao } : { type: Boolean, default: padrao });
  }
  reg("revelarCartas", "client", { type: Boolean, default: true });

  // seção "Cartas" no painel de configurações do módulo
  adicionarSecao({ id: "cartas", icone: "fa-solid fa-layer-group", chaves: ["modoCartas", ...Object.values(CHAVES), "revelarCartas"] });

  // cartas de cada personagem e cartas personalizadas (menu próprio, só o mestre)
  game.settings.registerMenu(MOD, "menuCartas", {
    name: "COMBATE.Cartas.Settings.menu.Name",
    label: "COMBATE.Cartas.Settings.menu.Label",
    hint: "COMBATE.Cartas.Settings.menu.Hint",
    icon: "fa-solid fa-layer-group",
    type: MenuCartas,
    restricted: true
  });

  // editados pelo menu
  const obj = key => game.settings.register(MOD, key, {
    scope: "world", config: false, type: Object, default: {}, onChange: () => onChange?.(key)
  });
  obj("cartasAtores");   // { [actorId | "_pj" | "_npc"]: { [tipo]: quantidade } }
  obj("cartasCustom");   // { lista: [ carta personalizada ] }
}

export function regras() {
  const r = {};
  for (const [regra, key] of Object.entries(CHAVES)) r[regra] = cfg(key) ?? REGRAS_PADRAO[regra];
  r.tamanhoMao = Math.max(1, Math.min(10, Math.floor(Number(r.tamanhoMao) || REGRAS_PADRAO.tamanhoMao)));
  return r;
}

export function cartasCustom() {
  const l = cfg("cartasCustom")?.lista;
  return Array.isArray(l) ? l : [];
}

export function quantidadesAtores() {
  return cfg("cartasAtores") ?? {};
}

export const modoCartasLigado = () => !!cfg("modoCartas");
