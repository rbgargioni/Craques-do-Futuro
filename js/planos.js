// ======================================================
// Craques do Futuro — planos.html (dados reais)
// Só roda depois que auth-guard.js confirma o papel (evento "cf:pronto"),
// que é quando window.CF.escolaId fica disponível.
// ======================================================

import {
  collection, addDoc, onSnapshot, query, where, serverTimestamp, Timestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./firebase-init.js";

const STATUS_INFO = {
  planejado: { texto: "Planejado", classe: "badge--neutral" },
  andamento: { texto: "Em andamento", classe: "badge--progress" },
  concluido: { texto: "Concluído", classe: "badge--done" },
};

let turmasCache = {};
let turmaAtivaId = null;
let pararDeOuvirPlanos = null;

function escolaId() { return window.CF.escolaId; }
function turmasRef() { return collection(db, "escolas", escolaId(), "turmas"); }
function planosRef() { return collection(db, "escolas", escolaId(), "planos"); }
function chaveTurmaAtiva() { return `cf_turmaAtiva_${escolaId()}`; }

function formatarDataCurta(timestamp) {
  return timestamp ? timestamp.toDate().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "";
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
  const btnNovo = document.getElementById("btnNovoPlano");
  const ids = Object.keys(turmasCache);

  if (ids.length === 0) {
    select.innerHTML = '<option value="">Nenhuma turma cadastrada</option>';
    select.disabled = true;
    aviso.classList.remove("is-hidden");
    btnNovo.disabled = true;
    turmaAtivaId = null;
    atualizarTurmaBar();
    ouvirPlanos();
    return;
  }

  select.disabled = false;
  aviso.classList.add("is-hidden");
  btnNovo.disabled = false;

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
  ouvirPlanos();
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
    ouvirPlanos();
  });
}

// ------------------------------------------------------
// Cards de plano
// ------------------------------------------------------
function criarCardPlano(dados) {
  const card = document.createElement("div");
  card.className = "entity-card";

  const top = document.createElement("div");
  top.className = "entity-card-top";
  const info = document.createElement("div");
  const tituloEl = document.createElement("strong");
  tituloEl.textContent = dados.titulo;
  const focoEl = document.createElement("span");
  focoEl.textContent = `Foco ${dados.foco.toLowerCase()}`;
  info.append(tituloEl, focoEl);
  top.appendChild(info);

  const objetivoEl = document.createElement("p");
  objetivoEl.className = "muted";
  objetivoEl.style.cssText = "margin:0;font-size:12px;";
  objetivoEl.textContent = dados.objetivo || "";

  const foot = document.createElement("div");
  foot.className = "entity-card-foot";
  const statusInfo = STATUS_INFO[dados.status] || STATUS_INFO.planejado;
  const badge = document.createElement("span");
  badge.className = `badge ${statusInfo.classe}`;
  badge.textContent = statusInfo.texto;
  const tag = document.createElement("span");
  tag.className = "tag";
  if (dados.status === "planejado") tag.textContent = `a partir de ${formatarDataCurta(dados.inicio)}`;
  else if (dados.status === "concluido") tag.textContent = `encerrado em ${formatarDataCurta(dados.fim)}`;
  else tag.textContent = `até ${formatarDataCurta(dados.fim)}`;
  foot.append(badge, tag);

  card.append(top, objetivoEl, foot);
  return card;
}

function ouvirPlanos() {
  if (pararDeOuvirPlanos) {
    pararDeOuvirPlanos();
    pararDeOuvirPlanos = null;
  }

  const container = document.getElementById("listaPlanos");
  if (!turmaAtivaId) {
    container.innerHTML = '<p class="empty-state">Selecione uma turma pra ver os planos.</p>';
    return;
  }

  container.innerHTML = '<p class="empty-state">Carregando planos...</p>';
  const q = query(planosRef(), where("turmaId", "==", turmaAtivaId));
  pararDeOuvirPlanos = onSnapshot(
    q,
    (snapshot) => {
      const lista = [];
      snapshot.forEach((docSnap) => lista.push(docSnap.data()));
      lista.sort((a, b) => (b.criadoEm?.toMillis?.() || 0) - (a.criadoEm?.toMillis?.() || 0));

      container.innerHTML = "";
      if (lista.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhum plano cadastrado nesta turma ainda.</p>';
        return;
      }
      lista.forEach((dados) => container.appendChild(criarCardPlano(dados)));
    },
    (erro) => {
      console.error("Erro ao carregar planos:", erro);
      container.innerHTML = '<p class="empty-state">Não foi possível carregar os planos.</p>';
    }
  );
}

// ------------------------------------------------------
// Novo plano
// ------------------------------------------------------
function configurarFormNovoPlano() {
  const form = document.getElementById("formNovoPlano");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!turmaAtivaId) {
      showToast("Selecione (ou cadastre) uma turma antes de criar um plano.");
      return;
    }

    const botao = form.querySelector("button[type=submit]");
    botao.disabled = true;
    botao.textContent = "Salvando...";

    try {
      await addDoc(planosRef(), {
        titulo: form.titulo.value.trim(),
        foco: form.foco.value,
        status: form.status.value,
        inicio: Timestamp.fromDate(new Date(`${form.inicio.value}T12:00:00`)),
        fim: Timestamp.fromDate(new Date(`${form.fim.value}T12:00:00`)),
        objetivo: form.objetivo.value.trim(),
        turmaId: turmaAtivaId,
        criadoEm: serverTimestamp(),
      });

      showToast(`Plano "${form.titulo.value.trim()}" criado.`);
      form.reset();
      document.getElementById("painelPlano").classList.add("is-hidden");
    } catch (erro) {
      console.error(erro);
      showToast("Não foi possível criar o plano. Tente novamente.");
    } finally {
      botao.disabled = false;
      botao.textContent = "Salvar plano";
    }
  });
}

document.addEventListener("cf:pronto", () => {
  ouvirTurmas();
  montarSeletorTurma();
  configurarFormNovoPlano();
});
