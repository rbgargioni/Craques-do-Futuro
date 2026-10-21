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
// da data de fim gravada em data-license-fim="AAAA-MM-DD". Exposta em
// window.CFBadgeLicenca porque admin-escolas.js cria cards dinamicamente
// depois de carregar os dados do Firestore (esse forEach roda só uma vez,
// ao carregar a página, e não pega elementos criados depois).
// ------------------------------------------------------
function aplicarBadgeLicenca(el) {
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
}
window.CFBadgeLicenca = aplicarBadgeLicenca;
document.querySelectorAll("[data-license-fim]").forEach(aplicarBadgeLicenca);

// ------------------------------------------------------
// Barra "Turma ativa" (atletas/avaliações/frequência/planos/...) — nome,
// categoria e temporada da turma vêm de campos de texto livre no Firestore,
// então isso monta o texto via DOM (textContent) em vez de innerHTML, pra
// não abrir brecha de XSS caso alguém cadastre uma turma com HTML no nome.
// ------------------------------------------------------
function definirTurmaBar(el, turma) {
  el.textContent = "";
  if (!turma) {
    el.textContent = "Nenhuma turma";
    return;
  }
  el.appendChild(document.createTextNode(`${turma.nome} `));
  const small = document.createElement("small");
  small.textContent = `· ${turma.categoria} · ${turma.temporada}`;
  el.appendChild(small);
}
window.CFTurmaBar = definirTurmaBar;

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
// Nível de evolução dentro da categoria (atletas.html)
// Nível é ajustado manualmente pelo técnico (+/-); ao chegar em 9,
// mostra o aviso de "pronto para subir de categoria".
// ------------------------------------------------------
document.querySelectorAll("[data-nivel-atleta]").forEach((linha) => {
  const card = linha.closest(".entity-card");
  const categoriaEl = linha.querySelector(".nivel-categoria");
  const valorEl = linha.querySelector(".nivel-valor");
  const dots = linha.querySelectorAll(".nivel-dot");
  const prontoEl = card ? card.querySelector(".nivel-pronto") : null;
  const prontoCategoriaEl = prontoEl ? prontoEl.querySelector("[data-proxima-categoria-label]") : null;

  function render() {
    const nivel = Number(linha.dataset.nivel);
    categoriaEl.textContent = linha.dataset.categoria;
    valorEl.textContent = nivel;
    dots.forEach((dot, i) => dot.classList.toggle("is-filled", i < nivel));
    if (prontoEl) {
      prontoEl.classList.toggle("is-hidden", nivel < 9);
      if (prontoCategoriaEl) prontoCategoriaEl.textContent = linha.dataset.proximaCategoria;
    }
  }

  linha.querySelectorAll("[data-nivel-dir]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const novo = Math.min(9, Math.max(1, Number(linha.dataset.nivel) + Number(btn.dataset.nivelDir)));
      linha.dataset.nivel = novo;
      render();
    });
  });

  const btnPromover = prontoEl ? prontoEl.querySelector("[data-promover]") : null;
  if (btnPromover) {
    btnPromover.addEventListener("click", () => {
      const categoriaAntiga = linha.dataset.categoria;
      const categoriaNova = linha.dataset.proximaCategoria;
      showToast(`Promoção de ${categoriaAntiga} (nível 9) para ${categoriaNova} será salva quando o banco de dados (Firebase) estiver conectado.`);
      linha.dataset.categoria = categoriaNova;
      linha.dataset.nivel = 1;
      render();
    });
  }

  render();
});

