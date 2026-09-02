# Craques do Futuro

Painel de gestão para escolinhas de futebol, vendido por licença anual. O
dono do sistema cadastra escolas-cliente; cada escola tem administradores e
técnicos que cadastram atletas, turmas, avaliações, frequência etc.; e os
responsáveis (pais/atletas) têm um acesso só-leitura pra acompanhar a
evolução do filho.

> Este arquivo existe pra qualquer sessão (Claude ou humana, neste
> computador ou em outro) conseguir entender o projeto rapidamente e
> continuar de onde parou. Sempre que fechar uma etapa relevante, atualize
> a seção **Estado atual** e **Próximos passos** antes de seguir.

## Stack técnico

- **Sem build tool.** HTML/CSS/JS puro. Sem npm, sem bundler, sem framework.
  Cada página é um `.html` na raiz que carrega `css/style.css` e um ou dois
  `<script>` de `js/`.
- **Firebase** (Auth + Firestore), plano Spark (gratuito). SDK carregado via
  CDN com `<script type="module">`, sem npm — ver `js/firebase-init.js`.
- Projeto Firebase: `craques-do-futuro` (console: https://console.firebase.google.com).
- Repositório: https://github.com/rbgargioni/Craques-do-Futuro (branch `main`).

### Por que isso importa pra quem for mexer no código

Como não tem servidor/Cloud Functions, **tudo roda no navegador do
usuário**. Toda a segurança está nas *Security Rules* do Firestore
(`firestore.rules`), não no código JS — o JS só chama a API; quem garante
que um técnico não lê dado de outra escola é a regra publicada no console.

Abrir os `.html` direto no navegador (`file://`) **não funciona** pra
páginas com Firebase, porque `<script type="module">` bloqueia import por
`file://`. Pra testar, precisa servir por `http://` — qualquer servidor
estático local resolve (ex: `npx serve`, extensão Live Server do VS Code,
ou um `HttpListener` do PowerShell se não tiver Node/Python instalado).

## Papéis de acesso

```
dono            → cadastra escolas + administradores (pode ter mais de um "sócio" dono)
administrador   → mesmo acesso a dados que o técnico, e também cria técnicos
tecnico         → cadastra/edita atletas, turmas, avaliações, frequência, planos, recados
responsavel     → só leitura, vê a evolução do(s) atleta(s) vinculado(s) a ele
```

**Não existe um papel separado pra "cliente do plano mais completo"** —
qualquer `administrador` pode virar isso: o dono libera `limiteEscolas` +
`licencaFim` no perfil dele (em admin-escolas.html), e ele passa a poder
cadastrar/gerenciar escolas EXTRAS, além da própria. Ver seção "Múltiplas
escolas" mais abaixo — foi uma decisão consciente de simplificar (existia
um papel `gestor` à parte numa versão anterior, mas causava confusão
recorrente sobre "administrador vira gestor ou não" — foi removido).

Ao logar, dono cai em `admin-escolas.html`, responsável em
`responsavel.html`, técnico direto na escola dele (`index.html`), e
**administrador sempre cai em `gestor-escolas.html`** ("Minhas escolas") —
mostra a própria escola (com opção de editar o nome) e, se ele tiver
`limiteEscolas` liberado, também as escolas extras (cadastrar/editar/
excluir). Dali ele clica "Entrar na escola →" pra ir operar de verdade.

Guardados em `usuarios/{uid}` no Firestore (`uid` = Firebase Auth uid), com
`role` + `escolaId` (null só pro dono) + `atletaIds` (só pro responsável).
O modelo completo de dados está documentado no cabeçalho de
`firestore.rules` — é a fonte da verdade, leia antes de mudar qualquer
coisa relacionada a permissões.

Depois do login (`login.html`), `js/auth-guard.js` lê `usuarios/{uid}` e
redireciona pra página certa de cada papel. Toda página protegida declara
`<body data-allowed-roles="...">` com os papéis permitidos.

## Estado atual (o que já é real vs. o que ainda é mockup)

| Página | JS dedicado | Situação |
|---|---|---|
| `login.html` | `login.js` | ✅ real (Firebase Auth) |
| `admin-escolas.html` (dono) | `admin-escolas.js` | ✅ real — cria/edita escola, sócios, administradores, catálogo de planos de assinatura + uso por escola, fila de solicitações de plano, e revisão/exclusão de trials vencidos |
| `index.html` (dashboard) | `dashboard.js` | ✅ real |
| `atletas.html` | `atletas.js` | ✅ real — inclui nível de evolução/promoção de categoria, edição completa (nome/posição/turma/nascimento/telefone/observações) e desativar/reativar (só administrador) |
| `avaliacoes.html` | `avaliacoes.js` | ✅ real — sistema novo de 5 pilares/100 pontos (2026-09-01), ver seção própria abaixo |
| `frequencia.html` | `frequencia.js` | ✅ real |
| `planos.html` | `planos.js` | ✅ real |
| `comunicacao.html` | `comunicacao.js` | ✅ real |
| `relatorios.html` | `relatorios.js` | ✅ real |
| `comparativos.html` | `comparativos.js` | ✅ real |
| `configuracoes.html` | `turmas.js` | ✅ real — turmas, gestão de usuários; o mockup de "perfil do treinador" foi removido (nunca conectado) |
| `responsavel.html` | `responsavel.js` | ✅ real — evolução, radar, frequência, linha do tempo e recados do técnico |
| `area-do-atleta.html` | `area-do-atleta.js` | ✅ real — **sem login**, ver seção própria abaixo |
| `sem-acesso.html` | `sem-acesso.js` | ✅ real — mensagem genérica, ou aviso de trial/licença vencida com link pra `escolher-plano.html` |
| `cadastro-trial.html` | `cadastro-trial.js` | ✅ real — cadastro público de teste grátis por 7 dias, ver seção própria abaixo |
| `escolher-plano.html` | `escolher-plano.js` | ✅ real — administrador/técnico pede um plano (mesmo com licença vencida), ver seção "Planos de assinatura" abaixo |
| `gestor-escolas.html` ("Minhas escolas") | `gestor-escolas.js` | ✅ real — landing page do administrador, ver seção "Múltiplas escolas" abaixo |
| `vendas.html` | — (script inline) | página pública de vendas/marketing, sem auth-guard — standalone, sem dado do Firestore |
| `manual.html` | — (estático) | manual de uso público, sem auth-guard nem Firestore — focado no dia a dia de administrador/técnico (não cobre dono nem responsável), linkado no rodapé de `login.html` |

