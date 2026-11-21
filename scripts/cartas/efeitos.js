// ═══════════════════════════════════════════════════════════════════════════
//  Combate da Mesa — modo de cartas: o que cada carta faz
//  Tudo pelo que o dnd5e e o Foundry já têm: atividades (activity.use),
//  testes de perícia, condições nativas, Active Effects e Macros.
//  Quando a carta mexe em algo que o jogador não controla (−2 em outro
//  combatente, Ajudar um aliado, Agarrar um inimigo, macro do mestre), o
//  pedido vai nas flags da própria mensagem de chat da carta e o mestre
//  ativo executa ao recebê-la. Sem socket.
// ═══════════════════════════════════════════════════════════════════════════

import { MOD, combateAtivo, esc, isActiveGM, loc, tokenNoMapa } from "../core.js";
import { cartasCustom, regras } from "./config.js";
import { comprar, estadoCartas, salvarCartas, tirarDaMao, usaCartas } from "./baralho.js";
import { infoCarta, itemFormaSelvagem, opcoesAtaque, opcoesItem, opcoesMagia, ehDefesa } from "./tipos.js";
import { cartaHTML } from "./visual.js";

const { DialogV2 } = foundry.applications.api;

// Enquanto uma carta está sendo usada, a economia rígida e o "só cartas" deixam passar.
let emUso = 0;
export const cartaEmUso = () => emUso > 0;
async function comCarta(fn) {
  emUso++;
  try { return await fn(); } finally { emUso--; }
}

// ───────────────────────── Escolhas ─────────────────────────

// Janela nativa (DialogV2) para escolher uma opção com imagem.
async function escolher(titulo, opcoes) {
  if (!opcoes.length) return null;
  if (opcoes.length === 1) return opcoes[0].valor;
  let grupoAtual = null;
  const linhas = opcoes.map((o, i) => {
    let cab = "";
    if (o.grupo !== undefined && o.grupo !== grupoAtual) {
      grupoAtual = o.grupo;
      cab = `<h4 class="cmb-escolha-grupo">${esc(o.grupo)}</h4>`;
    }
    return `${cab}<label class="cmb-escolha-opcao">
      <input type="radio" name="escolha" value="${i}" ${i === 0 ? "checked" : ""}>
      <img src="${esc(o.img)}" alt=""><span>${esc(o.nome)}</span>${o.extra ? `<em>${esc(o.extra)}</em>` : ""}
    </label>`;
  }).join("");
  const escolha = await DialogV2.wait({
    window: { title: titulo, icon: "fa-solid fa-layer-group" },
    classes: ["cmb-escolha-janela"],
    position: { width: 380 },
    content: `<div class="cmb-escolha">${linhas}</div>`,
    buttons: [{
      action: "ok", label: loc("COMBATE.Cartas.escolher.ok"), icon: "fa-solid fa-check", default: true,
      callback: (event, button) => button.form.elements.escolha.value
    }],
    rejectClose: false
  });
  return escolha == null ? null : opcoes[Number(escolha)]?.valor ?? null;
}

function rotuloCirculo(n) {
  return n === 0 ? loc("COMBATE.Barra.truques") : loc("COMBATE.Barra.circulo", { n });
}

async function escolherAtaque(actor) {
  const ops = opcoesAtaque(actor).map(({ item, act }) => ({
    valor: act, img: item.img, nome: item.name,
    extra: [...item.system.activities].filter(a => a.type === "attack").length > 1 ? act.name : null
  }));
  if (!ops.length) { ui.notifications.warn(loc("COMBATE.Cartas.aviso.semAtaque")); return null; }
  return escolher(loc("COMBATE.Cartas.escolher.ataque"), ops);
}

async function escolherMagia(actor, filtro) {
  const magias = opcoesMagia(actor, filtro).sort((a, b) => (a.system.level - b.system.level) || a.name.localeCompare(b.name));
  const truque = filtro?.circulos === false;
  if (!magias.length) { ui.notifications.warn(loc(truque ? "COMBATE.Cartas.aviso.semTruque" : "COMBATE.Cartas.aviso.semMagia")); return null; }
  return escolher(loc(truque ? "COMBATE.Cartas.escolher.truque" : "COMBATE.Cartas.escolher.magia"), magias.map(i => ({
    valor: i, img: i.img, nome: i.name, grupo: rotuloCirculo(i.system.level ?? 0)
  })));
}

