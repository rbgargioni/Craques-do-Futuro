// ======================================================
// Craques do Futuro — index.html (Dashboard, parcialmente conectado)
// Turma ativa, total de atletas, "prontos para evoluir", Destaques/Atenção
// (avaliações) e presença de hoje (frequência) já são reais.
// Só os 3 gráficos no fim da página ainda são mockup.
// ======================================================

import {
  collection, doc, updateDoc, addDoc, getDocs, onSnapshot, where, query, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { PROXIMA_CATEGORIA, NIVEL_MAXIMO, NIVEL_INICIAL, notaEhBoa } from "./metricas.js";

let turmasCache = {};
let turmaAtivaId = null;
let atletasCache = {}; // atletaId -> dados, só da turma ativa (usado no "Destaques"/"Atenção" também)
let pararDeOuvirAtletas = null;
let pararDeOuvirAvaliacoes = null;

function escolaId() { return window.CF.escolaId; }
function turmasRef() { return collection(db, "escolas", escolaId(), "turmas"); }
function atletasRef() { return collection(db, "escolas", escolaId(), "atletas"); }
function avaliacoesRef() { return collection(db, "escolas", escolaId(), "avaliacoes"); }
function frequenciaRef() { return collection(db, "escolas", escolaId(), "frequencia"); }
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
    ouvirAvaliacoes();
    carregarPresencaHoje();
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
  ouvirAvaliacoes();
  carregarPresencaHoje();
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
    ouvirAvaliacoes();
    carregarPresencaHoje();
  });
}