O responsável (`responsavel.html`) só vê **recados endereçados diretamente
ao atleta dele** (`mensagens.destinatarioId == atletaId`) — recados de
"toda a turma" ainda ficam só pra equipe (decisão consciente, ver
comentário em `firestore.rules`).

### Planos de assinatura — catálogo + uso por escola

Nova coleção plana `planosAssinatura/{planoId}` (nome, `limiteTecnicos`,
`limiteAlunos` — 0 = ilimitado, `ativo`), gerenciada só pelo dono numa
seção própria em `admin-escolas.html` ("Planos de assinatura", ao lado de
"Sócios da conta"). **Não confundir com `escolas/{id}/planos`**, que são
os planos de TREINO que o técnico cadastra — nomes parecidos, coisas
bem diferentes; ver comentário no topo de `firestore.rules`.

Cada `escola` ganhou um campo `planoId` (referência ao plano, `null` =
sem plano definido — é o caso de toda escola criada antes dessa feature).
Ao abrir uma escola pra editar, `admin-escolas.js` mostra quantos
treinadores (administrador + técnico) e alunos ela já tem, contra o
limite do plano contratado (`getCountFromServer()` — conta sem baixar os
documentos, calculado na hora, não fica sincronizado em nenhum campo).

**É só visibilidade, não trava nada:** passar do limite não impede
cadastrar mais um técnico ou atleta — o dono só vê o número (com aviso
visual em amarelo/vermelho perto do limite) e decide manualmente se
sugere upgrade pro cliente. Combina com o resto do app: tudo aqui é
decisão manual do dono, nada automático.

#### Solicitação de plano (venda semi-automática)

`escolher-plano.html` — administrador/técnico logado escolhe um plano
(`planosAssinatura` com `ativo == true`) e uma duração (1 ou 2 anos),
manda um pedido, e o dono confirma em "Solicitações de plano"
(`admin-escolas.html`). **Não tem pagamento processado pelo sistema
ainda** — o dono confirma manualmente depois de receber o pagamento por
fora (Pix, link de pagamento etc.); confirmar já atualiza `planoId`,
`status` e recalcula `licencaFim` (data de hoje + duração) na escola.

Essa página funciona **mesmo com a licença da escola vencida** — é
justamente pra isso que serve. `js/auth-guard.js` tem uma exceção
específica pra ela (senão cairia num loop de redirecionamento pra
`sem-acesso.html`, que é onde o link pra ela aparece quando o trial/
licença vence).

**Automação total (webhook confirmando pagamento sozinho) ainda não
existe** — decisão consciente, discutida com o Rafael: exigiria
integração real com um provedor de pagamento (ex: extensão oficial do
Stripe pro Firebase) e migrar o Firebase pro plano pago (Blaze). Fica
pra quando o Rafael tiver um provedor de pagamento configurado.

### Múltiplas escolas — o mesmo administrador, escopo maior

**Não existe um papel `gestor` separado** (existiu numa versão anterior, foi
removido — ver nota em "Papéis de acesso" acima). Em vez disso, qualquer
`administrador` pode ganhar a capacidade de gerenciar mais de uma escola: o
dono libera isso ao clicar num administrador na lista "Administradores desta
escola" (dentro de editar escola, em `admin-escolas.html`) e preenche
"Múltiplas escolas" — `usuarios/{uid}.limiteEscolas` (quantas escolas EXTRAS,
além da própria) + `licencaFim` (vencimento do pacote que cobre elas).
**Ainda não está ligado ao fluxo de "Solicitação de plano"** — é um passo
manual à parte, decisão consciente pra não misturar dois fluxos de venda
diferentes nesta primeira versão.

Todo administrador cai em `gestor-escolas.html` ("Minhas escolas", o nome do
arquivo ficou de uma versão anterior mas a página é só do administrador
agora) ao logar:

- **Escola "de casa"** (`window.CF.escolaId`, fixo no perfil, do jeito que
  sempre foi): SEMPRE aparece, com um botão "Editar nome". **Nunca aparece
  "Excluir"** — apagar a própria escola continua exigindo o dono, decisão
  consciente pra não deixar a escola "sumir" sem ele saber.
- **Escolas extras** (`escolas/{id}.administradorUid == seu uid`): só
  aparecem (cadastrar/editar/excluir) pra quem tem `limiteEscolas` liberado
  pelo dono — pra administrador comum (a maioria), essa parte da tela nem
  aparece (`js/gestor-escolas.js` esconde os elementos
  `[data-requer-multi-escola]` quando `window.CF.limiteEscolas` é 0/null).
