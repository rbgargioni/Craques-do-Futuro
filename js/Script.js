// ======================================================
// Craques do Futuro — Esboço de interface (ainda sem banco de dados real)
// Este arquivo é compartilhado por todas as páginas.
// ======================================================

// Data de hoje no cabeçalho
const elData = document.getElementById("today");
if (elData) {
  const hoje = new Date();
  const formatado = hoje.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
  elData.textContent = formatado.charAt(0).toUpperCase() + formatado.slice(1);
}

// ------------------------------------------------------
// Status de licença (admin-escolas.html) — calcula o badge a partir
// da data de fim gravada em data-license-fim="AAAA-MM-DD"
// ------------------------------------------------------
document.querySelectorAll("[data-license-fim]").forEach((el) => {
  const fim = new Date(`${el.dataset.licenseFim}T23:59:59`);
  const hoje = new Date();
  const diasRestantes = Math.ceil((fim - hoje) / 86400000);

  if (diasRestantes < 0) {
    el.textContent = "Licença vencida";
    el.classList.add("badge--bad");
  } else if (diasRestantes <= 30) {
    el.textContent = `Vence em ${diasRestantes} dia${diasRestantes === 1 ? "" : "s"}`;
    el.classList.add("badge--progress");
  } else {
    el.textContent = "Ativa";
    el.classList.add("badge--done");
  }
});

// Menu mobile (sidebar retrátil)
const menuToggle = document.getElementById("menuToggle");
const sidebar = document.getElementById("sidebar");
if (menuToggle && sidebar) {
  menuToggle.addEventListener("click", () => {
    sidebar.classList.toggle("is-open");
  });
}

// Botão "Trocar turma" — só um placeholder visual por enquanto
const btnTrocarTurma = document.getElementById("trocarTurma");
if (btnTrocarTurma) {
  btnTrocarTurma.addEventListener("click", () => {
    alert("Aqui vai abrir a lista de turmas (Sub-9, Sub-11, Sub-13...) quando o sistema estiver funcional.");
  });
}

// ------------------------------------------------------
// Toast — aviso rápido no rodapé da tela
// ------------------------------------------------------
let toastTimer = null;
function showToast(mensagem) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = mensagem;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

// ------------------------------------------------------
// Formulários e ações "fake" — ainda sem Firebase conectado
// ------------------------------------------------------
document.querySelectorAll("form[data-fake-form]").forEach((form) => {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    showToast(form.dataset.fakeForm || "Isso será salvo assim que o banco de dados (Firebase) estiver conectado.");
    if (form.dataset.resetOnSubmit !== "false") form.reset();
  });
});

document.querySelectorAll("[data-fake-action]").forEach((el) => {
  const evento = el.tagName === "SELECT" ? "change" : "click";
  el.addEventListener(evento, (e) => {
    if (evento === "click") e.preventDefault();
    showToast(el.dataset.fakeAction || "Essa ação vai funcionar de verdade quando o Firebase estiver conectado.");
  });
});

// ------------------------------------------------------
// Painéis que abrem/fecham (ex: "Cadastrar atleta")
// ------------------------------------------------------
document.querySelectorAll("[data-toggle-panel]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = document.getElementById(btn.dataset.togglePanel);
    if (!target) return;
    const isHidden = target.classList.toggle("is-hidden");
    target.classList.toggle("is-visible", !isHidden);
    if (!isHidden) target.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
});

// ------------------------------------------------------
// Busca simples (filtra elementos [data-search-item] pelo data-name)
// ------------------------------------------------------
document.querySelectorAll("[data-search]").forEach((input) => {
  const scopeSelector = input.dataset.search;
  input.addEventListener("input", () => {
    const termo = input.value.trim().toLowerCase();
    document.querySelectorAll(`${scopeSelector} [data-search-item]`).forEach((item) => {
      const nome = (item.dataset.name || "").toLowerCase();
      item.style.display = nome.includes(termo) ? "" : "none";
    });
  });
});

// ------------------------------------------------------
// Sliders dos 5 Pilares — mostra o valor ao lado em tempo real
// ------------------------------------------------------
document.querySelectorAll('input[type="range"][data-live-output]').forEach((range) => {
  const out = document.getElementById(range.dataset.liveOutput);
  const update = () => { if (out) out.textContent = Number(range.value).toFixed(1); };
  range.addEventListener("input", update);
  update();
});

// ------------------------------------------------------
// Chamada / frequência — grupos de botões Presente/Atrasado/Ausente
// ------------------------------------------------------
function recalcularResumoChamada() {
  const contadores = { presente: 0, atrasado: 0, ausente: 0 };
  document.querySelectorAll(".toggle-group [data-state].is-active").forEach((btn) => {
    contadores[btn.dataset.state] = (contadores[btn.dataset.state] || 0) + 1;
  });
  document.querySelectorAll("[data-count]").forEach((el) => {
    el.textContent = contadores[el.dataset.count] || 0;
  });
}

document.querySelectorAll(".toggle-group").forEach((group) => {
  group.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-state]");
    if (!btn || !group.contains(btn)) return;
    group.querySelectorAll("[data-state]").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    recalcularResumoChamada();
  });
});
recalcularResumoChamada();

// ------------------------------------------------------
// Comunicação — adiciona o recado na lista visualmente (não é salvo)
// ------------------------------------------------------
const formRecado = document.getElementById("formRecado");
if (formRecado) {
  formRecado.addEventListener("submit", () => {
    const lista = document.getElementById("listaMensagens");
    const destinatario = formRecado.querySelector("[name=destinatario]");
    const texto = formRecado.querySelector("[name=mensagem]");
    if (!lista || !texto || !texto.value.trim()) return;

    const li = document.createElement("li");
    li.className = "message-item";

    const head = document.createElement("div");
    head.className = "message-item-head";
    const strong = document.createElement("strong");
    strong.textContent = destinatario ? destinatario.selectedOptions[0].textContent : "Turma";
    const quando = document.createElement("span");
    quando.textContent = "agora mesmo";
    head.append(strong, quando);

    const paragrafo = document.createElement("p");
    paragrafo.textContent = texto.value.trim();

    li.append(head, paragrafo);
    lista.prepend(li);
    formRecado.reset();
  });
}
