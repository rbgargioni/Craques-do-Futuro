// ======================================================
// Craques do Futuro — "Porteiro" de autenticação
// Carregado (type="module") em toda página protegida, ANTES de js/Script.js.
//
// - Redireciona quem não está logado para login.html
// - Descobre o papel do usuário (usuarios/{uid}) e bloqueia páginas erradas
// - Bloqueia administrador/técnico se a licença da escola de casa venceu
// - Expõe window.CF com os dados do usuário logado, pra outras páginas usarem
// ======================================================

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from "./firebase-init.js";

const LANDING_POR_PAPEL = {
  dono: "admin-escolas.html",
  administrador: "gestor-escolas.html",
  tecnico: "index.html",
  responsavel: "responsavel.html",
};

// Chave no localStorage DESTE navegador com a escola EXTRA que o administrador escolheu
// "entrar" em gestor-escolas.html (só relevante pra quem tem limiteEscolas/licencaFim no
// próprio perfil — ver nota sobre "múltiplas escolas" em firestore.rules). Sem escolha
// nenhuma, ou pra qualquer outro administrador, a escola usada é sempre a "de casa"
// (perfil.escolaId), do jeito que já era antes dessa feature existir.
const CHAVE_ESCOLA_ATIVA_EXTRA = "cf_gestorEscolaAtiva";

function paginaAtual() {
  return location.pathname.split("/").pop() || "index.html";
}

function papeisPermitidosDaPagina() {
  const attr = document.body.dataset.allowedRoles;
  return attr ? attr.split(" ") : null; // null = página pública (login.html, sem-acesso.html)
}

function liberarPagina() {
  document.documentElement.classList.add("is-authorized");
}

function aplicarVisibilidadePorPapel(role) {
  document.querySelectorAll("[data-roles]").forEach((el) => {
    const permitido = el.dataset.roles.split(" ").includes(role);
    el.classList.toggle("is-hidden", !permitido);
  });
}

