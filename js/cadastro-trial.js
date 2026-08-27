// ======================================================
// Craques do Futuro — cadastro-trial.html (cadastro público de teste grátis)
// Página SEM auth-guard.js: precisa funcionar deslogado. Ao enviar o formulário,
// cria a conta de login (Auth) — o que já loga o navegador nessa conta — e então
// cria a escola (status "trial") e o próprio perfil em usuarios/{uid}, exatamente
// na ordem que firestore.rules espera (ver ehCriacaoDeTrialValida e a regra de
// criação de usuarios/{uid} pra usuário sem perfil ainda).
// ======================================================

import { createUserWithEmailAndPassword, deleteUser } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection, addDoc, doc, setDoc, deleteDoc, serverTimestamp, Timestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from "./firebase-init.js";

// O relógio do navegador de quem se cadastra pode estar um pouco adiantado ou
// atrasado em relação ao relógio do servidor (request.time nas regras). Uma
// margem de 10 minutos pra trás no início evita que um relógio levemente
// adiantado derrube a regra "licencaInicio <= request.time", sem abrir brecha
// real: mesmo com a margem, o total continua travado em 7 dias na regra.
const MARGEM_RELOGIO_MS = 10 * 60 * 1000;
const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

function traduzirErro(erro) {
  const codigo = erro && erro.code ? erro.code : "";
  if (codigo.includes("email-already-in-use")) return "Esse e-mail já está cadastrado. Se já é sua conta, faça login.";
  if (codigo.includes("weak-password")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (codigo.includes("invalid-email")) return "E-mail inválido.";
  if (codigo.includes("permission-denied")) return "Não foi possível concluir o cadastro. Tente novamente em alguns instantes.";
  return (erro && erro.message) || "Algo deu errado. Tente novamente em alguns segundos.";
}

const form = document.getElementById("formCadastroTrial");
const erroEl = document.getElementById("erroCadastro");

function mostrarErro(mensagem) {
  erroEl.textContent = mensagem;
  erroEl.classList.remove("is-hidden");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  erroEl.classList.add("is-hidden");

  const botao = form.querySelector("button[type=submit]");
  botao.disabled = true;
  botao.textContent = "Criando sua conta...";

  const nomeEscola = form.nomeEscola.value.trim();
  const nomeResponsavel = form.nomeResponsavel.value.trim();
  const email = form.email.value.trim();
  const senha = form.senha.value;

  let contaCriada = false;
  let escolaRef = null;

  try {
    await createUserWithEmailAndPassword(auth, email, senha);
    contaCriada = true;

    const agora = Date.now();
    const licencaInicio = Timestamp.fromDate(new Date(agora - MARGEM_RELOGIO_MS));
    const licencaFim = Timestamp.fromDate(new Date(agora - MARGEM_RELOGIO_MS + SETE_DIAS_MS));

    escolaRef = await addDoc(collection(db, "escolas"), {
      nome: nomeEscola,
      licencaInicio,
      licencaFim,
      status: "trial",
      criadoEm: serverTimestamp(),
    });

    await setDoc(doc(db, "usuarios", auth.currentUser.uid), {
      role: "administrador",
      escolaId: escolaRef.id,
      nome: nomeResponsavel,
      email,
    });

    location.href = "index.html"; // auth-guard.js assume o resto
  } catch (erro) {
    console.error(erro);
    // Desfaz o que já tiver sido criado, senão sobra escola ou conta órfã.
    if (escolaRef) await deleteDoc(escolaRef).catch(() => {});
    if (contaCriada && auth.currentUser) await deleteUser(auth.currentUser).catch(() => {});
    mostrarErro(traduzirErro(erro));
    botao.disabled = false;
    botao.textContent = "Começar teste grátis";
  }
});
