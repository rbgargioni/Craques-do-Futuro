// ======================================================
// Craques do Futuro — configuracoes.html (turmas, dados reais)
// Só roda depois que auth-guard.js confirma o papel (evento "cf:pronto"),
// que é quando window.CF.escolaId fica disponível.
// ======================================================

import {
  collection, addDoc, doc, setDoc, updateDoc, onSnapshot, query, where, serverTimestamp, getCountFromServer,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { app as appPrincipal, auth, db } from "./firebase-init.js";

function turmasRef() {
  return collection(db, "escolas", window.CF.escolaId, "turmas");
}

function criarCardTurma(turmaId, dados) {
  const card = document.createElement("div");
  card.className = "entity-card";
  card.style.cursor = "pointer";
  card.title = "Clique para editar";

  const top = document.createElement("div");
  top.className = "entity-card-top";
  const info = document.createElement("div");
  const nomeEl = document.createElement("strong");
  nomeEl.textContent = dados.nome;
  const categoriaEl = document.createElement("span");
  categoriaEl.textContent = `${dados.categoria} · ${dados.temporada}`;
  info.append(nomeEl, categoriaEl);
  top.appendChild(info);

  const foot = document.createElement("div");
  foot.className = "entity-card-foot";
  const badge = document.createElement("span");
  badge.className = dados.ativa === false ? "badge badge--bad" : "badge badge--done";
  badge.textContent = dados.ativa === false ? "Inativa" : "Ativa";
  const tagAlunos = document.createElement("span");
  tagAlunos.className = "tag";
  tagAlunos.textContent = "carregando...";
  foot.append(badge, tagAlunos);

  card.append(top, foot);
  card.addEventListener("click", () => abrirEdicaoTurma(turmaId, dados));

  getCountFromServer(query(collection(db, "escolas", window.CF.escolaId, "atletas"), where("turmaId", "==", turmaId)))
    .then((snap) => {
      const total = snap.data().count;
      tagAlunos.textContent = `${total} aluno${total === 1 ? "" : "s"}`;
    })
    .catch((erro) => {
      console.error("Erro ao contar alunos da turma:", erro);
      tagAlunos.textContent = "— alunos";
    });

  return card;
}

function carregarTurmas() {
  const container = document.getElementById("listaTurmas");
  onSnapshot(
    turmasRef(),
    (snapshot) => {
      container.innerHTML = "";
      if (snapshot.empty) {
        container.innerHTML = '<p class="empty-state">Nenhuma turma cadastrada ainda. Clique em "＋ Nova turma" pra criar a primeira.</p>';
        return;
      }
      snapshot.forEach((docSnap) => {
        container.appendChild(criarCardTurma(docSnap.id, docSnap.data()));
      });
    },
    (erro) => {
      console.error("Erro ao carregar turmas:", erro);
      container.innerHTML = '<p class="empty-state">Não foi possível carregar as turmas.</p>';
    }
  );
}

function abrirEdicaoTurma(turmaId, dados) {
  const form = document.getElementById("formEditarTurma");
  form.dataset.turmaId = turmaId;
  form.nome.value = dados.nome;
  form.categoria.value = dados.categoria;
  form.temporada.value = dados.temporada;
  form.ativa.value = dados.ativa === false ? "false" : "true";

  document.getElementById("tituloEditarTurma").textContent = `Editar ${dados.nome}`;
  document.getElementById("painelTurma").classList.add("is-hidden");

  const painel = document.getElementById("painelEditarTurma");
  painel.classList.remove("is-hidden");
  painel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function configurarFormCadastrarTurma() {
  const form = document.getElementById("formCadastrarTurma");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const botao = form.querySelector("button[type=submit]");
    botao.disabled = true;
    botao.textContent = "Criando...";

    try {
      const nome = form.nome.value.trim();
      await addDoc(turmasRef(), {
        nome,
        categoria: form.categoria.value.trim(),
        temporada: form.temporada.value.trim(),
        ativa: true,
        criadoEm: serverTimestamp(),
      });
      showToast(`Turma "${nome}" criada.`);
      form.reset();
      document.getElementById("painelTurma").classList.add("is-hidden");
    } catch (erro) {
      console.error(erro);
      showToast("Não foi possível criar a turma. Tente novamente.");
    } finally {
      botao.disabled = false;
      botao.textContent = "Criar turma";
    }
  });
}

