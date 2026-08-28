// ======================================================
// Craques do Futuro — admin-escolas.html (dados reais)
// Só roda depois que auth-guard.js confirma que quem está logado é "dono"
// (evento "cf:pronto"), senão as regras do Firestore bloqueiam tudo mesmo.
// ======================================================

import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection, addDoc, doc, getDocs, getCountFromServer, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, serverTimestamp, Timestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { app as appPrincipal, db } from "./firebase-init.js";

// onSnapshot ativo da lista de administradores da escola aberta no painel de edição —
// precisa ser cancelado ao trocar de escola, senão fica ouvindo a escola antiga também.
let pararDeOuvirAdministradores = null;

// planoId -> dados, mantido em dia por ouvirPlanosAssinatura() — usado tanto pra montar
// os <select> de escola quanto pra saber o limite do plano ao mostrar "uso do plano".
let planosCache = {};

// Cria uma conta de login (Auth) sem deslogar o dono: usa uma segunda instância
// isolada do Firebase App só pra essa chamada, e descarta ela logo depois.
async function criarContaSemDeslogar(email, senha) {
  const appSecundario = initializeApp(appPrincipal.options, `secundario-${Date.now()}`);
  const authSecundario = getAuth(appSecundario);
  try {
    const credencial = await createUserWithEmailAndPassword(authSecundario, email, senha);
    return credencial.user.uid;
  } finally {
    await signOut(authSecundario).catch(() => {});
    await deleteApp(appSecundario).catch(() => {});
  }
}

function traduzirErro(erro) {
  const codigo = erro && erro.code ? erro.code : "";
  if (codigo.includes("email-already-in-use")) return "Esse e-mail já está sendo usado por outra conta.";
  if (codigo.includes("weak-password")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (codigo.includes("invalid-email")) return "E-mail inválido.";
  if (codigo.includes("permission-denied")) return "Você não tem permissão pra fazer essa ação — confira se está logado como dono.";
  return (erro && erro.message) || "Algo deu errado. Tente novamente em alguns segundos.";
}

function mostrarErro(mensagem) {
  const el = document.getElementById("erroAdmin");
  el.textContent = mensagem;
  el.classList.remove("is-hidden");
}
function esconderErro() {
  document.getElementById("erroAdmin").classList.add("is-hidden");
}

function dataInputParaTimestamp(valorInput) {
  return Timestamp.fromDate(new Date(`${valorInput}T12:00:00`));
}

function criarCardEscola(escolaId, dados) {
  const card = document.createElement("div");
  card.className = "entity-card";
  card.dataset.searchItem = "";
  card.dataset.name = dados.nome;
  card.style.cursor = "pointer";
  card.title = "Clique para editar";

  const top = document.createElement("div");
  top.className = "entity-card-top";
  const info = document.createElement("div");
  const nomeEl = document.createElement("strong");
  nomeEl.textContent = dados.nome;
  info.appendChild(nomeEl);
  top.appendChild(info);

  const foot = document.createElement("div");
  foot.className = "entity-card-foot";
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.dataset.licenseFim = dados.licencaFim.toDate().toISOString().slice(0, 10);
  const tag = document.createElement("span");
  tag.className = "tag";
  tag.textContent = `até ${dados.licencaFim.toDate().toLocaleDateString("pt-BR")}`;
  foot.append(badge, tag);

  card.append(top, foot);
  card.addEventListener("click", () => abrirEdicaoEscola(escolaId, dados));
  window.CFBadgeLicenca(badge);
  return card;
}

function ouvirSocios() {
  const lista = document.getElementById("listaSocios");
  const q = query(collection(db, "usuarios"), where("role", "==", "dono"));
  onSnapshot(
    q,
    (snapshot) => {
      lista.innerHTML = "";
      if (snapshot.empty) {
        lista.innerHTML = '<li class="empty-state">Nenhum sócio cadastrado ainda.</li>';
        return;
      }
      snapshot.forEach((docSnap) => {
        const dados = docSnap.data();
        const li = document.createElement("li");
        li.className = "message-item";
        const head = document.createElement("div");
        head.className = "message-item-head";
        const nomeEl = document.createElement("strong");
        nomeEl.textContent = dados.nome || dados.email;
        const emailEl = document.createElement("span");
        emailEl.textContent = dados.email;
        head.append(nomeEl, emailEl);
        li.appendChild(head);
        lista.appendChild(li);
      });
    },
    (erro) => {
      console.error("Erro ao carregar sócios:", erro);
      lista.innerHTML = '<li class="empty-state">Não foi possível carregar os sócios.</li>';
    }
  );
}

function configurarFormAdicionarSocio() {
  const form = document.getElementById("formAdicionarSocio");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    esconderErro();
    const botao = form.querySelector("button[type=submit]");
    botao.disabled = true;
    botao.textContent = "Adicionando...";

    try {
      const nome = form.nome.value.trim();
      const email = form.email.value.trim();
      const senha = form.senha.value;

      const novoUid = await criarContaSemDeslogar(email, senha);
      await setDoc(doc(db, "usuarios", novoUid), {
        role: "dono",
        escolaId: null,
        nome,
        email,
      });

      showToast(`Sócio "${nome}" adicionado.`);
      form.reset();
      document.getElementById("painelSocio").classList.add("is-hidden");
    } catch (erro) {
      console.error(erro);
      mostrarErro(traduzirErro(erro));
    } finally {
      botao.disabled = false;
      botao.textContent = "Adicionar sócio";
    }
  });
}

