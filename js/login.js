// ======================================================
// Craques do Futuro — login.html (autenticação real)
// O redirecionamento pra página certa depois do login é feito pelo auth-guard.js.
// ======================================================

import { signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from "./firebase-init.js";

const form = document.getElementById("formLogin");
const erroEl = document.getElementById("erroLogin");

function mostrarErro(mensagem) {
  erroEl.textContent = mensagem;
  erroEl.classList.remove("is-hidden");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  erroEl.classList.add("is-hidden");

  const email = form.email.value.trim();
  const senha = form.senha.value;
  const botao = form.querySelector("button[type=submit]");
  botao.disabled = true;
  botao.textContent = "Entrando...";

  try {
    await signInWithEmailAndPassword(auth, email, senha);
    // auth-guard.js cuida do redirecionamento assim que detectar o login
  } catch (erro) {
    mostrarErro("E-mail ou senha incorretos.");
    botao.disabled = false;
    botao.textContent = "Entrar";
  }
});

const linkEsqueci = document.getElementById("linkEsqueciSenha");
if (linkEsqueci) {
  linkEsqueci.addEventListener("click", async (e) => {
    e.preventDefault();
    erroEl.classList.add("is-hidden");
    const email = form.email.value.trim();
    if (!email) {
      mostrarErro("Digite seu e-mail no campo acima primeiro, depois clique em \"Esqueci minha senha\".");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      erroEl.classList.remove("is-hidden");
      erroEl.style.color = "var(--good)";
      erroEl.textContent = "Enviamos um e-mail com o link pra redefinir sua senha.";
    } catch (erro) {
      mostrarErro("Não conseguimos enviar o e-mail de redefinição. Confira se o e-mail está certo.");
    }
  });
}
