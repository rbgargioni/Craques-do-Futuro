// ======================================================
// Craques do Futuro — admin-escolas.html (dados reais)
// Só roda depois que auth-guard.js confirma que quem está logado é "dono"
// (evento "cf:pronto"), senão as regras do Firestore bloqueiam tudo mesmo.
// ======================================================

import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection, addDoc, doc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, serverTimestamp, Timestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { app as appPrincipal, db } from "./firebase-init.js";

// onSnapshot ativo da lista de administradores da escola aberta no painel de edição —
// precisa ser cancelado ao trocar de escola, senão fica ouvindo a escola antiga também.
let pararDeOuvirAdministradores = null;

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
      console.error("Erro ao carregar administradores:", erro);
      lista.innerHTML = '<li class="empty-state">Não foi possível carregar os administradores.</li>';
    }
  );
}

function abrirEdicaoEscola(escolaId, dados) {
  esconderErro();

  const form = document.getElementById("formEditarEscola");
  form.dataset.escolaId = escolaId;
  form.nome.value = dados.nome;
  form.licencaInicio.value = dados.licencaInicio.toDate().toISOString().slice(0, 10);
  form.licencaFim.value = dados.licencaFim.toDate().toISOString().slice(0, 10);
  form.status.value = dados.status || "ativa";

  document.getElementById("tituloEditarEscola").textContent = `Editar ${dados.nome}`;
  document.getElementById("escolaDoAdminHidden").value = escolaId;
  document.getElementById("nomeEscolaParaAdmin").textContent = dados.nome;

  document.getElementById("painelEscola").classList.add("is-hidden");
  document.getElementById("painelAdministrador").classList.add("is-hidden");

  const painel = document.getElementById("painelEditarEscola");
  painel.classList.remove("is-hidden");
  painel.scrollIntoView({ behavior: "smooth", block: "nearest" });

  ouvirAdministradoresDaEscola(escolaId);
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
      await updateDoc(doc(db, "escolas", escolaId), {
        nome: form.nome.value.trim(),
        licencaInicio: dataInputParaTimestamp(form.licencaInicio.value),
        licencaFim: dataInputParaTimestamp(form.licencaFim.value),
        status: form.status.value,
      });
      document.getElementById("tituloEditarEscola").textContent = `Editar ${form.nome.value.trim()}`;
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

      escolaRef = await addDoc(collection(db, "escolas"), {
        nome,
        licencaInicio,
        licencaFim,
        status: "ativa",
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
  carregarEscolas();
  configurarFormCadastrarEscola();
  configurarFormEditarEscola();
  configurarFormAdicionarAdministrador();

  // "Cadastrar escola" e "Editar escola" não fazem sentido abertos ao mesmo tempo
  document.getElementById("btnCadastrarEscola").addEventListener("click", () => {
    document.getElementById("painelEditarEscola").classList.add("is-hidden");
  });
});
