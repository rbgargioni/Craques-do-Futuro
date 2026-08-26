// ======================================================
// Craques do Futuro — comunicacao.html (dados reais)
// Só roda depois que auth-guard.js confirma o papel (evento "cf:pronto"),
// que é quando window.CF.escolaId fica disponível.
// ======================================================

import {
  collection, addDoc, onSnapshot, query, where, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./firebase-init.js";

let turmasCache = {};
let turmaAtivaId = null;
let atletasCache = {}; // atletaId -> dados, só da turma ativa
let pararDeOuvirAtletas = null;
let pararDeOuvirMensagens = null;

function escolaId() { return window.CF.escolaId; }
function turmasRef() { return collection(db, "escolas", escolaId(), "turmas"); }
function atletasRef() { return collection(db, "escolas", escolaId(), "atletas"); }
function mensagensRef() { return collection(db, "escolas", escolaId(), "mensagens"); }
function chaveTurmaAtiva() { return `cf_turmaAtiva_${escolaId()}`; }

function formatarQuando(timestamp) {
  if (!timestamp) return "";
  const diffMs = Date.now() - timestamp.toDate().getTime();
  const dias = Math.floor(diffMs / 86400000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  return timestamp.toDate().toLocaleDateString("pt-BR");
}

// ------------------------------------------------------
// Turma ativa
// ------------------------------------------------------
function atualizarTurmaBar() {
  const nomeEl = document.getElementById("turmaAtivaNome");
  const turma = turmasCache[turmaAtivaId];
  nomeEl.innerHTML = turma
    ? `${turma.nome} <small>· ${turma.categoria} · ${turma.temporada}</small>`
    : "Nenhuma turma";
}

function popularSeletorTurma() {
  const select = document.getElementById("seletorTurma");
  const aviso = document.getElementById("avisoSemTurma");
  const ids = Object.keys(turmasCache);

  if (ids.length === 0) {
    select.innerHTML = '<option value="">Nenhuma turma cadastrada</option>';
    select.disabled = true;
    aviso.classList.remove("is-hidden");
    turmaAtivaId = null;
    atualizarTurmaBar();
    ouvirAtletasDaTurma();
    return;
  }

  select.disabled = false;
  aviso.classList.add("is-hidden");

  if (!turmaAtivaId || !turmasCache[turmaAtivaId]) {
    const salva = localStorage.getItem(chaveTurmaAtiva());
    turmaAtivaId = salva && turmasCache[salva] ? salva : ids[0];
  }

  select.innerHTML = "";
  ids.forEach((id) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = turmasCache[id].nome;
    if (id === turmaAtivaId) opt.selected = true;
    select.appendChild(opt);
  });

  atualizarTurmaBar();
  ouvirAtletasDaTurma();
}

function ouvirTurmas() {
  onSnapshot(
    turmasRef(),
    (snapshot) => {
      turmasCache = {};
      snapshot.forEach((docSnap) => { turmasCache[docSnap.id] = docSnap.data(); });
      popularSeletorTurma();
    },
    (erro) => console.error("Erro ao carregar turmas:", erro)
  );
}

function montarSeletorTurma() {
  document.getElementById("seletorTurma").addEventListener("change", (e) => {
    turmaAtivaId = e.target.value;
    localStorage.setItem(chaveTurmaAtiva(), turmaAtivaId);
    atualizarTurmaBar();
    ouvirAtletasDaTurma();
  });
}

// ------------------------------------------------------
// Atletas da turma ativa (preenche o <select> "Enviar para")
// ------------------------------------------------------
function popularSelectDestinatario() {
  const select = document.getElementById("destinatario");
  select.innerHTML = '<option value="turma">Toda a turma</option>';
  Object.keys(atletasCache)
    .sort((a, b) => atletasCache[a].nome.localeCompare(atletasCache[b].nome, "pt-BR"))
    .forEach((id) => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = atletasCache[id].nome;
      select.appendChild(opt);
    });
}