function configurarFormEditarTurma() {
  const form = document.getElementById("formEditarTurma");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const botao = form.querySelector("button[type=submit]");
    botao.disabled = true;
    botao.textContent = "Salvando...";

    try {
      const turmaId = form.dataset.turmaId;
      const nome = form.nome.value.trim();
      await updateDoc(doc(db, "escolas", window.CF.escolaId, "turmas", turmaId), {
        nome,
        categoria: form.categoria.value.trim(),
        temporada: form.temporada.value.trim(),
        ativa: form.ativa.value === "true",
      });
      document.getElementById("tituloEditarTurma").textContent = `Editar ${nome}`;
      showToast("Turma atualizada.");
    } catch (erro) {
      console.error(erro);
      showToast("Não foi possível salvar as alterações. Tente novamente.");
    } finally {
      botao.disabled = false;
      botao.textContent = "Salvar alterações";
    }
  });
}

// ------------------------------------------------------
// Gestão de usuários — técnicos da escola (só administrador vê esta seção,
// ver data-roles em configuracoes.html). A permissão de criar técnico já
// existe nas regras do Firestore (podeCriarTecnico) desde sempre — só
// faltava esta tela.
// ------------------------------------------------------

// Mesmo padrão de criarContaSemDeslogar() já usado em admin-escolas.js e
// gestor-escolas.js: cria a conta de login do técnico sem deslogar quem
// está usando o site, via uma instância secundária e descartável do Firebase App.
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

