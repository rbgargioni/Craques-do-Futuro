// ======================================================
// Craques do Futuro — gestor-escolas.html ("Minhas escolas", dados reais)
// Só roda depois que auth-guard.js confirma que quem está logado é
// "administrador" (evento "cf:pronto"). TODO administrador cai aqui ao
// logar — o que muda de conta pra conta é só o que aparece:
//   - Escola "de casa" (window.CF.escolaId, fixo no perfil): sempre
//     aparece, com botão "Editar nome" mas SEM "Excluir" (isso continua
//     exigindo o dono).
//   - Escolas EXTRAS (escolas.administradorUid == meu uid): QUALQUER
//     administrador pode cadastrar (decisão de 2026-08-28 — revogou o
//     modelo anterior de "limiteEscolas" liberado pelo dono). Como não
//     tem mais um "pacote" com licencaFim pra herdar, quem cadastra
//     define a licença da escola nova na hora, igual o dono faz em
//     admin-escolas.html.
// Ver nota sobre "múltiplas escolas" no topo de firestore.rules antes de
// mexer aqui.
// ======================================================

import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection, addDoc, doc, setDoc, updateDoc, deleteDoc, getDocs, getCountFromServer, onSnapshot, query, where, serverTimestamp, Timestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { app as appPrincipal, db } from "./firebase-init.js";

const CHAVE_ESCOLA_ATIVA_EXTRA = "cf_gestorEscolaAtiva";

let pararEscolaDeCasa = null;
let pararEscolasExtras = null;

// Mesmo padrão de criarContaSemDeslogar() de admin-escolas.js: cria a conta de
// login do administrador sem deslogar quem está usando o site, usando uma
// instância secundária e descartável do Firebase App.
async function criarContaSemDeslogar(email, senha) {
  const appSecundario = initializeApp(appPrincipal.options, `secundario-${Date.now()}`);
  const authSecundario = getAuth(appSecundario);
  try {
    const credencial = await createUserWithEmailAndPassword(authSecundario, email, senha);
    return credencial.user.uid;
  } finally {
    await signOut(authSecundario).catch(() => {});
    await deleteApp(appSecundario).catch(() => {});
  }
}