async function escolherItem(actor) {
  const itens = opcoesItem(actor);
  if (!itens.length) { ui.notifications.warn(loc("COMBATE.Cartas.aviso.semItem")); return null; }
  return escolher(loc("COMBATE.Cartas.escolher.item"), itens.map(i => ({
    valor: i, img: i.img, nome: i.name, extra: i.system.quantity > 1 ? `×${i.system.quantity}` : null
  })));
}

// O resultado de activity.use / item.use: undefined ou null quando a pessoa cancelou.
const usou = r => r !== undefined && r !== null && r !== false;

// Próximo combatente na ordem (pulando derrotados e o próprio)
function proximoCombatente(combat, c) {
  const turnos = combat.turns ?? [];
  const i = turnos.findIndex(t => t.id === c.id);
  for (let k = 1; k < turnos.length; k++) {
    const t = turnos[(i + k) % turnos.length];
    if (t && !t.isDefeated && t.id !== c.id) return t;
  }
  return null;
}

// ───────────────────────── Efeitos ─────────────────────────

// Cada efeito devolve { ok, acao?, extra? }. ok:false = cancelado (a carta volta para a mão).
const EFEITOS = {
  async atacar({ actor, event }) {
    const act = await escolherAtaque(actor);
    if (!act) return { ok: false };
    return { ok: usou(await act.use({ event })) };
  },

  // gasta o espaço de magia normalmente (o dnd5e cuida)
  async magia({ actor, event }) {
    const item = await escolherMagia(actor, { truques: false });
    if (!item) return { ok: false };
    return { ok: usou(await item.use({ event })) };
  },

  // Truques: não gastam nada, então a carta sempre volta para a mão
  async truque({ actor, event }) {
    const item = await escolherMagia(actor, { circulos: false });
    if (!item) return { ok: false };
    return { ok: usou(await item.use({ event })) };
  },

  async item({ actor, event }) {
    const item = await escolherItem(actor);
    if (!item) return { ok: false };
    return { ok: usou(await item.use({ event })) };
  },

  // Habilidade da ficha (Cura pelas Mãos, Inspiração de Bardo…): usa pelo dnd5e,
  // gastando os usos normalmente
  async habilidade({ actor, event }, carta) {
    const item = actor.items.get(carta.iid);
    if (!item) { ui.notifications.warn(loc("COMBATE.Cartas.aviso.semHabilidade", { nome: carta.nome ?? "" })); return { ok: false }; }
    return { ok: usou(await item.use({ event })) };
  },

  async mover({ combatant }) {
    await salvarCartas(combatant, { mov: estadoCartas(combatant).mov + 1 });
    return { ok: true };
  },

  async disparada({ combatant }) {
    await salvarCartas(combatant, { mov: estadoCartas(combatant).mov + 2 });
    return { ok: true };
  },

  async esconder({ actor, event }) {
    const r = await actor.rollSkill({ skill: "ste", event });
    return { ok: usou(r) };
  },

  // Forma Selvagem do próprio dnd5e, sem gastar os usos (a carta é o limite)
  async transformar({ actor, event }) {
    const item = itemFormaSelvagem(actor);
    if (!item) { ui.notifications.warn(loc("COMBATE.Cartas.aviso.semForma")); return { ok: false }; }
    return { ok: usou(await item.use({ event, consume: { resources: false } })) };
  },

  // ── Defesas: duram até o início do próximo turno de quem jogou ──
  async esquivar({ actor, combatant }) {
    await actor.toggleStatusEffect("dodging", { active: true });
    await combatant.setFlag(MOD, "esquivou", true); // a economia tira no início do próximo turno
    return { ok: true };
  },

  async defender({ actor, combatant }) {
    await criarDefesa(actor, combatant, "defender", [{ key: "system.attributes.ac.bonus", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "+1" }]);
    return { ok: true, defesa: true };
  },

  async resistir({ actor, combatant }) {
    const changes = ["str", "dex", "con", "int", "wis", "cha"].map(a => ({
      key: `system.abilities.${a}.save.roll.mode`, mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "1"
    }));
    await criarDefesa(actor, combatant, "resistir", changes);
    return { ok: true, defesa: true };
  },

  // +2 na CA de um aliado marcado (o mestre aplica, porque o aliado é de outro jogador)
  async proteger({ combatant }) {
    const alvo = game.user.targets.first();
    if (!alvo?.actor || alvo.actor.uuid === combatant.actor?.uuid) {
      ui.notifications.warn(loc("COMBATE.Cartas.aviso.marqueProteger"));
      return { ok: false };
    }
    return { ok: true, defesa: true, acao: { tipo: "proteger", alvo: alvo.actor.uuid }, extra: alvo.name };
  },

  async ajudar({ combatant }) {
    const alvo = game.user.targets.first();
    if (!alvo?.actor || alvo.actor.uuid === combatant.actor?.uuid) {
      ui.notifications.warn(loc("COMBATE.Cartas.aviso.marqueAliado"));
      return { ok: false };
    }
    return { ok: true, acao: { tipo: "ajudar", alvo: alvo.actor.uuid }, extra: alvo.name };
  },

  async agarrar({ actor, event }) {
    const alvo = game.user.targets.first();
    if (!alvo?.actor) { ui.notifications.warn(loc("COMBATE.Cartas.aviso.marqueAlvo")); return { ok: false }; }
    const modo = await escolher(loc("COMBATE.Cartas.escolher.agarrar"), [
      { valor: "agarrar", img: "icons/svg/net.svg", nome: loc("COMBATE.Cartas.agarrar.agarrar") },
      { valor: "empurrar", img: "icons/svg/falling.svg", nome: loc("COMBATE.Cartas.agarrar.empurrar") }
    ]);
    if (!modo) return { ok: false };
    const rolls = await actor.rollSkill({ skill: "ath", event });
    const total = rolls?.[0]?.total ?? rolls?.total;
    if (!Number.isFinite(total)) return { ok: false };
    return { ok: true, acao: { tipo: "agarrar", modo, total, alvo: alvo.document.uuid }, extra: alvo.name };
  },

  // Fica virada na mesa até alguém atacar o personagem
  async armadilha({ combatant }, carta) {
    const st = estadoCartas(combatant);
    if (st.armadilha) { ui.notifications.warn(loc("COMBATE.Cartas.aviso.jaTemArmadilha")); return { ok: false }; }
    await salvarCartas(combatant, { armadilha: { ...carta } });
    return { ok: true, oculta: true };
  },

  async mais2({ actor, combatant }) {
    const st = estadoCartas(combatant);
    const extras = comprar(actor, 2, { excluir: st.usadas });
    await salvarCartas(combatant, { mao: [...st.mao, ...extras] });
    return { ok: true };
  },

  // Com um alvo marcado: ele compra 2 a menos. Sem alvo: o próximo da ordem.
  async menos2({ combatant }) {
    const combat = combateAtivo();
    const marcado = game.user.targets.first()?.combatant;
    const alvo = marcado && marcado.parent === combat ? marcado : proximoCombatente(combat, combatant);
    if (!alvo || !usaCartas(alvo)) { ui.notifications.warn(loc("COMBATE.Cartas.aviso.semAlvoCartas")); return { ok: false }; }
    return { ok: true, acao: { tipo: "menos2", alvo: alvo.id }, extra: alvo.name };
  },

  async custom({ actor, combatant, token, event }, carta) {
    const def = cartasCustom().find(c => c.id === carta.cid);
    if (!def) { ui.notifications.warn(loc("COMBATE.Cartas.aviso.customSumiu")); return { ok: false }; }
    if (def.efeito === "item") {
      const alvo = String(def.item ?? "").trim().toLowerCase();
      const item = actor.items.find(i => i.system?.identifier === alvo || i.name.toLowerCase() === alvo);
      if (!item) { ui.notifications.warn(loc("COMBATE.Cartas.aviso.semItemCustom", { item: def.item })); return { ok: false }; }
      const consume = def.gratis ? { resources: false, spellSlot: false } : undefined;
      return { ok: usou(await item.use({ event, ...(consume ? { consume } : {}) })) };
    }
    if (def.efeito === "macro") {
      const macro = await acharMacro(def.macro);
      if (!macro) { ui.notifications.warn(loc("COMBATE.Cartas.aviso.semMacro")); return { ok: false }; }
      const alvos = [...game.user.targets].map(t => t.document.uuid);
      // Quem pode rodar a macro roda aqui; senão o mestre roda ao receber a carta.
      if (game.user.isGM || macro.canExecute) {
        await rodarMacro(macro, { actor, combatant, token, carta: infoCarta(carta), alvos, usuario: game.user });
        return { ok: true };
      }
      return { ok: true, acao: { tipo: "macro", macro: macro.uuid, combatant: combatant.id, alvos, usuario: game.user.id } };
    }
    return { ok: true }; // só texto: a carta aparece no chat e a mesa resolve
  }
};

