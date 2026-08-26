// ======================================================
// Craques do Futuro — atletas.html (dados reais)
// Só roda depois que auth-guard.js confirma o papel (evento "cf:pronto"),
// que é quando window.CF.escolaId fica disponível.
// ======================================================

import {
  collection, addDoc, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, serverTimestamp, Timestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { PROXIMA_CATEGORIA, NIVEL_MAXIMO, NIVEL_INICIAL, estaProntoParaEvoluir } from "./metricas.js";

let turmasCache = {}; // turmaId -> dados
let turmaAtivaId = null;
let pararDeOuvirAtletas = null;

function escolaId() { return window.CF.escolaId; }
function turmasRef() { return collection(db, "escolas", escolaId(), "turmas"); }
function atletasRef() { return collection(db, "escolas", escolaId(), "atletas"); }
function atletaRef(atletaId) { return doc(db, "escolas", escolaId(), "atletas", atletaId); }
function resumoPublicoRef(codigo) { return doc(db, "resumosPublicos", codigo); }
function chaveTurmaAtiva() { return `cf_turmaAtiva_${escolaId()}`; }

// ------------------------------------------------------
// Código da "Área do atleta" — 6 caracteres, sem 0/O/1/I/L (fácil de ler
// e digitar, difícil de confundir). Guardado como ID do documento em
// resumosPublicos, então já sai único por natureza (colisão exigiria
// gerar o mesmo código duas vezes, extremamente improvável nesse espaço).
// ------------------------------------------------------
const ALFABETO_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function gerarCodigoPublico() {
  let codigo = "";
  for (let i = 0; i < 6; i++) {
    codigo += ALFABETO_CODIGO[Math.floor(Math.random() * ALFABETO_CODIGO.length)];
  }
  return codigo;
}

function criarResumoPublicoInicial(codigo, atletaId, nome) {
  return setDoc(resumoPublicoRef(codigo), {
    escolaId: escolaId(),
    atletaId,
    nome,
    radar: { tecnico: 0, tatico: 0, fisico: 0, mental: 0, evolucao: 0 },
    notaGeral: null,
    totalPresencas: 0,
    totalRegistrosFrequencia: 0,
    atualizadoEm: serverTimestamp(),
  });
}

// Gera um novo código pro atleta, preservando o resumo (radar/frequência)
// que já existia no código antigo, e apaga o código antigo em seguida —
// assim, se o código vazar, dá pra invalidar o antigo sem perder o histórico.
async function regenerarCodigoPublico(atletaId, codigoAntigo, nome) {
  const novoCodigo = gerarCodigoPublico();
  let dadosBase = null;
  if (codigoAntigo) {
    const snapAntigo = await getDoc(resumoPublicoRef(codigoAntigo));
    if (snapAntigo.exists()) dadosBase = snapAntigo.data();
  }

  await setDoc(resumoPublicoRef(novoCodigo), {
    escolaId: escolaId(),
    atletaId,
    nome,
    radar: { tecnico: 0, tatico: 0, fisico: 0, mental: 0, evolucao: 0 },
    notaGeral: null,
    totalPresencas: 0,
    totalRegistrosFrequencia: 0,
    ...dadosBase,
    atualizadoEm: serverTimestamp(),
  });
  await updateDoc(atletaRef(atletaId), { codigoPublico: novoCodigo });
  if (codigoAntigo) await deleteDoc(resumoPublicoRef(codigoAntigo)).catch(() => {});
  return novoCodigo;
}

function iniciaisDoNome(nome) {
  return (nome || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

// ------------------------------------------------------
// Turma ativa (seletor no topo da página)
// ------------------------------------------------------
function atualizarTurmaBar() {
  const nomeEl = document.getElementById("turmaAtivaNome");
  const turma = turmasCache[turmaAtivaId];
  window.CFTurmaBar(nomeEl, turma);
}

function popularSeletorTurma() {
  const select = document.getElementById("seletorTurma");
  const aviso = document.getElementById("avisoSemTurma");
  const btnCadastrar = document.getElementById("btnCadastrarAtleta");
  const ids = Object.keys(turmasCache);

  if (ids.length === 0) {
    select.innerHTML = '<option value="">Nenhuma turma cadastrada</option>';
    select.disabled = true;
    aviso.classList.remove("is-hidden");
    btnCadastrar.disabled = true;
    turmaAtivaId = null;
    atualizarTurmaBar();
    ouvirAtletas();
    return;
  }

  select.disabled = false;
  aviso.classList.add("is-hidden");
  btnCadastrar.disabled = false;

  // Mantém a turma já escolhida se ainda existir; senão usa a salva no navegador; senão a primeira.
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
  });
}

// ------------------------------------------------------
// Nível de evolução dentro da categoria (+/- e "Promover")
// ------------------------------------------------------
function criarLinhaNivel(atletaId, dados) {
  const categoriaAtual = dados.categoriaAtual || "Sub-9";
  const proximaCategoria = PROXIMA_CATEGORIA[categoriaAtual] || null;

  const linha = document.createElement("div");
  linha.className = "nivel-row";

  const info = document.createElement("div");
  info.className = "nivel-info";
  const categoriaEl = document.createElement("span");
  categoriaEl.className = "nivel-categoria";
  categoriaEl.textContent = categoriaAtual;
  const dotsWrap = document.createElement("div");
  dotsWrap.className = "nivel-dots";
  const dots = [];
  for (let i = 0; i < NIVEL_MAXIMO; i++) {
    const dot = document.createElement("span");
    dot.className = "nivel-dot";
    dots.push(dot);
    dotsWrap.appendChild(dot);
  }
  info.append(categoriaEl, dotsWrap);

  const stepper = document.createElement("div");
  stepper.className = "nivel-stepper";
  const btnMenos = document.createElement("button");
  btnMenos.type = "button";
  btnMenos.className = "nivel-btn";
  btnMenos.textContent = "−";
  btnMenos.setAttribute("aria-label", "Diminuir nível");
  const valorEl = document.createElement("strong");
  valorEl.className = "nivel-valor";
  const btnMais = document.createElement("button");
  btnMais.type = "button";
  btnMais.className = "nivel-btn";
  btnMais.textContent = "+";
  btnMais.setAttribute("aria-label", "Aumentar nível");
  stepper.append(btnMenos, valorEl, btnMais);

  linha.append(info, stepper);

  const pronto = document.createElement("div");
  pronto.className = "nivel-pronto is-hidden";
  const spanPronto = document.createElement("span");
  spanPronto.textContent = "⬆ Pronto para ";
  const strongProxima = document.createElement("strong");
  strongProxima.textContent = proximaCategoria || "";
  spanPronto.appendChild(strongProxima);
  const btnPromover = document.createElement("button");
  btnPromover.type = "button";
  btnPromover.className = "btn btn-primary btn-sm";
  btnPromover.textContent = "Promover";
  pronto.append(spanPronto, btnPromover);

  function render(nivel) {
    valorEl.textContent = nivel;
    dots.forEach((dot, i) => dot.classList.toggle("is-filled", i < nivel));
    pronto.classList.toggle("is-hidden", !estaProntoParaEvoluir(nivel, categoriaAtual));
  }

  async function mudarNivel(delta) {
    const atual = Number(valorEl.textContent);
    const novo = Math.min(NIVEL_MAXIMO, Math.max(NIVEL_INICIAL, atual + delta));
    if (novo === atual) return;
    render(novo);
    try {
      await updateDoc(doc(db, "escolas", escolaId(), "atletas", atletaId), {
        nivelAtual: novo,
        nivelDesde: serverTimestamp(),
      });
    } catch (erro) {
      console.error(erro);
      showToast("Não foi possível salvar o nível. Tente novamente.");
      render(atual);
    }
  }
  btnMenos.addEventListener("click", () => mudarNivel(-1));
  btnMais.addEventListener("click", () => mudarNivel(1));

  btnPromover.addEventListener("click", async () => {
    if (!proximaCategoria) return;
    btnPromover.disabled = true;
    try {
      await updateDoc(doc(db, "escolas", escolaId(), "atletas", atletaId), {
        categoriaAtual: proximaCategoria,
        nivelAtual: NIVEL_INICIAL,
        nivelDesde: serverTimestamp(),
      });
      await addDoc(collection(db, "escolas", escolaId(), "atletas", atletaId, "progressao"), {
        tipo: "promocao",
        categoriaAnterior: categoriaAtual,
        nivelAnterior: NIVEL_MAXIMO,
        categoriaNova: proximaCategoria,
        data: serverTimestamp(),
      });
      showToast(`${dados.nome} promovido para ${proximaCategoria}.`);
    } catch (erro) {
      console.error(erro);
      showToast("Não foi possível promover o atleta. Tente novamente.");
      btnPromover.disabled = false;
    }
  });

  render(dados.nivelAtual || NIVEL_INICIAL);
  return { linha, pronto };
}

// ------------------------------------------------------
// Cards de atleta
// ------------------------------------------------------
function criarCardAtleta(atletaId, dados) {
  const card = document.createElement("div");
  card.className = "entity-card";
  card.dataset.searchItem = "";
  card.dataset.name = dados.nome;

  const top = document.createElement("div");
  top.className = "entity-card-top";
  const avatar = document.createElement("span");
  avatar.className = "athlete-avatar";
  avatar.textContent = iniciaisDoNome(dados.nome);
  const info = document.createElement("div");
  info.style.flex = "1";
  const nomeEl = document.createElement("strong");
  nomeEl.textContent = dados.nome;
  const subEl = document.createElement("span");
  const ano = dados.nascimento ? dados.nascimento.toDate().getFullYear() : null;
  subEl.textContent = ano ? `${dados.posicao} · ${ano}` : dados.posicao;
  info.append(nomeEl, subEl);

  const codigoWrap = document.createElement("div");
  codigoWrap.className = "codigo-publico";
  const codigoLabel = document.createElement("span");
  codigoLabel.className = "codigo-publico-label";
  codigoLabel.textContent = "Área do atleta";
  const codigoLinha = document.createElement("div");
  codigoLinha.className = "codigo-publico-linha";
  const codigoValor = document.createElement("strong");
  codigoValor.textContent = dados.codigoPublico || "—";
  const btnRegenerar = document.createElement("button");
  btnRegenerar.type = "button";
  btnRegenerar.className = "codigo-publico-regenerar";
  btnRegenerar.textContent = "⟳";
  btnRegenerar.title = "Gerar novo código (o antigo deixa de funcionar)";
  btnRegenerar.setAttribute("aria-label", "Gerar novo código da Área do atleta");
  btnRegenerar.addEventListener("click", async () => {
    btnRegenerar.disabled = true;
    try {
      const novoCodigo = await regenerarCodigoPublico(atletaId, dados.codigoPublico, dados.nome);
      dados.codigoPublico = novoCodigo;
      codigoValor.textContent = novoCodigo;
      showToast("Novo código gerado — o antigo não funciona mais.");
    } catch (erro) {
      console.error(erro);
      showToast("Não foi possível gerar um novo código. Tente novamente.");
    } finally {
      btnRegenerar.disabled = false;
    }
  });
  codigoLinha.append(codigoValor, btnRegenerar);
  codigoWrap.append(codigoLabel, codigoLinha);

  top.append(avatar, info, codigoWrap);

  const foot = document.createElement("div");
  foot.className = "entity-card-foot";
  const badge = document.createElement("span");
  const emAtencao = dados.status === "atencao";
  badge.className = emAtencao ? "badge badge--bad" : "badge badge--done";
  badge.textContent = emAtencao ? "Atenção" : "Ativo";
  foot.appendChild(badge);

  const { linha, pronto } = criarLinhaNivel(atletaId, dados);

  card.append(top, foot, linha, pronto);
  return card;
}

function renderizarAtletas(lista) {
  const container = document.getElementById("listaAtletas");
  const totalEl = document.getElementById("totalAtletas");
  totalEl.textContent = `${lista.length} atleta${lista.length === 1 ? "" : "s"}`;

  container.innerHTML = "";
  if (lista.length === 0) {
    container.innerHTML = '<p class="empty-state">Nenhum atleta cadastrado nesta turma ainda.</p>';
    return;
  }
  lista.forEach(({ id, dados }) => container.appendChild(criarCardAtleta(id, dados)));
}

function ouvirAtletas() {
  if (pararDeOuvirAtletas) {
    pararDeOuvirAtletas();
    pararDeOuvirAtletas = null;
  }

  const container = document.getElementById("listaAtletas");
  if (!turmaAtivaId) {
    container.innerHTML = '<p class="empty-state">Selecione uma turma pra ver o elenco.</p>';
    document.getElementById("totalAtletas").textContent = "0 atletas";
    return;
  }

  container.innerHTML = '<p class="empty-state">Carregando atletas...</p>';
  const q = query(atletasRef(), where("turmaId", "==", turmaAtivaId));
  pararDeOuvirAtletas = onSnapshot(
    q,
    (snapshot) => {
      const lista = [];
      snapshot.forEach((docSnap) => lista.push({ id: docSnap.id, dados: docSnap.data() }));
      lista.sort((a, b) => a.dados.nome.localeCompare(b.dados.nome, "pt-BR"));
      renderizarAtletas(lista);
    },
    (erro) => {
      console.error("Erro ao carregar atletas:", erro);
      container.innerHTML = '<p class="empty-state">Não foi possível carregar os atletas.</p>';
    }
  );
}

// ------------------------------------------------------
// Cadastro de atleta
// ------------------------------------------------------
function configurarFormCadastrarAtleta() {
  const form = document.getElementById("formCadastrarAtleta");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!turmaAtivaId) {
      showToast("Selecione (ou cadastre) uma turma antes de cadastrar um atleta.");
      return;
    }

    const botao = form.querySelector("button[type=submit]");
    botao.disabled = true;
    botao.textContent = "Salvando...";

    try {
      const turma = turmasCache[turmaAtivaId];
      const nome = form.nome.value.trim();
      const codigoPublico = gerarCodigoPublico();

      const novoAtletaRef = await addDoc(atletasRef(), {
        nome,
        posicao: form.posicao.value,
        nascimento: Timestamp.fromDate(new Date(`${form.nascimento.value}T12:00:00`)),
        telefone: form.telefone.value.trim(),
        observacoes: form.observacoes.value.trim(),
        turmaId: turmaAtivaId,
        status: "ativo",
        categoriaAtual: (turma && turma.categoria) || "Sub-9",
        nivelAtual: NIVEL_INICIAL,
        nivelDesde: serverTimestamp(),
        responsavelUids: [],
        codigoPublico,
        criadoEm: serverTimestamp(),
      });
      await criarResumoPublicoInicial(codigoPublico, novoAtletaRef.id, nome);

      showToast(`Atleta "${nome}" cadastrado.`);
      form.reset();
      document.getElementById("painelCadastro").classList.add("is-hidden");
    } catch (erro) {
      console.error(erro);
      showToast("Não foi possível cadastrar o atleta. Tente novamente.");
    } finally {
      botao.disabled = false;
      botao.textContent = "Salvar atleta";
    }
  });
}

document.addEventListener("cf:pronto", () => {
  ouvirTurmas();
  montarSeletorTurma();
  configurarFormCadastrarAtleta();
});
