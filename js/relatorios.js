// ======================================================
// Craques do Futuro — relatorios.html (dados reais)
// Só roda depois que auth-guard.js confirma o papel (evento "cf:pronto"),
// que é quando window.CF.escolaId fica disponível.
//
// Busca avaliações/frequência da turma inteira (sem filtro de data na query,
// pra não precisar de índice composto) e filtra o período no cliente — assim
// trocar o filtro de período não precisa refazer a leitura no Firestore.
// ======================================================

import {
  collection, onSnapshot, query, where,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { PILARES_RADAR, notaEhBoa, calcularTendencia, pontoRadar } from "./metricas.js";

const NOMES_MES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const TEXTO_PERIODO = { 30: "Últimos 30 dias", 180: "Últimos 6 meses", temporada: "Temporada inteira" };

let turmasCache = {};
let turmaAtivaId = null;
let atletasCache = {};
let avaliacoesCacheAll = [];
let frequenciaCacheAll = [];
let pararDeOuvirAtletas = null;
let pararDeOuvirAvaliacoes = null;
let pararDeOuvirFrequencia = null;

function escolaId() { return window.CF.escolaId; }
function turmasRef() { return collection(db, "escolas", escolaId(), "turmas"); }
function atletasRef() { return collection(db, "escolas", escolaId(), "atletas"); }
function avaliacoesRef() { return collection(db, "escolas", escolaId(), "avaliacoes"); }
function frequenciaRef() { return collection(db, "escolas", escolaId(), "frequencia"); }
function chaveTurmaAtiva() { return `cf_turmaAtiva_${escolaId()}`; }

function filtroAtual() {
  const valor = document.getElementById("filtroPeriodo").value;
  return valor === "temporada" ? "temporada" : Number(valor);
}

function dataCorte() {
  const filtro = filtroAtual();
  if (filtro === "temporada") return null;
  const corte = new Date();
  corte.setDate(corte.getDate() - filtro);
  return corte;
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
    ouvirTudoDaTurma();
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
  ouvirTudoDaTurma();
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
    ouvirTudoDaTurma();
  });
}

function montarFiltroPeriodo() {
  document.getElementById("filtroPeriodo").addEventListener("change", recalcularTudo);
}

// ------------------------------------------------------
// Fontes de dados (atletas / avaliações / frequência da turma ativa)
// ------------------------------------------------------
function ouvirTudoDaTurma() {
  [pararDeOuvirAtletas, pararDeOuvirAvaliacoes, pararDeOuvirFrequencia].forEach((parar) => parar && parar());
  atletasCache = {};
  avaliacoesCacheAll = [];
  frequenciaCacheAll = [];

  if (!turmaAtivaId) {
    recalcularTudo();
    return;
  }

  pararDeOuvirAtletas = onSnapshot(
    query(atletasRef(), where("turmaId", "==", turmaAtivaId)),
    (snapshot) => {
      atletasCache = {};
      snapshot.forEach((docSnap) => { atletasCache[docSnap.id] = docSnap.data(); });
      recalcularTudo();
    },
    (erro) => console.error("Erro ao carregar atletas:", erro)
  );

  pararDeOuvirAvaliacoes = onSnapshot(
    query(avaliacoesRef(), where("turmaId", "==", turmaAtivaId)),
    (snapshot) => {
      avaliacoesCacheAll = [];
      snapshot.forEach((docSnap) => avaliacoesCacheAll.push(docSnap.data()));
      recalcularTudo();
    },
    (erro) => console.error("Erro ao carregar avaliações:", erro)
  );

  pararDeOuvirFrequencia = onSnapshot(
    query(frequenciaRef(), where("turmaId", "==", turmaAtivaId)),
    (snapshot) => {
      frequenciaCacheAll = [];
      snapshot.forEach((docSnap) => frequenciaCacheAll.push(docSnap.data()));
      recalcularTudo();
    },
    (erro) => console.error("Erro ao carregar frequência:", erro)
  );
}

// ------------------------------------------------------
// Recalcula os 4 blocos sempre que turma, período ou os dados mudam
// ------------------------------------------------------
function recalcularTudo() {
  const corte = dataCorte();
  const avaliacoesPeriodo = avaliacoesCacheAll.filter((a) => a.data && (!corte || a.data.toDate() >= corte));
  const frequenciaPeriodo = frequenciaCacheAll.filter((f) => f.data && (!corte || f.data.toDate() >= corte));

  const rotuloPeriodo = TEXTO_PERIODO[filtroAtual()];
  document.getElementById("tagPeriodoEvolucao").textContent = rotuloPeriodo;
  document.getElementById("tagPeriodoFrequencia").textContent = rotuloPeriodo;

  renderizarEvolucao(avaliacoesPeriodo);
  renderizarFrequencia(frequenciaPeriodo);
  renderizarRadar(avaliacoesPeriodo);
  renderizarDesempenho(avaliacoesPeriodo, frequenciaPeriodo);
}

