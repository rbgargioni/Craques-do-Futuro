// ======================================================
// Craques do Futuro — MÉTRICAS DE AVALIAÇÃO
//
// Este é o ÚNICO arquivo com a "régua" de avaliação do sistema: como a nota
// geral é calculada, o que conta como "bom" ou "atenção", como funciona a
// progressão de categoria e a tendência de evolução. Todas as outras páginas
// (Avaliações, Atletas, Dashboard, Relatórios, Comparativos) importam daqui
// em vez de ter esses números espalhados e duplicados pelo código.
//
// Se for mudar algum critério (peso de um pilar, nota de corte, quanto tempo
// no nível 9 pra promover, etc.), o lugar certo pra mexer é este arquivo.
// ======================================================

// ------------------------------------------------------
// Os 5 Pilares
// ------------------------------------------------------

// Ordem/rótulos como aparecem em tabelas (Relatórios, Comparativos).
// "evolucao" é o campo espelho de compatibilidade (ver PILARES_100 mais
// abaixo) — hoje carrega o pilar Potencial/Futuro normalizado 0-10, por
// isso o rótulo é "Potencial", não "Evolução" (o nome do campo em si não
// mudou pra não precisar migrar avaliações já salvas).
export const PILARES_TABELA = [
  { campo: "tecnico", label: "Técnico" },
  { campo: "tatico", label: "Tático" },
  { campo: "fisico", label: "Físico" },
  { campo: "mental", label: "Mental" },
  { campo: "evolucao", label: "Potencial" },
];

// Ordem ao redor do gráfico radar (pentágono) — começa no topo (Técnico) e
// segue no sentido horário. Precisa bater com a posição dos rótulos <text>
// já desenhados no SVG de cada página (Dashboard, Relatórios, Comparativos).
export const PILARES_RADAR = ["tecnico", "tatico", "mental", "fisico", "evolucao"];

// Nota geral de uma avaliação = média simples dos 5 Pilares.
// Pra mudar pra média ponderada, é só ajustar os pesos aqui.
const PESO_PILAR = { tecnico: 1, tatico: 1, fisico: 1, mental: 1, evolucao: 1 };

export function calcularNotaGeral(pilares) {
  const chaves = Object.keys(PESO_PILAR);
  const somaPesos = chaves.reduce((soma, campo) => soma + PESO_PILAR[campo], 0);
  const soma = chaves.reduce((total, campo) => total + (pilares[campo] || 0) * PESO_PILAR[campo], 0);
  return Math.round((soma / somaPesos) * 10) / 10;
}

