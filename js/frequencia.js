// ======================================================
// Craques do Futuro — frequencia.html (dados reais)
// Só roda depois que auth-guard.js confirma o papel (evento "cf:pronto"),
// que é quando window.CF.escolaId fica disponível.
//
// Id determinístico do documento (turmaId_data_atletaId): salvar a chamada
// do mesmo dia de novo faz upsert (set()) em vez de criar duplicado.
// ======================================================

import {
  collection, doc, getDocs, writeBatch, onSnapshot, query, where, Timestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./firebase-init.js";

const ROTULO_BADGE = {
  presente: { texto: "Presente", classe: "badge--done" },
  atrasado: { texto: "Atrasado", classe: "badge--progress" },
  ausente: { texto: "Ausente", classe: "badge--bad" },
};

let turmasCache = {};
let turmaAtivaId = null;
let estadosHojeCache = {}; // atletaId -> "presente" | "atrasado" | "ausente", só do dia de hoje
let chamadaJaFeita = false; // true = já existe chamada salva hoje pra essa turma; trava edição até amanhã
let pararDeOuvirAtletas = null;

function escolaId() { return window.CF.escolaId; }
function turmasRef() { return collection(db, "escolas", escolaId(), "turmas"); }
function atletasRef() { return collection(db, "escolas", escolaId(), "atletas"); }
function frequenciaRef() { return collection(db, "escolas", escolaId(), "frequencia"); }
function chaveTurmaAtiva() { return `cf_turmaAtiva_${escolaId()}`; }

function hojeISO() {
  const hoje = new Date();
  const m = String(hoje.getMonth() + 1).padStart(2, "0");
  const d = String(hoje.getDate()).padStart(2, "0");
  return `${hoje.getFullYear()}-${m}-${d}`;
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

async function popularSeletorTurma() {
  const select = document.getElementById("seletorTurma");
  const aviso = document.getElementById("avisoSemTurma");
  const btnSalvar = document.getElementById("btnSalvarChamada");
  const ids = Object.keys(turmasCache);

  if (ids.length === 0) {
    select.innerHTML = '<option value="">Nenhuma turma cadastrada</option>';
    select.disabled = true;
    aviso.classList.remove("is-hidden");
    btnSalvar.disabled = true;
    turmaAtivaId = null;
    atualizarTurmaBar();
    await carregarEstadosDeHoje();
    ouvirAtletas();
    return;
  }

  select.disabled = false;
  aviso.classList.add("is-hidden");
  btnSalvar.disabled = false;

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
  await carregarEstadosDeHoje();
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
  document.getElementById("seletorTurma").addEventListener("change", async (e) => {
    turmaAtivaId = e.target.value;
    localStorage.setItem(chaveTurmaAtiva(), turmaAtivaId);
    atualizarTurmaBar();
    await carregarEstadosDeHoje();
    ouvirAtletas();
  });
}

// ------------------------------------------------------
// Chamada já salva hoje — pré-marca os botões certos e, se já tiver chamada
// registrada, trava a edição (só dá pra fazer de novo amanhã).
// ------------------------------------------------------
async function carregarEstadosDeHoje() {
  estadosHojeCache = {};
  if (turmaAtivaId) {
    try {
      const hojeStr = new Date().toDateString();
      const snap = await getDocs(query(frequenciaRef(), where("turmaId", "==", turmaAtivaId)));
      snap.forEach((docSnap) => {
        const dados = docSnap.data();
        if (dados.data && dados.data.toDate().toDateString() === hojeStr) {
          estadosHojeCache[dados.atletaId] = dados.estado;
        }
      });
    } catch (erro) {
      console.error("Erro ao carregar a chamada de hoje:", erro);
    }
  }

  chamadaJaFeita = Object.keys(estadosHojeCache).length > 0;
  document.getElementById("avisoChamadaFeita").classList.toggle("is-hidden", !chamadaJaFeita);
  document.getElementById("acoesChamada").classList.toggle("is-hidden", chamadaJaFeita);
}

// ------------------------------------------------------
// Linha da tabela / lista de atletas
// ------------------------------------------------------
function criarLinhaChamadaTravada(atletaId, dados) {
  const tr = document.createElement("tr");
  const tdNome = document.createElement("td");
  tdNome.textContent = dados.nome;
  const tdPosicao = document.createElement("td");
  tdPosicao.textContent = dados.posicao;

  const tdEstado = document.createElement("td");
  const estado = estadosHojeCache[atletaId] || "presente";
  const rotulo = ROTULO_BADGE[estado] || ROTULO_BADGE.presente;
  const badge = document.createElement("span");
  badge.className = `badge ${rotulo.classe}`;
  badge.textContent = rotulo.texto;
  tdEstado.appendChild(badge);

  tr.append(tdNome, tdPosicao, tdEstado);
  return tr;
}

function criarLinhaChamada(atletaId, dados) {
  const tr = document.createElement("tr");
  const tdNome = document.createElement("td");
  tdNome.textContent = dados.nome;
  const tdPosicao = document.createElement("td");
  tdPosicao.textContent = dados.posicao;

  const tdToggle = document.createElement("td");
  const group = document.createElement("div");
  group.className = "toggle-group";
  group.dataset.atletaId = atletaId;

  const estadoAtual = estadosHojeCache[atletaId] || "presente";
  [["presente", "Presente"], ["atrasado", "Atrasado"], ["ausente", "Ausente"]].forEach(([estado, rotulo]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "toggle-btn" + (estado === estadoAtual ? " is-active" : "");
    btn.dataset.state = estado;
    btn.textContent = rotulo;
    group.appendChild(btn);
  });

  group.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-state]");
    if (!btn || !group.contains(btn)) return;
    group.querySelectorAll("[data-state]").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    if (typeof recalcularResumoChamada === "function") recalcularResumoChamada();
  });

  tdToggle.appendChild(group);
  tr.append(tdNome, tdPosicao, tdToggle);
  return tr;
}

