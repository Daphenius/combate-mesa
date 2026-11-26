# Histórico de versões — Combate da Mesa

> ⚠️ **Beta, em testes:** o Combate da Mesa ainda está sendo testado no Foundry VTT 14 e no D&D 5e 6 e pode ter erros. Teste primeiro num mundo de teste ou faça backup antes de ativar. Bugs e sugestões: https://github.com/Daphenius/combate-mesa/issues

## v0.3.7 (beta)

- **Ataques por ação (modo padrão, sem cartas):** a Ação de Ataque agora dá vários ataques com arma, como o Ataque Extra do D&D 5e. O primeiro ataque gasta a Ação e os outros saem de graça no mesmo turno; a barra mostra quantos ataques ainda restam. O número vem da ficha (Ataque Extra, Multiataque) ou o mestre ajusta por personagem.
- **Ataques múltiplos:** nova habilidade que o mestre combina com cada jogador. Ela aparece como um botão ao lado dos selos da barra; cada vez que o jogador ativa, ganha mais ataques neste turno. O mestre define quantas vezes pode ativar, quantos ataques cada uso dá e quando recarrega (a cada turno, a cada combate, descanso curto ou descanso longo).
- **Menu "Ataques por personagem"** (Configurações > Configurar Módulos > Combate da Mesa), só para o mestre, com padrões para PJs e NPCs.

## v0.3.6 (beta)

- **Correção do clique no aliado (Proteger, Ajudar, Agarrar):** para o mestre, clicar no token do alvo enquanto o aviso estava aberto era ignorado (o Foundry seleciona o token no mesmo clique e o módulo achava que era o próprio personagem). Agora o clique marca o alvo e a seleção volta para quem está agindo.
- **Marcar o alvo do jeito normal também vale:** com o aviso aberto, marcar o alvo pela tecla T ou pela ferramenta Alvo completa a ação na hora (antes o aviso continuava esperando o clique e a carta falhava).
- Um alvo antigo marcado no próprio personagem não é mais usado: o aviso pede o alvo de novo.

## v0.3.5 (beta)

- **Correção do alvo no próprio personagem:** enquanto o módulo espera o clique no alvo, clicar no seu próprio token (ou num token selecionado) agora é só seleção normal e não marca você mesmo como alvo; o aviso continua esperando o clique no alvo de verdade.
- **Alvo desmarcado depois da ação:** no combate, o alvo é desmarcado sozinho quando a ação termina (depois da rolagem de dano, ou do ataque/uso quando não há dano; e logo após Agarrar, Ajudar, Proteger e −2) e também na troca de turno. Assim a próxima ação pede o alvo de novo. Pode ser desligado em Interface.

## v0.3.4 (beta)

- **Integração com o Dados em Cena:** com o módulo Dados em Cena ativo, os testes do combate abrem a tela do Dados em Cena para o dono do personagem rolar os dados. Vale para Esconder e Procurar (barra e cartas) e para Agarrar/Empurrar, em que quem agarra rola Atletismo e o alvo rola Atletismo ou Acrobacia, cada um na sua tela. Salvaguardas contra magias e habilidades também: ao usar uma magia com teste de resistência (ex.: Bola de Fogo), cada alvo marcado rola a salvaguarda na tela do Dados em Cena, um por vez, contra a CD da magia, e o chat mostra quem passou ou falhou. Pode ser desligado em Regras. Precisa de um mestre on-line; sem o Dados em Cena, tudo rola como antes.

## v0.3.3 (beta)

- **Correção:** o erro vermelho "id [...] does not exist in the EmbeddedCollection collection" no início do turno. Acontecia quando o módulo tentava tirar um efeito (Esquiva, cartas de defesa ou Ajudar) que o Foundry ou o dnd5e já tinham tirado sozinhos. Agora o módulo confere antes e ignora o que já sumiu.

## v0.3.2 (beta)