// ------------------------------------------------------
// NOVO sistema de avaliação — 5 Pilares / 100 pontos (2026-09-01)
//
// Decisão do Rafael com um técnico consultado + confirmado por ele: a régua
// antiga acima ("Os 5 Pilares", nota 0-10 direta por pilar) e os
// "fundamentos técnicos por posição" mais abaixo (FUNDAMENTOS_POR_POSICAO)
// estavam desatualizados. Este bloco é o substituto DEFINITIVO — inclusive
// derruba a ideia de fundamentos técnicos DIFERENTES por posição: agora o
// pilar Técnico (e todos os outros) usa as MESMAS subcategorias pra
// qualquer atleta, seja goleiro ou atacante.
//
// Migração em fases (ver README): Fase 1 = só este arquivo (pronto). Fase 2
// = reescrever avaliacoes.html/js pra usar isso em vez do formulário antigo.
// Fase 3 = atualizar dashboard/relatórios/comparativos/responsável/Área do
// atleta, que ainda leem os campos antigos (tecnico/tatico/fisico/mental/
// evolucao 0-10). Até a Fase 2 terminar, tudo acima e FUNDAMENTOS_POR_POSICAO
// abaixo continuam no ar pra não quebrar a tela de Avaliações atual.
//
// Regra de cálculo (o avaliador NUNCA digita peso, só nota de 0 a 10):
//   pontuação da subcategoria = (nota ÷ 10) × peso da subcategoria
//   pontuação do pilar        = soma das subcategorias dele
//   nota final                = soma dos 5 pilares → 0 a 100
// ------------------------------------------------------
export const PILARES_100 = {
  fisico: {
    label: "Físico",
    peso: 20,
    subcategorias: {
      velocidade: { label: "Velocidade", peso: 3.0 },
      explosao: { label: "Explosão", peso: 3.0 },
      agilidade: { label: "Agilidade", peso: 2.5 },
      resistencia: { label: "Resistência/condicionamento", peso: 3.0 },
      forca: { label: "Força", peso: 2.5 },
      coordenacaoMotora: { label: "Coordenação motora", peso: 2.0 },
      equilibrio: { label: "Equilíbrio", peso: 2.0 },
      mobilidade: { label: "Mobilidade/flexibilidade", peso: 2.0 },
    },
  },
  tecnico: {
    label: "Técnico",
    peso: 30,
    subcategorias: {
      dominioPrimeiroToque: { label: "Domínio/primeiro toque", peso: 4.0 },
      passe: { label: "Passe", peso: 3.5 },
      conducao: { label: "Condução", peso: 3.0 },
      drible: { label: "Drible", peso: 3.5 },
      finalizacao: { label: "Finalização", peso: 4.0 },
      chute: { label: "Chute", peso: 2.5 },
      cruzamento: { label: "Cruzamento", peso: 2.0 },
      cabeceio: { label: "Cabeceio", peso: 1.5 },
      desarme: { label: "Desarme", peso: 3.0 },
      controleDeBola: { label: "Controle de bola", peso: 3.0 },
    },
  },
  tatico: {
    label: "Tático",
    peso: 20,
    subcategorias: {
      posicionamento: { label: "Posicionamento", peso: 3.0 },
      leituraDeJogo: { label: "Leitura de jogo", peso: 3.0 },
      tomadaDeDecisao: { label: "Tomada de decisão", peso: 3.0 },
      ocupacaoDeEspacos: { label: "Ocupação de espaços", peso: 2.0 },
      movimentacaoSemBola: { label: "Movimentação sem bola", peso: 2.0 },
      cobertura: { label: "Cobertura", peso: 2.0 },
      transicaoAtaqueDefesa: { label: "Transição ataque/defesa", peso: 2.0 },
      entendimentoDaPosicao: { label: "Entendimento da posição", peso: 2.0 },
      funcaoColetiva: { label: "Função coletiva", peso: 1.0 },
    },
  },
  mental: {
    label: "Mental/Comportamental",
    // ⚠️ O enunciado original diz "peso total: 20", mas a soma das 10
    // subcategorias abaixo dá 18.5 (conferido pelo teste automático) — até
    // o Rafael confirmar com o técnico qual número está certo (falta 1,5
    // ponto em algum lugar), o peso do pilar aqui é a soma REAL das
    // subcategorias, não o total declarado. Nota final máxima possível
    // hoje é 98,5/100, não 100/100, por causa disso.
    peso: 18.5,
    subcategorias: {
      comportamentoSobPressao: { label: "Comportamento sob pressão", peso: 2.0 },
      concentracao: { label: "Concentração", peso: 2.0 },
      disciplina: { label: "Disciplina", peso: 1.5 },
      confianca: { label: "Confiança", peso: 1.5 },
      reacaoAoErro: { label: "Reação ao erro", peso: 2.0 },
      competitividade: { label: "Competitividade", peso: 2.0 },
      resiliencia: { label: "Resiliência", peso: 2.0 },
      aceitaCriticas: { label: "Aceita críticas/orientações", peso: 1.5 },
      compreendeComando: { label: "Compreende o comando", peso: 2.0 },
      executaComando: { label: "Executa o comando", peso: 2.0 },
    },
  },
  // "Potencial/Futuro" é a capacidade estimada de evolução, NÃO a mesma
  // coisa que o desempenho atual — mesmo assim entra na soma dos 100 pontos
  // (é assim que foi especificado); a tela (Fase 2/3) deve mostrar isso
  // separado do resto pra não confundir "nota atual" com "potencial".
  potencial: {
    label: "Potencial/Futuro",
    peso: 10,
    subcategorias: {
      evolucao: { label: "Evolução", peso: 1.5 },
      facilidadeParaAprender: { label: "Facilidade para aprender", peso: 1.5 },
      potencialFisico: { label: "Potencial físico", peso: 1.0 },
      potencialTecnico: { label: "Potencial técnico", peso: 1.5 },
      potencialTatico: { label: "Potencial tático", peso: 1.0 },
      potencialMental: { label: "Potencial mental", peso: 1.0 },
      regularidade: { label: "Regularidade", peso: 1.0 },
      adaptabilidade: { label: "Adaptabilidade", peso: 0.5 },
      idadeXDesempenho: { label: "Idade x desempenho", peso: 1.0 },
    },
  },
};