async function acharMacro(ref) {
  if (!ref) return null;
  try {
    const doc = await fromUuid(ref);
    if (doc?.documentName === "Macro") return doc;
  } catch { /* não é uuid */ }
  return game.macros.get(ref) ?? game.macros.getName(ref) ?? null;
}

async function rodarMacro(macro, { actor, combatant, token, carta, alvos, usuario }) {
  const tokens = (alvos ?? []).map(u => fromUuidSync(u, { strict: false })?.object).filter(Boolean);
  try {
    return await macro.execute({ actor, token: token ?? null, combatant, carta, alvos: tokens, usuario });
  } catch (e) {
    console.error("Combate da Mesa | macro da carta", e);
    ui.notifications.error(loc("COMBATE.Cartas.aviso.erroMacro", { nome: macro.name }));
  }
}

// Active Effect de uma carta de defesa, marcado com quem jogou (para sair no próximo turno dele)
async function criarDefesa(actor, combatant, tipo, changes) {
  return actor.createEmbeddedDocuments("ActiveEffect", [{
    name: loc(`COMBATE.Cartas.tipo.${tipo}.nome`),
    img: tipo === "proteger" ? "icons/svg/shield.svg" : tipo === "resistir" ? "icons/svg/aura.svg" : "icons/svg/shield.svg",
    description: loc(`COMBATE.Cartas.tipo.${tipo}.texto`),
    changes,
    duration: { rounds: 1 },
    flags: { [MOD]: { defesaDe: combatant.id } }
  }]);
}

