// ======================================================
// Craques do Futuro — avaliacoes.html (dados reais)
// Só roda depois que auth-guard.js confirma o papel (evento "cf:pronto"),
// que é quando window.CF.escolaId fica disponível.
//
// Fase 2 da migração pro novo sistema de 5 pilares/100 pontos (ver
// js/metricas.js): o formulário agora usa PILARES_100 (universal, mesmas
// subcategorias pra qualquer posição) em vez dos fundamentos técnicos por
// posição antigos.
// ======================================================

import {
  collection, addDoc, doc, updateDoc, onSnapshot, query, where, serverTimestamp, Timestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./firebase-init.js";
import {
  PILARES_100, ORDEM_PILARES_100, calcularAvaliacaoCompleta, analisarPontosFortesFracos,
  normalizarPilarPara10, calcularNotaGeral, notaEhBoa,
} from "./metricas.js";

let turmasCache = {};
let turmaAtivaId = null;
let atletasCache = {}; // atletaId -> dados, só da turma ativa
let pararDeOuvirAtletas = null;
let pararDeOuvirAvaliacoes = null;

function escolaId() { return window.CF.escolaId; }
function turmasRef() { return collection(db, "escolas", escolaId(), "turmas"); }
function atletasRef() { return collection(db, "escolas", escolaId(), "atletas"); }
function avaliacoesRef() { return collection(db, "escolas", escolaId(), "avaliacoes"); }
function resumoPublicoRef(codigo) { return doc(db, "resumosPublicos", codigo); }
function chaveTurmaAtiva() { return `cf_turmaAtiva_${escolaId()}`; }

// Soma dos pesos dos 5 pilares — 100, calculado a partir de PILARES_100
// (não travado em 100 direto: se algum peso for ajustado em js/metricas.js
// e não fechar de novo, esse número muda sozinho, denunciando o problema).
const NOTA_FINAL_MAXIMA = ORDEM_PILARES_100.reduce((soma, chave) => soma + PILARES_100[chave].peso, 0);

// Mantém a "Área do atleta" (resumosPublicos) com o radar/nota mais recentes.
// Nunca deixa um erro aqui derrubar o salvamento da avaliação em si.
async function atualizarResumoPublico(atletaId, pilares) {
  const atleta = atletasCache[atletaId];
  if (!atleta || !atleta.codigoPublico) return;
  try {
    await updateDoc(resumoPublicoRef(atleta.codigoPublico), {
      radar: {
        tecnico: pilares.tecnico, tatico: pilares.tatico, fisico: pilares.fisico,
        mental: pilares.mental, evolucao: pilares.evolucao,
      },
      notaGeral: pilares.geral,
      atualizadoEm: serverTimestamp(),
    });
  } catch (erro) {
    console.error("Erro ao atualizar o resumo público do atleta:", erro);
  }
}

function formatarData(timestamp) {
  return timestamp ? timestamp.toDate().toLocaleDateString("pt-BR") : "—";
}

function formatarPt(numero) {
  return numero.toFixed(1).replace(".", ",");
}

// ------------------------------------------------------
// Turma ativa
// ------------------------------------------------------
function atualizarTurmaBar() {
  const nomeEl = document.getElementById("turmaAtivaNome");
  const turma = turmasCache[turmaAtivaId];
  window.CFTurmaBar(nomeEl, turma);
}

function popularSeletorTurma() {
  const select = document.getElementById("seletorTurma");
  const aviso = document.getElementById("avisoSemTurma");
  const btnNova = document.getElementById("btnNovaAvaliacao");
  const ids = Object.keys(turmasCache);

  if (ids.length === 0) {
    select.innerHTML = '<option value="">Nenhuma turma cadastrada</option>';
    select.disabled = true;
    aviso.classList.remove("is-hidden");
    btnNova.disabled = true;
    turmaAtivaId = null;
    atualizarTurmaBar();
    ouvirAtletasDaTurma();
    return;
  }

  select.disabled = false;
  aviso.classList.add("is-hidden");
  btnNova.disabled = false;

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
// Atletas da turma ativa (preenche o <select> do formulário)
// ------------------------------------------------------
function popularSelectAtletas() {
  const select = document.getElementById("atletaAvaliado");
  const valorAtual = select.value;
  select.innerHTML = '<option value="">Selecione...</option>';
  Object.keys(atletasCache)
    .sort((a, b) => atletasCache[a].nome.localeCompare(atletasCache[b].nome, "pt-BR"))
    .forEach((id) => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = atletasCache[id].nome;
      select.appendChild(opt);
    });
  select.value = atletasCache[valorAtual] ? valorAtual : "";
  atualizarPosicaoExibida(select.value);
}

function atualizarPosicaoExibida(atletaId) {
  const posicaoEl = document.getElementById("posicaoAtletaAvaliado");
  const dadosAtleta = atletasCache[atletaId];
  if (posicaoEl) posicaoEl.textContent = dadosAtleta ? dadosAtleta.posicao : "—";
}

// ------------------------------------------------------
// Os 5 pilares (Físico/Técnico/Tático/Mental/Potencial) — ver PILARES_100 em
// js/metricas.js. Universal: as mesmas subcategorias pra qualquer atleta,
// independente da posição (a posição só é exibida como informação, não
// muda mais quais campos aparecem aqui — diferente do sistema antigo).
// ------------------------------------------------------
function lerNotasPorPilar() {
  const notasPorPilar = {};
  ORDEM_PILARES_100.forEach((pilarChave) => {
    notasPorPilar[pilarChave] = {};
    document.querySelectorAll(`#blocoPilares100 [data-pilar="${pilarChave}"]`).forEach((input) => {
      notasPorPilar[pilarChave][input.dataset.subcategoria] = Number(input.value);
    });
  });
  return notasPorPilar;
}

function atualizarResultado() {
  const notasPorPilar = lerNotasPorPilar();
  const { porPilar, notaFinal } = calcularAvaliacaoCompleta(notasPorPilar);

  ORDEM_PILARES_100.forEach((pilarChave) => {
    const totalEl = document.getElementById(`pilarTotal_${pilarChave}`);
    if (totalEl) totalEl.textContent = `${formatarPt(porPilar[pilarChave].pontos)} / ${formatarPt(porPilar[pilarChave].max)}`;
  });

  const analise = analisarPontosFortesFracos(notasPorPilar);
  const bloco = document.getElementById("blocoResultado");
  if (bloco && analise) {
    bloco.innerHTML = "";

    const linhaNota = document.createElement("p");
    linhaNota.style.cssText = "margin:0 0 8px;font-size:15px;";
    const rotuloNota = document.createElement("strong");
    rotuloNota.textContent = "Nota final: ";
    const valorNota = document.createElement("span");
    valorNota.textContent = `${formatarPt(notaFinal)} / ${formatarPt(NOTA_FINAL_MAXIMA)}`;
    linhaNota.append(rotuloNota, valorNota);

    const linhaAnalise = document.createElement("p");
    linhaAnalise.className = "muted";
    linhaAnalise.style.cssText = "margin:0;font-size:12px;";
    linhaAnalise.textContent = `⭐ Ponto forte: ${analise.melhor.label} (${analise.melhor.pilarLabel}, ${formatarPt(analise.melhor.nota)})  ·  🔧 A desenvolver: ${analise.piorAMelhorar.label} (${analise.piorAMelhorar.pilarLabel}, ${formatarPt(analise.piorAMelhorar.nota)})`;

    bloco.append(linhaNota, linhaAnalise);
  }
}

// Cria um <input type="range"> de 0 a 10 (aceita decimal) pra uma
// subcategoria, com o valor ao lado atualizado em tempo real — mesmo padrão
// usado antes pros fundamentos técnicos por posição (input dinâmico, sem
// depender do listener genérico de Script.js, que só pega sliders que já
// existiam no HTML quando a página carregou).
function criarCampoSubcategoria(pilarChave, chave, info) {
  const campo = document.createElement("div");
  campo.className = "pillar-field";
  campo.style.marginTop = "10px";

  const head = document.createElement("div");
  head.className = "pillar-field-head";
  const label = document.createElement("span");
  label.style.fontSize = "12px";
  label.textContent = info.label; // peso fica só no código, não aparece pro avaliador
  const saida = document.createElement("strong");
  saida.textContent = "7.0";
  head.append(label, saida);

  const input = document.createElement("input");
  input.type = "range";
  input.min = "0";
  input.max = "10";
  input.step = "0.1";
  input.value = "7";
  input.dataset.pilar = pilarChave;
  input.dataset.subcategoria = chave;
  input.addEventListener("input", () => {
    saida.textContent = Number(input.value).toFixed(1);
    atualizarResultado();
  });

  campo.append(head, input);
  return campo;
}

function criarBlocoPilar(pilarChave) {
  const pilar = PILARES_100[pilarChave];
  const bloco = document.createElement("div");
  bloco.style.cssText = "border:1px solid var(--border); border-radius:10px; padding:14px; margin-bottom:14px;";

  const cabecalho = document.createElement("div");
  cabecalho.className = "pillar-field-head";
  const titulo = document.createElement("label");
  titulo.textContent = pilar.label;
  const total = document.createElement("strong");
  total.id = `pilarTotal_${pilarChave}`;
  total.textContent = `0,0 / ${formatarPt(pilar.peso)}`;
  cabecalho.append(titulo, total);
  bloco.appendChild(cabecalho);

  Object.keys(pilar.subcategorias).forEach((chave) => {
    bloco.appendChild(criarCampoSubcategoria(pilarChave, chave, pilar.subcategorias[chave]));
  });

  return bloco;
}

function renderizarBlocoPilares100() {
  const bloco = document.getElementById("blocoPilares100");
  bloco.innerHTML = "";
  ORDEM_PILARES_100.forEach((pilarChave) => bloco.appendChild(criarBlocoPilar(pilarChave)));
  atualizarResultado();
}

function montarSelectAtletaAvaliado() {
  document.getElementById("atletaAvaliado").addEventListener("change", (e) => {
    atualizarPosicaoExibida(e.target.value);
  });
}

function ouvirAtletasDaTurma() {
  if (pararDeOuvirAtletas) {
    pararDeOuvirAtletas();
    pararDeOuvirAtletas = null;
  }
  atletasCache = {};
  popularSelectAtletas();
  ouvirAvaliacoes();

  if (!turmaAtivaId) return;

  const q = query(atletasRef(), where("turmaId", "==", turmaAtivaId));
  pararDeOuvirAtletas = onSnapshot(
    q,
    (snapshot) => {
      atletasCache = {};
      snapshot.forEach((docSnap) => { atletasCache[docSnap.id] = docSnap.data(); });
      popularSelectAtletas();
      renderizarTabelaAvaliacoes();
    },
    (erro) => console.error("Erro ao carregar atletas:", erro)
  );
}

// ------------------------------------------------------
// Tabela de avaliações da turma ativa
// ------------------------------------------------------
function criarLinhaAvaliacao(dados) {
  const tr = document.createElement("tr");
  // Posição vem do cadastro atual do atleta (atletasCache), não fica salva na
  // própria avaliação — mostra a posição de HOJE, mesmo que o atleta tenha
  // trocado de posição depois dessa avaliação ter sido feita.
  const posicaoAtleta = (atletasCache[dados.atletaId] && atletasCache[dados.atletaId].posicao) || "—";

  // Avaliações salvas antes da Fase 2 não têm pontuacaoPorPilar/notaFinal —
  // mostra "—" nessas colunas em vez de quebrar a tabela.
  const pp = dados.pontuacaoPorPilar;
  const celulas = [
    dados.atletaNome,
    posicaoAtleta,
    formatarData(dados.data),
    pp ? `${formatarPt(pp.fisico.pontos)}/${formatarPt(pp.fisico.max)}` : "—",
    pp ? `${formatarPt(pp.tecnico.pontos)}/${formatarPt(pp.tecnico.max)}` : "—",
    pp ? `${formatarPt(pp.tatico.pontos)}/${formatarPt(pp.tatico.max)}` : "—",
    pp ? `${formatarPt(pp.mental.pontos)}/${formatarPt(pp.mental.max)}` : "—",
    pp ? `${formatarPt(pp.potencial.pontos)}/${formatarPt(pp.potencial.max)}` : "—",
  ];
  celulas.forEach((texto) => {
    const td = document.createElement("td");
    td.textContent = texto;
    tr.appendChild(td);
  });

  const tdFinal = document.createElement("td");
  if (typeof dados.notaFinal === "number") {
    const pill = document.createElement("span");
    pill.className = `pill ${notaEhBoa(dados.geral) ? "pill--good" : "pill--warn"}`;
    pill.textContent = `${formatarPt(dados.notaFinal)}/${formatarPt(NOTA_FINAL_MAXIMA)}`;
    tdFinal.appendChild(pill);
  } else {
    tdFinal.textContent = "—";
  }
  tr.appendChild(tdFinal);

  return tr;
}

// Guarda a última lista de avaliações recebida do Firestore, pra poder
// redesenhar a tabela quando atletasCache mudar (ex.: terminou de carregar
// os atletas da turma DEPOIS que as avaliações já tinham chegado) — sem
// isso, a coluna Posição ficava travada em "—" pra sempre, porque
// ouvirAvaliacoes() é chamado antes do onSnapshot de atletas resolver
// (ver ouvirAtletasDaTurma()) e só redesenha de novo quando uma AVALIAÇÃO
// muda, não quando um ATLETA muda.
let ultimaListaAvaliacoes = [];

function renderizarTabelaAvaliacoes() {
  const corpo = document.getElementById("corpoTabelaAvaliacoes");
  corpo.innerHTML = "";
  if (ultimaListaAvaliacoes.length === 0) {
    corpo.innerHTML = '<tr><td colspan="9" class="empty-state">Nenhuma avaliação registrada nesta turma ainda.</td></tr>';
    return;
  }
  ultimaListaAvaliacoes.forEach((dados) => corpo.appendChild(criarLinhaAvaliacao(dados)));
}

function ouvirAvaliacoes() {
  if (pararDeOuvirAvaliacoes) {
    pararDeOuvirAvaliacoes();
    pararDeOuvirAvaliacoes = null;
  }

  const corpo = document.getElementById("corpoTabelaAvaliacoes");
  ultimaListaAvaliacoes = [];
  if (!turmaAtivaId) {
    corpo.innerHTML = '<tr><td colspan="9" class="empty-state">Selecione uma turma.</td></tr>';
    return;
  }

  corpo.innerHTML = '<tr><td colspan="9" class="empty-state">Carregando avaliações...</td></tr>';
  const q = query(avaliacoesRef(), where("turmaId", "==", turmaAtivaId));
  pararDeOuvirAvaliacoes = onSnapshot(
    q,
    (snapshot) => {
      const lista = [];
      snapshot.forEach((docSnap) => lista.push(docSnap.data()));
      lista.sort((a, b) => (b.data?.toMillis() || 0) - (a.data?.toMillis() || 0));
      ultimaListaAvaliacoes = lista;
      renderizarTabelaAvaliacoes();
    },
    (erro) => {
      console.error("Erro ao carregar avaliações:", erro);
      corpo.innerHTML = '<tr><td colspan="9" class="empty-state">Não foi possível carregar as avaliações.</td></tr>';
    }
  );
}

// ------------------------------------------------------
// Nova avaliação
// ------------------------------------------------------
function configurarFormNovaAvaliacao() {
  const form = document.getElementById("formNovaAvaliacao");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const atletaId = form.atleta.value;
    if (!atletaId || !atletasCache[atletaId]) {
      showToast("Selecione um atleta.");
      return;
    }
    if (!form.data.value) {
      showToast("Escolha a data da avaliação.");
      return;
    }

    const botao = form.querySelector("button[type=submit]");
    botao.disabled = true;
    botao.textContent = "Salvando...";

    try {
      const notasPorPilar = lerNotasPorPilar();
      const { porPilar, notaFinal } = calcularAvaliacaoCompleta(notasPorPilar);

      // Campos "tecnico/tatico/fisico/mental/evolucao/geral" (escala 0-10) são
      // um espelho de compatibilidade pras telas que ainda não migraram pro
      // sistema novo (Dashboard, Relatórios, Comparativos, Responsável, Área
      // do atleta — Fase 3). "potencial" ocupa o lugar de "evolucao" nesse
      // espelho só pelo formato (5 valores 0-10) — remover quando a Fase 3
      // terminar de atualizar essas telas pros 5 pilares novos de verdade.
      const espelho = {
        tecnico: normalizarPilarPara10(porPilar.tecnico.pontos, porPilar.tecnico.max),
        tatico: normalizarPilarPara10(porPilar.tatico.pontos, porPilar.tatico.max),
        fisico: normalizarPilarPara10(porPilar.fisico.pontos, porPilar.fisico.max),
        mental: normalizarPilarPara10(porPilar.mental.pontos, porPilar.mental.max),
        evolucao: normalizarPilarPara10(porPilar.potencial.pontos, porPilar.potencial.max),
      };
      const geral = calcularNotaGeral(espelho);

      await addDoc(avaliacoesRef(), {
        atletaId,
        atletaNome: atletasCache[atletaId].nome,
        turmaId: turmaAtivaId,
        data: Timestamp.fromDate(new Date(`${form.data.value}T12:00:00`)),
        notasPorPilar,
        pontuacaoPorPilar: porPilar,
        notaFinal,
        ...espelho,
        geral,
        observacoes: form.observacoes.value.trim(),
        criadoEm: serverTimestamp(),
      });
      await atualizarResumoPublico(atletaId, { ...espelho, geral });

      showToast(`Avaliação de ${atletasCache[atletaId].nome} salva.`);
      form.reset();
      renderizarBlocoPilares100(); // volta todos os sliders pro padrão (7) e refaz o resultado
      atualizarPosicaoExibida("");
      document.getElementById("painelAvaliacao").classList.add("is-hidden");
    } catch (erro) {
      console.error(erro);
      showToast("Não foi possível salvar a avaliação. Tente novamente.");
    } finally {
      botao.disabled = false;
      botao.textContent = "Salvar avaliação";
    }
  });
}

document.addEventListener("cf:pronto", () => {
  renderizarBlocoPilares100();
  ouvirTurmas();
  montarSeletorTurma();
  montarSelectAtletaAvaliado();
  configurarFormNovaAvaliacao();
});