// ------------------------------------------------------
// Administradores de uma escola — clicar num deles abre "Múltiplas escolas"
// (limiteEscolas/licencaFim), pra liberar o plano de mais de uma escola pra
// ele — ver nota sobre "múltiplas escolas" no topo de firestore.rules.
// ------------------------------------------------------
function abrirEdicaoMultiEscola(uid, dados) {
  esconderErro();
  const form = document.getElementById("formMultiEscola");
  form.dataset.uid = uid;
  form.limiteEscolas.value = dados.limiteEscolas || 0;
  form.licencaFim.value = dados.licencaFim ? dados.licencaFim.toDate().toISOString().slice(0, 10) : "";

  document.getElementById("nomeAdminParaMultiEscola").textContent = dados.nome || dados.email;
  document.getElementById("painelAdministrador").classList.add("is-hidden");
  const painel = document.getElementById("painelMultiEscola");
  painel.classList.remove("is-hidden");
  painel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function configurarFormMultiEscola() {
  const form = document.getElementById("formMultiEscola");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    esconderErro();
    const botao = form.querySelector("button[type=submit]");
    botao.disabled = true;
    botao.textContent = "Salvando...";

    try {
      const limiteEscolas = Number(form.limiteEscolas.value) || 0;
      if (limiteEscolas > 5) {
        mostrarErro("O limite de escolas extras é no máximo 5.");
        botao.disabled = false;
        botao.textContent = "Salvar";
        return;
      }
      const dados = { limiteEscolas };
      // licencaFim só é obrigatório se o limite for maior que 0 — sem escolas extras liberadas,
      // não faz sentido travar o formulário pedindo uma data.
      if (form.licencaFim.value) dados.licencaFim = dataInputParaTimestamp(form.licencaFim.value);

      await updateDoc(doc(db, "usuarios", form.dataset.uid), dados);
      showToast("Plano de múltiplas escolas atualizado.");
      document.getElementById("painelMultiEscola").classList.add("is-hidden");
    } catch (erro) {
      console.error(erro);
      mostrarErro(traduzirErro(erro));
    } finally {
      botao.disabled = false;
      botao.textContent = "Salvar";
    }
  });
}