// Ordem em que os pilares aparecem em telas/tabelas novas.
export const ORDEM_PILARES_100 = ["fisico", "tecnico", "tatico", "mental", "potencial"];

export const NOTA_MINIMA_SUBCATEGORIA = 0;
export const NOTA_MAXIMA_SUBCATEGORIA = 10;

export function notaSubcategoriaValida(nota) {
  return (
    typeof nota === "number" &&
    !Number.isNaN(nota) &&
    nota >= NOTA_MINIMA_SUBCATEGORIA &&
    nota <= NOTA_MAXIMA_SUBCATEGORIA
  );
}

// pontuação da subcategoria = (nota ÷ 10) × peso — trava a nota em 0-10
// antes de calcular, pra um valor inválido nunca estourar o peso do pilar.
export function calcularPontuacaoSubcategoria(nota, peso) {
  const notaTravada = Math.min(NOTA_MAXIMA_SUBCATEGORIA, Math.max(NOTA_MINIMA_SUBCATEGORIA, nota || 0));
  return (notaTravada / 10) * peso;
}

// notasPilar: { chaveDaSubcategoria: nota de 0 a 10, ... }
// Retorna { pontos, max } — "pontos" já na escala do peso do pilar (ex.: até 30 pro Técnico).
export function calcularPontuacaoPilar(pilarChave, notasPilar) {
  const pilar = PILARES_100[pilarChave];
  if (!pilar) return null;
  const chaves = Object.keys(pilar.subcategorias);
  const pontos = chaves.reduce(
    (total, chave) => total + calcularPontuacaoSubcategoria((notasPilar || {})[chave], pilar.subcategorias[chave].peso),
    0
  );
  return { pontos: Math.round(pontos * 100) / 100, max: pilar.peso };
}

// notasPorPilar: { fisico: {chave: nota, ...}, tecnico: {...}, tatico: {...}, mental: {...}, potencial: {...} }
// Retorna { porPilar: {fisico: {pontos,max}, ...}, notaFinal } — notaFinal de 0 a 100.
export function calcularAvaliacaoCompleta(notasPorPilar) {
  const porPilar = {};
  let notaFinal = 0;
  ORDEM_PILARES_100.forEach((chave) => {
    const resultado = calcularPontuacaoPilar(chave, (notasPorPilar || {})[chave]);
    porPilar[chave] = resultado;
    notaFinal += resultado.pontos;
  });
  return { porPilar, notaFinal: Math.round(notaFinal * 100) / 100 };
}

// Pra gráficos que precisam de uma escala comum entre pilares de peso
// diferente (radar 0-10, por exemplo): normaliza a pontuação do pilar pro
// tamanho do PESO dele, não pro maior peso entre todos.
export function normalizarPilarPara10(pontos, max) {
  if (!max) return 0;
  return Math.round((pontos / max) * 10 * 10) / 10;
}

