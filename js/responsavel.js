// ======================================================
// Craques do Futuro — responsavel.html (dados reais)
// Só roda depois que auth-guard.js confirma o papel (evento "cf:pronto"),
// que é quando window.CF.atletaIds fica disponível.
// ======================================================

import {
  collection, doc, getDoc, onSnapshot, query, where,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { PILARES_RADAR, notaEhBoa, pontoRadar, pontosEvolucao } from "./metricas.js";

let atletasCache = {}; // atletaId -> dados
let atletaAtivoId = null;
let pararDeOuvirAvaliacoes = null;
let pararDeOuvirFrequencia = null;
let pararDeOuvirRecados = null;

function escolaId() { return window.CF.escolaId; }
function atletaRef(atletaId) { return doc(db, "escolas", escolaId(), "atletas", atletaId); }
function avaliacoesRef() { return collection(db, "escolas", escolaId(), "avaliacoes"); }
function frequenciaRef() { return collection(db, "escolas", escolaId(), "frequencia"); }
function mensagensRef() { return collection(db, "escolas", escolaId(), "mensagens"); }

function formatarData(timestamp) {
  return timestamp ? timestamp.toDate().toLocaleDateString("pt-BR") : "—";
}
function formatarNota(nota) {
  return typeof nota === "number" ? nota.toFixed(1).replace(".", ",") : "—";
}

// ------------------------------------------------------
// Atletas vinculados a este responsável (seletor "Visualizando")
// ------------------------------------------------------
async function carregarAtletas() {
  const ids = window.CF.atletaIds || [];
  const select = document.getElementById("seletorAtleta");
  const aviso = document.getElementById("avisoSemAtleta");

  if (ids.length === 0) {
    select.innerHTML = '<option value="">Nenhum atleta vinculado</option>';
    select.disabled = true;
    aviso.classList.remove("is-hidden");
    return;
  }

  const snaps = await Promise.all(ids.map((id) => getDoc(atletaRef(id)).catch(() => null)));
  atletasCache = {};
  snaps.forEach((snap, i) => {
    if (snap && snap.exists()) atletasCache[ids[i]] = snap.data();
  });

  const idsValidos = Object.keys(atletasCache);
  if (idsValidos.length === 0) {
    select.innerHTML = '<option value="">Nenhum atleta vinculado</option>';
    select.disabled = true;
    aviso.classList.remove("is-hidden");
    return;
  }

  aviso.classList.add("is-hidden");
  select.disabled = false;
  select.innerHTML = "";
  idsValidos.forEach((id) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = atletasCache[id].nome;
    select.appendChild(opt);
  });

  atletaAtivoId = idsValidos[0];
  select.value = atletaAtivoId;
  await atualizarInfoEscolaTurma();
  ouvirDadosDoAtleta();
}

async function atualizarInfoEscolaTurma() {
  const info = document.getElementById("escolaTurmaInfo");
  const atleta = atletasCache[atletaAtivoId];
  if (!atleta) {
    info.textContent = "";
    document.getElementById("badgePagamento").classList.add("is-hidden");
    return;
  }

  const partes = [];
  try {
    const escolaSnap = await getDoc(doc(db, "escolas", escolaId()));
    if (escolaSnap.exists()) partes.push(escolaSnap.data().nome);
  } catch (erro) {
    console.error("Erro ao carregar escola:", erro);
  }

  if (atleta.turmaId) {
    try {
      const turmaSnap = await getDoc(doc(db, "escolas", escolaId(), "turmas", atleta.turmaId));
      if (turmaSnap.exists()) partes.push(`Turma ${turmaSnap.data().nome}`);
    } catch (erro) {
      console.error("Erro ao carregar turma:", erro);
    }
  }

  info.textContent = partes.join(" · ") || "—";

  // Status de pagamento — só leitura aqui (o técnico é quem alterna, em atletas.html).
  const badge = document.getElementById("badgePagamento");
  const inadimplente = atleta.statusPagamento === "inadimplente";
  badge.classList.remove("is-hidden");
  badge.className = `badge ${inadimplente ? "badge--bad" : "badge--done"}`;
  badge.textContent = inadimplente ? "Mensalidade pendente" : "Mensalidade em dia";
}