function ouvirAdministradoresDaEscola(escolaId) {
  const lista = document.getElementById("listaAdministradoresEscola");
  lista.innerHTML = '<li class="empty-state">Carregando...</li>';

  if (pararDeOuvirAdministradores) pararDeOuvirAdministradores();

  const q = query(collection(db, "usuarios"), where("escolaId", "==", escolaId), where("role", "==", "administrador"));
  pararDeOuvirAdministradores = onSnapshot(
    q,
    (snapshot) => {
      lista.innerHTML = "";
      if (snapshot.empty) {
        lista.innerHTML = '<li class="empty-state">Nenhum administrador cadastrado ainda.</li>';
        return;
      }
      snapshot.forEach((docSnap) => {
        const dados = docSnap.data();
        const li = document.createElement("li");
        li.className = "message-item";
        li.style.cursor = "pointer";
        li.title = "Clique para ver/editar o plano de múltiplas escolas";
        const head = document.createElement("div");
        head.className = "message-item-head";
        const nomeEl = document.createElement("strong");
        nomeEl.textContent = dados.nome || dados.email;
        const emailEl = document.createElement("span");
        emailEl.textContent = dados.email;
        head.append(nomeEl, emailEl);
        li.appendChild(head);

        if (dados.limiteEscolas > 0) {
          const detalhes = document.createElement("p");
          detalhes.style.margin = "6px 0 0";
          detalhes.style.fontSize = "12px";
          detalhes.style.color = "var(--text-muted)";
          const licencaTxt = dados.licencaFim ? dados.licencaFim.toDate().toLocaleDateString("pt-BR") : "—";
          detalhes.textContent = `Até ${dados.limiteEscolas} escola${dados.limiteEscolas === 1 ? "" : "s"} extra${dados.limiteEscolas === 1 ? "" : "s"} · pacote até ${licencaTxt}`;
          li.appendChild(detalhes);
        }

        li.addEventListener("click", () => abrirEdicaoMultiEscola(docSnap.id, dados));
        lista.appendChild(li);
      });
    },
    (erro) => {
      console.error("Erro ao carregar administradores:", erro);
      lista.innerHTML = '<li class="empty-state">Não foi possível carregar os administradores.</li>';
    }
  );
}

// ------------------------------------------------------
// Catálogo de planos de assinatura
// ------------------------------------------------------
function popularSelectsDePlano() {
  const idsAtivos = Object.keys(planosCache).filter((id) => planosCache[id].ativo !== false);
  ["planoEscola", "planoEditarEscola"].forEach((elId) => {
    const select = document.getElementById(elId);
    const valorAtual = select.value;
    select.innerHTML = '<option value="">Sem plano definido</option>';
    idsAtivos.forEach((id) => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = planosCache[id].nome;
      select.appendChild(opt);
    });
    if (idsAtivos.includes(valorAtual)) select.value = valorAtual;
  });
}

function criarItemPlanoAssinatura(planoId, dados) {
  const li = document.createElement("li");
  li.className = "message-item";
  li.style.cursor = "pointer";
  li.title = "Clique para editar";

  const head = document.createElement("div");
  head.className = "message-item-head";
  const nomeEl = document.createElement("strong");
  nomeEl.textContent = dados.nome;
  const statusEl = document.createElement("span");
  statusEl.textContent = dados.ativo === false ? "Desativado" : "Ativo";
  head.append(nomeEl, statusEl);

  const detalhes = document.createElement("p");
  detalhes.style.margin = "6px 0 0";
  detalhes.style.fontSize = "12px";
  detalhes.style.color = "var(--text-muted)";
  const treinadoresTxt = dados.limiteTecnicos > 0 ? `até ${dados.limiteTecnicos} treinador${dados.limiteTecnicos === 1 ? "" : "es"}` : "treinadores ilimitados";
  const alunosTxt = dados.limiteAlunos > 0 ? `até ${dados.limiteAlunos} aluno${dados.limiteAlunos === 1 ? "" : "s"}` : "alunos ilimitados";
  detalhes.textContent = `${treinadoresTxt} · ${alunosTxt}`;

  li.append(head, detalhes);
  li.addEventListener("click", () => abrirEdicaoPlanoAssinatura(planoId, dados));
  return li;
}