- **Truque volta para o baralho:** depois de usada, a carta Truque sai da mão e volta para o baralho, podendo vir de novo nas próximas compras (antes ela voltava direto para a mão).
- **Contra-ataque mais forte:** quando a carta de reação (Armadilha) dispara, o jogador ganha um ataque e também uma magia contra quem atacou (o alvo já vem marcado; a magia gasta o espaço normalmente e cada escolha pode ser cancelada).

## v0.3.1 (beta)

- **Alvo ao clicar:** ao usar uma carta ou ação que precisa de alvo (Atacar, Agarrar, Ajudar, Proteger, habilidades, magias e ataques da barra) sem ter marcado ninguém, aparece um aviso e o próximo clique num token já marca ele como alvo, sem trocar para a ferramenta Alvo (Esc cancela, Shift+clique soma alvos). Fora disso os cliques continuam normais. Em Interface dá para escolher "Sempre" (clicar no token de outro sempre marca alvo) ou desligar.

- **Pilha de Atacar:** quando o personagem tem mais de um ataque (Ataque Extra ou quantidade configurada maior que 1), as cartas Atacar vêm empilhadas uma atrás da outra e contam como uma carta só, sem tirar espaço das outras cartas da mão. Um número (×2, ×3…) mostra quantos ataques restam; ao usar a carta da frente, a de trás continua na mão.

## v0.3.0 (beta)

- **Campo Guardada** ao lado da mão de cartas: botão direito numa carta leva ela para esse campo, e ela volta na sua próxima mão (ocupando um dos espaços). Clique na carta guardada para devolvê-la à mão antes disso. Se já houver uma carta guardada, ela troca de lugar com a nova.

## v0.2.9 (beta)

- **Nova carta Truque:** escolhe um truque da ficha, não gasta nada e volta para a mão depois de usada. A carta Magia agora é só para magias de 1º círculo ou mais.
- **Esquivar não é mais carta de defesa:** volta a ser uma carta comum (sem campo de Defesa e sem o limite de 1 vez por combate). As cartas de defesa são Defender, Proteger e Resistir.
- **Habilidades sem limite de usos** também voltam para a mão depois de usadas.

## v0.2.8 (beta)

- **Campo de Reação e campo de Defesa** ao lado da mão de cartas. A carta virada (Armadilha) fica no campo de Reação e dispara sozinha quando você é atacado. As cartas de defesa ficam no campo de Defesa, valem até o início do seu próximo turno e então se desfazem e o efeito acaba.
- **Novas cartas de defesa:** Defender (+1 na CA), Proteger (+2 na CA de um aliado marcado) e Resistir (vantagem em testes de resistência). Esquivar também virou carta de defesa. Cada carta de defesa só pode ser usada 1 vez por combate; depois disso ela não volta mais na compra.
- **Magia e Habilidade não acabam à toa:** depois de usadas, essas cartas voltam para a mão enquanto ainda houver espaço de magia ou usos da habilidade. Habilidades sem limite de usos são gastas normalmente.
- **Descrição nas cartas de habilidade:** a carta mostra o texto da habilidade da ficha (o texto completo aparece ao passar o mouse).

## v0.2.7 (beta)

- **Barra de ações maior e mais legível.** As cartas não ficam mais cortadas (o Foundry dava altura fixa aos botões) e ficaram maiores, com o nome inteiro embaixo. Nova opção **Tamanho da barra de ações** (Normal, Grande ou Enorme), de cada jogador. O padrão agora é Grande.
- **Magias mais fáceis de achar:** cada círculo ocupa uma linha inteira, com os espaços de magia ao lado do nome, e as abas de armas, magias, habilidades e itens ganharam uma **busca por nome**.
- **Nova aba Ações bônus:** junta tudo da ficha que gasta Ação Bônus (magias, habilidades, armas e itens) num lugar só.
- **Barra móvel:** arraste pela alça à esquerda do retrato para levar a barra para onde quiser. A posição fica salva para cada jogador. Clique duas vezes na alça para ela voltar ao canto.
- **O mestre vê a barra no turno de qualquer combatente,** inclusive dos personagens dos jogadores. Antes ela só aparecia no turno dos NPCs.