- **Limite de escolas extras é no máximo 5**, seja lá o que o dono digitar —
  o campo `limiteEscolasMulti` em `admin-escolas.html` tem `max="5"` e o
  submit recusa valor maior (`js/admin-escolas.js`). Fora esse teto, a
  contagem em si é só na interface (o botão "Cadastrar escola" some depois
  do limite que o dono deu) — mesma decisão consciente de "visibilidade,
  não bloqueio hermético" já usada pro limite de treinador/aluno dos planos
  de assinatura. Não tem um contador à prova de burla na regra do Firestore
  (exigiria manter um campo sincronizado à parte); ver comentário no topo de
  `firestore.rules`.
- **O acesso a uma escola extra NÃO depende do licencaFim dela** —
  `isStaffAtivo()` em `firestore.rules` dá acesso total (ler, escrever,
  criar técnico, editar, excluir) enquanto `escolas/{id}.administradorUid
  == seu uid`, sem checar o `licencaFim` da escola em si. Esse campo só é
  usado como teto na hora de CRIAR (não dá pra criar uma escola extra com
  vencimento além do PACOTE do administrador), depois disso é só um dado
  informativo. Quem corta o acesso é o dono, manualmente (zerando
  `limiteEscolas` ou apagando o perfil) — mesmo padrão manual do resto do app.
- **Excluir uma escola extra** — botão "Excluir escola" no card (nunca
  aparece no card da escola de casa). Apaga em cascata
  turmas/atletas(+progressão)/avaliações/frequência/planos/mensagens/
  resumosPublicos e os perfis (`usuarios/{uid}`) de administrador/técnicos/
  responsáveis vinculados — mesmo padrão de `excluirEscolaTrialVencida()`
  que o dono já usa pra trials vencidas. **Limitação conhecida**: como o
  resto do app, não apaga a conta de login (Firebase Auth) de quem ficou
  vinculado, só o acesso (perfil em `usuarios/{uid}`) — não dá pra apagar a
  conta Auth de outra pessoa a partir do cliente, sem Admin SDK.
- **"Entrar na escola →"**: no card (de casa ou extra), um botão leva pra
  dentro dela (`index.html`, `atletas.html` etc.), como se fosse o
  administrador dela. Um link "← Minhas escolas" aparece no topo dessas
  páginas pra voltar. Escolher uma escola EXTRA fica guardado no
  `localStorage` deste navegador (`cf_gestorEscolaAtiva`, nome também
  legado) e tem prioridade sobre a de casa até trocar de novo — é por isso
  que `js/auth-guard.js` tem uma lógica própria pra resolver
  `window.CF.escolaId`. Sem nenhuma escolha (a grande maioria dos
  administradores), continua sendo sempre a escola de casa, sem mudança
  nenhuma de comportamento.
- Dentro de qualquer escola (de casa ou extra), o acesso é idêntico ao de
  sempre (inclusive criar técnicos, ver "Gestão de usuários" abaixo) —
  **nenhuma tela operacional (atletas/avaliações/frequência/...) precisou
  de código novo**, elas só leem `window.CF.escolaId`, que já chega certo.

### Gestão de usuários — administrador cadastra técnico direto pelo site

Nova seção em `configuracoes.html` ("Gestão de usuários", visível só pra
administrador — técnico não vê, `data-roles="administrador"`): lista os
técnicos da escola atual (de casa ou extra, tanto faz) e deixa cadastrar um
novo (nome/e-mail/senha provisória), usando o mesmo padrão de
conta-sem-deslogar (`criarContaSemDeslogar()`) já usado em
`admin-escolas.js`/`gestor-escolas.js`. A PERMISSÃO de administrador criar
técnico já existia nas regras desde sempre — só faltava a tela.

Cada técnico da lista tem um botão **"Enviar redefinição de senha"** — manda
um e-mail (`sendPasswordResetEmail`) com um link pra ele escolher uma senha
nova. **Não existe "resetar e ver a senha nova na tela"**: o projeto é
100% client-side (sem Admin SDK), então definir a senha de outra pessoa
diretamente não é possível a partir do navegador — o e-mail é o único jeito
seguro de fazer isso sem servidor.

Cada card de escola em `gestor-escolas.html` ("Minhas escolas") tem um botão
**"Gestão de usuários"** que salva a escolha de escola ativa (mesmo mecanismo
do "Entrar na escola →") e já pousa em `configuracoes.html#secaoGestaoUsuarios`
— evita ter que "entrar" na escola e depois achar a seção pelo menu lateral.
Cada card também mostra 3 números ao vivo (`getCountFromServer`, calculado na
hora): **Treinadores**, **Alunos** e **Turmas**.

⚠️ **Achado num teste real (2026-08-28)**: "Treinadores" conta
administrador+técnico juntos, mas a lista de "Gestão de usuários" só mostra
técnicos (só o dono cria/remove administrador) — então o número não batia
com nada visível na tela, e não tinha como saber quem era o(s) outro(s)
administrador(es) contados. Corrigido adicionando uma lista **só leitura**
"Administradores desta escola" (`ouvirOutrosAdministradores()` em
`js/turmas.js`, marca o próprio usuário logado com a etiqueta "você") logo
abaixo da lista de técnicos — sem botão de criar/editar/remover, é só pra
essa contagem fazer sentido.