function traduzirErro(erro) {
  const codigo = erro && erro.code ? erro.code : "";
  if (codigo.includes("email-already-in-use")) return "Esse e-mail já está sendo usado por outra conta.";
  if (codigo.includes("weak-password")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (codigo.includes("invalid-email")) return "E-mail inválido.";
  if (codigo.includes("permission-denied")) return "Você não tem permissão pra fazer essa ação.";
  return (erro && erro.message) || "Algo deu errado. Tente novamente em alguns segundos.";
}

function mostrarErro(mensagem) {
  const el = document.getElementById("erroGestor");
  el.textContent = mensagem;
  el.classList.remove("is-hidden");
}
function esconderErro() {
  document.getElementById("erroGestor").classList.add("is-hidden");
}

function dataInputParaTimestamp(valorInput) {
  return Timestamp.fromDate(new Date(`${valorInput}T12:00:00`));
}

async function aplicarUsoNoCard(card, escolaId) {
  const treinadoresEl = card.querySelector("[data-uso-treinadores]");
  const alunosEl = card.querySelector("[data-uso-alunos]");
  const turmasEl = card.querySelector("[data-uso-turmas]");
  try {
    const qTreinadores = query(
      collection(db, "usuarios"),
      where("escolaId", "==", escolaId),
      where("role", "in", ["administrador", "tecnico"])
    );
    const snapTreinadores = await getCountFromServer(qTreinadores);
    treinadoresEl.textContent = snapTreinadores.data().count;
  } catch (erro) {
    console.error("Erro ao contar treinadores da escola:", erro);
    treinadoresEl.textContent = "—";
  }
  try {
    const snapAlunos = await getCountFromServer(collection(db, "escolas", escolaId, "atletas"));
    alunosEl.textContent = snapAlunos.data().count;
  } catch (erro) {
    console.error("Erro ao contar alunos da escola:", erro);
    alunosEl.textContent = "—";
  }
  try {
    const snapTurmas = await getCountFromServer(collection(db, "escolas", escolaId, "turmas"));
    turmasEl.textContent = snapTurmas.data().count;
  } catch (erro) {
    console.error("Erro ao contar turmas da escola:", erro);
    turmasEl.textContent = "—";
  }
}

function criarCardEscola(escolaId, dados, ehDeCasa) {
  const card = document.createElement("div");
  card.className = "entity-card";

  const top = document.createElement("div");
  top.className = "entity-card-top";
  const info = document.createElement("div");
  const nomeEl = document.createElement("strong");
  nomeEl.textContent = dados.nome;
  info.appendChild(nomeEl);
  if (ehDeCasa) {
    const tagCasa = document.createElement("span");
    tagCasa.className = "tag";
    tagCasa.style.marginLeft = "8px";
    tagCasa.textContent = "sua escola";
    info.appendChild(tagCasa);
  }
  top.appendChild(info);

  const stats = document.createElement("div");
  stats.className = "stat-grid";
  stats.style.gridTemplateColumns = "repeat(3, 1fr)";
  stats.style.margin = "12px 0";

  const statTreinadores = document.createElement("div");
  statTreinadores.className = "stat-card";
  const iconeTreinadores = document.createElement("span");
  iconeTreinadores.className = "stat-icon stat-icon--neutral";
  iconeTreinadores.textContent = "👥";
  const wrapTreinadores = document.createElement("div");
  const valorTreinadores = document.createElement("strong");
  valorTreinadores.textContent = "—";
  valorTreinadores.dataset.usoTreinadores = "";
  const labelTreinadores = document.createElement("span");
  labelTreinadores.textContent = "Treinadores";
  wrapTreinadores.append(valorTreinadores, labelTreinadores);
  statTreinadores.append(iconeTreinadores, wrapTreinadores);

  const statAlunos = document.createElement("div");
  statAlunos.className = "stat-card";
  const iconeAlunos = document.createElement("span");
  iconeAlunos.className = "stat-icon stat-icon--neutral";
  iconeAlunos.textContent = "🧑‍🤝‍🧑";
  const wrapAlunos = document.createElement("div");
  const valorAlunos = document.createElement("strong");
  valorAlunos.textContent = "—";
  valorAlunos.dataset.usoAlunos = "";
  const labelAlunos = document.createElement("span");
  labelAlunos.textContent = "Alunos";
  wrapAlunos.append(valorAlunos, labelAlunos);
  statAlunos.append(iconeAlunos, wrapAlunos);

  const statTurmas = document.createElement("div");
  statTurmas.className = "stat-card";
  const iconeTurmas = document.createElement("span");
  iconeTurmas.className = "stat-icon stat-icon--neutral";
  iconeTurmas.textContent = "🗂";
  const wrapTurmas = document.createElement("div");
  const valorTurmas = document.createElement("strong");
  valorTurmas.textContent = "—";
  valorTurmas.dataset.usoTurmas = "";
  const labelTurmas = document.createElement("span");
  labelTurmas.textContent = "Turmas";
  wrapTurmas.append(valorTurmas, labelTurmas);
  statTurmas.append(iconeTurmas, wrapTurmas);

  stats.append(statTreinadores, statAlunos, statTurmas);

  const foot = document.createElement("div");
  foot.className = "entity-card-foot";
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.dataset.licenseFim = dados.licencaFim.toDate().toISOString().slice(0, 10);
  const btnEntrar = document.createElement("button");
  btnEntrar.type = "button";
  btnEntrar.className = "btn btn-primary btn-sm";
  btnEntrar.textContent = "Entrar na escola →";
  btnEntrar.addEventListener("click", () => {
    localStorage.setItem(CHAVE_ESCOLA_ATIVA_EXTRA, escolaId);
    location.href = "index.html";
  });
  foot.append(badge, btnEntrar);

  const acoes = document.createElement("div");
  acoes.style.display = "flex";
  acoes.style.gap = "8px";
  acoes.style.marginTop = "10px";
  const btnEditar = document.createElement("button");
  btnEditar.type = "button";
  btnEditar.className = "btn btn-outline btn-sm";
  btnEditar.textContent = "Editar nome";
  btnEditar.addEventListener("click", () => abrirEdicaoEscola(escolaId, dados));
  acoes.append(btnEditar);

  // Atalho direto pra "Gestão de usuários" (dentro de configuracoes.html) — sem isso, precisava
  // "Entrar na escola" e depois achar a seção no menu lateral. Mesmo mecanismo de troca de escola
  // ativa do botão "Entrar na escola →" (ver CHAVE_ESCOLA_ATIVA_EXTRA), só que já pousa na tela certa.
  const btnGestaoUsuarios = document.createElement("button");
  btnGestaoUsuarios.type = "button";
  btnGestaoUsuarios.className = "btn btn-outline btn-sm";
  btnGestaoUsuarios.textContent = "Gestão de usuários";
  btnGestaoUsuarios.addEventListener("click", () => {
    localStorage.setItem(CHAVE_ESCOLA_ATIVA_EXTRA, escolaId);
    location.href = "configuracoes.html#secaoGestaoUsuarios";
  });
  acoes.append(btnGestaoUsuarios);

  // Excluir: só escolas EXTRAS — a de casa não pode ser excluída por essa tela (só o dono).
  if (!ehDeCasa) {
    const btnExcluir = document.createElement("button");
    btnExcluir.type = "button";
    btnExcluir.className = "btn btn-outline btn-sm";
    btnExcluir.textContent = "Excluir escola";
    btnExcluir.addEventListener("click", () => excluirEscolaExtra(escolaId, dados.nome, btnExcluir));
    acoes.append(btnExcluir);
  }

  card.append(top, stats, foot, acoes);
  window.CFBadgeLicenca(badge);
  aplicarUsoNoCard(card, escolaId);
  return card;
}

function abrirEdicaoEscola(escolaId, dados) {
  esconderErro();
  const form = document.getElementById("formEditarEscolaGestor");
  form.dataset.escolaId = escolaId;
  form.nome.value = dados.nome;
  document.getElementById("tituloEditarEscolaGestor").textContent = `Editar ${dados.nome}`;
  document.getElementById("painelEscolaGestor").classList.add("is-hidden");
  const painel = document.getElementById("painelEditarEscolaGestor");
  painel.classList.remove("is-hidden");
  painel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function configurarFormEditarEscola() {
  const form = document.getElementById("formEditarEscolaGestor");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    esconderErro();
    const botao = form.querySelector("button[type=submit]");
    botao.disabled = true;
    botao.textContent = "Salvando...";
    try {
      const nome = form.nome.value.trim();
      await updateDoc(doc(db, "escolas", form.dataset.escolaId), { nome });
      showToast("Escola atualizada.");
      document.getElementById("painelEditarEscolaGestor").classList.add("is-hidden");
    } catch (erro) {
      console.error(erro);
      mostrarErro(traduzirErro(erro));
    } finally {
      botao.disabled = false;
      botao.textContent = "Salvar alterações";
    }
  });
}