// A carta volta para a mão depois de usada? Truque sempre; Magia enquanto houver
// espaço de magia; Habilidade enquanto houver usos (sem limite de usos, sempre).
function aindaTemRecurso(actor, carta) {
  if (carta.tipo === "truque") return true;
  if (carta.tipo === "magia") {
    const sp = actor.system?.spells ?? {};
    return Object.values(sp).some(s => (Number(s?.max) || 0) > 0 && (Number(s?.value) || 0) > 0);
  }
  if (carta.tipo === "habilidade") {
    const item = actor.items.get(carta.iid);
    if (!item) return false;
    const u = item.system?.uses;
    return !u?.max || (Number(u.value) || 0) > 0;
  }
  return false;
}

// ───────────────────────── Jogar uma carta ─────────────────────────

export function podeJogar(combatant) {
  const combat = combateAtivo();
  if (!combat || !combatant?.isOwner || !usaCartas(combatant)) return false;
  if (game.user.isGM || regras().foraDoTurno) return true;
  return combat.combatant?.id === combatant.id;
}

export async function jogarCarta(combatant, uid, event) {
  if (!podeJogar(combatant)) { ui.notifications.warn(loc("COMBATE.Cartas.aviso.foraDoTurno")); return; }
  const carta = estadoCartas(combatant).mao.find(c => c.uid === uid);
  if (!carta) return;
  const actor = combatant.actor;
  const token = tokenNoMapa(combatant);
  // as rolagens usam o token selecionado como orador
  if (token && !token.controlled) token.control({ releaseOthers: true });

  const efeito = EFEITOS[carta.tipo];
  if (!efeito) return;
  if (ehDefesa(carta.tipo) && estadoCartas(combatant).usadas.includes(carta.tipo)) {
    ui.notifications.warn(loc("COMBATE.Cartas.aviso.defesaUsada"));
    return;
  }
  // tira da mão antes, para não jogar a mesma carta duas vezes com cliques rápidos
  if (!(await tirarDaMao(combatant, uid))) return;
  let res;
  try {
    res = await comCarta(() => efeito({ actor, combatant, token, event }, carta));
  } catch (e) {
    console.error("Combate da Mesa | carta", e);
    res = { ok: false };
  }
  if (!res?.ok) { // cancelou: a carta volta
    const st = estadoCartas(combatant);
    if (!st.mao.some(c => c.uid === uid)) await salvarCartas(combatant, { mao: [...st.mao, carta] });
    return;
  }
  const st = estadoCartas(combatant);
  if (res.defesa) {
    // vai para o campo de defesa e não volta mais neste combate
    await salvarCartas(combatant, { defesa: [...st.defesa, { ...carta, alvo: res.extra ?? null }], usadas: [...new Set([...st.usadas, carta.tipo])] });
  } else if (aindaTemRecurso(actor, carta) && !st.mao.some(c => c.uid === uid)) {
    // Magia/Habilidade com recurso sobrando: a carta continua na mão
    await salvarCartas(combatant, { mao: [...st.mao, carta] });
  }
  await anunciarCarta(combatant, carta, res);
}

