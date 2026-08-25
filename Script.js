// ======================================================
// Craques do Futuro — Esboço de interface (ainda sem dados reais)
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

// Navegação lateral: apenas alterna qual item está "ativo" (visual, sem trocar de página ainda)
document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", (e) => {
    e.preventDefault();
    document.querySelectorAll(".nav-item").forEach((i) => i.classList.remove("is-active"));
    item.classList.add("is-active");

    // No mobile, fecha o menu depois de escolher uma opção
    document.getElementById("sidebar").classList.remove("is-open");
  });
});

// Botão "Trocar turma" — só um placeholder visual por enquanto
const btnTrocarTurma = document.getElementById("trocarTurma");
if (btnTrocarTurma) {
  btnTrocarTurma.addEventListener("click", () => {
    alert("Aqui vai abrir a lista de turmas (Sub-9, Sub-11, Sub-13...) quando o sistema estiver funcional.");
  });
}

// Menu mobile (sidebar retrátil)
const menuToggle = document.getElementById("menuToggle");
const sidebar = document.getElementById("sidebar");
if (menuToggle && sidebar) {
  menuToggle.addEventListener("click", () => {
    sidebar.classList.toggle("is-open");
  });
}