### Desativar/excluir atleta — só administrador, técnico não pode

Decisão consciente com o Rafael: **não existe exclusão de verdade de atleta**
a partir do app (perderia o histórico de avaliações/frequência de uma criança
por engano). "Excluir" na conversa virou só um campo booleano `desativado`
em `escolas/{id}/atletas/{id}` — **só administrador pode mudar esse campo**
(técnico continua podendo cadastrar/editar atleta normalmente, só não pode
desativar ninguém). Botão "Desativar atleta"/"Reativar atleta" no card, em
`atletas.html`, só aparece pra quem está logado como administrador
(`window.CF.role === "administrador"`, checado direto no JS — diferente do
`data-roles` estático, porque os cards são montados dinamicamente por
atleta). Quando desativado, o card ganha uma etiqueta **"Inativo"** visível
pra todo mundo (inclusive técnico) — é só um aviso, o atleta continua
aparecendo normalmente em todas as telas (avaliações, frequência, etc.),
não some de lugar nenhum.

Não confundir com o campo `status` do atleta (`"ativo"`/`"atencao"`, saúde da
avaliação — hoje só setado uma vez na criação, nunca atualizado por nenhuma
tela) nem com `statusPagamento` (ver seção abaixo) — três campos parecidos
de nome, coisas bem diferentes; ver comentário no modelo de dados em
`firestore.rules`.

A regra do Firestore (`escolas/{id}/atletas/{id}`, `allow update`) trava isso
via `request.resource.data.diff(resource.data).affectedKeys()`: técnico pode
mudar qualquer campo MENOS `desativado`; administrador/dono podem mudar
qualquer um. Validei essa lógica com Firestore mockado (card mostra o botão
só pro administrador, o toggle chama `updateDoc` certo, a etiqueta "Inativo"
aparece condicionalmente) — a regra em si ainda não foi testada contra o
Firestore de verdade.

### Status de pagamento do aluno — indicador visual (não é cobrança de verdade)

Cada atleta tem um campo `statusPagamento` (`"em_dia"` ou `"inadimplente"`),
mostrado como uma etiqueta no card do atleta em `atletas.html` — o técnico
clica pra alternar. É **só um lembrete visual**, não tem cobrança/gateway de
pagamento nenhum rodando por trás (mensalidade da escolinha pro aluno é um
fluxo manual, fora do sistema, por enquanto). O responsável também vê esse
status (só leitura) em `responsavel.html`.

De propósito, **não aparece na "Área do atleta"** (`area-do-atleta.html`,
link sem login) — informação de pagamento é sensível demais pra uma página
sem autenticação.

### Área do atleta — acesso sem login por código

Cada atleta ganha um **código de 6 caracteres** (`codigoPublico`, ex:
`VA02T5`) mostrado no card dele em `atletas.html`, com um botão pra gerar
um novo (invalida o antigo). O responsável entra em `area-do-atleta.html`
(link na tela de login), digita o código e vê **só o nome do atleta e
gráficos** (radar dos 5 Pilares + % de frequência) — sem precisar de conta,
e-mail ou senha.

Isso existe porque um responsável às vezes só quer uma olhada rápida, sem
criar conta. É **intencionalmente mais limitado** que o login completo
(`responsavel.html`): nada de telefone, observações, recados ou histórico
detalhado passa por aqui — só um resumo público e reduzido.

Como funciona por baixo (importante entender antes de mexer):
- `escolas/{id}/atletas/{id}.codigoPublico` é só uma referência; os dados
  de verdade exibidos vêm de uma coleção plana separada,
  `resumosPublicos/{codigoPublico}` (nome + radar + nota geral +
  contadores de presença/total — nada mais).
- Essa coleção é a **única** no projeto com leitura pública nas regras
  (`allow get: if true`), e só por ID exato — `allow list: if false`
  impede listar/varrer todos os códigos. Sem isso, brute-force seria trivial.
- `js/atletas.js` cria o resumo ao cadastrar o atleta; `js/avaliacoes.js`
  atualiza o radar/nota a cada avaliação salva; `js/frequencia.js`
  incrementa os contadores de presença a cada chamada salva (usa
  `increment()`, não recalcula tudo do zero).
- Regenerar o código (botão "⟳" no card) cria um resumo novo copiando os
  dados do antigo e apaga o antigo — pra vazamento de código não obrigar a
  perder o histórico acumulado.
- **Limitação conhecida:** a sincronização só acontece em avaliações/chamadas
  salvas *depois* que esse recurso existe — avaliações e frequência que já
  existiam antes não entram retroativamente no resumo. O link "Recalcular a
  partir do histórico" no card do atleta conserta isso na hora (relê todas
  as avaliações/frequência dele e reconstrói o resumo do zero).

### Teste grátis de 7 dias — cadastro público sem passar por um dono

`vendas.html` (página pública de marketing, sem vínculo com o Firestore) e
`login.html` linkam pra `cadastro-trial.html`, onde qualquer pessoa cria uma
conta nova sozinha: digita nome da escola, seu nome, e-mail e senha, e o
`js/cadastro-trial.js`:

1. Cria a conta de login (`createUserWithEmailAndPassword` na instância
   **principal** do Auth — diferente do `criarContaSemDeslogar()` usado em
   `admin-escolas.js`, porque aqui é a própria pessoa se cadastrando, não um
   dono criando conta de outra pessoa).
2. Cria `escolas/{id}` com `status: "trial"` e `licencaFim` travada em no
   máximo 7 dias a partir de agora.
