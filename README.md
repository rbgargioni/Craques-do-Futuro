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
| `admin-escolas.html` (dono) | `admin-escolas.js` | ✅ real — cria/edita escola, sócios, administradores |
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
| `sem-acesso.html` | — | página estática (só precisa do auth-guard pro botão "Sair") |

`js/metricas.js` centraliza toda a régua de avaliação (nota geral, corte
bom/atenção, tendência, progressão de categoria, pesos dos fundamentos
técnicos por posição). **Qualquer mudança de critério de avaliação deve
mexer só nesse arquivo.**

⚠️ **Pendência de dados, não de código**: os pesos dos fundamentos técnicos
em `js/metricas.js` só foram validados de verdade pro **Volante** (pesos
somam 100) e pro **Meio de campo** genérico usado hoje só pelo "Meia"
(pesos somam 93 — conferir se não falta um fundamento). Goleiro, Zagueiro,
Lateral e Atacante ainda são rascunho — ver o comentário no topo do
arquivo antes de confiar nesses números pra valer.

`js/metricas.js` também tem `calcularInteligenciaDefensiva()`, um
indicador 0-10 exclusivo do Volante que combina posicionamento +
interceptação + desarme antecipado + leitura de jogo (pesos originais
desses 4, recalculados entre eles). Assim como o resto de fundamentos,
ainda é só lógica — não está exibido em nenhuma tela ainda.

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

O responsável só vê **recados endereçados diretamente ao atleta dele**
(`mensagens.destinatarioId == atletaId`) — recados de "toda a turma" ainda
ficam só pra equipe (decisão consciente, ver comentário em
`firestore.rules`). Não testei esta página com dados reais de ponta a
ponta ainda (não tenho conta de responsável de teste com atleta/avaliações
vinculadas) — validei sintaxe, geometria dos gráficos e que todo ID
referenciado pelo JS existe no HTML, mas vale um teste manual completo
assim que tiver dados de teste.

## Próximos passos conhecidos

- Testar `responsavel.html`/`js/responsavel.js` de ponta a ponta com uma
  conta de responsável real vinculada a um atleta com avaliações/frequência/
  recados cadastrados.
- Terminar o formulário de perfil do usuário em `configuracoes.html`
  (ainda `data-fake-form`).
- Validar com o sócio os pesos de fundamentos técnicos de Goleiro,
  Zagueiro, Lateral e Atacante em `js/metricas.js` (Volante e Meio de
  campo genérico já foram passados pelo sócio).
- Ligar `calcularNotaTecnica`/`analisarFundamentos`/
  `calcularInteligenciaDefensiva` (já prontos em `js/metricas.js`) na tela
  de Avaliações: formulário de notas por fundamento, nota final, ranking e
  destaques. Falta confirmar com o Rafael o que exatamente a interface
  deve mostrar sobre "destaques" (pergunta ficou em aberto numa conversa).
- Construir o "reverter pro checkpoint anterior" da progressão de
  categoria (documentado no modelo de dados de `firestore.rules`, ainda
  não tem interface).
- Decidir onde hospedar o site publicamente (hoje só roda local/teste) —
  Firebase Hosting é a opção mais natural, ainda não configurada.
