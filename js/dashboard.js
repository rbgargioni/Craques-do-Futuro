// ======================================================
// Craques do Futuro — index.html (Dashboard, parcialmente conectado)
// Turma ativa, total de atletas e "prontos para evoluir" já são reais.
// O resto da página (presença de hoje, destaques, gráficos) ainda é mockup —
// depende de Frequência/Avaliações, que ainda não existem.
// ======================================================

import {
  collection, doc, updateDoc, addDoc, onSnapshot, where, query, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./firebase-init.js";

const PROXIMA_CATEGORIA = {
  "Sub-9": "Sub-11",
  "Sub-11": "Sub-13",
  "Sub-13": "Sub-15",
  "Sub-15": "Sub-17",
  "Sub-17": "Sub-20",
};

let turmasCache = {};
let turmaAtivaId = null;
let pararDeOuvirAtletas = null;

function escolaId() { return window.CF.escolaId; }
function turmasRef() { return collection(db, "escolas", escolaId(), "turmas"); }
function atletasRef() { return collection(db, "escolas", escolaId(), "atletas"); }
// Mesma chave usada em atletas.js — trocar a turma numa página reflete na outra.
function chaveTurmaAtiva() { return `cf_turmaAtiva_${escolaId()}`; }

function iniciaisDoNome(nome) {
  return (nome || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
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
    ouvirAtletas();
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
  ouvirAtletas();
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
    ouvirAtletas();
  });
}

// ------------------------------------------------------
// Prontos para evoluir (nível 9) + total de atletas
// ------------------------------------------------------
function criarItemPronto(atletaId, dados) {
  const proximaCategoria = PROXIMA_CATEGORIA[dados.categoriaAtual];

  const li = document.createElement("li");
  const avatar = document.createElement("span");
  avatar.className = "athlete-avatar";
  avatar.textContent = iniciaisDoNome(dados.nome);

  const info = document.createElement("div");
  info.className = "athlete-info";
  const nomeEl = document.createElement("strong");
  nomeEl.textContent = dados.nome;
  const nivelEl = document.createElement("span");
  nivelEl.textContent = `Nível 9/9 em ${dados.categoriaAtual}`;
  info.append(nomeEl, nivelEl);

  const btn = document.createElement("button");
  btn.className = "btn btn-primary btn-sm";
  btn.textContent = `Promover para ${proximaCategoria}`;
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    try {
      await updateDoc(doc(db, "escolas", escolaId(), "atletas", atletaId), {
        categoriaAtual: proximaCategoria,
        nivelAtual: 1,
        nivelDesde: serverTimestamp(),
      });
      await addDoc(collection(db, "escolas", escolaId(), "atletas", atletaId, "progressao"), {
        tipo: "promocao",
        categoriaAnterior: dados.categoriaAtual,
        nivelAnterior: 9,
        categoriaNova: proximaCategoria,
        data: serverTimestamp(),
      });
      showToast(`${dados.nome} promovido para ${proximaCategoria}.`);
    } catch (erro) {
      console.error(erro);
      showToast("Não foi possível promover o atleta. Tente novamente.");
      btn.disabled = false;
    }
  });

  li.append(avatar, info, btn);
  return li;
}

function renderizarProntos(lista) {
  const container = document.getElementById("listaProntosEvoluir");
  const prontos = lista.filter((a) => (a.dados.nivelAtual || 0) >= 9 && PROXIMA_CATEGORIA[a.dados.categoriaAtual]);

  container.innerHTML = "";
  if (prontos.length === 0) {
    container.innerHTML = '<li class="empty-state">Nenhum atleta pronto para evoluir de categoria no momento.</li>';
    return;
  }
  prontos.forEach(({ id, dados }) => container.appendChild(criarItemPronto(id, dados)));
}

function ouvirAtletas() {
  if (pararDeOuvirAtletas) {
    pararDeOuvirAtletas();
    pararDeOuvirAtletas = null;
  }

  const statTotal = document.getElementById("statTotalAtletas");
  const listaProntos = document.getElementById("listaProntosEvoluir");
  if (!turmaAtivaId) {
    statTotal.textContent = "0";
    listaProntos.innerHTML = '<li class="empty-state">Selecione uma turma.</li>';
    return;
  }

  const q = query(atletasRef(), where("turmaId", "==", turmaAtivaId));
  pararDeOuvirAtletas = onSnapshot(
    q,
    (snapshot) => {
      const lista = [];
      snapshot.forEach((docSnap) => lista.push({ id: docSnap.id, dados: docSnap.data() }));
      statTotal.textContent = lista.length;
      renderizarProntos(lista);
    },
    (erro) => {
      console.error("Erro ao carregar atletas:", erro);
      statTotal.textContent = "—";
      listaProntos.innerHTML = '<li class="empty-state">Não foi possível carregar os atletas.</li>';
    }
  );
}

document.addEventListener("cf:pronto", () => {
  ouvirTurmas();
  montarSeletorTurma();
});