// Apaga todos os documentos retornados por uma query/coleção, em paralelo —
// mesmo helper usado em admin-escolas.js pra excluir trials vencidos.
async function excluirDocsDe(refOuQuery) {
  const snap = await getDocs(refOuQuery);
  await Promise.all(snap.docs.map((docSnap) => deleteDoc(docSnap.ref)));
}

// Exclusão em cascata de UMA escola EXTRA (nunca a de casa) — mesmo padrão de
// excluirEscolaTrialVencida() em admin-escolas.js (turmas/atletas+progressao/
// avaliações/frequência/planos/mensagens/resumosPublicos/usuarios vinculados).
// Mesma limitação conhecida: não apaga a conta de login (Firebase Auth) do
// administrador/técnicos vinculados, só o acesso deles (via usuarios/{uid}) —
// ver nota em admin-escolas.js.
async function excluirEscolaExtra(escolaId, nomeEscola, botao) {
  const confirmado = confirm(
    `Excluir "${nomeEscola}" e todos os dados dela (turmas, atletas, avaliações, frequência, recados)?\n\nEssa ação não pode ser desfeita.`
  );
  if (!confirmado) return;

  botao.disabled = true;
  botao.textContent = "Excluindo...";
  try {
    const snapAtletas = await getDocs(collection(db, "escolas", escolaId, "atletas"));
    for (const atletaDoc of snapAtletas.docs) {
      await excluirDocsDe(collection(db, "escolas", escolaId, "atletas", atletaDoc.id, "progressao"));
      await deleteDoc(atletaDoc.ref);
    }

    await excluirDocsDe(collection(db, "escolas", escolaId, "turmas"));
    await excluirDocsDe(collection(db, "escolas", escolaId, "avaliacoes"));
    await excluirDocsDe(collection(db, "escolas", escolaId, "frequencia"));
    await excluirDocsDe(collection(db, "escolas", escolaId, "planos"));
    await excluirDocsDe(collection(db, "escolas", escolaId, "mensagens"));
    await excluirDocsDe(query(collection(db, "resumosPublicos"), where("escolaId", "==", escolaId)));
    await excluirDocsDe(query(collection(db, "usuarios"), where("escolaId", "==", escolaId)));
    await deleteDoc(doc(db, "escolas", escolaId));

    showToast(`"${nomeEscola}" foi excluída.`);
  } catch (erro) {
    console.error(erro);
    mostrarErro(traduzirErro(erro));
    botao.disabled = false;
    botao.textContent = "Excluir escola";
  }
}