## v0.2.6 (beta)

- **O módulo voltou a carregar (o problema era da v0.2.5).** O arquivo do menu de cartas (`scripts/cartas/menu.js`) foi publicado vazio, e o Foundry parava de carregar o módulo inteiro: o Combate da Mesa não aparecia nas configurações e nada surgia ao iniciar um combate. O menu foi refeito.
- **Não quebra mais o Calendário da Mesa.** Os dois módulos usavam o mesmo prefixo `cm-` nas classes de estilo, e algumas tinham o mesmo nome (`cm-linha`, `cm-controles`, `cm-grupo`, `cm-barra`, `cm-vazio`). Com os dois ativos, o relógio do calendário ganhava o fundo translúcido da linha do tempo e os botões de tempo ficavam em colunas soltas; do lado do combate, a barra de ações podia ficar achatada pelo estilo das barras de progresso do calendário. Todas as classes, ids e variáveis de estilo do Combate da Mesa passam a usar o prefixo próprio `cmb-`. Nada muda no uso nem nas configurações salvas.

## v0.2.5 (beta, primeira versão publicada)

- **Combate com cartas no tema claro/escuro:** o painel ao lado da mão, o aviso de mão vazia, a janela de escolha e as etiquetas do menu de cartas seguem o tema do módulo. As cartas mantêm a moldura colorida nos dois temas.

## v0.2.4

- **Acompanha o tema do Foundry:** linha do tempo, barra de ações, painel de configurações e tela de resultados ficam claros ou escuros conforme o esquema de cores da interface escolhido nas configurações do Foundry, e mudam na hora quando ele é trocado. Nova opção "Tema" (Acompanhar o Foundry, Escuro ou Claro), por usuário. O anúncio de turno continua escuro nos dois temas, como uma faixa de cinema.
- **Tela de resultados mais limpa:** sem a faixa de couro, destaques em cartões simples e tabela sem grade pesada, no mesmo estilo da barra e da linha do tempo.

## v0.2.3

- **Barra de ações mais limpa**, no mesmo estilo da linha do tempo: painel escuro translúcido com cantos arredondados. Os selos viraram etiquetas com nome (Ação, Bônus, Reação) que ficam riscadas quando gastas. O movimento mostra "restante/total". Botão "Terminar" em destaque no seu turno. As abas mostram só o ícone, com o nome na aba aberta. As cartas viraram ícones quadrados com o nome embaixo, um ponto colorido indicando o selo que gastam e os usos numa etiqueta. Magias por círculo com os espaços em losangos.

## v0.2.2

- **Cartas de habilidade:** no combate com cartas, cada habilidade da ficha com Ação, Ação Bônus ou Reação (Cura pelas Mãos, Retomar o Fôlego, Inspiração de Bardo, Canalizar Divindade…) vira uma carta própria, com o nome e o ícone da habilidade. Usa pelo dnd5e e gasta os usos normalmente; sem usos restantes ela não entra na compra. No menu Cartas de combate, "Habilidade" define quantas cópias de cada uma (0 desliga).

## v0.2.1

- **Linha do tempo mais limpa:** virou uma faixa fina e translúcida, com retratos menores e um anel na cor de cada lado (aliado, inimigo, neutro). Quem joga agora fica maior, com brilho e o nome embaixo. A iniciativa aparece só ao passar o mouse (e sempre em quem está jogando). A vida virou uma linha fina; para inimigos no modo "descrição", um ponto colorido. Condições viraram ícones pequenos no canto do retrato. Nome, iniciativa, vida e condições ficam todos na dica ao passar o mouse. Botões de turno só com ícone.

## v0.2.0