// Ponto forte / ponto a melhorar entre TODAS as subcategorias dos 5
// pilares — por NOTA BRUTA (0-10) que o avaliador deu, não pela pontuação
// ponderada: o peso decide o quanto aquilo conta na nota final, mas
// "força"/"fraqueza" é sobre o nível de habilidade em si, não sobre o peso.
export function analisarPontosFortesFracos(notasPorPilar) {
  const todas = [];
  ORDEM_PILARES_100.forEach((pilarChave) => {
    const pilar = PILARES_100[pilarChave];
    const notasDoPilar = (notasPorPilar || {})[pilarChave] || {};
    Object.keys(pilar.subcategorias).forEach((chave) => {
      todas.push({
        pilar: pilarChave,
        pilarLabel: pilar.label,
        chave,
        label: pilar.subcategorias[chave].label,
        nota: notasDoPilar[chave] || 0,
      });
    });
  });
  todas.sort((a, b) => b.nota - a.nota);
  return {
    ranking: todas,
    melhor: todas[0] || null,
    piorAMelhorar: todas[todas.length - 1] || null,
  };
}

// ------------------------------------------------------
// "Bom" vs "Atenção" — usado nos pills/badges de nota em todo o site
// ------------------------------------------------------
export const NOTA_DE_CORTE_BOA = 7;

export function notaEhBoa(nota) {
  return nota >= NOTA_DE_CORTE_BOA;
}

// ------------------------------------------------------
// Tendência (Relatórios) — compara a 1ª metade das notas do período com a 2ª
// ------------------------------------------------------
export const VARIACAO_MINIMA_TENDENCIA = 0.3;

export function calcularTendencia(notasEmOrdemCronologica) {
  if (notasEmOrdemCronologica.length < 2) return "→ estável";
  const meio = Math.ceil(notasEmOrdemCronologica.length / 2);
  const media = (lista) => lista.reduce((s, v) => s + v, 0) / lista.length;
  const diferenca = media(notasEmOrdemCronologica.slice(meio)) - media(notasEmOrdemCronologica.slice(0, meio));
  if (diferenca > VARIACAO_MINIMA_TENDENCIA) return "↑ subindo";
  if (diferenca < -VARIACAO_MINIMA_TENDENCIA) return "↓ atenção";
  return "→ estável";
}

// ------------------------------------------------------
// Progressão de categoria (Atletas / Dashboard)
// ------------------------------------------------------
export const NIVEL_MAXIMO = 9; // nível dentro da categoria em que o atleta fica "pronto pra subir"
export const NIVEL_INICIAL = 1; // nível ao entrar numa categoria nova

export const PROXIMA_CATEGORIA = {
  "Sub-9": "Sub-11",
  "Sub-11": "Sub-13",
  "Sub-13": "Sub-15",
  "Sub-15": "Sub-17",
  "Sub-17": "Sub-20",
};

export function estaProntoParaEvoluir(nivelAtual, categoriaAtual) {
  return nivelAtual >= NIVEL_MAXIMO && Boolean(PROXIMA_CATEGORIA[categoriaAtual]);
}

// ------------------------------------------------------
// Geometria do radar — usada por Dashboard/Relatórios/Comparativos pra
// desenhar o pentágono a partir das médias dos pilares (escala 0-10).
// ------------------------------------------------------
export function pontoRadar(valor, indice, { centro = 120, raio = 100 } = {}) {
  const angulo = ((-90 + indice * 72) * Math.PI) / 180;
  const r = (Math.min(10, Math.max(0, valor)) / 10) * raio;
  const x = centro + r * Math.cos(angulo);
  const y = centro + r * Math.sin(angulo);
  return `${x.toFixed(1)},${y.toFixed(1)}`;
}

export function pontosRadarPilares(medias, opcoes) {
  return PILARES_RADAR.map((campo, i) => pontoRadar(medias[campo] || 0, i, opcoes)).join(" ");
}

