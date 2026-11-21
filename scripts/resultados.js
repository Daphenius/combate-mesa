// ═══════════════════════════════════════════════════════════════════════════
//  Combate da Mesa — placar do combate e tela de resultados
//  O mestre ativo anota o placar numa flag do próprio Combat (documento
//  nativo). Quando o combate é encerrado, todos veem a tela de resultados.
//  O dano é creditado a quem está no turno (no 5e, quase todo dano acontece
//  no turno de quem causou; reações fora do turno contam para quem joga).
// ═══════════════════════════════════════════════════════════════════════════

import { ApplicationV2, HandlebarsApplicationMixin, MOD, PATH, cfg, combatenteDoAtor, esc, imagemDe, isActiveGM, loc } from "./core.js";

const VAZIO = () => ({ dano: 0, cura: 0, recebido: 0, abates: 0, criticos: 0, acertos: 0, erros: 0 });

// gravações em sequência, para duas mudanças seguidas não se sobrescreverem
let gravando = Promise.resolve();
function anotar(combat, combatant, mudancas) {
  if (!combat || !combatant) return;
  gravando = gravando.then(async () => {
    if (!game.combats.has(combat.id)) return;
    const placar = foundry.utils.deepClone(combat.getFlag(MOD, "placar") ?? {});
    const p = placar[combatant.id] ?? VAZIO();
    for (const [k, v] of Object.entries(mudancas)) p[k] = (p[k] ?? 0) + v;
    placar[combatant.id] = p;
    await combat.setFlag(MOD, "placar", placar);
  }).catch(e => console.warn("Combate da Mesa | placar", e));
}

export function instalarPlacar() {
  // Acertos, erros e críticos, pelo cartão de ataque do dnd5e
  Hooks.on("createChatMessage", message => {
    if (message.type !== "attack" || !isActiveGM()) return;
    const combat = game.combat;
    if (!combat?.started) return;
    const actor = ChatMessage.getSpeakerActor(message.speaker);
    const c = combatenteDoAtor(actor, combat);
    const roll = message.rolls?.[0];
    if (!c || !roll) return;
    const alvos = message.system?.targets ?? [];
    const m = { criticos: roll.isCritical ? 1 : 0, acertos: 0, erros: 0 };
    for (const t of alvos.length ? alvos : [{}]) {
      const acertou = roll.isFumble ? false : roll.isCritical ? true : Number.isFinite(t.ac) ? roll.total >= t.ac : null;
      if (acertou === true) m.acertos++;
      else if (acertou === false) m.erros++;
    }
    anotar(combat, c, m);
  });

  // Dano e cura: ganchos do dnd5e que rodam em todos os clientes depois da mudança de PV
  Hooks.on("dnd5e.damageActor", (actor, changes) => {
    if (!isActiveGM()) return;
    const combat = game.combat;
    if (!combat?.started) return;
    const valor = -changes.total;
    const alvo = combatenteDoAtor(actor, combat);
    if (alvo) anotar(combat, alvo, { recebido: valor });
    const autor = combat.combatant;
    if (!autor || autor.id === alvo?.id) return;
    const caiu = (actor.system?.attributes?.hp?.value ?? 1) <= 0 && changes.hp < 0;
    anotar(combat, autor, { dano: valor, abates: caiu ? 1 : 0 });
  });

  Hooks.on("dnd5e.healActor", (actor, changes) => {
    if (!isActiveGM()) return;
    const combat = game.combat;
    const autor = combat?.started ? combat.combatant : null;
    if (autor) anotar(combat, autor, { cura: changes.total });
  });

  // Fim do combate: a tela aparece para todos
  Hooks.on("deleteCombat", combat => {
    if (!cfg("resultados") || !combat.started) return;
    const placar = combat.getFlag(MOD, "placar");
    if (!placar || !Object.keys(placar).length) return;
    new ResultadosCombate({ combat }).render({ force: true });
  });
}

// ───────────────────────── Janela de resultados ─────────────────────────

export class ResultadosCombate extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ["cmb-resultados"],
    window: { title: "COMBATE.Resultados.titulo", icon: "fa-solid fa-trophy", resizable: true },
    position: { width: 620, height: "auto" },
    actions: { postarChat: ResultadosCombate.#postarChat }
  };

  static PARTS = { corpo: { template: `${PATH}/templates/resultados.hbs` } };

  constructor(options = {}) {
    super(options);
    this.combat = options.combat;
  }

  #linhas() {
    const placar = this.combat.getFlag(MOD, "placar") ?? {};
    const linhas = [];
    for (const c of this.combat.combatants) {
      const p = placar[c.id];
      if (!p) continue;
      if (!game.user.isGM && c.hidden) continue;
      const hostil = c.token?.disposition === CONST.TOKEN_DISPOSITIONS.HOSTILE;
      linhas.push({
        nome: c.name, img: imagemDe(c), hostil,
        caiu: c.isDefeated || (c.actor?.system?.attributes?.hp?.value ?? 1) <= 0,
        ...VAZIO(), ...p
      });
    }
    linhas.sort((a, b) => (a.hostil - b.hostil) || (b.dano - a.dano));
    return linhas;
  }

  async _prepareContext() {
    const linhas = this.#linhas();
    const herois = linhas.filter(l => !l.hostil);
    const inimigos = this.combat.combatants.filter(c => c.token?.disposition === CONST.TOKEN_DISPOSITIONS.HOSTILE);
    const vitoria = inimigos.length > 0 && inimigos.every(c => c.isDefeated || (c.actor?.system?.attributes?.hp?.value ?? 1) <= 0);
    const destaque = (campo) => {
      const top = herois.reduce((m, l) => (l[campo] > (m?.[campo] ?? 0) ? l : m), null);
      return top ? { nome: top.nome, img: top.img, valor: top[campo] } : null;
    };
    return {
      vitoria,
      rodadas: this.combat.round,
      linhas,
      mvp: destaque("dano"),
      curandeiro: destaque("cura"),
      algoz: destaque("abates"),
      isGM: game.user.isGM
    };
  }

  static async #postarChat() {
    const linhas = this.#linhas().filter(l => !l.hostil);
    const corpo = linhas.map(l => `<tr><td>${esc(l.nome)}</td><td>${l.dano}</td><td>${l.cura}</td><td>${l.abates}</td><td>${l.criticos}</td></tr>`).join("");
    const content = `<div class="cmb-chat-resultados"><h3><i class="fa-solid fa-trophy"></i> ${esc(loc("COMBATE.Resultados.titulo"))}</h3>
      <table><thead><tr><th></th><th>${esc(loc("COMBATE.Resultados.dano"))}</th><th>${esc(loc("COMBATE.Resultados.cura"))}</th>
      <th>${esc(loc("COMBATE.Resultados.abates"))}</th><th>${esc(loc("COMBATE.Resultados.criticos"))}</th></tr></thead><tbody>${corpo}</tbody></table></div>`;
    await ChatMessage.create({ content, speaker: { alias: loc("COMBATE.Titulo") } });
  }
}