function abrirEdicaoPlanoAssinatura(planoId, dados) {
  esconderErro();
  const form = document.getElementById("formPlanoAssinatura");
  form.dataset.planoId = planoId;
  form.nome.value = dados.nome;
  form.limiteTecnicos.value = dados.limiteTecnicos || 0;
  form.limiteAlunos.value = dados.limiteAlunos || 0;

  document.getElementById("tituloPlanoAssinatura").textContent = `Editar ${dados.nome}`;
  const painel = document.getElementById("painelPlanoAssinatura");
  painel.classList.remove("is-hidden");
  painel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function ouvirPlanosAssinatura() {
  const lista = document.getElementById("listaPlanosAssinatura");
  onSnapshot(
    collection(db, "planosAssinatura"),
    (snapshot) => {
      planosCache = {};
      lista.innerHTML = "";
      if (snapshot.empty) {
        lista.innerHTML = '<li class="empty-state">Nenhum plano cadastrado ainda.</li>';
        popularSelectsDePlano();
        return;
      }
      snapshot.forEach((docSnap) => {
        planosCache[docSnap.id] = docSnap.data();
        lista.appendChild(criarItemPlanoAssinatura(docSnap.id, docSnap.data()));
      });
      popularSelectsDePlano();
    },
    (erro) => {
      console.error("Erro ao carregar planos de assinatura:", erro);
      lista.innerHTML = '<li class="empty-state">Não foi possível carregar os planos.</li>';
    }
  );
}

function configurarFormPlanoAssinatura() {
  const form = document.getElementById("formPlanoAssinatura");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    esconderErro();
    const botao = form.querySelector("button[type=submit]");
    botao.disabled = true;
    botao.textContent = "Salvando...";

    try {
      const dados = {
        nome: form.nome.value.trim(),
        limiteTecnicos: Number(form.limiteTecnicos.value) || 0,
        limiteAlunos: Number(form.limiteAlunos.value) || 0,
        ativo: true,
      };

      if (form.dataset.planoId) {
        await updateDoc(doc(db, "planosAssinatura", form.dataset.planoId), dados);
        showToast(`Plano "${dados.nome}" atualizado.`);
      } else {
        await addDoc(collection(db, "planosAssinatura"), { ...dados, criadoEm: serverTimestamp() });
        showToast(`Plano "${dados.nome}" criado.`);
      }

      form.reset();
      delete form.dataset.planoId;
      document.getElementById("painelPlanoAssinatura").classList.add("is-hidden");
    } catch (erro) {
      console.error(erro);
      mostrarErro(traduzirErro(erro));
    } finally {
      botao.disabled = false;
      botao.textContent = "Salvar plano";
    }
  });
}

// ------------------------------------------------------
// Uso do plano (treinadores/alunos) de uma escola — calculado na hora que o
// dono abre a escola pra editar, não fica guardado/sincronizado em campo nenhum.
// ------------------------------------------------------
function aplicarUsoNoCard(elValor, elIcone, total, limite) {
  if (limite > 0) {
    const percentual = Math.round((total / limite) * 100);
    elValor.textContent = `${total} de ${limite} (${percentual}%)`;
    elIcone.className = `stat-icon ${percentual >= 100 ? "stat-icon--bad" : percentual >= 80 ? "stat-icon--warn" : "stat-icon--good"}`;
  } else {
    elValor.textContent = `${total} (ilimitado)`;
    elIcone.className = "stat-icon stat-icon--neutral";
  }
}

async function carregarUsoDaEscola(escolaId, planoId) {
  const treinadoresEl = document.getElementById("usoTreinadores");
  const alunosEl = document.getElementById("usoAlunos");
  const treinadoresIcone = document.getElementById("usoTreinadoresIcone");
  const alunosIcone = document.getElementById("usoAlunosIcone");
  treinadoresEl.textContent = "Carregando...";
  alunosEl.textContent = "Carregando...";

  const plano = planoId ? planosCache[planoId] : null;
  const limiteTecnicos = plano ? plano.limiteTecnicos || 0 : 0;
  const limiteAlunos = plano ? plano.limiteAlunos || 0 : 0;

  try {
    const qTreinadores = query(
      collection(db, "usuarios"),
      where("escolaId", "==", escolaId),
      where("role", "in", ["administrador", "tecnico"])
    );
    const snapTreinadores = await getCountFromServer(qTreinadores);
    aplicarUsoNoCard(treinadoresEl, treinadoresIcone, snapTreinadores.data().count, limiteTecnicos);
  } catch (erro) {
    console.error("Erro ao contar treinadores da escola:", erro);
    treinadoresEl.textContent = "—";
  }

  try {
    const snapAlunos = await getCountFromServer(collection(db, "escolas", escolaId, "atletas"));
    aplicarUsoNoCard(alunosEl, alunosIcone, snapAlunos.data().count, limiteAlunos);
  } catch (erro) {
    console.error("Erro ao contar alunos da escola:", erro);
    alunosEl.textContent = "—";
  }
}