// Pontos do gráfico de linha "Evolução" (nota geral ao longo do tempo).
// Recebe avaliações já ordenadas por data crescente. Retorna
// [{x, y, data}, ...] pra quem chamar poder montar tanto o `points` do
// <polyline> quanto os rótulos de data embaixo do gráfico.
export function pontosEvolucao(avaliacoesOrdenadas, { xMin = 10, xMax = 270, yTop = 20, yBottom = 110 } = {}) {
  const n = avaliacoesOrdenadas.length;
  if (n === 0) return [];
  return avaliacoesOrdenadas.map((avaliacao, i) => {
    const x = n === 1 ? xMin : xMin + (i / (n - 1)) * (xMax - xMin);
    const y = yBottom - (Math.min(10, Math.max(0, avaliacao.geral)) / 10) * (yBottom - yTop);
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)), data: avaliacao.data };
  });
}

// ------------------------------------------------------
// ⚠️ DEPRECIADO (2026-09-01) — substituído pelo pilar "Técnico" universal em
// PILARES_100 acima (mesmas subcategorias pra qualquer posição). Continua
// aqui só até a Fase 2 trocar o formulário de avaliacoes.html/js — depois
// disso, remover tudo daqui até o fim do arquivo. Não usar em código novo.
// ------------------------------------------------------
// Fundamentos técnicos por posição — usados pra calcular o pilar "Técnico"
// a partir de notas de 1 a 10 em cada fundamento, em vez de uma nota única.
//
// ⚠️ STATUS DESTE BLOCO (27/08/2026):
// - "Volante" e "Atacante" vieram de conversas do Rafael com o sócio — pesos
//   reais confirmados, cada um somando exatamente 100.
// - "Meio de campo" (usado hoje só por "Meia") veio de uma conversa anterior
//   do Rafael com o sócio (ChatGPT) — os pesos somam 93 (não 100); a função
//   calcularNotaTecnica() normaliza pela soma dos pesos, então isso não
//   quebra a conta, mas vale conferir com o sócio se não faltou um
//   fundamento. Agora que "Volante" e "Atacante" têm peso próprio
//   confirmado, esse conjunto "Meio de campo" ficou sendo só o rascunho de
//   "Meia".
// - Goleiro, Zagueiro e Lateral AINDA NÃO foram combinados com o sócio —
//   são um ponto de partida razoável que eu (Claude) montei, só pra existir
//   uma estrutura pra revisar. Tratar como rascunho até vir confirmação
//   real, igual foi feito com Volante, Atacante e Meio de campo.
// - Já ESTÁ ligado na tela de Avaliações (formulário por fundamento, nota
//   final calculada, melhor fundamento e ponto a melhorar) — funciona pra
//   qualquer posição aqui em baixo, rascunho ou confirmada. Os indicadores
//   extras (Inteligência Defensiva, Capacidade de Ataque, Poder de
//   Finalização, mais abaixo) ainda NÃO aparecem em nenhuma tela.
//
// As chaves de posição usam exatamente os mesmos textos do <select> de
// posição em atletas.html (Goleiro/Zagueiro/Lateral/Volante/Meia/Atacante).
// ------------------------------------------------------

// Confirmado com o sócio (26/08/2026) — pesos somam 100.
const FUNDAMENTOS_VOLANTE = {
  posicionamento: { label: "Posicionamento", peso: 16 },
  interceptacao: { label: "Interceptação", peso: 15 },
  desarme: { label: "Desarme", peso: 13 },
  desarmeAntecipado: { label: "Desarme antecipado", peso: 12 },
  marcacao: { label: "Marcação", peso: 10 },
  passe: { label: "Passe", peso: 10 },
  leituraDeJogo: { label: "Leitura de jogo", peso: 8 },
  condicionamentoFisico: { label: "Condicionamento físico", peso: 7 },
  controleOrientado: { label: "Controle orientado", peso: 4 },
  peNaoDominante: { label: "Pé não dominante", peso: 3 },
  conducao: { label: "Condução", peso: 2 },
};