function atualizarContadoresTravados(lista) {
  const contagem = { presente: 0, atrasado: 0, ausente: 0 };
  lista.forEach(({ id }) => {
    const estado = estadosHojeCache[id] || "presente";
    contagem[estado] = (contagem[estado] || 0) + 1;
  });
  document.querySelectorAll("[data-count]").forEach((el) => {
    el.textContent = contagem[el.dataset.count] || 0;
  });
}

function renderizarChamada(lista) {
  const corpo = document.getElementById("corpoChamada");
  corpo.innerHTML = "";
  if (lista.length === 0) {
    corpo.innerHTML = '<tr><td colspan="3" class="empty-state">Nenhum atleta cadastrado nesta turma ainda.</td></tr>';
    document.querySelectorAll("[data-count]").forEach((el) => { el.textContent = "0"; });
    return;
  }

  if (chamadaJaFeita) {
    lista.forEach(({ id, dados }) => corpo.appendChild(criarLinhaChamadaTravada(id, dados)));
    atualizarContadoresTravados(lista);
  } else {
    lista.forEach(({ id, dados }) => corpo.appendChild(criarLinhaChamada(id, dados)));
    if (typeof recalcularResumoChamada === "function") recalcularResumoChamada();
  }
}

function ouvirAtletas() {
  if (pararDeOuvirAtletas) {
    pararDeOuvirAtletas();
    pararDeOuvirAtletas = null;
  }

  if (!turmaAtivaId) {
    renderizarChamada([]);
    return;
  }

  const q = query(atletasRef(), where("turmaId", "==", turmaAtivaId));
  pararDeOuvirAtletas = onSnapshot(
    q,
    (snapshot) => {
      const lista = [];
      snapshot.forEach((docSnap) => lista.push({ id: docSnap.id, dados: docSnap.data() }));
      lista.sort((a, b) => a.dados.nome.localeCompare(b.dados.nome, "pt-BR"));
      renderizarChamada(lista);
    },
    (erro) => {
      console.error("Erro ao carregar atletas:", erro);
      document.getElementById("corpoChamada").innerHTML = '<tr><td colspan="3" class="empty-state">Não foi possível carregar os atletas.</td></tr>';
    }
  );
}

// ------------------------------------------------------
// Salvar chamada
// ------------------------------------------------------
function configurarBotaoSalvar() {
  const botao = document.getElementById("btnSalvarChamada");
  botao.addEventListener("click", async () => {
    if (chamadaJaFeita) {
      showToast("A chamada de hoje já foi registrada — só dá pra mudar amanhã.");
      return;
    }
    const grupos = document.querySelectorAll("#corpoChamada .toggle-group");
    if (grupos.length === 0) {
      showToast("Não há atletas nesta turma pra fazer a chamada.");
      return;
    }

    botao.disabled = true;
    botao.textContent = "Salvando...";

    try {
      const iso = hojeISO();
      const dataTimestamp = Timestamp.fromDate(new Date(`${iso}T12:00:00`));
      const batch = writeBatch(db);

      grupos.forEach((grupo) => {
        const atletaId = grupo.dataset.atletaId;
        const ativo = grupo.querySelector(".is-active");
        const estado = ativo ? ativo.dataset.state : "presente";
        const idDoc = `${turmaAtivaId}_${iso}_${atletaId}`;
        batch.set(doc(db, "escolas", escolaId(), "frequencia", idDoc), {
          turmaId: turmaAtivaId,
          atletaId,
          data: dataTimestamp,
          estado,
        });
      });

      await batch.commit();
      showToast("Chamada salva com sucesso.");
      await carregarEstadosDeHoje();
      ouvirAtletas();
    } catch (erro) {
      console.error(erro);
      showToast("Não foi possível salvar a chamada. Tente novamente.");
    } finally {
      botao.disabled = false;
      botao.textContent = "Salvar chamada";
    }
  });
}

document.addEventListener("cf:pronto", () => {
  document.getElementById("dataChamadaHoje").textContent = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  ouvirTurmas();
  montarSeletorTurma();
  configurarBotaoSalvar();
});