function abrirEdicaoEscola(escolaId, dados) {
  esconderErro();

  const form = document.getElementById("formEditarEscola");
  form.dataset.escolaId = escolaId;
  form.nome.value = dados.nome;
  form.licencaInicio.value = dados.licencaInicio.toDate().toISOString().slice(0, 10);
  form.licencaFim.value = dados.licencaFim.toDate().toISOString().slice(0, 10);
  form.status.value = dados.status || "ativa";
  form.planoId.value = dados.planoId || "";

  document.getElementById("tituloEditarEscola").textContent = `Editar ${dados.nome}`;
  document.getElementById("escolaDoAdminHidden").value = escolaId;
  document.getElementById("nomeEscolaParaAdmin").textContent = dados.nome;

  document.getElementById("painelEscola").classList.add("is-hidden");
  document.getElementById("painelAdministrador").classList.add("is-hidden");

  const painel = document.getElementById("painelEditarEscola");
  painel.classList.remove("is-hidden");
  painel.scrollIntoView({ behavior: "smooth", block: "nearest" });

  ouvirAdministradoresDaEscola(escolaId);
  carregarUsoDaEscola(escolaId, dados.planoId || null);
}

function configurarFormEditarEscola() {
  const form = document.getElementById("formEditarEscola");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    esconderErro();
    const botao = form.querySelector("button[type=submit]");
    botao.disabled = true;
    botao.textContent = "Salvando...";

    try {
      const escolaId = form.dataset.escolaId;
      const planoId = form.planoId.value || null;
      await updateDoc(doc(db, "escolas", escolaId), {
        nome: form.nome.value.trim(),
        licencaInicio: dataInputParaTimestamp(form.licencaInicio.value),
        licencaFim: dataInputParaTimestamp(form.licencaFim.value),
        status: form.status.value,
        planoId,
      });
      document.getElementById("tituloEditarEscola").textContent = `Editar ${form.nome.value.trim()}`;
      carregarUsoDaEscola(escolaId, planoId); // limite pode ter mudado se trocou de plano
      showToast("Escola atualizada.");
    } catch (erro) {
      console.error(erro);
      mostrarErro(traduzirErro(erro));
    } finally {
      botao.disabled = false;
      botao.textContent = "Salvar alterações";
    }
  });
}

// Apaga todos os documentos retornados por uma query/coleção, em paralelo.
async function excluirDocsDe(refOuQuery) {
  const snap = await getDocs(refOuQuery);
  await Promise.all(snap.docs.map((docSnap) => deleteDoc(docSnap.ref)));
}

// Exclusão em cascata de uma escola trial vencida: apaga todo o conteúdo da
// escola (turmas/atletas+progressao/avaliações/frequência/planos/mensagens),
// os resumosPublicos e os perfis em usuarios/{uid} vinculados a ela, e por
// fim a própria escola.
//
// Limitação conhecida (100% client-side, sem Cloud Functions/Admin SDK): isso
// NÃO apaga a conta de login (Firebase Auth) dos administradores/técnicos —
// só um usuário pode apagar a própria conta Auth, nunca a de outra pessoa a
// partir do cliente. Na prática o acesso já fica bloqueado (auth-guard.js
// desloga quem não tem mais um perfil em usuarios/{uid}), mas a entrada continua
// existindo em Authentication > Users no Firebase Console, e pode ser removida
// de lá manualmente se quiser limpar de vez.
async function excluirEscolaTrialVencida(escolaId) {
  const snapAtletas = await getDocs(collection(db, "escolas", escolaId, "atletas"));
  for (const atletaDoc of snapAtletas.docs) {
    await excluirDocsDe(collection(db, "escolas", escolaId, "atletas", atletaDoc.id, "progressao"));
    await deleteDoc(atletaDoc.ref);
  }

  await excluirDocsDe(collection(db, "escolas", escolaId, "turmas"));
  await excluirDocsDe(collection(db, "escolas", escolaId, "avaliacoes"));
  await excluirDocsDe(collection(db, "escolas", escolaId, "frequencia"));
  await excluirDocsDe(collection(db, "escolas", escolaId, "planos"));
  await excluirDocsDe(collection(db, "escolas", escolaId, "mensagens"));
  await excluirDocsDe(query(collection(db, "resumosPublicos"), where("escolaId", "==", escolaId)));
  await excluirDocsDe(query(collection(db, "usuarios"), where("escolaId", "==", escolaId)));
  await deleteDoc(doc(db, "escolas", escolaId));
}