// ------------------------------------------------------
// Quadro tático — botão flutuante que abre um campo de futebol em tela
// cheia pra desenhar jogadas (giz digital: só desenhar/limpar/fechar, não
// salva nada em lugar nenhum — é um rascunho, some ao fechar de propósito,
// não precisa de coleção nova no Firestore pra isso).
//
// Só aparece pra administrador/técnico, e só nas páginas com a barra
// lateral (Dashboard/Atletas/Avaliações/Frequência/Planos/Relatórios/
// Comparativos/Comunicação/Configurações — checado via ".sidebar" existir
// na página) — não faz sentido em "Minhas escolas", no painel do dono nem
// pro responsável. Script.js roda antes do "cf:pronto" resolver (ver
// convenção no topo do arquivo), então isso só é montado quando o evento
// dispara e já sabe o papel de quem está logado.
// ------------------------------------------------------
// Duas versões do campo (paisagem/retrato) — a retrato é a paisagem com
// x/y transpostos (rotação de 90°), então os elementos simétricos (linha
// central, círculo, grandes áreas, pequenas áreas, cantos) caem no lugar
// certo só trocando qual dimensão é a maior. Evita ficar com um campo
// deitado "espremido" numa tela de celular em pé (ou vice-versa).
const CAMPO_TATICO_SVG = {
  paisagem: {
    viewBox: "0 0 700 450",
    conteudo: `
      <rect x="0" y="0" width="700" height="450" fill="#1f7a3d"></rect>
      <g fill="none" stroke="#eafff0" stroke-width="2" stroke-opacity="0.9">
        <rect x="20" y="20" width="660" height="410"></rect>
        <line x1="350" y1="20" x2="350" y2="430"></line>
        <circle cx="350" cy="225" r="55"></circle>
        <circle cx="350" cy="225" r="2.5" fill="#eafff0"></circle>
        <rect x="20" y="115" width="105" height="220"></rect>
        <rect x="20" y="170" width="40" height="110"></rect>
        <rect x="575" y="115" width="105" height="220"></rect>
        <rect x="640" y="170" width="40" height="110"></rect>
        <circle cx="92" cy="225" r="2.5" fill="#eafff0"></circle>
        <circle cx="608" cy="225" r="2.5" fill="#eafff0"></circle>
        <path d="M125,183 A55,55 0 0 1 125,267"></path>
        <path d="M575,183 A55,55 0 0 0 575,267"></path>
        <rect x="8" y="195" width="12" height="60"></rect>
        <rect x="680" y="195" width="12" height="60"></rect>
        <path d="M20,36 A16,16 0 0 0 36,20"></path>
        <path d="M664,20 A16,16 0 0 0 680,36"></path>
        <path d="M680,414 A16,16 0 0 0 664,430"></path>
        <path d="M36,430 A16,16 0 0 0 20,414"></path>
      </g>
    `,
  },
  retrato: {
    viewBox: "0 0 450 700",
    conteudo: `
      <rect x="0" y="0" width="450" height="700" fill="#1f7a3d"></rect>
      <g fill="none" stroke="#eafff0" stroke-width="2" stroke-opacity="0.9">
        <rect x="20" y="20" width="410" height="660"></rect>
        <line x1="20" y1="350" x2="430" y2="350"></line>
        <circle cx="225" cy="350" r="55"></circle>
        <circle cx="225" cy="350" r="2.5" fill="#eafff0"></circle>
        <rect x="115" y="20" width="220" height="105"></rect>
        <rect x="170" y="20" width="110" height="40"></rect>
        <rect x="115" y="575" width="220" height="105"></rect>
        <rect x="170" y="640" width="110" height="40"></rect>
        <circle cx="225" cy="92" r="2.5" fill="#eafff0"></circle>
        <circle cx="225" cy="608" r="2.5" fill="#eafff0"></circle>
        <path d="M183,125 A55,55 0 0 0 267,125"></path>
        <path d="M183,575 A55,55 0 0 1 267,575"></path>
        <rect x="195" y="8" width="60" height="12"></rect>
        <rect x="195" y="680" width="60" height="12"></rect>
        <path d="M36,20 A16,16 0 0 1 20,36"></path>
        <path d="M20,664 A16,16 0 0 1 36,680"></path>
        <path d="M414,680 A16,16 0 0 1 430,664"></path>
        <path d="M430,36 A16,16 0 0 1 414,20"></path>
      </g>
    `,
  },
};

