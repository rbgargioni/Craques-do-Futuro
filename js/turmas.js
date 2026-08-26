// ======================================================
// Craques do Futuro — configuracoes.html (turmas, dados reais)
// Só roda depois que auth-guard.js confirma o papel (evento "cf:pronto"),
// que é quando window.CF.escolaId fica disponível.
// ======================================================

import {
  collection, addDoc, doc, updateDoc, onSnapshot, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./firebase-init.js";

function turmasRef() {
  return collection(db, "escolas", window.CF.escolaId, "turmas");
}

function criarCardTurma(turmaId, dados) {
  const card = document.createElement("div");
  card.className = "entity-card";
  card.style.cursor = "pointer";
  card.title = "Clique para editar";

  const top = document.createElement("div");
  top.className = "entity-card-top";
  const info = document.createElement("div");
  const nomeEl = document.createElement("strong");
  nomeEl.textContent = dados.nome;
  const categoriaEl = document.createElement("span");
  categoriaEl.textContent = `${dados.categoria} · ${dados.temporada}`;
  info.append(nomeEl, categoriaEl);
  top.appendChild(info);

  const foot = document.createElement("div");
  foot.className = "entity-card-foot";
  const badge = document.createElement("span");
  badge.className = dados.ativa === false ? "badge badge--bad" : "badge badge--done";
  badge.textContent = dados.ativa === false ? "Inativa" : "Ativa";
  foot.appendChild(badge);

  card.append(top, foot);
  card.addEventListener("click", () => abrirEdicaoTurma(turmaId, dados));
  return card;
}

function carregarTurmas() {
  const container = document.getElementById("listaTurmas");
  onSnapshot(
    turmasRef(),
    (snapshot) => {
      container.innerHTML = "";
      if (snapshot.empty) {
        container.innerHTML = '<p class="empty-state">Nenhuma turma cadastrada ainda. Clique em "＋ Nova turma" pra criar a primeira.</p>';
        return;
      }
      snapshot.forEach((docSnap) => {
        container.appendChild(criarCardTurma(docSnap.id, docSnap.data()));
      });
    },
    (erro) => {
      console.error("Erro ao carregar turmas:", erro);
      container.innerHTML = '<p class="empty-state">Não foi possível carregar as turmas.</p>';
    }
  );
}

function abrirEdicaoTurma(turmaId, dados) {
  const form = document.getElementById("formEditarTurma");
  form.dataset.turmaId = turmaId;
  form.nome.value = dados.nome;
  form.categoria.value = dados.categoria;
  form.temporada.value = dados.temporada;
  form.ativa.value = dados.ativa === false ? "false" : "true";

  document.getElementById("tituloEditarTurma").textContent = `Editar ${dados.nome}`;
  document.getElementById("painelTurma").classList.add("is-hidden");

  const painel = document.getElementById("painelEditarTurma");
  painel.classList.remove("is-hidden");
  painel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function configurarFormCadastrarTurma() {
  const form = document.getElementById("formCadastrarTurma");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const botao = form.querySelector("button[type=submit]");
    botao.disabled = true;
    botao.textContent = "Criando...";

    try {
      const nome = form.nome.value.trim();
      await addDoc(turmasRef(), {
        nome,
        categoria: form.categoria.value.trim(),
        temporada: form.temporada.value.trim(),
        ativa: true,
        criadoEm: serverTimestamp(),
      });
      showToast(`Turma "${nome}" criada.`);
      form.reset();
      document.getElementById("painelTurma").classList.add("is-hidden");
    } catch (erro) {
      console.error(erro);
      showToast("Não foi possível criar a turma. Tente novamente.");
    } finally {
      botao.disabled = false;
      botao.textContent = "Criar turma";
    }
  });
}

function configurarFormEditarTurma() {
  const form = document.getElementById("formEditarTurma");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const botao = form.querySelector("button[type=submit]");
    botao.disabled = true;
    botao.textContent = "Salvando...";

    try {
      const turmaId = form.dataset.turmaId;
      const nome = form.nome.value.trim();
      await updateDoc(doc(db, "escolas", window.CF.escolaId, "turmas", turmaId), {
        nome,
        categoria: form.categoria.value.trim(),
        temporada: form.temporada.value.trim(),
        ativa: form.ativa.value === "true",
      });
      document.getElementById("tituloEditarTurma").textContent = `Editar ${nome}`;
      showToast("Turma atualizada.");
    } catch (erro) {
      console.error(erro);
      showToast("Não foi possível salvar as alterações. Tente novamente.");
    } finally {
      botao.disabled = false;
      botao.textContent = "Salvar alterações";
    }
  });
}

document.addEventListener("cf:pronto", () => {
  carregarTurmas();
  configurarFormCadastrarTurma();
  configurarFormEditarTurma();

  // "Nova turma" e "Editar turma" não fazem sentido abertos ao mesmo tempo
  document.getElementById("btnCadastrarTurma").addEventListener("click", () => {
    document.getElementById("painelEditarTurma").classList.add("is-hidden");
  });
});