// Rascunho — conversa anterior com o sócio, pesos somam 93 (ver status acima).
const FUNDAMENTOS_MEIO_DE_CAMPO = {
  interceptacao: { label: "Interceptação", peso: 18 },
  posicionamento: { label: "Posicionamento", peso: 18 },
  desarme: { label: "Desarme", peso: 15 },
  dueloAereo: { label: "Cabeceio / duelo aéreo", peso: 10 },
  marcacao: { label: "Marcação", peso: 10 },
  saidaDeBola: { label: "Saída de bola", peso: 8 },
  peNaoDominante: { label: "Pé não dominante", peso: 5 },
  dominioOrientado: { label: "Domínio / controle orientado", peso: 5 },
  conducao: { label: "Condução", peso: 4 },
  // soma = 93 — confirmar com o sócio se não falta um fundamento (ex: passe curto/longo).
};

// Rascunhos meus (Claude), sem validação do sócio ainda — pesos somam 100 cada.
const FUNDAMENTOS_GOLEIRO = {
  defesa: { label: "Defesa / reflexo", peso: 20 },
  posicionamento: { label: "Posicionamento", peso: 18 },
  jogoAereo: { label: "Saída no jogo aéreo", peso: 12 },
  saidaDeBolaComPe: { label: "Saída de bola com os pés", peso: 15 },
  reposicao: { label: "Reposição / lançamento", peso: 10 },
  umContraUm: { label: "Um contra um", peso: 10 },
  dominioOrientado: { label: "Domínio / controle orientado", peso: 8 },
  comunicacao: { label: "Comunicação com a defesa", peso: 7 },
};

const FUNDAMENTOS_ZAGUEIRO = {
  posicionamento: { label: "Posicionamento", peso: 20 },
  interceptacao: { label: "Interceptação", peso: 18 },
  desarme: { label: "Desarme", peso: 18 },
  dueloAereo: { label: "Cabeceio / duelo aéreo", peso: 15 },
  marcacao: { label: "Marcação", peso: 12 },
  saidaDeBola: { label: "Saída de bola", peso: 10 },
  peNaoDominante: { label: "Pé não dominante", peso: 4 },
  conducao: { label: "Condução", peso: 3 },
};

const FUNDAMENTOS_LATERAL = {
  marcacao: { label: "Marcação", peso: 15 },
  posicionamentoDefensivo: { label: "Posicionamento defensivo", peso: 15 },
  recomposicao: { label: "Velocidade de recomposição", peso: 12 },
  cruzamento: { label: "Cruzamento", peso: 12 },
  desarme: { label: "Desarme", peso: 10 },
  apoioOfensivo: { label: "Apoio ofensivo (overlap)", peso: 12 },
  dominioOrientado: { label: "Domínio / controle orientado", peso: 10 },
  peNaoDominante: { label: "Pé não dominante", peso: 8 },
  conducao: { label: "Condução", peso: 6 },
};

// Confirmado com o sócio (27/08/2026) — pesos somam 100.
const FUNDAMENTOS_ATACANTE = {
  finalizacao: { label: "Finalização", peso: 20 },
  explosaoNaCorrida: { label: "Explosão na corrida", peso: 15 },
  profundidade: { label: "Profundidade / ataque ao espaço", peso: 14 },
  posicionamentoOfensivo: { label: "Posicionamento ofensivo", peso: 14 },
  drible: { label: "Drible", peso: 10 },
  cabeceio: { label: "Cabeceio", peso: 10 },
  controleOrientado: { label: "Domínio / controle orientado", peso: 6 },
  peNaoDominante: { label: "Uso do pé não dominante", peso: 5 },
  conducaoComVelocidade: { label: "Condução com velocidade", peso: 4 },
  leituraDeJogada: { label: "Leitura de jogada", peso: 2 },
};

export const FUNDAMENTOS_POR_POSICAO = {
  Goleiro: FUNDAMENTOS_GOLEIRO,
  Zagueiro: FUNDAMENTOS_ZAGUEIRO,
  Lateral: FUNDAMENTOS_LATERAL,
  Volante: FUNDAMENTOS_VOLANTE,
  Meia: FUNDAMENTOS_MEIO_DE_CAMPO,
  Atacante: FUNDAMENTOS_ATACANTE,
};