function montarQuadroTatico() {
  if (document.getElementById("quadroTaticoBtn")) return; // evita duplicar se o evento disparar 2x

  const btn = document.createElement("button");
  btn.id = "quadroTaticoBtn";
  btn.type = "button";
  btn.className = "quadro-tatico-fab";
  btn.title = "Quadro tático — desenhar jogada";
  btn.setAttribute("aria-label", "Abrir quadro tático pra desenhar jogada");
  btn.textContent = "⚽";

  const overlay = document.createElement("div");
  overlay.className = "quadro-tatico-overlay is-hidden";
  overlay.innerHTML = `
    <div class="quadro-tatico-topo">
      <strong>Quadro tático</strong>
      <div class="quadro-tatico-acoes">
        <button type="button" class="btn btn-outline btn-sm" id="quadroTaticoLimpar">Limpar</button>
        <button type="button" class="btn btn-primary btn-sm" id="quadroTaticoFechar">Fechar</button>
      </div>
    </div>
    <div class="quadro-tatico-area">
      <div class="quadro-tatico-campo">
        <svg viewBox="${CAMPO_TATICO_SVG.paisagem.viewBox}" class="quadro-tatico-svg" preserveAspectRatio="xMidYMid meet">${CAMPO_TATICO_SVG.paisagem.conteudo}</svg>
        <canvas class="quadro-tatico-canvas"></canvas>
      </div>
    </div>
  `;

  document.body.append(btn, overlay);

  const campo = overlay.querySelector(".quadro-tatico-campo");
  const svgCampo = overlay.querySelector(".quadro-tatico-svg");
  let orientacaoAtual = "paisagem";

  // Decide pela forma real do espaço disponível (não pelo ângulo do
  // aparelho) — cobre celular girado, desktop com janela estreita etc.
  // Só troca o SVG quando a orientação realmente muda, pra não perder o
  // desenho à toa em todo redimensionamento pequeno.
  function atualizarOrientacaoCampo() {
    const rect = campo.getBoundingClientRect();
    const orientacao = rect.height > rect.width ? "retrato" : "paisagem";
    if (orientacao === orientacaoAtual && svgCampo.childElementCount) return;
    orientacaoAtual = orientacao;
    const dados = CAMPO_TATICO_SVG[orientacao];
    svgCampo.setAttribute("viewBox", dados.viewBox);
    svgCampo.innerHTML = dados.conteudo;
  }

  const canvas = overlay.querySelector(".quadro-tatico-canvas");
  const ctx = canvas.getContext("2d");
  let desenhando = false;
  let ultimoPonto = null;

  // Redimensiona o canvas pro tamanho real (em pixels) do retângulo onde ele
  // aparece — sem isso, o canvas usa um tamanho padrão pequeno (300x150) e o
  // desenho sai borrado/errado. Usa devicePixelRatio pra ficar nítido em
  // tela retina/celular. Simplesmente limpa o desenho ao redimensionar (ex:
  // girar o celular no meio de um desenho) — preservar o traço ao
  // redimensionar exigiria mais complexidade pra um caso raro.
  function redimensionarCanvas() {
    atualizarOrientacaoCampo();
    const rect = canvas.getBoundingClientRect();
    const escala = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * escala));
    canvas.height = Math.max(1, Math.round(rect.height * escala));
    ctx.setTransform(escala, 0, 0, escala, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#ffe600"; // amarelo — contrasta com o verde do campo e as linhas brancas
    ctx.lineWidth = 3.5;
  }

  function posicaoRelativa(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  // Pointer Events cobrem mouse/toque/caneta com o mesmo código —
  // touch-action:none no CSS evita a tela rolar enquanto desenha no celular.
  canvas.addEventListener("pointerdown", (e) => {
    desenhando = true;
    ultimoPonto = posicaoRelativa(e);
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!desenhando) return;
    const ponto = posicaoRelativa(e);
    ctx.beginPath();
    ctx.moveTo(ultimoPonto.x, ultimoPonto.y);
    ctx.lineTo(ponto.x, ponto.y);
    ctx.stroke();
    ultimoPonto = ponto;
  });
  function pararDeDesenhar() { desenhando = false; ultimoPonto = null; }
  canvas.addEventListener("pointerup", pararDeDesenhar);
  canvas.addEventListener("pointercancel", pararDeDesenhar);
  canvas.addEventListener("pointerleave", pararDeDesenhar);

  function limparCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  btn.addEventListener("click", () => {
    overlay.classList.remove("is-hidden");
    document.documentElement.classList.add("quadro-tatico-aberto"); // trava o scroll de fundo
    requestAnimationFrame(redimensionarCanvas); // só dá pra medir o tamanho real depois de aparecer
  });

  overlay.querySelector("#quadroTaticoFechar").addEventListener("click", () => {
    overlay.classList.add("is-hidden");
    document.documentElement.classList.remove("quadro-tatico-aberto");
  });

  overlay.querySelector("#quadroTaticoLimpar").addEventListener("click", limparCanvas);

  window.addEventListener("resize", () => {
    if (!overlay.classList.contains("is-hidden")) redimensionarCanvas();
  });
  // "resize" já cobre a rotação na maioria dos navegadores, mas
  // "orientationchange" é o sinal mais direto pra girar o celular — some
  // navegadores disparam um antes do outro terminar de ajustar o viewport.
  window.addEventListener("orientationchange", () => {
    if (!overlay.classList.contains("is-hidden")) requestAnimationFrame(redimensionarCanvas);
  });
}

document.addEventListener("cf:pronto", (e) => {
  const perfil = e.detail || {};
  if ((perfil.role === "administrador" || perfil.role === "tecnico") && document.querySelector(".sidebar")) {
    montarQuadroTatico();
  }
});
