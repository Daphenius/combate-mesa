# Combate da Mesa

## Sobre como este módulo foi feito

Sei que parte da comunidade não gosta de módulos produzidos com IA, então prefiro ser transparente: este foi desenvolvido com ajuda de IA. Não sou programador.

Tudo começou quando um amigo me disse: “cara, ficou muito mais simples, é só fazer uma macro do que você quer”. Fiz a macro para a minha mesa, fui adaptando conforme a necessidade dos jogos e, no fim, ela virou um módulo. Uso nas minhas próprias sessões e resolvi compartilhar caso seja útil para mais alguém.

Se encontrar bugs ou tiver sugestões, abra uma issue. Todo retorno é bem-vindo.

---

> [!WARNING]
> **Versão beta, em testes.** Este módulo ainda está sendo testado no Foundry VTT 14 com o sistema D&D 5e 6 e **pode ter erros**. Use primeiro num mundo de teste ou faça backup do seu mundo antes de ativar. Se algo der errado, abra uma [issue](https://github.com/Daphenius/combate-mesa/issues) com um print do console (F12).

**Versão 0.3.7 (beta)** · Foundry VTT 14 · D&D 5e 6 · Português e English · Licença MIT · 🧪 Em testes no Foundry VTT e no D&D 5e

![Combate da Mesa](<docs/barra-e-linha-do-tempo.png>)

Um combate com cara de fantasia para D&D 5e. Inspirado na ideia de trackers em carrossel e de "boosters" de combate, mas feito do zero e usando o que o Foundry e o dnd5e já têm: ApplicationV2, os ganchos do sistema, o marcador de turno nativo e as animações do próprio canvas. Sem macros e sem depender de outros módulos.

## Principais recursos

- **Linha do tempo de iniciativa** no topo, com quem joga agora, os próximos e a próxima rodada.
- **Barra de ações** no canto inferior com os selos ◆ Ação, ▶ Ação Bônus, ↺ Reação e a barra de Movimento, no espírito das ações do Pathfinder, mas com a economia do 5e.
- **Vários ataques por ação**: o mestre define quantos ataques a Ação de Ataque dá a cada personagem (Ataque Extra; automático pela ficha) e pode dar a habilidade **Ataques múltiplos**, que o jogador ativa na barra para ganhar ataques extras.
- **Cartas de ação**: armas, magias por círculo (com espaços de magia), habilidades, itens e ações básicas (Disparada, Esquiva, Desengajar, Ajudar, Esconder, Procurar, Preparar, Usar objeto).
- **Animação de ataque** no mapa: investida, projétil, tremor, esquiva e texto de acerto/erro/crítico.
- **Anúncio de turno** em faixa de estandarte e câmera até o token.
- **Marcador de turno** com círculo de runas (marcador nativo do Foundry).
- **Tela de resultados** ao fim do combate, com MVP, curandeiro e mais abates.
- **Combate com cartas (opcional)**: cada combatente compra uma mão nova por turno e age jogando cartas, com cartas personalizadas e de macro criadas pelo mestre.

![Magias e resultados](<docs/magias-e-resultados.png>)

## Instalação

No Foundry, em **Módulos complementares → Instalar módulo**, cole o manifesto:

```
https://github.com/Daphenius/combate-mesa/releases/latest/download/module.json
```

## Como usar

- **Jogadores:** a barra aparece quando o personagem está num combate iniciado. No seu turno ela brilha. Clique numa carta para usar; o selo correspondente apaga. Clique num selo para marcar ou desmarcar à mão. **Shift+B** recolhe ou abre a barra.
- **Mestre:** a barra aparece no turno dos NPCs. A linha do tempo tem botões de turno anterior e próximo.
- **Marcador de turno:** a imagem de runas é usada quando nenhuma outra foi escolhida nas configurações do Rastreador de Combate, onde também se escolhe a animação.
- **Som:** fica com o tema de som de combate nativo do Foundry (configurações do Rastreador de Combate).

## Configurações

Tudo fica num painel próprio: **Configurações → Configurar Módulos → Combate da Mesa → Abrir painel**. Ele é dividido em Interface, Regras e Efeitos de cena. O mestre vê tudo; cada jogador vê só o que vale para ele (marcado como "Só você").

![Painel de configurações](<docs/painel-configuracoes.png>)

| Configuração | Quem | O que faz |
|---|---|---|
| Linha do tempo de iniciativa | Mundo | Liga ou desliga a linha do tempo. |
| Barra de ações | Mundo | Liga ou desliga a barra. |
| Economia de ações rígida | Mundo | Impede gastar o mesmo selo duas vezes ou usar Ação/Ação Bônus fora do turno. |
| Tema | Usuário | Acompanhar o Foundry (padrão), Escuro ou Claro. |
| Imagem dos personagens | Mundo | Retrato da ficha (padrão) ou imagem do token. |
| Vida de quem o jogador não controla | Mundo | Descrição, barra ou nada. |
| Mostrar a iniciativa dos inimigos | Mundo | Mostra o número da iniciativa dos inimigos. |
| Câmera no início do turno | Mundo | Ninguém, só quem controla o token, ou todos. |
| Marcador de turno da Mesa | Mundo | Usa o círculo de runas como marcador padrão. |
| Tela de resultados | Mundo | Mostra o resultado ao encerrar o combate. |
| Animação de ataque | Usuário | Liga ou desliga as animações no mapa. |
| Anúncio de turno | Usuário | Liga ou desliga a faixa de turno. |
| Esconder a barra de macros no combate | Mundo | Esconde a barra de macros e a lista de jogadores de todos durante o combate. |

As animações ficam mais leves com o modo de desempenho "Baixo" do Foundry ou com "reduzir movimento" ligado no sistema.

## Combate com cartas (opcional)

Ligue em **Combate com cartas**, na seção **Cartas** do painel. No início do seu turno você compra uma mão nova (5 cartas por padrão) e age jogando cartas: cada carta faz a ação na hora, sem gastar Ação ou Ação Bônus. Espaços de magia, munição e usos continuam sendo gastos normalmente.

- **Clique** numa carta para jogar. **Botão direito** leva a carta para o campo **Guardada**, e ela volta na sua próxima mão (se a regra estiver ligada).
- **Atacar, Magia e Item** abrem a escolha da arma, magia ou item e usam o próprio dnd5e.
- **Ajudar, Agarrar/Empurrar e Corte −2** usam o alvo marcado. Sem alvo, o Corte −2 vai para o próximo da ordem.
- **Armadilha** fica virada ao lado da mão. Quando alguém te ataca, ela dispara e abre o seu contra-ataque.
- **Compre +2** compra 2 cartas aleatórias na hora, então dá para ter várias iguais.
- **Cartas de defesa** (Defender, Proteger, Resistir) vão para o campo de Defesa ao lado da mão e valem até o início do seu próximo turno. Cada uma só pode ser usada 1 vez por combate.
- **Truque** volta para o baralho depois de usado. **Habilidade** volta para a mão depois de usada (Habilidade só enquanto tiver usos, se tiver limite). **Magia** volta enquanto houver espaço de magia.
- **Habilidades da ficha** (Cura pelas Mãos, Retomar o Fôlego, Inspiração de Bardo…) viram cartas próprias, com o nome e o ícone da habilidade, e gastam os usos normalmente.

No menu **Cartas de combate** (Configurar Módulos), o mestre ajusta quantas cartas de cada tipo cada personagem tem (em branco = automático pela ficha) e cria **cartas personalizadas**. Uma carta de macro recebe `actor`, `token`, `combatant`, `carta`, `alvos` e `usuario`:

```js
// exemplo de macro para uma carta "Grito de Guerra"
for (const t of alvos) await t.actor.applyDamage(-5); // cura 5 em cada alvo
ChatMessage.create({ content: `${actor.name} solta um grito de guerra!` });
```

## Para macros e outros módulos

```js
const api = game.modules.get("combate-mesa").api;
api.resultados(game.combat);   // abre a tela de resultados de um combate
```

## Licença

MIT