// notasFundamentos: { chaveDoFundamento: nota (1 a 10), ... }
export function calcularNotaTecnica(posicao, notasFundamentos) {
  const fundamentos = FUNDAMENTOS_POR_POSICAO[posicao];
  if (!fundamentos) return null;

  const chaves = Object.keys(fundamentos);
  const somaPesos = chaves.reduce((soma, chave) => soma + fundamentos[chave].peso, 0);
  const soma = chaves.reduce((total, chave) => total + (notasFundamentos[chave] || 0) * fundamentos[chave].peso, 0);
  return Math.round((soma / somaPesos) * 10) / 10;
}

// Retorna { melhor: {chave,label,nota}, piorAMelhorar: {chave,label,nota}, ranking: [...] }
// ranking vem do maior pro menor.
export function analisarFundamentos(posicao, notasFundamentos) {
  const fundamentos = FUNDAMENTOS_POR_POSICAO[posicao];
  if (!fundamentos) return null;

  const ranking = Object.keys(fundamentos)
    .map((chave) => ({ chave, label: fundamentos[chave].label, nota: notasFundamentos[chave] || 0 }))
    .sort((a, b) => b.nota - a.nota);

  return {
    ranking,
    melhor: ranking[0] || null,
    piorAMelhorar: ranking[ranking.length - 1] || null,
  };
}

// ------------------------------------------------------
// Indicadores combinados — cada um pega um subconjunto dos fundamentos de
// uma posição e recalcula a média ponderada só entre eles (mantendo a
// proporção de importância que já têm na nota geral daquela posição), pra
// dar uma nota 0-10 de uma característica específica do atleta.
// ------------------------------------------------------
function calcularMediaPonderada(pesos, notasFundamentos) {
  const chaves = Object.keys(pesos);
  const somaPesos = chaves.reduce((soma, chave) => soma + pesos[chave], 0);
  const soma = chaves.reduce((total, chave) => total + (notasFundamentos[chave] || 0) * pesos[chave], 0);
  return Math.round((soma / somaPesos) * 10) / 10;
}

// "Inteligência defensiva" (Volante) — posicionamento, interceptação,
// desarme antecipado e leitura de jogo. O sócio pediu pra "combinar" esses
// 4 sem especificar peso relativo entre eles, então usei os pesos originais
// de cada um (16/15/12/8) do conjunto do Volante.
const PESOS_INTELIGENCIA_DEFENSIVA = {
  posicionamento: 16,
  interceptacao: 15,
  desarmeAntecipado: 12,
  leituraDeJogo: 8,
};
export function calcularInteligenciaDefensiva(notasFundamentos) {
  return calcularMediaPonderada(PESOS_INTELIGENCIA_DEFENSIVA, notasFundamentos);
}

// "Capacidade de Ataque" (Atacante) — explosão na corrida, profundidade/
// ataque ao espaço, posicionamento ofensivo e leitura de jogada. Pesos
// originais do conjunto do Atacante (15/14/14/2).
const PESOS_CAPACIDADE_DE_ATAQUE = {
  explosaoNaCorrida: 15,
  profundidade: 14,
  posicionamentoOfensivo: 14,
  leituraDeJogada: 2,
};
export function calcularCapacidadeDeAtaque(notasFundamentos) {
  return calcularMediaPonderada(PESOS_CAPACIDADE_DE_ATAQUE, notasFundamentos);
}

// "Poder de Finalização" (Atacante) — finalização, cabeceio e uso do pé não
// dominante. Pesos originais do conjunto do Atacante (20/10/5).
const PESOS_PODER_DE_FINALIZACAO = {
  finalizacao: 20,
  cabeceio: 10,
  peNaoDominante: 5,
};
export function calcularPoderDeFinalizacao(notasFundamentos) {
  return calcularMediaPonderada(PESOS_PODER_DE_FINALIZACAO, notasFundamentos);
}