// ------------------------------------------------------
// Presença de hoje (a partir da Frequência)
// ------------------------------------------------------
async function carregarPresencaHoje() {
  const statPresentes = document.getElementById("statPresentes");
  const statAusentes = document.getElementById("statAusentes");
  const statAtrasados = document.getElementById("statAtrasados");

  if (!turmaAtivaId) {
    statPresentes.textContent = "0";
    statAusentes.textContent = "0";
    statAtrasados.textContent = "0";
    return;
  }

  try {
    const hojeStr = new Date().toDateString();
    const snap = await getDocs(query(frequenciaRef(), where("turmaId", "==", turmaAtivaId)));
    const contagem = { presente: 0, atrasado: 0, ausente: 0 };
    snap.forEach((docSnap) => {
      const dados = docSnap.data();
      if (dados.data && dados.data.toDate().toDateString() === hojeStr) {
        contagem[dados.estado] = (contagem[dados.estado] || 0) + 1;
      }
    });
    statPresentes.textContent = contagem.presente;
    statAusentes.textContent = contagem.ausente;
    statAtrasados.textContent = contagem.atrasado;
  } catch (erro) {
    console.error("Erro ao carregar presença de hoje:", erro);
    statPresentes.textContent = "—";
    statAusentes.textContent = "—";
    statAtrasados.textContent = "—";
  }
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
  nivelEl.textContent = `Nível ${NIVEL_MAXIMO}/${NIVEL_MAXIMO} em ${dados.categoriaAtual}`;
  info.append(nomeEl, nivelEl);

  const btn = document.createElement("button");
  btn.className = "btn btn-primary btn-sm";
  btn.textContent = `Promover para ${proximaCategoria}`;
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    try {
      await updateDoc(doc(db, "escolas", escolaId(), "atletas", atletaId), {
        categoriaAtual: proximaCategoria,
        nivelAtual: NIVEL_INICIAL,
        nivelDesde: serverTimestamp(),
      });
      await addDoc(collection(db, "escolas", escolaId(), "atletas", atletaId, "progressao"), {
        tipo: "promocao",
        categoriaAnterior: dados.categoriaAtual,
        nivelAnterior: NIVEL_MAXIMO,
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
  const prontos = lista.filter((a) => (a.dados.nivelAtual || 0) >= NIVEL_MAXIMO && PROXIMA_CATEGORIA[a.dados.categoriaAtual]);

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
  atletasCache = {};
  if (!turmaAtivaId) {
    statTotal.textContent = "0";
    listaProntos.innerHTML = '<li class="empty-state">Selecione uma turma.</li>';
    renderizarDestaquesAtencao();
    return;
  }

  const q = query(atletasRef(), where("turmaId", "==", turmaAtivaId));
  pararDeOuvirAtletas = onSnapshot(
    q,
    (snapshot) => {
      const lista = [];
      snapshot.forEach((docSnap) => {
        atletasCache[docSnap.id] = docSnap.data();
        lista.push({ id: docSnap.id, dados: docSnap.data() });
      });
      statTotal.textContent = lista.length;
      renderizarProntos(lista);
      renderizarDestaquesAtencao();
    },
    (erro) => {
      console.error("Erro ao carregar atletas:", erro);
      statTotal.textContent = "—";
      listaProntos.innerHTML = '<li class="empty-state">Não foi possível carregar os atletas.</li>';
    }
  );
}

// ------------------------------------------------------
// Destaques da turma / Atenção do treinador (a partir das avaliações)
// Usa a nota "geral" da avaliação MAIS RECENTE de cada atleta.
// ------------------------------------------------------
let ultimaAvaliacaoPorAtleta = {};

function criarItemAthleteList(atletaId, nota, textoSecundario, classePill) {
  const dadosAtleta = atletasCache[atletaId];
  const li = document.createElement("li");
  const avatar = document.createElement("span");
  avatar.className = "athlete-avatar";
  avatar.textContent = iniciaisDoNome(dadosAtleta ? dadosAtleta.nome : "");

  const info = document.createElement("div");
  info.className = "athlete-info";
  const nomeEl = document.createElement("strong");
  nomeEl.textContent = dadosAtleta ? dadosAtleta.nome : "Atleta removido";
  const subEl = document.createElement("span");
  subEl.textContent = textoSecundario;
  if (classePill === "pill--warn") subEl.className = "warn-text";
  info.append(nomeEl, subEl);

  const pill = document.createElement("span");
  pill.className = `pill ${classePill}`;
  pill.textContent = nota.toFixed(1).replace(".", ",");

  li.append(avatar, info, pill);
  return li;
}

function renderizarDestaquesAtencao() {
  const listaDestaques = document.getElementById("listaDestaques");
  const listaAtencao = document.getElementById("listaAtencao");

  const avaliados = Object.entries(ultimaAvaliacaoPorAtleta)
    .filter(([atletaId]) => atletasCache[atletaId]) // só atletas que ainda estão nesta turma
    .map(([atletaId, dados]) => ({ atletaId, geral: dados.geral }));

  if (avaliados.length === 0) {
    listaDestaques.innerHTML = '<li class="empty-state">Nenhuma avaliação registrada ainda.</li>';
    listaAtencao.innerHTML = '<li class="empty-state">Nenhuma avaliação registrada ainda.</li>';
    return;
  }

  const porNotaDesc = [...avaliados].sort((a, b) => b.geral - a.geral);
  const destaques = porNotaDesc.slice(0, 3);
  listaDestaques.innerHTML = "";
  destaques.forEach(({ atletaId, geral }) => {
    const posicao = atletasCache[atletaId] ? atletasCache[atletaId].posicao : "";
    listaDestaques.appendChild(criarItemAthleteList(atletaId, geral, posicao, "pill--good"));
  });

  const emAtencao = porNotaDesc.filter((a) => !notaEhBoa(a.geral)).slice(-3).reverse();
  if (emAtencao.length === 0) {
    listaAtencao.innerHTML = '<li class="empty-state">Ninguém abaixo da média no momento. 🎉</li>';
  } else {
    listaAtencao.innerHTML = "";
    emAtencao.forEach(({ atletaId, geral }) => {
      listaAtencao.appendChild(criarItemAthleteList(atletaId, geral, "Precisa evoluir", "pill--warn"));
    });
  }
}

function ouvirAvaliacoes() {
  if (pararDeOuvirAvaliacoes) {
    pararDeOuvirAvaliacoes();
    pararDeOuvirAvaliacoes = null;
  }

  ultimaAvaliacaoPorAtleta = {};
  if (!turmaAtivaId) {
    renderizarDestaquesAtencao();
    return;
  }

  const q = query(avaliacoesRef(), where("turmaId", "==", turmaAtivaId));
  pararDeOuvirAvaliacoes = onSnapshot(
    q,
    (snapshot) => {
      ultimaAvaliacaoPorAtleta = {};
      snapshot.forEach((docSnap) => {
        const dados = docSnap.data();
        const atual = ultimaAvaliacaoPorAtleta[dados.atletaId];
        if (!atual || (dados.data?.toMillis() || 0) > (atual.data?.toMillis() || 0)) {
          ultimaAvaliacaoPorAtleta[dados.atletaId] = dados;
        }
      });
      renderizarDestaquesAtencao();
    },
    (erro) => console.error("Erro ao carregar avaliações:", erro)
  );
}

document.addEventListener("cf:pronto", () => {
  ouvirTurmas();
  montarSeletorTurma();
});