3. Cria `usuarios/{uid}` como `administrador` apontando pra essa escola.
4. Manda pra `index.html`, e o `auth-guard.js` assume o resto normalmente.

Se qualquer passo depois da criação da conta falhar, desfaz o que já tiver
sido criado (`deleteDoc` da escola, `deleteUser` da própria conta) — senão
sobra escola ou conta órfã.

**A trava de 7 dias é da regra do Firestore, não do JS** —
`ehCriacaoDeTrialValida()` em `firestore.rules` confere que
`licencaFim <= licencaInicio + 7 dias`, então não dá pra um cliente adulterado
se dar um trial mais longo. Pra um usuário completamente novo (sem
`usuarios/{uid}` ainda) poder criar o próprio perfil sem que `myRole()` dê
erro de avaliação num documento que não existe, `myRole()` ganhou uma
guarda (`meuPerfilExiste()`) — leia o comentário no topo de
`firestore.rules` antes de mexer em qualquer função de papel.

**O que acontece depois dos 7 dias (decisão consciente, não é limitação
técnica):** nada automático. Sem Cloud Functions/plano pago, o modelo
escolhido foi:
- `sem-acesso.js` detecta `status == "trial"` na escola de quem tenta entrar
  e mostra "seu teste acabou" com link pra `vendas.html#planos`.
- **Pagamento é manual por enquanto**: a pessoa fala com o Rafael, que
  confirma o pagamento e muda `status` pra `"ativa"` (e estende
  `licencaFim`) direto no formulário de editar escola em
  `admin-escolas.html` — já dava pra fazer isso, só faltava a opção
  "Teste grátis (7 dias)" no `<select>` de status pra não ficar em branco
  ao abrir uma escola trial pra editar.
- **Exclusão também é manual, com revisão do dono**: `admin-escolas.html`
  lista toda escola com `status == "trial"` e `licencaFim` vencida numa
  seção "Trials vencidos", com um botão "Excluir escola e dados" por linha
  (`excluirEscolaTrialVencida()` em `js/admin-escolas.js`). **Nada é
  apagado sozinho** — o dono só vê a lista e decide.
- A exclusão apaga turmas/atletas(+progressao)/avaliações/frequência/
  planos/mensagens da escola, os `resumosPublicos` e os `usuarios/{uid}`
  vinculados a ela. **Limitação conhecida:** não apaga a conta de login
  (Firebase Auth) de quem ficou vinculado — só é possível apagar a própria
  conta Auth a partir do cliente, nunca a de outra pessoa, sem Admin SDK.
  Na prática o acesso já fica bloqueado (auth-guard desloga quem não tem
  mais perfil em `usuarios/{uid}`), mas a entrada continua existindo em
  Authentication → Users no console, e pode ser removida de lá manualmente
  se quiser limpar de vez.

`js/metricas.js` centraliza toda a régua de avaliação. **Qualquer mudança
de critério de avaliação deve mexer só nesse arquivo.**

### Sistema de avaliação — 5 Pilares / 100 pontos (substituiu o antigo em 2026-09-01)

Um técnico consultado pelo Rafael apontou que a régua antiga (nota 0-10
direta por pilar + fundamentos técnicos DIFERENTES por posição, ver
"⚠️ pendência" abaixo) estava desatualizada. O substituto — `PILARES_100`
em `js/metricas.js` — muda duas coisas ao mesmo tempo:

1. **Escala nova**: cada pilar tem um peso fixo que soma até 100 no total
   (Físico 20 + Técnico 30 + Tático 20 + Mental 18,5\* + Potencial/Futuro 10),
   dividido em várias **subcategorias**, cada uma avaliada de 0 a 10.
   Fórmula (o avaliador NUNCA digita peso, só a nota): `pontuação da
   subcategoria = (nota ÷ 10) × peso da subcategoria`; soma das
   subcategorias = nota do pilar; soma dos 5 pilares = nota final.
2. **Técnico virou universal**: revoga de vez os "fundamentos técnicos por
   posição" (pesos diferentes pra Volante, Atacante etc., ver "⚠️
   pendência" abaixo) — agora TODO atleta usa as mesmas 10 subcategorias no
   pilar Técnico, goleiro ou atacante. Decisão consciente e confirmada com
   o Rafael, mesmo isso contradizendo o discurso de vendas anterior
   ("métricas específicas por posição" em `vendas.html`) — ainda não
   atualizei `vendas.html` pra refletir isso.

\* **Pendência de dados, não de código**: o enunciado que o técnico mandou diz
"Mental/Comportamental: peso total 20", mas a soma das 10 subcategorias que
ele listou dá 18,5 — falta 1,5 ponto em algum lugar (ver comentário em
`PILARES_100.mental` no código). Até o Rafael confirmar com o técnico qual
número está certo, o sistema usa 18,5 (soma real das subcategorias) — a
nota final máxima hoje é **98,5/100**, não 100/100.

**Migração em 3 fases** (pra não quebrar o site inteiro de uma vez):
- ✅ **Fase 1** — `js/metricas.js`: `PILARES_100`, cálculo, validação, ranking
  de pontos fortes/fracos. Testado com dados mockados.
