// ======================================================
// Craques do Futuro — area-do-atleta.html
//
// Página PÚBLICA, sem login. Busca resumosPublicos/{codigo} (get direto por
// ID — não é uma consulta/lista, então não dá pra "descobrir" códigos por
// aqui). Mostra só nome + gráficos; nada de telefone, observações, recados
// ou histórico — isso continua exigindo o login completo em login.html.
// ======================================================

import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { PILARES_RADAR, pontoRadar } from "./metricas.js";

const telaCodigo = document.getElementById("telaCodigo");
const areaResultado = document.getElementById("areaResultado");
const form = document.getElementById("formCodigo");
const erroEl = document.getElementById("erroCodigo");

function mostrarErro(mensagem) {
  erroEl.textContent = mensagem;
  erroEl.classList.remove("is-hidden");
}

function formatarNota(nota) {
  return typeof nota === "number" ? nota.toFixed(1).replace(".", ",") : "—";
}

function renderizarResultado(dados) {
  document.getElementById("nomeAtletaResultado").textContent = dados.nome || "Atleta";
  document.getElementById("resNotaGeral").textContent = formatarNota(dados.notaGeral);
  document.getElementById("resRadarMedia").textContent = formatarNota(dados.notaGeral);

  const radar = dados.radar || {};
  document.getElementById("resRadarShape").setAttribute(
    "points",
    PILARES_RADAR.map((campo, i) => pontoRadar(radar[campo] || 0, i)).join(" ")
  );

  const total = dados.totalRegistrosFrequencia || 0;
  const presencas = dados.totalPresencas || 0;
  const percentual = total > 0 ? Math.round((presencas / total) * 1000) / 10 : null;

  const circulo = document.getElementById("resDonutValor");
  const CIRCUNFERENCIA = 301.6;
  const percentualEl = document.getElementById("resFrequencia");
  const donutPercentualEl = document.getElementById("resDonutPercentual");

  if (percentual === null) {
    circulo.style.strokeDashoffset = `${CIRCUNFERENCIA}`;
    percentualEl.textContent = "—";
    donutPercentualEl.textContent = "—";
  } else {
    circulo.style.strokeDashoffset = `${CIRCUNFERENCIA * (1 - percentual / 100)}`;
    const texto = `${percentual.toFixed(1).replace(".", ",")}%`;
    percentualEl.textContent = texto;
    donutPercentualEl.textContent = texto;
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  erroEl.classList.add("is-hidden");

  const codigo = form.codigo.value.trim().toUpperCase();
  if (!codigo) return;

  const botao = form.querySelector("button[type=submit]");
  botao.disabled = true;
  botao.textContent = "Buscando...";

  try {
    const snap = await getDoc(doc(db, "resumosPublicos", codigo));
    if (!snap.exists()) {
      mostrarErro("Código não encontrado. Confira com o técnico se digitou certo.");
      return;
    }
    renderizarResultado(snap.data());
    telaCodigo.classList.add("is-hidden");
    areaResultado.classList.remove("is-hidden");
  } catch (erro) {
    console.error(erro);
    mostrarErro("Não foi possível buscar agora. Tente de novo em instantes.");
  } finally {
    botao.disabled = false;
    botao.textContent = "Ver evolução";
  }
});

document.getElementById("btnOutroCodigo").addEventListener("click", () => {
  areaResultado.classList.add("is-hidden");
  telaCodigo.classList.remove("is-hidden");
  form.reset();
  erroEl.classList.add("is-hidden");
});
