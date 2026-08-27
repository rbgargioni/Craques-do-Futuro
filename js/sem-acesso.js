// ======================================================
// Craques do Futuro — sem-acesso.html
// Página pública (sem data-allowed-roles): auth-guard.js dispara "cf:pronto"
// mesmo quando a licença da escola já venceu (o redirecionamento pra cá só
// acontece a partir de OUTRAS páginas — quem já está aqui passa direto).
// Se não disparar (usuário deslogado, ex.: veio do link "Problemas pra
// entrar?" do login), o bloco genérico já visível no HTML continua valendo.
// ======================================================

import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./firebase-init.js";

document.addEventListener("cf:pronto", async (e) => {
  const escolaId = e.detail && e.detail.escolaId;
  if (!escolaId) return; // dono não tem escolaId; papel sem vínculo direto continua com o aviso genérico

  try {
    const snap = await getDoc(doc(db, "escolas", escolaId));
    if (!snap.exists() || snap.data().status !== "trial") return;

    document.getElementById("nomeEscolaTrialVencida").textContent = snap.data().nome || "sua escola";
    document.getElementById("blocoGenerico").classList.add("is-hidden");
    document.getElementById("blocoTrialVencido").classList.remove("is-hidden");
  } catch (erro) {
    console.error("Falha ao verificar status da escola:", erro);
  }
});
