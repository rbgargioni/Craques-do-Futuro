// ======================================================
// Craques do Futuro — comparativos.html (dados reais)
// Só roda depois que auth-guard.js confirma o papel (evento "cf:pronto"),
// que é quando window.CF.escolaId fica disponível.
//
// A média de cada atleta considera TODAS as avaliações dele (não só as da
// turma ativa) — se ele já foi promovido de turma, a comparação continua
// olhando a carreira inteira.
// ======================================================

import {
  collection, onSnapshot, query, where,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./firebase-init.js";

const ORDEM_PILARES_RADAR = ["tecnico", "tatico", "mental", "fisico", "evolucao"];
const ORDEM_PILARES_TABELA = [
  { campo: "tecnico", label: "Técnico" },
  { campo: "tatico", label: "Tático" },
  { campo: "fisico", label: "Físico" },
  { campo: "mental", label: "Mental" },
  { campo: "evolucao", label: "Evolução" },
];

let turmasCache = {};
let turmaAtivaId = null;
let atletasCache = {};
let pararDeOuvirAtletas = null;
let pararDeOuvirAvalA = null;
let pararDeOuvirAvalB = null;
let mediasA = null;
let mediasB = null;

function escolaId() { return window.CF.escolaId; }
function turmasRef() { return collection(db, "escolas", escolaId(), "turmas"); }
function atletasRef() { return collection(db, "escolas", escolaId(), "atletas"); }
function avaliacoesRef() { return collection(db, "escolas", escolaId(), "avaliacoes"); }
function chaveTurmaAtiva() { return `cf_turmaAtiva_${escolaId()}`; }

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
// Atletas da turma ativa (preenche os dois seletores)
// ------------------------------------------------------
function popularSelectsAtletas() {
  const ids = Object.keys(atletasCache).sort((a, b) => atletasCache[a].nome.localeCompare(atletasCache[b].nome, "pt-BR"));

  [["atletaA", "A"], ["atletaB", "B"]].forEach(([elId, rotulo], idx) => {
    const select = document.getElementById(elId);
    const valorAtual = select.value;
    select.innerHTML = '<option value="">Selecione...</option>';
    ids.forEach((id) => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = atletasCache[id].nome;
      select.appendChild(opt);
    });
    const novoValor = ids.includes(valorAtual) ? valorAtual : (ids[idx] || "");
    select.value = novoValor;
    ouvirAvaliacoesAtleta(novoValor, rotulo);
  });
}

function ouvirAtletasDaTurma() {
  if (pararDeOuvirAtletas) {
    pararDeOuvirAtletas();
    pararDeOuvirAtletas = null;
  }
  atletasCache = {};
  popularSelectsAtletas();

  if (!turmaAtivaId) return;

  const q = query(atletasRef(), where("turmaId", "==", turmaAtivaId));
  pararDeOuvirAtletas = onSnapshot(
    q,
    (snapshot) => {
      atletasCache = {};
      snapshot.forEach((docSnap) => { atletasCache[docSnap.id] = docSnap.data(); });
      popularSelectsAtletas();
    },
    (erro) => console.error("Erro ao carregar atletas:", erro)
  );
}

// ------------------------------------------------------
// Avaliações do atleta selecionado (carreira inteira) → médias
// ------------------------------------------------------
function calcularMedias(avaliacoes) {
  if (avaliacoes.length === 0) return null;
  const somas = { tecnico: 0, tatico: 0, fisico: 0, mental: 0, evolucao: 0, geral: 0 };
  avaliacoes.forEach((a) => {
    Object.keys(somas).forEach((campo) => { somas[campo] += a[campo]; });
  });
  const medias = { quantidade: avaliacoes.length };
  Object.keys(somas).forEach((campo) => { medias[campo] = somas[campo] / avaliacoes.length; });
  return medias;
}

function ouvirAvaliacoesAtleta(atletaId, rotulo) {
  if (rotulo === "A" && pararDeOuvirAvalA) { pararDeOuvirAvalA(); pararDeOuvirAvalA = null; }
  if (rotulo === "B" && pararDeOuvirAvalB) { pararDeOuvirAvalB(); pararDeOuvirAvalB = null; }

  if (!atletaId) {
    if (rotulo === "A") mediasA = null; else mediasB = null;
    renderizarComparacao();
    return;
  }

  const q = query(avaliacoesRef(), where("atletaId", "==", atletaId));
  const parar = onSnapshot(
    q,
    (snapshot) => {
      const lista = [];
      snapshot.forEach((docSnap) => lista.push(docSnap.data()));
      const medias = calcularMedias(lista);
      if (rotulo === "A") mediasA = medias; else mediasB = medias;
      renderizarComparacao();
    },
    (erro) => console.error("Erro ao carregar avaliações do atleta:", erro)
  );

  if (rotulo === "A") pararDeOuvirAvalA = parar; else pararDeOuvirAvalB = parar;
}