- ✅ **Fase 2** — `avaliacoes.html`/`js/avaliacoes.js`: formulário novo (46
  campos, renderizados dinamicamente a partir de `PILARES_100` — nada
  disso é escrito à mão no HTML), nota final e ponto forte/a desenvolver
  calculados ao vivo. Cada avaliação salva grava `notasPorPilar` +
  `pontuacaoPorPilar` + `notaFinal`, e TAMBÉM um "espelho" de compatibilidade
  0-10 (`tecnico`/`tatico`/`fisico`/`mental`/`evolucao`/`geral`) pra Fase 3
  não precisar acontecer no mesmo dia. Avaliações de ANTES dessa mudança
  não têm os campos novos — aparecem com "—" nas colunas novas da tabela em
  vez de quebrar.
- ✅ **Fase 3** — Dashboard, Relatórios, Comparativos, `responsavel.html` e a
  "Área do atleta" continuam lendo o "espelho" 0-10 (o radar de 5 pontas em
  si é normalizado por natureza — pilares de pesos diferentes, tipo 30 vs
  10, só cabem juntos numa mesma régua visual se forem normalizados pra
  0-10; a pontuação "por peso" de verdade já fica na tela de Avaliações,
  Fase 2), só que o eixo/coluna que antes chamava **"Evolução" agora chama
  "Potencial"** — o campo em si (`evolucao`) não mudou de nome (evitaria
  migrar avaliação já salva), só o rótulo visível em `radar-label` (6
  arquivos) e no cabeçalho da tabela de `responsavel.html` + `PILARES_TABELA`
  em `js/metricas.js` (usado por `comparativos.js`). `manual.html` também
  foi corrigido — ainda descrevia a régua antiga.

Com isso a migração de código está completa nas 3 fases. Ainda faltam 2
coisas fora do código em si: confirmar com o técnico o peso certo do pilar
Mental (ver "⚠️ pendência" acima) e reescrever o discurso de `vendas.html`
("métricas específicas por posição" não é mais verdade). Os indicadores
combinados antigos (`calcularInteligenciaDefensiva`,
`calcularCapacidadeDeAtaque`, `calcularPoderDeFinalizacao`) e o resto do
sistema depreciado (`FUNDAMENTOS_POR_POSICAO`, `calcularNotaTecnica`) podem
ser removidos de `js/metricas.js` quando quiser — não tem mais nenhuma
tela usando eles, ficaram só documentados como "depreciado" no arquivo.

### "Adicionar à tela inicial" no celular (PWA leve, sem Service Worker)

Toda página tem um `manifest.json` (raiz do projeto) + `<link rel="manifest">`
+ `<link rel="apple-touch-icon">` + `<meta name="apple-mobile-web-app-title">`
no `<head>` — isso é **só o suficiente pra "Adicionar à tela inicial" ficar
com nome e ícone certos** ("Craques do Futuro", ícone verde com "CF", igual
o `brand-badge`), tanto no Android (usa o manifest) quanto no iOS (Safari
ignora a maior parte do manifest e usa os `<meta>`/`<link rel="apple-touch-
icon">` em vez disso — por isso os dois jeitos estão presentes). `start_url`
do manifest aponta pra `login.html`.

**Não é um PWA de verdade** — não tem Service Worker, então não funciona
offline nem tem "instalar app" nativo do Chrome/Android (aquele banner/
prompt automático exige Service Worker registrado). É só o atalho com
aparência de app. Os ícones (`img/icon-180.png`, `img/icon-192.png`,
`img/icon-512.png`) foram gerados uma vez via `<canvas>` (desenho
programático do mesmo quadrado verde arredondado + "CF" do `favicon.svg`,
exportado como PNG) — não são um asset de design entregue pelo sócio; se um
dia tiver uma logo oficial de verdade, é só substituir esses 3 arquivos
(mesmos nomes/tamanhos) e o `favicon.svg`.

## Convenções do projeto (siga estas ao adicionar código)

- **Português sem acento** nos nomes de campo do Firestore e nas variáveis
  de dados (`nome`, `posicao`, `licencaFim`, `nivelAtual`...) — é o padrão
  usado desde o início, mantenha consistência.
- **Sempre escope por `escolaId`**: toda leitura/escrita de dado de escola
  usa `collection(db, "escolas", window.CF.escolaId, "...")`. Nunca faça
  uma query sem esse escopo pra coleções dentro de uma escola.
- **Nunca use `innerHTML` com dado vindo do Firestore.** Use
  `createElement`/`textContent`, ou o helper `window.CFTurmaBar` (barra de
  turma ativa) já pronto em `js/Script.js`. Motivo: nome/categoria/etc. são
  campos de texto livre digitados por técnicos — um `innerHTML` com dado
  não escapado é XSS armazenado (já corrigimos um caso assim, ver commit
  `dfab8b9`).
- **`js/Script.js`** é compartilhado por todas as páginas (script clássico,
  sem `type="module"`) e expõe helpers globais tipo `showToast()`,
  `window.CFBadgeLicenca`, `window.CFTurmaBar`. Cada página tem também o
  seu próprio módulo (`js/atletas.js` etc.) com a lógica real daquela tela.
- **Criar login sem deslogar quem está usando o site**: quando um
  dono/administrador cria a conta de outra pessoa (sócio/administrador/
  técnico), isso usa uma segunda instância isolada do Firebase App
  (`initializeApp` com um nome diferente) só pra chamar
  `createUserWithEmailAndPassword`, depois descarta essa instância — ver
  `criarContaSemDeslogar()` em `js/admin-escolas.js`.
- **Regras do Firestore não têm deploy automático.** Depois de editar
  `firestore.rules`, é preciso colar o conteúdo manualmente no console
  (Firestore Database → Regras → Publicar). Não existe Firebase CLI
  configurado neste projeto.