// Mensagem de chat da carta. Todos os clientes veem a revelação (ver revelar.js)
// e o mestre ativo executa o que vier em "acao".
export async function anunciarCarta(combatant, carta, { oculta = false, acao = null, extra = null, gatilho = false } = {}) {
  const info = infoCarta(carta);
  const nome = combatant.token?.name ?? combatant.name;
  const chave = gatilho ? "COMBATE.Cartas.chat.disparou" : oculta ? "COMBATE.Cartas.chat.baixou" : "COMBATE.Cartas.chat.jogou";
  const texto = loc(chave, { nome: esc(nome), carta: esc(info.nome) }) + (extra ? ` <em>→ ${esc(extra)}</em>` : "");
  const content = `<div class="cmb-chat-carta">${cartaHTML(info, { mini: true, oculta })}<p>${texto}</p></div>`;
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: combatant.actor, token: combatant.token }),
    content,
    flags: { [MOD]: { carta: { tipo: carta.tipo, cid: carta.cid ?? null, iid: carta.iid ?? null, nome: carta.nome ?? null, img: carta.img ?? null, texto: carta.texto ?? null }, oculta, acao, combatant: combatant.id } }
  });
}

// ───────────────────────── Pedidos que o mestre executa ─────────────────────────

const AJUDA_FLAG = "ajudado";

async function aplicarAjuda(actorUuid, origem) {
  const actor = await fromUuid(actorUuid);
  if (!actor) return;
  const ja = actor.effects.find(e => e.getFlag(MOD, AJUDA_FLAG));
  if (ja) return;
  await actor.createEmbeddedDocuments("ActiveEffect", [{
    name: loc("COMBATE.Cartas.ajuda.efeito"),
    img: "icons/svg/upgrade.svg",
    origin: origem ?? null,
    duration: { rounds: 1 },
    description: loc("COMBATE.Cartas.ajuda.descricao"),
    flags: { [MOD]: { [AJUDA_FLAG]: true } }
  }]);
}

async function resolverAgarrar({ modo, total, alvo: tokenUuid }, speaker) {
  const tokenDoc = await fromUuid(tokenUuid);
  const actor = tokenDoc?.actor;
  if (!actor) return;
  // defesa: o melhor entre Atletismo e Acrobacia do alvo, rolado pelo próprio dnd5e
  const ath = actor.system?.skills?.ath?.total ?? 0;
  const acr = actor.system?.skills?.acr?.total ?? 0;
  const skill = acr > ath ? "acr" : "ath";
  const rolls = await actor.rollSkill({ skill }, { configure: false }, { data: { speaker: ChatMessage.getSpeaker({ actor, token: tokenDoc }) } });
  const defesa = rolls?.[0]?.total ?? rolls?.total ?? 0;
  const venceu = total >= defesa;
  if (venceu) await actor.toggleStatusEffect(modo === "agarrar" ? "grappled" : "prone", { active: true });
  const chave = venceu ? `COMBATE.Cartas.agarrar.venceu.${modo}` : "COMBATE.Cartas.agarrar.falhou";
  await ChatMessage.create({ speaker, content: `<div class="cmb-chat-acao"><i class="fa-solid fa-hand-fist"></i><div>${loc(chave, { alvo: esc(tokenDoc.name), ataque: total, defesa })}</div></div>` });
}

