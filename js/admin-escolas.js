// ======================================================
// Craques do Futuro — admin-escolas.html (dados reais)
// Só roda depois que auth-guard.js confirma que quem está logado é "dono"
// (evento "cf:pronto"), senão as regras do Firestore bloqueiam tudo mesmo.
// ======================================================

import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection, addDoc, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp, Timestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { app as appPrincipal, db } from "./firebase-init.js";

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

function criarCardEscola(dados) {
  const card = document.createElement("div");
  card.className = "entity-card";
  card.dataset.searchItem = "";
  card.dataset.name = dados.nome;

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
  window.CFBadgeLicenca(badge);
  return card;
}

function carregarEscolas() {
  const container = document.getElementById("listaEscolas");
  const totalEl = document.getElementById("totalEscolas");
  const selectEscola = document.getElementById("escolaDoAdmin");

  onSnapshot(
    collection(db, "escolas"),
    (snapshot) => {
      container.innerHTML = "";
      selectEscola.innerHTML = "";

      if (snapshot.empty) {
        container.innerHTML = '<p class="empty-state">Nenhuma escola cadastrada ainda. Clique em "Cadastrar escola" pra criar a primeira.</p>';
        const opt = document.createElement("option");
        opt.textContent = "Nenhuma escola cadastrada ainda";
        selectEscola.appendChild(opt);
        totalEl.textContent = "0 clientes";
        return;
      }

      totalEl.textContent = `${snapshot.size} cliente${snapshot.size === 1 ? "" : "s"}`;

      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Selecione...";
      selectEscola.appendChild(placeholder);

      snapshot.forEach((docSnap) => {
        const dados = docSnap.data();
        container.appendChild(criarCardEscola(dados));

        const opt = document.createElement("option");
        opt.value = docSnap.id;
        opt.textContent = dados.nome;
        selectEscola.appendChild(opt);
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
  carregarEscolas();
  configurarFormCadastrarEscola();
  configurarFormAdicionarAdministrador();
});