function preencherTopbar(perfil) {
  const nomeEl = document.querySelector(".profile-text strong");
  const cargoEl = document.querySelector(".profile-text span");
  const avatarEl = document.querySelector(".avatar");
  const rotulos = { dono: "Dono da conta", administrador: "Administrador", tecnico: "Técnico", responsavel: "Responsável" };

  if (nomeEl) nomeEl.textContent = perfil.nome || perfil.email;
  if (cargoEl && rotulos[perfil.role]) cargoEl.textContent = rotulos[perfil.role];
  if (avatarEl) {
    const iniciais = (perfil.nome || perfil.email || "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join("");
    avatarEl.textContent = iniciais || "?";
  }
}

// gestor-escolas.html ("Minhas escolas") é a landing page do administrador — esse link deixa
// fácil voltar pra lá de dentro das páginas operacionais (atletas.html etc.).
function adicionarLinkVoltarGestao() {
  const linkSair = document.querySelector("[data-sair]");
  if (!linkSair || linkSair.parentElement.querySelector("[data-voltar-gestao]")) return;
  const link = document.createElement("a");
  link.href = "gestor-escolas.html";
  link.className = "link-sair";
  link.style.marginRight = "12px";
  link.textContent = "← Minhas escolas";
  link.dataset.voltarGestao = "";
  linkSair.parentElement.insertBefore(link, linkSair);
}

onAuthStateChanged(auth, async (user) => {
  const permitidos = papeisPermitidosDaPagina();
  const naPaginaDeLogin = paginaAtual() === "login.html";

  if (!user) {
    if (permitidos) {
      location.href = "login.html";
      return;
    }
    liberarPagina(); // login.html / sem-acesso.html continuam acessíveis sem login
    return;
  }

  let perfil;
  try {
    const snap = await getDoc(doc(db, "usuarios", user.uid));
    if (!snap.exists()) throw new Error("Perfil não encontrado em usuarios/" + user.uid);
    perfil = snap.data();
  } catch (erro) {
    console.error("Falha ao carregar o perfil do usuário:", erro);
    await signOut(auth);
    location.href = "login.html";
    return;
  }

  window.CF = {
    uid: user.uid,
    role: perfil.role,
    escolaId: perfil.escolaId || null,
    nome: perfil.nome,
    email: perfil.email,
    atletaIds: perfil.atletaIds || [],
    // Só preenchidos quando o administrador tem plano de mais de uma escola — ver gestor-escolas.js
    limiteEscolas: perfil.limiteEscolas || null,
    licencaFimPacote: perfil.licencaFim || null,
  };

  // Administrador pode ter escolhido operar numa escola EXTRA (não a de casa) em
  // gestor-escolas.html — essa escolha fica salva no localStorage e tem prioridade aqui.
  // Sem escolha válida, window.CF.escolaId já é a escola de casa (perfil.escolaId), então não
  // precisa fazer nada. gestor-escolas.html e login.html ficam de fora: é lá que a escolha é
  // feita/trocada, então essa página sempre trabalha com a escola de casa por padrão.
  if (perfil.role === "administrador" && paginaAtual() !== "gestor-escolas.html" && !naPaginaDeLogin) {
    const escolaExtraId = localStorage.getItem(CHAVE_ESCOLA_ATIVA_EXTRA);
    if (escolaExtraId && escolaExtraId !== perfil.escolaId) {
      try {
        const escolaSnap = await getDoc(doc(db, "escolas", escolaExtraId));
        if (escolaSnap.exists() && escolaSnap.data().administradorUid === user.uid) {
          window.CF.escolaId = escolaExtraId;
          window.CF.escolaNome = escolaSnap.data().nome;
        } else {
          localStorage.removeItem(CHAVE_ESCOLA_ATIVA_EXTRA);
        }
      } catch (erro) {
        console.error("Falha ao carregar a escola extra escolhida:", erro);
        localStorage.removeItem(CHAVE_ESCOLA_ATIVA_EXTRA);
      }
    }
  }

  // Bloqueia se a licença da escola já venceu — só se aplica à escola DE CASA (técnico sempre;
  // administrador só quando está operando a própria, não uma extra escolhida acima). Escolas
  // extras não são checadas aqui de propósito: o acesso a elas não depende do licencaFim de
  // cada uma (ver isStaffAtivo em firestore.rules); bloquear aqui também ficaria inconsistente
  // com o que a regra do Firestore já permite.
  const escolaParaChecarLicenca =
    perfil.role === "tecnico" ? perfil.escolaId
    : (perfil.role === "administrador" && window.CF.escolaId === perfil.escolaId) ? perfil.escolaId
    : null;
  if (escolaParaChecarLicenca) {
    try {
      const escolaSnap = await getDoc(doc(db, "escolas", escolaParaChecarLicenca));
      const venceu = !escolaSnap.exists() || escolaSnap.data().licencaFim.toDate() < new Date();
      // escolher-plano.html também fica de fora — é justamente pra onde a escola vencida
      // precisa poder ir pra pedir um plano novo; sem essa exceção, cairia num loop de volta pra
      // sem-acesso.html. gestor-escolas.html fica de fora porque a checagem acima já não roda lá.
      if (venceu && paginaAtual() !== "sem-acesso.html" && paginaAtual() !== "escolher-plano.html") {
        location.href = "sem-acesso.html";
        return;
      }
    } catch (erro) {
      console.error("Falha ao verificar a licença da escola:", erro);
    }
  }

  if (naPaginaDeLogin) {
    location.href = LANDING_POR_PAPEL[perfil.role] || "sem-acesso.html";
    return;
  }

  if (permitidos && !permitidos.includes(perfil.role)) {
    location.href = "sem-acesso.html";
    return;
  }

  preencherTopbar(perfil);
  aplicarVisibilidadePorPapel(perfil.role);
  if (perfil.role === "administrador" && paginaAtual() !== "gestor-escolas.html") adicionarLinkVoltarGestao();
  liberarPagina();
  document.dispatchEvent(new CustomEvent("cf:pronto", { detail: window.CF }));
});

// Botão/link "Sair" — qualquer elemento com [data-sair]
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-sair]");
  if (!btn) return;
  e.preventDefault();
  signOut(auth).then(() => {
    location.href = "login.html";
  });
});