function traduzirErroUsuario(erro) {
  const codigo = erro && erro.code ? erro.code : "";
  if (codigo.includes("email-already-in-use")) return "Esse e-mail já está sendo usado por outra conta.";
  if (codigo.includes("weak-password")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (codigo.includes("invalid-email")) return "E-mail inválido.";
  if (codigo.includes("permission-denied")) return "Você não tem permissão pra fazer essa ação.";
  return (erro && erro.message) || "Algo deu errado. Tente novamente em alguns segundos.";
}

function criarItemTecnico(dados) {
  const li = document.createElement("li");
  li.className = "message-item";

  const head = document.createElement("div");
  head.className = "message-item-head";
  const nomeEl = document.createElement("strong");
  nomeEl.textContent = dados.nome || dados.email;
  const emailEl = document.createElement("span");
  emailEl.textContent = dados.email;
  head.append(nomeEl, emailEl);

  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "btn btn-outline btn-sm";
  botao.style.marginTop = "8px";
  botao.textContent = "Enviar redefinição de senha";
  botao.title = "Manda um e-mail pro técnico escolher uma senha nova — não dá pra ver/definir a senha dele diretamente por aqui.";
  botao.addEventListener("click", async () => {
    botao.disabled = true;
    botao.textContent = "Enviando...";
    try {
      await sendPasswordResetEmail(auth, dados.email);
      showToast(`E-mail de redefinição enviado pra ${dados.email}.`);
    } catch (erro) {
      console.error(erro);
      showToast("Não foi possível enviar o e-mail. Tente novamente.");
    } finally {
      botao.disabled = false;
      botao.textContent = "Enviar redefinição de senha";
    }
  });

  li.append(head, botao);
  return li;
}

// Lista só leitura dos administradores da escola (inclusive o próprio usuário
// logado, marcado como "(você)") — administrador não cria/remove outro
// administrador (só o dono, em admin-escolas.html), mas precisa poder VER
// quem mais tem esse acesso, senão a contagem de "Treinadores" em
// gestor-escolas.html não bate com nada visível.
function criarItemAdministrador(dados) {
  const li = document.createElement("li");
  li.className = "message-item";

  const head = document.createElement("div");
  head.className = "message-item-head";
  const nomeEl = document.createElement("strong");
  nomeEl.textContent = dados.nome || dados.email;
  if (dados.email === window.CF.email) {
    const voceEl = document.createElement("span");
    voceEl.className = "tag";
    voceEl.style.marginLeft = "6px";
    voceEl.textContent = "você";
    nomeEl.appendChild(voceEl);
  }
  const emailEl = document.createElement("span");
  emailEl.textContent = dados.email;
  head.append(nomeEl, emailEl);

  li.appendChild(head);
  return li;
}

function ouvirOutrosAdministradores() {
  const lista = document.getElementById("listaOutrosAdministradores");
  const q = query(collection(db, "usuarios"), where("escolaId", "==", window.CF.escolaId), where("role", "==", "administrador"));
  onSnapshot(
    q,
    (snapshot) => {
      lista.innerHTML = "";
      if (snapshot.empty) {
        lista.innerHTML = '<li class="empty-state">Nenhum administrador encontrado.</li>';
        return;
      }
      snapshot.forEach((docSnap) => lista.appendChild(criarItemAdministrador(docSnap.data())));
    },
    (erro) => {
      console.error("Erro ao carregar administradores:", erro);
      lista.innerHTML = '<li class="empty-state">Não foi possível carregar os administradores.</li>';
    }
  );
}

function ouvirTecnicos() {
  const lista = document.getElementById("listaTecnicos");
  const q = query(collection(db, "usuarios"), where("escolaId", "==", window.CF.escolaId), where("role", "==", "tecnico"));
  onSnapshot(
    q,
    (snapshot) => {
      lista.innerHTML = "";
      if (snapshot.empty) {
        lista.innerHTML = '<li class="empty-state">Nenhum técnico cadastrado ainda.</li>';
        return;
      }
      snapshot.forEach((docSnap) => lista.appendChild(criarItemTecnico(docSnap.data())));
    },
    (erro) => {
      console.error("Erro ao carregar técnicos:", erro);
      lista.innerHTML = '<li class="empty-state">Não foi possível carregar os técnicos.</li>';
    }
  );
}

function configurarFormCadastrarTecnico() {
  const form = document.getElementById("formCadastrarTecnico");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const botao = form.querySelector("button[type=submit]");
    botao.disabled = true;
    botao.textContent = "Adicionando...";

    try {
      const nome = form.nome.value.trim();
      const email = form.email.value.trim();
      const senha = form.senha.value;

      const novoUid = await criarContaSemDeslogar(email, senha);
      await setDoc(doc(db, "usuarios", novoUid), {
        role: "tecnico",
        escolaId: window.CF.escolaId,
        nome,
        email,
      });

      showToast(`Técnico "${nome}" adicionado.`);
      form.reset();
      document.getElementById("painelTecnico").classList.add("is-hidden");
    } catch (erro) {
      console.error(erro);
      showToast(traduzirErroUsuario(erro));
    } finally {
      botao.disabled = false;
      botao.textContent = "Adicionar técnico";
    }
  });
}

document.addEventListener("cf:pronto", () => {
  carregarTurmas();
  configurarFormCadastrarTurma();
  configurarFormEditarTurma();

  // "Nova turma" e "Editar turma" não fazem sentido abertos ao mesmo tempo
  document.getElementById("btnCadastrarTurma").addEventListener("click", () => {
    document.getElementById("painelEditarTurma").classList.add("is-hidden");
  });

  if (window.CF.role === "administrador") {
    ouvirTecnicos();
    configurarFormCadastrarTecnico();
    ouvirOutrosAdministradores();
  }
});