function ouvirAtletasDaTurma() {
  if (pararDeOuvirAtletas) {
    pararDeOuvirAtletas();
    pararDeOuvirAtletas = null;
  }
  atletasCache = {};
  popularSelectDestinatario();
  ouvirMensagens();

  if (!turmaAtivaId) return;

  const q = query(atletasRef(), where("turmaId", "==", turmaAtivaId));
  pararDeOuvirAtletas = onSnapshot(
    q,
    (snapshot) => {
      atletasCache = {};
      snapshot.forEach((docSnap) => { atletasCache[docSnap.id] = docSnap.data(); });
      popularSelectDestinatario();
    },
    (erro) => console.error("Erro ao carregar atletas:", erro)
  );
}

// ------------------------------------------------------
// Histórico de recados da turma ativa
// ------------------------------------------------------
function criarItemMensagem(dados) {
  const li = document.createElement("li");
  li.className = "message-item";

  const head = document.createElement("div");
  head.className = "message-item-head";
  const strong = document.createElement("strong");
  strong.textContent = dados.destinatarioNome;
  const quando = document.createElement("span");
  quando.textContent = formatarQuando(dados.criadoEm);
  head.append(strong, quando);

  const paragrafo = document.createElement("p");
  paragrafo.textContent = dados.mensagem;

  li.append(head, paragrafo);
  return li;
}

function ouvirMensagens() {
  if (pararDeOuvirMensagens) {
    pararDeOuvirMensagens();
    pararDeOuvirMensagens = null;
  }

  const lista = document.getElementById("listaMensagens");
  if (!turmaAtivaId) {
    lista.innerHTML = '<li class="empty-state">Selecione uma turma.</li>';
    return;
  }

  lista.innerHTML = '<li class="empty-state">Carregando...</li>';
  const q = query(mensagensRef(), where("turmaId", "==", turmaAtivaId));
  pararDeOuvirMensagens = onSnapshot(
    q,
    (snapshot) => {
      const registros = [];
      snapshot.forEach((docSnap) => registros.push(docSnap.data()));
      registros.sort((a, b) => (b.criadoEm?.toMillis?.() || 0) - (a.criadoEm?.toMillis?.() || 0));

      lista.innerHTML = "";
      if (registros.length === 0) {
        lista.innerHTML = '<li class="empty-state">Nenhum recado enviado nesta turma ainda.</li>';
        return;
      }
      registros.forEach((dados) => lista.appendChild(criarItemMensagem(dados)));
    },
    (erro) => {
      console.error("Erro ao carregar mensagens:", erro);
      lista.innerHTML = '<li class="empty-state">Não foi possível carregar os recados.</li>';
    }
  );
}

// ------------------------------------------------------
// Novo recado
// ------------------------------------------------------
function configurarFormRecado() {
  const form = document.getElementById("formRecado");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!turmaAtivaId) {
      showToast("Selecione uma turma antes de enviar um recado.");
      return;
    }

    const botao = form.querySelector("button[type=submit]");
    botao.disabled = true;
    botao.textContent = "Enviando...";

    try {
      const destinoValor = form.destinatario.value;
      const destinatarioNome = destinoValor === "turma"
        ? "Toda a turma"
        : (atletasCache[destinoValor] ? atletasCache[destinoValor].nome : "Atleta");

      await addDoc(mensagensRef(), {
        turmaId: turmaAtivaId,
        destinatarioId: destinoValor,
        destinatarioNome,
        mensagem: form.mensagem.value.trim(),
        criadoEm: serverTimestamp(),
      });

      showToast("Recado enviado.");
      form.reset();
    } catch (erro) {
      console.error(erro);
      showToast("Não foi possível enviar o recado. Tente novamente.");
    } finally {
      botao.disabled = false;
      botao.textContent = "Enviar recado";
    }
  });
}

document.addEventListener("cf:pronto", () => {
  ouvirTurmas();
  montarSeletorTurma();
  configurarFormRecado();
});