// ------------------------------------------------------
// Avaliações — resumo, radar, linha de evolução e tabela
// ------------------------------------------------------
function renderizarAvaliacoes(listaCronologica) {
  const statNota = document.getElementById("statNotaGeral");
  const statUltima = document.getElementById("statUltimaAvaliacao");
  const radarShape = document.getElementById("radarShape");
  const radarMedia = document.getElementById("radarMedia");
  const linha = document.getElementById("linhaEvolucao");
  const pontoFinal = document.getElementById("pontoFinalEvolucao");
  const labelsEl = document.getElementById("labelsEvolucao");
  const corpo = document.getElementById("corpoAvaliacoes");

  if (listaCronologica.length === 0) {
    statNota.textContent = "—";
    statUltima.textContent = "—";
    radarShape.setAttribute("points", PILARES_RADAR.map(() => "120,120").join(" "));
    radarMedia.textContent = "—";
    linha.setAttribute("points", "");
    pontoFinal.classList.add("is-hidden");
    labelsEl.innerHTML = "";
    corpo.innerHTML = '<tr><td colspan="7" class="empty-state">Nenhuma avaliação registrada ainda.</td></tr>';
    return;
  }

  const ultima = listaCronologica[listaCronologica.length - 1];
  statNota.textContent = formatarNota(ultima.geral);
  statUltima.textContent = formatarData(ultima.data);

  radarShape.setAttribute("points", PILARES_RADAR.map((campo, i) => pontoRadar(ultima[campo], i)).join(" "));
  radarMedia.textContent = formatarNota(ultima.geral);

  const pontosLinha = pontosEvolucao(listaCronologica);
  linha.setAttribute("points", pontosLinha.map((p) => `${p.x},${p.y}`).join(" "));
  const pFinal = pontosLinha[pontosLinha.length - 1];
  pontoFinal.setAttribute("cx", pFinal.x);
  pontoFinal.setAttribute("cy", pFinal.y);
  pontoFinal.classList.remove("is-hidden");

  labelsEl.innerHTML = "";
  const passo = Math.max(1, Math.ceil(pontosLinha.length / 6));
  pontosLinha.forEach((ponto, i) => {
    if (i % passo !== 0 && i !== pontosLinha.length - 1) return;
    const span = document.createElement("span");
    span.textContent = ponto.data.toDate().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    labelsEl.appendChild(span);
  });

  corpo.innerHTML = "";
  [...listaCronologica].reverse().forEach((avaliacao) => {
    const tr = document.createElement("tr");
    [avaliacao.data ? formatarData(avaliacao.data) : "—", avaliacao.tecnico, avaliacao.tatico, avaliacao.fisico, avaliacao.mental, avaliacao.evolucao]
      .forEach((valor) => {
        const td = document.createElement("td");
        td.textContent = typeof valor === "number" ? formatarNota(valor) : valor;
        tr.appendChild(td);
      });

    const tdGeral = document.createElement("td");
    const pill = document.createElement("span");
    pill.className = notaEhBoa(avaliacao.geral) ? "pill pill--good" : "pill pill--warn";
    pill.textContent = formatarNota(avaliacao.geral);
    tdGeral.appendChild(pill);
    tr.appendChild(tdGeral);

    corpo.appendChild(tr);
  });
}