## Como testar localmente

1. Sirva a pasta por HTTP (não abra `.html` direto). Sem Node/Python
   instalados, um jeito rápido é um `HttpListener` do PowerShell servindo
   `C:\Users\user\Documents\GitHub\Craques-do-Futuro` numa porta livre.
2. Pra testar um papel específico (dono/administrador/técnico/responsável),
   precisa de uma conta de teste daquele papel — ver contas já criadas no
   Firebase Console → Authentication → Users, ou criar uma nova.
3. Não tem suíte de testes automatizados ainda.

## Segurança — cuidado com isto

- **Nunca gere/commite a chave do Admin SDK** (Configurações do projeto →
  Contas de serviço → Gerar nova chave privada). Isso dá acesso total ao
  banco, ignorando todas as regras. O projeto é 100% client-side e nunca
  precisa dela. Se uma for gerada por engano, revogue em
  console.cloud.google.com → IAM e administrador → Contas de serviço →
  Chaves.
- A config pública do app (`js/firebase-init.js`, com `apiKey` etc.) **é
  segura de commitar** — não é segredo, é assim que o Firebase Web funciona.
  A segurança real está nas Security Rules.
- `resumosPublicos` é a **única** coleção com leitura pública (`allow get:
  if true`, sem `allow list`) — ver seção "Área do atleta" acima antes de
  copiar esse padrão pra outra coleção. Tudo mais exige login.
- **Nunca mostrar os pesos (%) dos fundamentos técnicos na interface** —
  eles ficam só em `js/metricas.js` (código, não é enviado como texto pra
  tela). É a metodologia de avaliação do sócio; a ideia é não facilitar
  cópia por quem só olhar a tela do app.

## Não testado de ponta a ponta ainda (falta conta/dado real, não é bug conhecido)

- `responsavel.html`/`js/responsavel.js` — validei sintaxe, geometria dos
  gráficos e que todo ID do JS existe no HTML, mas não testei com uma
  conta de responsável real vinculada a um atleta com avaliações/frequência/
  recados cadastrados.
- **Planos de assinatura** (`admin-escolas.html`/`js/admin-escolas.js`,
  ver seção própria acima) — o Rafael já confirmou que o painel "Novo
  plano" abre certo, mas ainda falta testar de ponta a ponta: salvar um
  plano, vincular numa escola, conferir se a contagem de treinadores/alunos
  (`getCountFromServer()`) aparece certa e se o aviso amarelo/vermelho
  aparece perto do limite.