// ------------------------------------------------------
// Solicitações de plano — administrador/técnico pede em escolher-plano.html,
// o dono confirma aqui depois de checar o pagamento por fora do sistema.
// ------------------------------------------------------
function calcularLicencaFim(duracaoMeses) {
  const data = new Date();
  data.setMonth(data.getMonth() + duracaoMeses);
  return Timestamp.fromDate(data);
}

const ROTULO_DURACAO = { 12: "1 ano", 24: "2 anos" };

async function confirmarSolicitacaoPlano(solicitacaoId, dados, botao) {
  botao.disabled = true;
  botao.textContent = "Confirmando...";
  try {
    await updateDoc(doc(db, "escolas", dados.escolaId), {
      planoId: dados.planoId,
      status: "ativa",
      licencaInicio: Timestamp.fromDate(new Date()),
      licencaFim: calcularLicencaFim(dados.duracaoMeses),
    });
    await updateDoc(doc(db, "solicitacoesPlano", solicitacaoId), { status: "confirmada" });
    showToast(`Plano "${dados.planoNome}" ativado para "${dados.escolaNome}".`);
  } catch (erro) {
    console.error(erro);
    mostrarErro(traduzirErro(erro));
    botao.disabled = false;
    botao.textContent = "Confirmar";
  }
}

async function recusarSolicitacaoPlano(solicitacaoId, botao) {
  botao.disabled = true;
  botao.textContent = "Recusando...";
  try {
    await updateDoc(doc(db, "solicitacoesPlano", solicitacaoId), { status: "recusada" });
    showToast("Pedido recusado.");
  } catch (erro) {
    console.error(erro);
    mostrarErro(traduzirErro(erro));
    botao.disabled = false;
    botao.textContent = "Recusar";
  }
}

function renderizarSolicitacoesPlano(docs) {
  const secao = document.getElementById("secaoSolicitacoesPlano");
  const lista = document.getElementById("listaSolicitacoesPlano");
  const totalEl = document.getElementById("totalSolicitacoesPlano");

  if (docs.length === 0) {
    secao.classList.add("is-hidden");
    lista.innerHTML = "";
    return;
  }

  secao.classList.remove("is-hidden");
  totalEl.textContent = docs.length;
  lista.innerHTML = "";

  docs.forEach((docSnap) => {
    const dados = docSnap.data();
    const li = document.createElement("li");
    li.className = "message-item";

    const head = document.createElement("div");
    head.className = "message-item-head";
    const nomeEl = document.createElement("strong");
    nomeEl.textContent = dados.escolaNome;
    const quandoEl = document.createElement("span");
    quandoEl.textContent = dados.criadoEm ? dados.criadoEm.toDate().toLocaleDateString("pt-BR") : "";
    head.append(nomeEl, quandoEl);

    const detalhes = document.createElement("p");
    detalhes.style.margin = "6px 0 10px";
    detalhes.style.fontSize = "12px";
    detalhes.style.color = "var(--text-muted)";
    const duracaoTxt = ROTULO_DURACAO[dados.duracaoMeses] || `${dados.duracaoMeses} meses`;
    detalhes.textContent = `Plano ${dados.planoNome} · ${duracaoTxt} · pedido por ${dados.solicitanteNome || dados.solicitanteEmail}`;

    const acoes = document.createElement("div");
    acoes.style.display = "flex";
    acoes.style.gap = "8px";
    const btnConfirmar = document.createElement("button");
    btnConfirmar.type = "button";
    btnConfirmar.className = "btn btn-primary btn-sm";
    btnConfirmar.textContent = "Confirmar";
    btnConfirmar.addEventListener("click", () => confirmarSolicitacaoPlano(docSnap.id, dados, btnConfirmar));
    const btnRecusar = document.createElement("button");
    btnRecusar.type = "button";
    btnRecusar.className = "btn btn-outline btn-sm";
    btnRecusar.textContent = "Recusar";
    btnRecusar.addEventListener("click", () => recusarSolicitacaoPlano(docSnap.id, btnRecusar));
    acoes.append(btnConfirmar, btnRecusar);

    li.append(head, detalhes, acoes);
    lista.appendChild(li);
  });
}