// ------------------------------------------------------
// Gráfico de linha — média da nota geral por mês
// ------------------------------------------------------
function renderizarEvolucao(avaliacoes) {
  const polyline = document.getElementById("linhaEvolucao");
  const ponto = document.getElementById("pontoEvolucao");
  const labelsEl = document.getElementById("labelsEvolucao");
  labelsEl.innerHTML = "";

  const porMes = {};
  avaliacoes.forEach((a) => {
    const d = a.data.toDate();
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    (porMes[chave] = porMes[chave] || []).push(a.geral);
  });

  const chaves = Object.keys(porMes).sort();
  if (chaves.length === 0) {
    polyline.setAttribute("points", "");
    ponto.classList.add("is-hidden");
    labelsEl.innerHTML = '<span>Sem avaliações no período</span>';
    return;
  }

  const pontos = chaves.map((chave) => {
    const valores = porMes[chave];
    const media = valores.reduce((s, v) => s + v, 0) / valores.length;
    const mes = Number(chave.split("-")[1]) - 1;
    return { label: NOMES_MES[mes], media };
  });

  const passo = pontos.length > 1 ? 300 / (pontos.length - 1) : 0;
  const coords = pontos.map((p, i) => ({
    x: 10 + i * passo,
    y: 130 - (Math.min(10, Math.max(0, p.media)) / 10) * 120,
  }));

  polyline.setAttribute("points", coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" "));
  const ultimo = coords[coords.length - 1];
  ponto.setAttribute("cx", ultimo.x.toFixed(1));
  ponto.setAttribute("cy", ultimo.y.toFixed(1));
  ponto.classList.remove("is-hidden");

  pontos.forEach((p) => {
    const span = document.createElement("span");
    span.textContent = p.label;
    labelsEl.appendChild(span);
  });
}

// ------------------------------------------------------
// Rosca — % de presença no período
// ------------------------------------------------------
function renderizarFrequencia(frequencia) {
  const circulo = document.getElementById("donutValor");
  const CIRCUNFERENCIA = 301.6;

  if (frequencia.length === 0) {
    circulo.style.strokeDashoffset = `${CIRCUNFERENCIA}`;
    document.getElementById("donutPercentual").textContent = "—";
    return;
  }

  const presentes = frequencia.filter((f) => f.estado === "presente").length;
  const percentual = Math.round((presentes / frequencia.length) * 1000) / 10;
  circulo.style.strokeDashoffset = `${CIRCUNFERENCIA * (1 - percentual / 100)}`;
  document.getElementById("donutPercentual").textContent = `${percentual.toFixed(1).replace(".", ",")}%`;
}

// ------------------------------------------------------
// Radar — média dos 5 Pilares no período
// ------------------------------------------------------
function renderizarRadar(avaliacoes) {
  const shape = document.getElementById("radarShape");
  const mediaEl = document.getElementById("radarMedia");

  if (avaliacoes.length === 0) {
    shape.setAttribute("points", PILARES_RADAR.map(() => "120,120").join(" "));
    mediaEl.textContent = "—";
    return;
  }

  const somas = { tecnico: 0, tatico: 0, fisico: 0, mental: 0, evolucao: 0, geral: 0 };
  avaliacoes.forEach((a) => {
    PILARES_RADAR.forEach((campo) => { somas[campo] += a[campo]; });
    somas.geral += a.geral;
  });
  const n = avaliacoes.length;
  const pontos = PILARES_RADAR.map((campo, i) => pontoRadar(somas[campo] / n, i)).join(" ");
  shape.setAttribute("points", pontos);
  mediaEl.textContent = (somas.geral / n).toFixed(1).replace(".", ",");
}

// ------------------------------------------------------
// Tabela de desempenho individual
// ------------------------------------------------------
function renderizarDesempenho(avaliacoesPeriodo, frequenciaPeriodo) {
  const corpo = document.getElementById("corpoDesempenho");
  const idsAtletas = Object.keys(atletasCache);
  corpo.innerHTML = "";

  if (idsAtletas.length === 0) {
    corpo.innerHTML = '<tr><td colspan="4" class="empty-state">Nenhum atleta nesta turma ainda.</td></tr>';
    return;
  }

  idsAtletas
    .sort((a, b) => atletasCache[a].nome.localeCompare(atletasCache[b].nome, "pt-BR"))
    .forEach((atletaId) => {
      const avals = avaliacoesPeriodo
        .filter((a) => a.atletaId === atletaId)
        .sort((a, b) => a.data.toMillis() - b.data.toMillis());
      const freqs = frequenciaPeriodo.filter((f) => f.atletaId === atletaId);

      const tr = document.createElement("tr");

      const tdNome = document.createElement("td");
      tdNome.textContent = atletasCache[atletaId].nome;

      const tdPresenca = document.createElement("td");
      tdPresenca.textContent = freqs.length === 0
        ? "—"
        : `${Math.round((freqs.filter((f) => f.estado === "presente").length / freqs.length) * 100)}%`;

      const tdNota = document.createElement("td");
      if (avals.length === 0) {
        tdNota.textContent = "—";
      } else {
        const media = avals.reduce((s, a) => s + a.geral, 0) / avals.length;
        const pill = document.createElement("span");
        pill.className = `pill ${notaEhBoa(media) ? "pill--good" : "pill--warn"}`;
        pill.textContent = media.toFixed(1).replace(".", ",");
        tdNota.appendChild(pill);
      }

      const tdTendencia = document.createElement("td");
      tdTendencia.textContent = calcularTendencia(avals.map((a) => a.geral));

      tr.append(tdNome, tdPresenca, tdNota, tdTendencia);
      corpo.appendChild(tr);
    });
}

document.addEventListener("cf:pronto", () => {
  ouvirTurmas();
  montarSeletorTurma();
  montarFiltroPeriodo();
});