// Combina escola de casa + escolas extras (dois listeners independentes) num único grid,
// sempre que qualquer um dos dois atualiza.
const cardsPorId = {}; // escolaId -> { dados, ehDeCasa }

function renderizarEscolas() {
  const container = document.getElementById("listaEscolasGestor");
  const totalEl = document.getElementById("totalEscolasGestor");
  const ids = Object.keys(cardsPorId);

  totalEl.textContent = `${ids.length}`;

  container.innerHTML = "";
  if (ids.length === 0) {
    container.innerHTML = '<p class="empty-state">Nenhuma escola encontrada.</p>';
    return;
  }
  ids.forEach((id) => {
    try {
      container.appendChild(criarCardEscola(id, cardsPorId[id].dados, cardsPorId[id].ehDeCasa));
    } catch (erro) {
      console.error(`Escola ${id} com dado inválido, pulando:`, cardsPorId[id].dados, erro);
    }
  });
}

function carregarEscolas() {
  const homeEscolaId = window.CF.escolaId; // nesta página, sempre a escola de casa (ver auth-guard.js)

  pararEscolaDeCasa = onSnapshot(
    doc(db, "escolas", homeEscolaId),
    (snap) => {
      if (snap.exists()) cardsPorId[homeEscolaId] = { dados: snap.data(), ehDeCasa: true };
      else delete cardsPorId[homeEscolaId];
      renderizarEscolas();
    },
    (erro) => {
      console.error("Erro ao carregar a escola de casa:", erro);
      mostrarErro("Não foi possível carregar sua escola. Recarregue a página.");
    }
  );

  const q = query(collection(db, "escolas"), where("administradorUid", "==", window.CF.uid));
  pararEscolasExtras = onSnapshot(
    q,
    (snapshot) => {
      // limpa extras antigas antes de reaplicar (a de casa nunca é tocada aqui, ela não tem
      // _veioDaQueryExtra)
      Object.keys(cardsPorId).forEach((id) => {
        if (cardsPorId[id]._veioDaQueryExtra) delete cardsPorId[id];
      });
      snapshot.forEach((docSnap) => {
        if (docSnap.id === homeEscolaId) return; // não deveria acontecer, mas evita duplicar o card
        cardsPorId[docSnap.id] = { dados: docSnap.data(), ehDeCasa: false, _veioDaQueryExtra: true };
      });
      renderizarEscolas();
    },
    (erro) => {
      console.error("Erro ao carregar escolas extras:", erro);
      mostrarErro("Não foi possível carregar suas escolas extras. Recarregue a página.");
    }
  );
}

function configurarFormCadastrarEscola() {
  const form = document.getElementById("formCadastrarEscolaGestor");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    esconderErro();

    const botao = form.querySelector("button[type=submit]");
    botao.disabled = true;
    botao.textContent = "Criando...";

    let escolaRef = null;
    try {
      const nome = form.nome.value.trim();
      const nomeAdmin = form.nomeAdmin.value.trim();
      const emailAdmin = form.emailAdmin.value.trim();
      const senhaAdmin = form.senhaAdmin.value;

      escolaRef = await addDoc(collection(db, "escolas"), {
        nome,
        licencaInicio: dataInputParaTimestamp(form.licencaInicio.value),
        licencaFim: dataInputParaTimestamp(form.licencaFim.value),
        status: "ativa",
        planoId: null,
        administradorUid: window.CF.uid,
        criadoEm: serverTimestamp(),
      });

      const novoUid = await criarContaSemDeslogar(emailAdmin, senhaAdmin);
      await setDoc(doc(db, "usuarios", novoUid), {
        role: "administrador",
        escolaId: escolaRef.id,
        nome: nomeAdmin,
        email: emailAdmin,
      });

      showToast(`Escola "${nome}" criada com sucesso.`);
      form.reset();
      document.getElementById("painelEscolaGestor").classList.add("is-hidden");
    } catch (erro) {
      console.error(erro);
      // Se a escola chegou a ser criada mas o administrador falhou, desfaz — senão fica uma escola órfã.
      if (escolaRef) await deleteDoc(escolaRef).catch(() => {});
      mostrarErro(traduzirErro(erro));
    } finally {
      botao.disabled = false;
      botao.textContent = "Criar escola";
    }
  });
}

document.addEventListener("cf:pronto", () => {
  carregarEscolas();
  configurarFormEditarEscola();
  configurarFormCadastrarEscola();
});