function ouvirSolicitacoesPlano() {
  const q = query(collection(db, "solicitacoesPlano"), where("status", "==", "pendente"));
  onSnapshot(
    q,
    (snapshot) => renderizarSolicitacoesPlano(snapshot.docs),
    (erro) => console.error("Erro ao carregar solicitações de plano:", erro)
  );
}

function trialVencido(dados) {
  if (dados.status !== "trial" || !dados.licencaFim) return false;
  return dados.licencaFim.toDate() < new Date();
}

function renderizarTrialsVencidos(escolasDocs) {
  const secao = document.getElementById("secaoTrialsVencidos");
  const lista = document.getElementById("listaTrialsVencidos");
  const totalEl = document.getElementById("totalTrialsVencidos");

  const vencidas = escolasDocs.filter((docSnap) => trialVencido(docSnap.data()));

  if (vencidas.length === 0) {
    secao.classList.add("is-hidden");
    lista.innerHTML = "";
    return;
  }

  secao.classList.remove("is-hidden");
  totalEl.textContent = vencidas.length;
  lista.innerHTML = "";

  vencidas.forEach((docSnap) => {
    const dados = docSnap.data();
    const li = document.createElement("li");
    li.className = "message-item";

    const head = document.createElement("div");
    head.className = "message-item-head";
    const nomeEl = document.createElement("strong");
    nomeEl.textContent = dados.nome;
    const dataEl = document.createElement("span");
    dataEl.textContent = `Teste venceu em ${dados.licencaFim.toDate().toLocaleDateString("pt-BR")}`;
    head.append(nomeEl, dataEl);

    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "btn btn-outline btn-sm";
    botao.style.marginTop = "8px";
    botao.textContent = "Excluir escola e dados";
    botao.addEventListener("click", async () => {
      const confirmado = confirm(
        `Excluir "${dados.nome}" e todos os dados dela (turmas, atletas, avaliações, frequência, recados)?\n\nEssa ação não pode ser desfeita.`
      );
      if (!confirmado) return;

      botao.disabled = true;
      botao.textContent = "Excluindo...";
      try {
        await excluirEscolaTrialVencida(docSnap.id);
        showToast(`"${dados.nome}" foi excluída.`);
      } catch (erro) {
        console.error(erro);
        mostrarErro(traduzirErro(erro));
        botao.disabled = false;
        botao.textContent = "Excluir escola e dados";
      }
    });

    li.append(head, botao);
    lista.appendChild(li);
  });
}

function carregarEscolas() {
  const container = document.getElementById("listaEscolas");
  const totalEl = document.getElementById("totalEscolas");

  onSnapshot(
    collection(db, "escolas"),
    (snapshot) => {
      container.innerHTML = "";
      renderizarTrialsVencidos(snapshot.docs);

      if (snapshot.empty) {
        container.innerHTML = '<p class="empty-state">Nenhuma escola cadastrada ainda. Clique em "Cadastrar escola" pra criar a primeira.</p>';
        totalEl.textContent = "0 clientes";
        return;
      }

      totalEl.textContent = `${snapshot.size} cliente${snapshot.size === 1 ? "" : "s"}`;

      snapshot.forEach((docSnap) => {
        // Uma escola com dado quebrado (ex.: licencaFim ausente/inválido) não pode
        // travar o forEach e esconder as escolas seguintes — só pula essa e loga.
        try {
          container.appendChild(criarCardEscola(docSnap.id, docSnap.data()));
        } catch (erro) {
          console.error(`Escola ${docSnap.id} com dado inválido, pulando:`, docSnap.data(), erro);
        }
      });
    },
    (erro) => {
      console.error("Erro ao carregar escolas:", erro);
      mostrarErro("Não foi possível carregar as escolas. Recarregue a página.");
    }
  );
}

