// ======================================================
// Craques do Futuro — avaliacoes.html (dados reais)
// Só roda depois que auth-guard.js confirma o papel (evento "cf:pronto"),
// que é quando window.CF.escolaId fica disponível.
// ======================================================

import {
  collection, addDoc, onSnapshot, query, where, serverTimestamp, Timestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./firebase-init.js";

let turmasCache = {};
let turmaAtivaId = null;
let atletasCache = {}; // atletaId -> dados, só da turma ativa
let pararDeOuvirAtletas = null;
let pararDeOuvirAvaliacoes = null;

function escolaId() { return window.CF.escolaId; }
function turmasRef() { return collection(db, "escolas", escolaId(), "turmas"); }
function atletasRef() { return collection(db, "escolas", escolaId(), "atletas"); }
function avaliacoesRef() { return collection(db, "escolas", escolaId(), "avaliacoes"); }
function chaveTurmaAtiva() { return `cf_turmaAtiva_${escolaId()}`; }

function formatarData(timestamp) {
  return timestamp ? timestamp.toDate().toLocaleDateString("pt-BR") : "—";
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
  if (atletasCache[valorAtual]) select.value = valorAtual;
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
    },
    (erro) => console.error("Erro ao carregar atletas:", erro)
  );
}

// ------------------------------------------------------
// Tabela de avaliações da turma ativa
// ------------------------------------------------------
function criarLinhaAvaliacao(dados) {
  const tr = document.createElement("tr");
  const celulas = [
    dados.atletaNome,
    formatarData(dados.data),
    dados.tecnico.toFixed(1).replace(".", ","),
    dados.tatico.toFixed(1).replace(".", ","),
    dados.fisico.toFixed(1).replace(".", ","),
    dados.mental.toFixed(1).replace(".", ","),
    dados.evolucao.toFixed(1).replace(".", ","),
  ];
  celulas.forEach((texto) => {
    const td = document.createElement("td");
    td.textContent = texto;
    tr.appendChild(td);
  });

  const tdGeral = document.createElement("td");
  const pill = document.createElement("span");
  pill.className = `pill ${dados.geral >= 7 ? "pill--good" : "pill--warn"}`;
  pill.textContent = dados.geral.toFixed(1).replace(".", ",");
  tdGeral.appendChild(pill);
  tr.appendChild(tdGeral);

  return tr;
}

function ouvirAvaliacoes() {
  if (pararDeOuvirAvaliacoes) {
    pararDeOuvirAvaliacoes();
    pararDeOuvirAvaliacoes = null;
  }

  const corpo = document.getElementById("corpoTabelaAvaliacoes");
  if (!turmaAtivaId) {
    corpo.innerHTML = '<tr><td colspan="8" class="empty-state">Selecione uma turma.</td></tr>';
    return;
  }

  corpo.innerHTML = '<tr><td colspan="8" class="empty-state">Carregando avaliações...</td></tr>';
  const q = query(avaliacoesRef(), where("turmaId", "==", turmaAtivaId));
  pararDeOuvirAvaliacoes = onSnapshot(
    q,
    (snapshot) => {
      const lista = [];
      snapshot.forEach((docSnap) => lista.push(docSnap.data()));
      lista.sort((a, b) => (b.data?.toMillis() || 0) - (a.data?.toMillis() || 0));

      corpo.innerHTML = "";
      if (lista.length === 0) {
        corpo.innerHTML = '<tr><td colspan="8" class="empty-state">Nenhuma avaliação registrada nesta turma ainda.</td></tr>';
        return;
      }
      lista.forEach((dados) => corpo.appendChild(criarLinhaAvaliacao(dados)));
    },
    (erro) => {
      console.error("Erro ao carregar avaliações:", erro);
      corpo.innerHTML = '<tr><td colspan="8" class="empty-state">Não foi possível carregar as avaliações.</td></tr>';
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
      const tecnico = Number(form.tecnico.value);
      const tatico = Number(form.tatico.value);
      const fisico = Number(form.fisico.value);
      const mental = Number(form.mental.value);
      const evolucao = Number(form.evolucao.value);
      const geral = Math.round(((tecnico + tatico + fisico + mental + evolucao) / 5) * 10) / 10;

      await addDoc(avaliacoesRef(), {
        atletaId,
        atletaNome: atletasCache[atletaId].nome,
        turmaId: turmaAtivaId,
        data: Timestamp.fromDate(new Date(`${form.data.value}T12:00:00`)),
        tecnico,
        tatico,
        fisico,
        mental,
        evolucao,
        geral,
        observacoes: form.observacoes.value.trim(),
        criadoEm: serverTimestamp(),
      });

      showToast(`Avaliação de ${atletasCache[atletaId].nome} salva.`);
      form.reset();
      // form.reset() volta os sliders pro value="7" do HTML — atualiza os números ao lado deles.
      form.querySelectorAll('input[type="range"][data-live-output]').forEach((range) => {
        const out = document.getElementById(range.dataset.liveOutput);
        if (out) out.textContent = Number(range.value).toFixed(1);
      });
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
  ouvirTurmas();
  montarSeletorTurma();
  configurarFormNovaAvaliacao();
});