- **Combate com cartas (opcional):** liga na seção **Cartas** do painel de configurações. Cada combatente compra uma mão nova no início do próprio turno (5 cartas, ajustável) e age jogando cartas, sem limite de Ação ou Ação Bônus. A mão fica no lugar da barra de macros e a barra de ações mostra só o retrato e o movimento.
- **13 tipos de carta:** Atacar, Magia (gasta o espaço de magia), Item, Mover, Esconder-se, Transformar-se (Forma Selvagem, sem gastar usos), Esquivar, Disparada, Ajudar (vantagem no próximo ataque ou teste do aliado), Agarrar/Empurrar (Atletismo contra o alvo), Armadilha (fica virada e contra-ataca quando você é atacado), Compre +2 e Corte −2.
- **Baralho automático pela ficha:** Atacar = número de ataques (Ataque Extra, Ataques Múltiplos), Magia só para conjuradores, Transformar só para quem tem Forma Selvagem. O mestre ajusta a quantidade de cada carta por personagem, ou os padrões de personagens e inimigos, no menu **Cartas de combate**.
- **Regras:** Atacar sempre na mão (opção), guardar 1 carta para o próximo turno com o botão direito (opção), inimigos também com cartas (opção), jogadores só agem pelas cartas (opção) e jogar fora do turno (opção).
- **Cartas personalizadas:** o mestre cria cartas com nome, imagem e texto, para todos, só personagens, só inimigos, uma classe (inclusive personalizada) ou personagens escolhidos. O efeito pode ser só o texto, usar um item da ficha ou rodar uma macro.
- **Revelação:** a carta jogada gira e aparece no meio da tela para todos, e fica registrada no chat.

## v0.1.3

- **Esconder a barra de macros no combate** agora é uma opção do mundo: o mestre liga ou desliga para todos (ele e os jogadores) de uma vez.

## v0.1.2

- **Painel de configurações:** as opções saíram da lista padrão do Foundry e foram para um painel próprio, com seções (Interface, Regras, Efeitos de cena), chaves de liga/desliga, opções em botões, etiquetas de "Mundo" e "Só você" e botão para restaurar o padrão. Abre pelo botão do módulo em Configurar Módulos. Jogadores veem só as opções deles.

## v0.1.1

- **Retrato da ficha:** a linha do tempo, a barra de ações, o anúncio de turno e a tela de resultados agora mostram o retrato da ficha do personagem. Nova configuração "Imagem dos personagens" para voltar à imagem do token. Quem não tem retrato próprio continua usando a imagem do token.

## v0.1.0

Primeira versão.

- **Linha do tempo de iniciativa** no topo da tela: quem joga agora vem primeiro, depois os próximos e, após o selo da próxima rodada, quem já jogou. Mostra vida (número para quem controla, descrição ou barra para inimigos, conforme a configuração), condições, concentração e iniciativa. Clique no retrato leva a câmera até o token.
- **Barra de ações** no canto inferior: selos de Ação, Ação Bônus e Reação, barra de movimento (pelo histórico de movimento nativo do Foundry) e cartas por aba (Armas, Magias por círculo com espaços de magia, Habilidades, Itens e Ações básicas). Cada carta usa o item pelo próprio dnd5e. Botão de terminar turno.
- **Economia de ações:** usar algo pela barra, pela ficha ou por macro apaga o selo certo. Tudo volta no início do turno do personagem. A opção "economia rígida" impede gastar o mesmo selo duas vezes.
- **Ações básicas:** Disparada (dobra o movimento), Esquiva (condição Esquivando até o próximo turno), Desengajar, Ajudar, Esconder (Furtividade), Procurar (Percepção), Preparar e Usar objeto.
- **Animação de ataque** no mapa, a partir do cartão de ataque do dnd5e: investida corpo a corpo ou projétil à distância, tremor e lampejo no acerto, esquiva no erro, e texto de acerto, erro e crítico. Respeita a visibilidade do resultado do dnd5e.
- **Anúncio de turno:** faixa de estandarte no início do combate, a cada rodada e a cada turno; câmera até o token.
- **Marcador de turno:** círculo de runas como imagem padrão do marcador de turno nativo do Foundry.
- **Tela de resultados** ao encerrar o combate: dano, cura, dano recebido, abates, acertos/erros e críticos, com destaques e botão para mandar ao chat.
