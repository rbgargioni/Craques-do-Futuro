// ======================================================
// Craques do Futuro — "Porteiro" de autenticação
// Carregado (type="module") em toda página protegida, ANTES de js/Script.js.
//
// - Redireciona quem não está logado para login.html
// - Descobre o papel do usuário (usuarios/{uid}) e bloqueia páginas erradas
// - Bloqueia administrador/técnico se a licença da escola venceu
// - Expõe window.CF com os dados do usuário logado, pra outras páginas usarem
// ======================================================

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from "./firebase-init.js";

const LANDING_POR_PAPEL = {
  dono: "admin-escolas.html",
  administrador: "index.html",
  tecnico: "index.html",
  responsavel: "responsavel.html",
};

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
  };

  // Administrador/técnico: bloqueia se a licença da escola já venceu
  if ((perfil.role === "administrador" || perfil.role === "tecnico") && perfil.escolaId) {
    try {
      const escolaSnap = await getDoc(doc(db, "escolas", perfil.escolaId));
      const venceu = !escolaSnap.exists() || escolaSnap.data().licencaFim.toDate() < new Date();
      if (venceu && paginaAtual() !== "sem-acesso.html") {
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
