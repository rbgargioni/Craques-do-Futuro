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
| `admin-escolas.html` (dono) | `admin-escolas.js` | ✅ real — cria/edita escola, sócios, administradores, e revisão/exclusão de trials vencidos |
| `index.html` (dashboard) | `dashboard.js` | ✅ real |
| `atletas.html` | `atletas.js` | ✅ real — inclui nível de evolução/promoção de categoria |
| `avaliacoes.html` | `avaliacoes.js` | ✅ real — inclui fundamentos técnicos por posição |
| `frequencia.html` | `frequencia.js` | ✅ real |
| `planos.html` | `planos.js` | ✅ real |
| `comunicacao.html` | `comunicacao.js` | ✅ real |
| `relatorios.html` | `relatorios.js` | ✅ real |
| `comparativos.html` | `comparativos.js` | ✅ real |
| `configuracoes.html` | `turmas.js` | ⚠️ turmas real; formulário de perfil do usuário ainda é mockup (`data-fake-form`) |
| `responsavel.html` | `responsavel.js` | ✅ real — evolução, radar, frequência, linha do tempo e recados do técnico |
| `area-do-atleta.html` | `area-do-atleta.js` | ✅ real — **sem login**, ver seção própria abaixo |
| `sem-acesso.html` | `sem-acesso.js` | ✅ real — mensagem genérica, ou aviso de teste grátis vencido com link pra `vendas.html#planos` |
| `cadastro-trial.html` | `cadastro-trial.js` | ✅ real — cadastro público de teste grátis por 7 dias, ver seção própria abaixo |
| `vendas.html` | — (script inline) | página pública de vendas/marketing, sem auth-guard — standalone, sem dado do Firestore |

O responsável (`responsavel.html`) só vê **recados endereçados diretamente
ao atleta dele** (`mensagens.destinatarioId == atletaId`) — recados de
"toda a turma" ainda ficam só pra equipe (decisão consciente, ver
comentário em `firestore.rules`).

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

`js/metricas.js` centraliza toda a régua de avaliação (nota geral, corte
bom/atenção, tendência, progressão de categoria, pesos dos fundamentos
técnicos por posição). **Qualquer mudança de critério de avaliação deve
mexer só nesse arquivo.**

⚠️ **Pendência de dados, não de código**: os pesos dos fundamentos técnicos
em `js/metricas.js` só foram validados de verdade pro **Volante** e pro
**Atacante** (pesos somam 100 nos dois) e pro **Meio de campo** genérico
usado hoje só pelo "Meia" (pesos somam 93 — conferir se não falta um
fundamento). Goleiro, Zagueiro e Lateral ainda são rascunho — ver o
comentário no topo do arquivo antes de confiar nesses números pra valer.

`js/metricas.js` também tem indicadores combinados 0-10 (cada um pega um
subconjunto dos fundamentos de uma posição e recalcula a média ponderada só
entre eles): `calcularInteligenciaDefensiva()` (Volante — posicionamento +
interceptação + desarme antecipado + leitura de jogo), e do Atacante,
`calcularCapacidadeDeAtaque()` (explosão na corrida + profundidade +
posicionamento ofensivo + leitura de jogada) e `calcularPoderDeFinalizacao()`
(finalização + cabeceio + pé não dominante). Assim como o resto de
fundamentos, ainda é só lógica — não estão exibidos em nenhuma tela ainda.

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
- `area-do-atleta.html`/`js/area-do-atleta.js` — testei o fluxo de "código
  não encontrado" contra o Firestore de verdade (funcionou), mas ainda não
  testei com um código real. As regras de `resumosPublicos` já foram
  publicadas (mesma publicação que levou as regras de trial, 2026-08-27),
  então não deveria mais dar `permission-denied` — só falta testar com um
  atleta que tenha `codigoPublico` de verdade.

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

- `firestore.rules` já está publicado no console (inclui `resumosPublicos`
  e o cadastro de teste grátis) — se editar o arquivo de novo, lembre de
  publicar de novo, é sempre manual.
- Testar `responsavel.html` e `area-do-atleta.html` de ponta a ponta (ver
  seção acima) — `cadastro-trial.html` já foi testado e funciona.
- Checar no Firestore Console se sobrou alguma escola de teste com
  `licencaFim` inválido/ausente (ver nota na seção "Não testado de ponta a
  ponta" acima) — provavelmente um resquício de teste manual, mas vale
  conferir/apagar.
- Preencher um contato de verdade (e-mail/WhatsApp) em `vendas.html` — hoje
  o botão de "Agendar uma demonstração" usa um `mailto:` placeholder
  (`contato@craquesdofuturo.com.br`).
- Decidir se/quando publicar preços reais nos planos de `vendas.html`
  (hoje ficam como "Valor em definição" de propósito).
- Terminar o formulário de perfil do usuário em `configuracoes.html`
  (ainda `data-fake-form`).
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
