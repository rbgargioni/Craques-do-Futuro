// ======================================================
// Craques do Futuro — escolher-plano.html
// Só roda depois que auth-guard.js confirma o papel (evento "cf:pronto").
// Funciona mesmo com a licença da escola vencida — auth-guard.js tem uma
// exceção pra essa página exatamente por causa disso (ver comentário lá).
// ======================================================

import {
  collection, addDoc, doc, getDoc, onSnapshot, query, where, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./firebase-init.js";

const DURACOES = [
  { meses: 12, label: "1 ano" },
  { meses: 24, label: "2 anos" },
];

function mostrarErro(mensagem) {
  const el = document.getElementById("erroEscolherPlano");
  el.textContent = mensagem;
  el.classList.remove("is-hidden");
}

function criarCardPlano(planoId, dados, escolaId, escolaNome) {
  const card = document.createElement("div");
  card.className = "entity-card";

  const top = document.createElement("div");
  top.className = "entity-card-top";
  const info = document.createElement("div");
  const nomeEl = document.createElement("strong");
  nomeEl.textContent = dados.nome;
  const detalhesEl = document.createElement("span");
  const treinadoresTxt = dados.limiteTecnicos > 0 ? `até ${dados.limiteTecnicos} treinador${dados.limiteTecnicos === 1 ? "" : "es"}` : "treinadores ilimitados";
  const alunosTxt = dados.limiteAlunos > 0 ? `até ${dados.limiteAlunos} aluno${dados.limiteAlunos === 1 ? "" : "s"}` : "alunos ilimitados";
  detalhesEl.textContent = `${treinadoresTxt} · ${alunosTxt}`;
  info.append(nomeEl, detalhesEl);
  top.appendChild(info);

  const campoDuracao = document.createElement("div");
  campoDuracao.className = "field";
  campoDuracao.style.marginTop = "14px";
  const label = document.createElement("label");
  label.textContent = "Duração";
  const select = document.createElement("select");
  DURACOES.forEach(({ meses, label: rotulo }) => {
    const opt = document.createElement("option");
    opt.value = meses;
    opt.textContent = rotulo;
    select.appendChild(opt);
  });
  campoDuracao.append(label, select);

  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "btn btn-primary";
  botao.style.width = "100%";
  botao.style.marginTop = "12px";
  botao.textContent = "Solicitar este plano";
  botao.addEventListener("click", async () => {
    botao.disabled = true;
    botao.textContent = "Enviando...";
    try {
      await addDoc(collection(db, "solicitacoesPlano"), {
        escolaId,
        escolaNome,
        planoId,
        planoNome: dados.nome,
        duracaoMeses: Number(select.value),
        solicitanteNome: window.CF.nome || window.CF.email,
        solicitanteEmail: window.CF.email,
        status: "pendente",
        criadoEm: serverTimestamp(),
      });
      showToast(`Pedido do plano "${dados.nome}" enviado! Você recebe a confirmação assim que for aprovado.`);
      document.getElementById("avisoPendente").classList.remove("is-hidden");
    } catch (erro) {
      console.error(erro);
      mostrarErro("Não foi possível enviar o pedido. Tente novamente em instantes.");
    } finally {
      botao.disabled = false;
      botao.textContent = "Solicitar este plano";
    }
  });

  card.append(top, campoDuracao, botao);
  return card;
}

async function carregarPlanos() {
  const container = document.getElementById("listaPlanosDisponiveis");
  const escolaId = window.CF.escolaId;

  let escolaNome = "sua escola";
  try {
    const escolaSnap = await getDoc(doc(db, "escolas", escolaId));
    if (escolaSnap.exists()) {
      escolaNome = escolaSnap.data().nome;
      document.getElementById("nomeEscolaPagina").textContent = escolaNome;
    }
  } catch (erro) {
    console.error("Erro ao carregar dados da escola:", erro);
  }

  const q = query(collection(db, "planosAssinatura"), where("ativo", "==", true));
  onSnapshot(
    q,
    (snapshot) => {
      container.innerHTML = "";
      if (snapshot.empty) {
        container.innerHTML = '<p class="empty-state">Nenhum plano disponível no momento. Fale com a gente.</p>';
        return;
      }
      snapshot.forEach((docSnap) => {
        container.appendChild(criarCardPlano(docSnap.id, docSnap.data(), escolaId, escolaNome));
      });
    },
    (erro) => {
      console.error("Erro ao carregar planos:", erro);
      container.innerHTML = '<p class="empty-state">Não foi possível carregar os planos.</p>';
    }
  );
}

document.addEventListener("cf:pronto", () => {
  carregarPlanos();
});