function configurarFormCadastrarEscola() {
  const form = document.getElementById("formCadastrarEscola");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    esconderErro();
    const botao = form.querySelector("button[type=submit]");
    botao.disabled = true;
    botao.textContent = "Criando...";

    let escolaRef = null;
    try {
      const nome = form.nome.value.trim();
      const licencaInicio = dataInputParaTimestamp(form.licencaInicio.value);
      const licencaFim = dataInputParaTimestamp(form.licencaFim.value);
      const nomeAdmin = form.nomeAdmin.value.trim();
      const emailAdmin = form.emailAdmin.value.trim();
      const senhaAdmin = form.senhaAdmin.value;
      const planoId = form.planoId.value || null;

      escolaRef = await addDoc(collection(db, "escolas"), {
        nome,
        licencaInicio,
        licencaFim,
        status: "ativa",
        planoId,
        criadoEm: serverTimestamp(),
      });

      const novoUid = await criarContaSemDeslogar(emailAdmin, senhaAdmin);
      await setDoc(doc(db, "usuarios", novoUid), {
        role: "administrador",
        escolaId: escolaRef.id,
        nome: nomeAdmin,
        email: emailAdmin,
      });

      showToast(`Escola "${nome}" criada com sucesso.`);
      form.reset();
      document.getElementById("painelEscola").classList.add("is-hidden");
    } catch (erro) {
      console.error(erro);
      // Se a escola chegou a ser criada mas o administrador falhou, desfaz — senão fica uma escola órfã.
      if (escolaRef) await deleteDoc(escolaRef).catch(() => {});
      mostrarErro(traduzirErro(erro));
    } finally {
      botao.disabled = false;
      botao.textContent = "Criar escola";
    }
  });
}

function configurarFormAdicionarAdministrador() {
  const form = document.getElementById("formAdicionarAdministrador");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    esconderErro();
    const botao = form.querySelector("button[type=submit]");
    botao.disabled = true;
    botao.textContent = "Adicionando...";

    try {
      const escolaId = form.escola.value;
      if (!escolaId) throw new Error("Selecione uma escola.");
      const nome = form.nome.value.trim();
      const email = form.email.value.trim();
      const senha = form.senha.value;

      const novoUid = await criarContaSemDeslogar(email, senha);
      await setDoc(doc(db, "usuarios", novoUid), {
        role: "administrador",
        escolaId,
        nome,
        email,
      });

      showToast(`Administrador "${nome}" adicionado.`);
      form.reset();
      form.escola.value = escolaId; // reset() limpa o hidden — a escola aberta no painel continua a mesma
      document.getElementById("painelAdministrador").classList.add("is-hidden");
    } catch (erro) {
      console.error(erro);
      mostrarErro(traduzirErro(erro));
    } finally {
      botao.disabled = false;
      botao.textContent = "Adicionar administrador";
    }
  });
}

document.addEventListener("cf:pronto", () => {
  ouvirSocios();
  configurarFormAdicionarSocio();
  ouvirPlanosAssinatura();
  configurarFormPlanoAssinatura();
  ouvirSolicitacoesPlano();
  carregarEscolas();
  configurarFormCadastrarEscola();
  configurarFormEditarEscola();
  configurarFormAdicionarAdministrador();
  configurarFormMultiEscola();

  // "Cadastrar escola" e "Editar escola" não fazem sentido abertos ao mesmo tempo
  document.getElementById("btnCadastrarEscola").addEventListener("click", () => {
    document.getElementById("painelEditarEscola").classList.add("is-hidden");
  });

  // "+ Novo plano" precisa começar com o form limpo (senão reabriria em modo edição
  // se o dono tivesse clicado num plano existente antes).
  document.getElementById("btnNovoPlanoAssinatura").addEventListener("click", () => {
    const form = document.getElementById("formPlanoAssinatura");
    delete form.dataset.planoId;
    form.reset();
    document.getElementById("tituloPlanoAssinatura").textContent = "Novo plano";
  });
});
