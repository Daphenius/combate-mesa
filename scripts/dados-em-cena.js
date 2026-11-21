// ═══════════════════════════════════════════════════════════════════════════
//  Combate da Mesa — integração com o Dados em Cena
//  Quando o módulo Dados em Cena está ativo, os testes do combate (Esconder,
//  Procurar, Agarrar/Empurrar e a defesa de quem é agarrado) e as salvaguardas
//  contra magias e habilidades abrem a tela do Dados em Cena para o dono do
//  personagem rolar, em vez de rolar sozinho.
//  A API do Dados em Cena (api.pedirTeste) só pode ser chamada pelo mestre
//  ativo, então o jogador pede ao mestre pelo socket nativo do módulo.
//  Sem o Dados em Cena (ou sem mestre on-line) tudo volta a rolar como antes.
// ═══════════════════════════════════════════════════════════════════════════

import { MOD, cfg, esc, isActiveGM, loc } from "./core.js";

const DADOS = "dados-em-cena";
const CANAL = `module.${MOD}`;
const TEMPO = 120000; // quanto tempo esperar o jogador rolar

export function apiDados() {
  if (cfg("dadosEmCena") === false) return null;
  const m = game.modules.get(DADOS);
  return m?.active && typeof m.api?.pedirTeste === "function" ? m.api : null;
}

// Dá para mandar o teste para o Dados em Cena agora?
export function usarDadosEmCena() {
  return !!apiDados() && !!game.users.activeGM;
}

function rotulo(kind, key) {
  const d = CONFIG.DND5E ?? {};
  const fonte = kind === "skill" ? d.skills : d.abilities;
  return fonte?.[key]?.label ?? key;
}

// Jogadores on-line donos do personagem (eles veem a tela e rolam; o mestre sempre vê)
function donos(actor) {
  return game.users.filter(u => u.active && !u.isGM && actor?.testUserPermission?.(u, "OWNER")).map(u => u.id);
}

/**
 * (Só o mestre ativo) Abre o teste no Dados em Cena e espera o resultado.
 * @returns {Promise<number|null>} o total, ou null se ninguém rolar a tempo
 */
export async function testeNoDados({ tokenDoc = null, actor = null, kind, key, cd = null }) {
  const api = apiDados();
  actor ??= tokenDoc?.actor;
  if (!api || !isActiveGM() || !actor) return null;
  try {
    const r = await api.pedirTeste({
      tokenId: tokenDoc?.id ?? null, actorId: actor.id, sceneId: tokenDoc?.parent?.id ?? null,
      config: { kind, key, label: rotulo(kind, key) }, cd, modo: "tela", para: donos(actor), tempoLimite: TEMPO
    });
    const total = Number(r?.total);
    return Number.isFinite(total) ? total : null;
  } catch (e) {
    console.error("Combate da Mesa | Dados em Cena", e);
    return null;
  }
}

/**
 * Pede um teste do próprio personagem pelo Dados em Cena (o resultado vai para o chat
 * pelo próprio Dados em Cena). Devolve false se não deu para usar o Dados em Cena.
 */
export function pedirTesteDados({ actor, token, kind, key }) {
  if (!usarDadosEmCena() || !actor) return false;
  const dados = { tipo: "teste", actorUuid: actor.uuid, tokenUuid: (token?.document ?? token)?.uuid ?? null, kind, key };
  if (isActiveGM()) executar(dados);
  else game.socket.emit(CANAL, dados);
  return true;
}

/**
 * Salvaguardas dos alvos de uma magia/habilidade com teste de resistência.
 * Um alvo por vez (o Dados em Cena mostra uma tela de cada vez); o próprio
 * Dados em Cena marca no chat quem passou ou falhou contra a CD.
 */
export function pedirSalvaguardas({ alvos, ability, cd, origem = "" }) {
  if (!usarDadosEmCena() || !alvos?.length || !ability) return false;
  const dados = { tipo: "salvaguarda", alvos, ability, cd: Number.isFinite(cd) ? cd : null, origem };
  if (isActiveGM()) executarSalvaguardas(dados);
  else game.socket.emit(CANAL, dados);
  return true;
}

async function executarSalvaguardas({ alvos, ability, cd, origem }) {
  for (const uuid of alvos) {
    const tokenDoc = await fromUuid(uuid);
    if (!tokenDoc?.actor) continue;
    const total = await testeNoDados({ tokenDoc, kind: "save", key: ability, cd });
    if (total === null) {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: tokenDoc.actor, token: tokenDoc }),
        content: `<div class="cmb-chat-acao"><i class="fa-solid fa-hourglass-end"></i><div>${loc("COMBATE.Dados.semSalvaguarda", { nome: esc(tokenDoc.name), origem: esc(origem) })}</div></div>`
      });
    }
  }
}

async function executar(dados) {
  const tokenDoc = dados.tokenUuid ? await fromUuid(dados.tokenUuid) : null;
  const actor = tokenDoc?.actor ?? (dados.actorUuid ? await fromUuid(dados.actorUuid) : null);
  if (!actor) return;
  await testeNoDados({ tokenDoc, actor, kind: dados.kind, key: dados.key });
}

export function instalarDadosEmCena() {
  game.socket.on(CANAL, dados => {
    if (!isActiveGM()) return;
    const erro = e => console.error("Combate da Mesa | Dados em Cena", e);
    if (dados?.tipo === "teste") executar(dados).catch(erro);
    else if (dados?.tipo === "salvaguarda") executarSalvaguardas(dados).catch(erro);
  });

  // Magia ou habilidade com salvaguarda (atividade "save" do dnd5e): cada alvo
  // marcado rola a salvaguarda no Dados em Cena, contra a CD da atividade.
  Hooks.on("dnd5e.postUseActivity", activity => {
    if (activity?.type !== "save" || !usarDadosEmCena()) return;
    const habilidades = [...(activity.save?.ability ?? [])];
    const alvos = [...game.user.targets].filter(t => t.actor).map(t => t.document.uuid);
    if (!habilidades.length || !alvos.length) return;
    const cd = Number(activity.save?.dc?.value);
    pedirSalvaguardas({ alvos, ability: habilidades[0], cd: Number.isFinite(cd) ? cd : null, origem: activity.item?.name ?? activity.name ?? "" });
  });
}