// ------------------------------------------------------
// Frequência — rosca de presença geral
// ------------------------------------------------------
function renderizarFrequencia(lista) {
  const circulo = document.getElementById("donutValor");
  const CIRCUNFERENCIA = 301.6;
  const statFrequencia = document.getElementById("statFrequencia");
  const donutPercentual = document.getElementById("donutPercentual");

  if (lista.length === 0) {
    circulo.style.strokeDashoffset = `${CIRCUNFERENCIA}`;
    donutPercentual.textContent = "—";
    statFrequencia.textContent = "—";
    return;
  }

  const presentes = lista.filter((f) => f.estado === "presente").length;
  const percentual = Math.round((presentes / lista.length) * 1000) / 10;
  circulo.style.strokeDashoffset = `${CIRCUNFERENCIA * (1 - percentual / 100)}`;
  const texto = `${percentual.toFixed(1).replace(".", ",")}%`;
  donutPercentual.textContent = texto;
  statFrequencia.textContent = texto;
}

// ------------------------------------------------------
// Recados do técnico endereçados a este atleta
// ------------------------------------------------------
function criarItemRecado(dados) {
  const li = document.createElement("li");
  li.className = "message-item";

  const head = document.createElement("div");
  head.className = "message-item-head";
  const quando = document.createElement("span");
  quando.textContent = dados.criadoEm ? dados.criadoEm.toDate().toLocaleDateString("pt-BR") : "";
  head.appendChild(quando);

  const paragrafo = document.createElement("p");
  paragrafo.textContent = dados.mensagem;

  li.append(head, paragrafo);
  return li;
}

function renderizarRecados(lista) {
  const listaEl = document.getElementById("listaRecados");
  listaEl.innerHTML = "";
  if (lista.length === 0) {
    listaEl.innerHTML = '<li class="empty-state">Nenhum recado do técnico ainda.</li>';
    return;
  }
  lista.forEach((dados) => listaEl.appendChild(criarItemRecado(dados)));
}

// ------------------------------------------------------
// Assina os dados do atleta ativo
// ------------------------------------------------------
function ouvirDadosDoAtleta() {
  if (pararDeOuvirAvaliacoes) pararDeOuvirAvaliacoes();
  if (pararDeOuvirFrequencia) pararDeOuvirFrequencia();
  if (pararDeOuvirRecados) pararDeOuvirRecados();

  const qAvaliacoes = query(avaliacoesRef(), where("atletaId", "==", atletaAtivoId));
  pararDeOuvirAvaliacoes = onSnapshot(
    qAvaliacoes,
    (snapshot) => {
      const lista = [];
      snapshot.forEach((docSnap) => lista.push(docSnap.data()));
      lista.sort((a, b) => a.data.toMillis() - b.data.toMillis());
      renderizarAvaliacoes(lista);
    },
    (erro) => console.error("Erro ao carregar avaliações:", erro)
  );

  const qFrequencia = query(frequenciaRef(), where("atletaId", "==", atletaAtivoId));
  pararDeOuvirFrequencia = onSnapshot(
    qFrequencia,
    (snapshot) => {
      const lista = [];
      snapshot.forEach((docSnap) => lista.push(docSnap.data()));
      renderizarFrequencia(lista);
    },
    (erro) => console.error("Erro ao carregar frequência:", erro)
  );

  const qMensagens = query(mensagensRef(), where("destinatarioId", "==", atletaAtivoId));
  pararDeOuvirRecados = onSnapshot(
    qMensagens,
    (snapshot) => {
      const lista = [];
      snapshot.forEach((docSnap) => lista.push(docSnap.data()));
      lista.sort((a, b) => (b.criadoEm?.toMillis?.() || 0) - (a.criadoEm?.toMillis?.() || 0));
      renderizarRecados(lista);
    },
    (erro) => console.error("Erro ao carregar recados:", erro)
  );
}

function montarSeletor() {
  document.getElementById("seletorAtleta").addEventListener("change", async (e) => {
    atletaAtivoId = e.target.value;
    await atualizarInfoEscolaTurma();
    ouvirDadosDoAtleta();
  });
}

document.addEventListener("cf:pronto", async () => {
  montarSeletor();
  await carregarAtletas();
});