- **Solicitação de plano** (`escolher-plano.html` → "Solicitações de
  plano" em `admin-escolas.html`) — validei sintaxe, geometria da data
  (`+12`/`+24` meses) e que todo ID existe no HTML, mas ainda não testei
  ao vivo: pedir um plano como administrador, confirmar como dono, e
  conferir se a escola atualiza `planoId`/`licencaFim` certinho. Também
  não testei a exceção do `auth-guard.js` pra essa página com uma escola
  de verdade com licença vencida.
- **Múltiplas escolas / "Minhas escolas"**
  (`gestor-escolas.html`/`js/gestor-escolas.js`, seção "Múltiplas escolas"
  acima) — **testado ao vivo em 2026-08-27 e 2026-08-28** (pelo Rafael, com
  a conta "Rafa"): administrador cai em `gestor-escolas.html` vendo a
  própria escola, Treinadores/Alunos/Turmas contam certo, "Gestão de
  usuários" leva pro lugar certo, lista de administradores bate com a
  contagem de Treinadores. **Ainda NÃO testado**: dono liberar
  `limiteEscolas`/`licencaFim` num administrador (painel "Múltiplas
  escolas" em admin-escolas.html, agora travado em máximo 5) e ele
  cadastrar/editar/excluir uma escola extra a partir daí.
  ⚠️ **Bug encontrado no teste de 2026-08-27 e corrigido**: "Treinadores"
  aparecia como "—" (contagem falhando) porque a regra de leitura de
  `usuarios` só liberava o próprio perfil ou o dono. Corrigido e já
  reconfirmado funcionando.
- **Gestão de usuários** (seção em `configuracoes.html`) — **testado ao
  vivo em 2026-08-28**: um técnico cadastrado pela tela apareceu certo na
  lista, e a contagem de Treinadores bateu depois de adicionar a lista de
  administradores (ver seção acima). Ainda não testado: o botão de
  redefinição de senha mandando o e-mail de verdade.
- **Status de pagamento do aluno** (badge em `atletas.html`, leitura em
  `responsavel.html`) — já testado ao vivo pelo Rafael em 2026-08-27,
  funcionando (badge "Em dia" aparecendo certo no card de cada atleta).
- **Desativar/excluir atleta** (`js/atletas.js`) + contagem de **Turmas** e
  botão **"Gestão de usuários"** em `gestor-escolas.html` + contagem de
  alunos por turma em `configuracoes.html` (tudo adicionado em 2026-08-28,
  ver seção "Desativar/excluir atleta" acima) — validado só com Firestore
  mockado (botão aparece só pro administrador, some pro técnico, etiqueta
  "Inativo" some/aparece certo, `updateDoc` chamado com o campo certo).
  **Nada disso foi testado no Firebase real ainda**, incluindo a regra nova
  de `atletas` (`allow update` com `diff().affectedKeys()`).
- **Editar atleta** (`js/atletas.js`, botão "Editar atleta" no card,
  administrador e técnico) — validado só com Firestore mockado: formulário
  populado com os dados certos, `updateDoc` salva os campos certos, e mudar
  de turma tira o atleta da lista da turma antiga. Ainda não testado ao
  vivo.
- **Sistema de avaliação novo (5 pilares/100 pontos)** — Fases 1 e 2 (ver
  seção própria acima), validado só com Firestore mockado: os 46 campos
  renderizam certo (8+10+9+10+9 por pilar), soma dos pesos bate com o
  declarado (exceto Mental, ver pendência), totais por pilar e nota final
  atualizam ao vivo, salvar grava `notasPorPilar`/`pontuacaoPorPilar`/
  `notaFinal` + o espelho de compatibilidade, e uma avaliação do formato
  antigo continua aparecendo na tabela (com "—" nas colunas novas) em vez
  de quebrar. **Nada disso foi testado no Firebase real ainda.**

`area-do-atleta.html`/`js/area-do-atleta.js` **já foi testado de ponta a
ponta no Firebase real** em 2026-08-27 (código de um atleta real, "Vicente",
retornou o nome corretamente) e funciona.

`cadastro-trial.html`/`js/cadastro-trial.js` (cadastro público de teste
grátis) **já foi testado de ponta a ponta no Firebase real** em
2026-08-27 e funciona: cadastro cria a conta, a escola trial e o perfil de
administrador, e a escola aparece pro dono em `admin-escolas.html` pra
editar status/licença manualmente. No caminho, um card de escola com
`licencaFim` inválido/ausente estava travando o `forEach` e escondendo as
escolas seguintes da lista — corrigido (agora pula só a escola com
problema e loga no console, ver `carregarEscolas()`/`trialVencido()` em
`js/admin-escolas.js`). Se aparecer esse log de erro no console, vale
achar essa escola no Firestore e corrigir/apagar o documento manualmente.

## Próximos passos conhecidos

- **Confirmar com o técnico o peso certo do pilar Mental/Comportamental**
  (soma das subcategorias dá 18,5, o enunciado dizia 20 — ver seção "5
  Pilares / 100 pontos" acima) e ajustar `PILARES_100.mental` em
  `js/metricas.js`.
- As 3 fases da migração do sistema de avaliação estão no ar — pode
  remover o sistema antigo depreciado de `js/metricas.js`
  (`FUNDAMENTOS_POR_POSICAO`, `calcularNotaTecnica`, `analisarFundamentos`,
  os 3 indicadores combinados) quando quiser, não tem mais nada usando.
- Testar o sistema de avaliação novo (5 pilares/100 pontos) no Firebase
  real de ponta a ponta — só validado com dados mockados até agora.
- Atualizar `vendas.html` — o discurso de "métricas específicas por
  posição" não é mais verdade depois da mudança pro Técnico universal.
- ✅ `firestore.rules` com a regra do campo `desativado` já está publicada.
  Falta testar desativar/reativar um atleta de verdade, como administrador e
  como técnico (técnico tem que apanhar `permission-denied` se tentar mudar
  `desativado` direto).
- Testar `responsavel.html`, Planos de assinatura, o fluxo de Solicitação de
  plano e o fluxo de "Minhas escolas"/múltiplas escolas de ponta a ponta
  (ver seções acima) — `cadastro-trial.html`, `area-do-atleta.html` e a
  escola de casa em "Minhas escolas" já foram testados e funcionam.
- Ligar a liberação de "múltiplas escolas" ao fluxo de venda (hoje é manual,
  o dono abre um administrador em admin-escolas.html e preenche
  `limiteEscolas`/`licencaFim`) — decidir se isso passa pelo mesmo
  `solicitacoesPlano`/`escolher-plano.html` já existente ou fica separado.
- Assim que o Rafael tiver um provedor de pagamento (Mercado Pago,
  PagSeguro, Stripe...) configurado, ligar a confirmação automática por
  webhook — hoje o dono confirma manualmente em "Solicitações de plano"
  depois de receber o pagamento por fora do sistema.
- Checar no Firestore Console se sobrou alguma escola de teste com
  `licencaFim` inválido/ausente (ver nota na seção "Não testado de ponta a
  ponta" acima) — provavelmente um resquício de teste manual, mas vale
  conferir/apagar.
- Preencher um contato de verdade (e-mail/WhatsApp) em `vendas.html` — hoje
  o botão de "Agendar uma demonstração" usa um `mailto:` placeholder
  (`contato@craquesdofuturo.com.br`).
- Decidir se/quando publicar preços reais nos planos de `vendas.html`
  (hoje ficam como "Valor em definição" de propósito).
- Validar com o sócio os pesos de fundamentos técnicos de Goleiro,
  Zagueiro e Lateral em `js/metricas.js` (Volante, Atacante e Meio de
  campo genérico já foram passados pelo sócio).
- Decidir onde/como exibir os indicadores combinados já calculados em
  `js/metricas.js` (`calcularInteligenciaDefensiva`,
  `calcularCapacidadeDeAtaque`, `calcularPoderDeFinalizacao`) — nenhum
  aparece em tela ainda. Precisa definir com o Rafael/sócio o formato
  (ex: card extra na tela de Avaliações? Só em Relatórios?).
- Construir o "reverter pro checkpoint anterior" da progressão de
  categoria (documentado no modelo de dados de `firestore.rules`, ainda
  não tem interface).
- Decidir onde hospedar o site publicamente (hoje só roda local/teste) —
  Firebase Hosting é a opção mais natural, ainda não configurada.