function montarSelectsAtletas() {
  document.getElementById("atletaA").addEventListener("change", (e) => ouvirAvaliacoesAtleta(e.target.value, "A"));
  document.getElementById("atletaB").addEventListener("change", (e) => ouvirAvaliacoesAtleta(e.target.value, "B"));
}

// ------------------------------------------------------
// Radar + tabela comparativa
// ------------------------------------------------------
function pontoRadar(valor, indice) {
  const angulo = ((-90 + indice * 72) * Math.PI) / 180;
  const r = (Math.min(10, Math.max(0, valor)) / 10) * 100;
  const x = 120 + r * Math.cos(angulo);
  const y = 120 + r * Math.sin(angulo);
  return `${x.toFixed(1)},${y.toFixed(1)}`;
}

function atualizarRadar(prefixo, atletaId, medias) {
  const dadosAtleta = atletasCache[atletaId];
  document.getElementById(`nomeAtleta${prefixo}`).textContent = dadosAtleta ? dadosAtleta.nome : "—";
  document.getElementById(`posicaoAtleta${prefixo}`).textContent = dadosAtleta ? dadosAtleta.posicao : "";

  const shape = document.getElementById(`radarShape${prefixo}`);
  const mediaEl = document.getElementById(`mediaAtleta${prefixo}`);

  if (!medias) {
    shape.setAttribute("points", ORDEM_PILARES_RADAR.map(() => "120,120").join(" "));
    mediaEl.textContent = dadosAtleta ? "sem notas" : "—";
    return;
  }
  shape.setAttribute("points", ORDEM_PILARES_RADAR.map((campo, i) => pontoRadar(medias[campo], i)).join(" "));
  mediaEl.textContent = medias.geral.toFixed(1).replace(".", ",");
}

function renderizarComparacao() {
  const idA = document.getElementById("atletaA").value;
  const idB = document.getElementById("atletaB").value;

  atualizarRadar("A", idA, mediasA);
  atualizarRadar("B", idB, mediasB);

  document.getElementById("cabecalhoA").textContent = atletasCache[idA] ? atletasCache[idA].nome : "Atleta A";
  document.getElementById("cabecalhoB").textContent = atletasCache[idB] ? atletasCache[idB].nome : "Atleta B";

  const corpo = document.getElementById("corpoComparativo");
  const aviso = document.getElementById("avisoComparativo");
  corpo.innerHTML = "";

  if (!idA || !idB) {
    corpo.innerHTML = '<tr><td colspan="4" class="empty-state">Selecione os dois atletas.</td></tr>';
    aviso.textContent = "";
    return;
  }
  if (idA === idB) {
    corpo.innerHTML = '<tr><td colspan="4" class="empty-state">Selecione dois atletas diferentes.</td></tr>';
    aviso.textContent = "";
    return;
  }
  if (!mediasA || !mediasB) {
    corpo.innerHTML = '<tr><td colspan="4" class="empty-state">Um dos atletas ainda não tem avaliações registradas.</td></tr>';
    aviso.textContent = "";
    return;
  }

  aviso.textContent = `${mediasA.quantidade} avaliação(ões) de ${atletasCache[idA].nome} · ${mediasB.quantidade} avaliação(ões) de ${atletasCache[idB].nome}.`;

  ORDEM_PILARES_TABELA.forEach(({ campo, label }) => {
    const valorA = mediasA[campo];
    const valorB = mediasB[campo];
    const diff = Math.round((valorA - valorB) * 10) / 10;

    const tr = document.createElement("tr");
    const tdLabel = document.createElement("td");
    tdLabel.textContent = label;
    const tdA = document.createElement("td");
    tdA.textContent = valorA.toFixed(1).replace(".", ",");
    const tdB = document.createElement("td");
    tdB.textContent = valorB.toFixed(1).replace(".", ",");

    const tdDiff = document.createElement("td");
    const pill = document.createElement("span");
    pill.className = `pill ${diff > 0 ? "pill--good" : diff < 0 ? "pill--bad" : "pill--warn"}`;
    pill.textContent = `${diff > 0 ? "+" : ""}${diff.toFixed(1).replace(".", ",")}`;
    tdDiff.appendChild(pill);

    tr.append(tdLabel, tdA, tdB, tdDiff);
    corpo.appendChild(tr);
  });
}

document.addEventListener("cf:pronto", () => {
  ouvirTurmas();
  montarSeletorTurma();
  montarSelectsAtletas();
});