export async function executarPedido(message) {
  const dados = message.getFlag(MOD, "acao");
  if (!dados || !isActiveGM()) return;
  const combat = combateAtivo();
  try {
    switch (dados.tipo) {
      case "proteger": {
        const actor = await fromUuid(dados.alvo);
        const c = combat?.combatants.get(message.getFlag(MOD, "combatant"));
        if (actor && c) await criarDefesa(actor, c, "proteger", [{ key: "system.attributes.ac.bonus", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "+2" }]);
        break;
      }
      case "menos2": {
        const alvo = combat?.combatants.get(dados.alvo);
        if (alvo) await salvarCartas(alvo, { menos: (Number(estadoCartas(alvo).menos) || 0) + 2 });
        break;
      }
      case "ajudar":
        await aplicarAjuda(dados.alvo, message.speaker?.actor ? `Actor.${message.speaker.actor}` : null);
        break;
      case "agarrar":
        await resolverAgarrar(dados, message.speaker);
        break;
      case "macro": {
        const macro = await acharMacro(dados.macro);
        const combatant = combat?.combatants.get(dados.combatant);
        if (macro && combatant) {
          await rodarMacro(macro, {
            actor: combatant.actor, combatant, token: tokenNoMapa(combatant),
            carta: infoCarta(message.getFlag(MOD, "carta")), alvos: dados.alvos, usuario: game.users.get(dados.usuario)
          });
        }
        break;
      }
    }
  } catch (e) { console.error("Combate da Mesa | pedido da carta", e); }
}

// Vantagem da carta Ajudar: no próximo ataque ou teste, depois some.
export function instalarAjuda() {
  const aplicar = (config, actor) => {
    const ef = actor?.effects?.find(e => e.getFlag(MOD, AJUDA_FLAG));
    if (!ef) return;
    config.advantage = true;
    for (const r of config.rolls ?? []) { r.options ??= {}; r.options.advantage = true; }
    if (ef.isOwner) ef.delete();
  };
  Hooks.on("dnd5e.preRollAttackV2", config => aplicar(config, config.subject?.actor));
  Hooks.on("dnd5e.preRollAbilityCheckV2", config => aplicar(config, config.subject));
  Hooks.on("dnd5e.preRollSkillV2", config => aplicar(config, config.subject));
  Hooks.on("dnd5e.preRollToolCheckV2", config => aplicar(config, config.subject));
}

// ───────────────────────── Armadilha ─────────────────────────

// Quem cuida da armadilha de um combatente: o jogador dono que está on-line, senão o mestre ativo.
function responsavel(combatant) {
  const jogador = game.users.find(u => u.active && !u.isGM && combatant.actor?.testUserPermission(u, "OWNER"));
  return (jogador ?? game.users.activeGM)?.isSelf ?? false;
}

export async function verificarArmadilha(message) {
  if (message.type !== "attack") return;
  const combat = combateAtivo();
  if (!combat) return;
  const atacanteId = message.speaker?.token;
  for (const t of message.system?.targets ?? []) {
    const doc = t.token ? fromUuidSync(t.token, { strict: false }) : null;
    const c = doc?.combatant;
    if (!c || c.parent !== combat || !usaCartas(c) || !responsavel(c)) continue;
    const armadilha = estadoCartas(c).armadilha;
    if (!armadilha) continue;
    await salvarCartas(c, { armadilha: null });
    await anunciarCarta(c, armadilha, { gatilho: true });
    // contra-ataque: mira no atacante e escolhe o ataque
    const atacante = atacanteId ? canvas.tokens?.get(atacanteId) : null;
    if (atacante) atacante.setTarget(true, { releaseOthers: true, groupSelection: false });
    const meu = tokenNoMapa(c);
    if (meu && !meu.controlled) meu.control({ releaseOthers: true });
    await comCarta(async () => {
      const act = await escolherAtaque(c.actor);
      if (act) await act.use({});
    });
  }
}
