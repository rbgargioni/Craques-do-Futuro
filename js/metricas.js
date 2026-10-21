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

// ------------------------------------------------------
// Sistema de avaliação — 5 Pilares / 23 atributos / nota 0 a 10 (2026-10-21)
//
// Substitui o sistema anterior de 46 subcategorias com pesos que somavam 100
// pontos (2026-09-01). Estrutura enviada pelo Rafael pra simplificar a
// avaliação do professor: no máximo 5 atributos por pilar (Mental e
// Comportamental tem só 3), todos universais (mesmos pra qualquer posição) e
// cada um com nota 0-10. NÃO criar atributos extras dentro dos pilares.
//
// Regra de cálculo (o avaliador NUNCA digita peso, só nota de 0 a 10):
//   média do pilar = soma das notas dos atributos ÷ quantidade de atributos
//   nota geral     = Σ (média do pilar × peso do pilar ÷ 100) → 0 a 10
// ------------------------------------------------------
export const PILARES_100 = {
  fisico: {
    label: "Físico",
    peso: 20,
    subcategorias: {
      velocidadeArranque: { label: "Velocidade e Arranque", descricao: "Velocidade de corrida e capacidade de acelerar rapidamente." },
      agilidadeCoordenacao: { label: "Agilidade e Coordenação", descricao: "Mudanças de direção, equilíbrio corporal e coordenação dos movimentos." },
      forcaEquilibrio: { label: "Força e Equilíbrio", descricao: "Força física, estabilidade e capacidade de disputar jogadas." },
      resistencia: { label: "Resistência", descricao: "Capacidade de manter um bom rendimento durante toda a atividade." },
      mobilidadeCondicionamento: { label: "Mobilidade e Condicionamento", descricao: "Mobilidade corporal, flexibilidade e condição física geral." },
    },
  },
  tecnico: {
    label: "Técnico",
    peso: 30,
    subcategorias: {
      dominioControle: { label: "Domínio e Controle", descricao: "Primeiro toque, domínio da bola e controle orientado." },
      passe: { label: "Passe", descricao: "Precisão, força e qualidade na execução dos passes." },
      conducaoDrible: { label: "Condução e Drible", descricao: "Condução da bola, habilidade individual e capacidade de superar adversários." },
      finalizacao: { label: "Finalização", descricao: "Qualidade dos chutes, precisão e capacidade de finalizar as jogadas." },
      fundamentosEspecificos: { label: "Fundamentos Específicos", descricao: "Cabeceio, cruzamento, uso do pé não dominante e outros fundamentos importantes para a posição." },
    },
  },
  tatico: {
    label: "Tático",
    peso: 20,
    subcategorias: {
      posicionamento: { label: "Posicionamento", descricao: "Ocupação correta dos espaços de acordo com a função do atleta." },
      leituraDeJogo: { label: "Leitura de Jogo", descricao: "Capacidade de perceber, antecipar e entender o que acontece durante a partida." },
      tomadaDeDecisao: { label: "Tomada de Decisão", descricao: "Escolha da melhor ação diante de cada situação." },
      movimentacao: { label: "Movimentação", descricao: "Movimentação com e sem bola, criação de espaços e apoio aos companheiros." },
      comportamentoColetivo: { label: "Comportamento Coletivo", descricao: "Participação na organização da equipe, marcação, cobertura e transições." },
    },
  },
  // Só 3 atributos, de propósito — não adicionar outros aqui.
  mental: {
    label: "Mental e Comportamental",
    peso: 20,
    subcategorias: {
      controleEmocionalPressao: { label: "Controle Emocional e Pressão", descricao: "Concentração, controle das emoções e reação diante de erros ou situações difíceis." },
      disciplinaCompreensao: { label: "Disciplina e Compreensão", descricao: "Capacidade de compreender orientações, respeitar regras e executar os comandos recebidos." },
      comprometimentoEquipe: { label: "Comprometimento e Equipe", descricao: "Dedicação, responsabilidade, respeito e capacidade de trabalhar em equipe." },
    },
  },
  // A chave continua "potencial" (e o campo espelho "evolucao") pra não
  // migrar avaliações já salvas — só o rótulo visível mudou.
  potencial: {
    label: "Evolução e Potencial",
    peso: 10,
    subcategorias: {
      capacidadeAprendizagem: { label: "Capacidade de Aprendizagem", descricao: "Facilidade para aprender novos fundamentos, conceitos e movimentos." },
      evolucao: { label: "Evolução", descricao: "Desenvolvimento apresentado pelo atleta ao longo do tempo." },
      potencialTecnico: { label: "Potencial Técnico", descricao: "Possibilidade de desenvolver ainda mais suas habilidades técnicas." },
      potencialFisicoTatico: { label: "Potencial Físico e Tático", descricao: "Possibilidade de evolução nas capacidades físicas e na compreensão do jogo." },
      adaptabilidade: { label: "Adaptabilidade", descricao: "Capacidade de se adaptar a novas funções, posições e situações de jogo." },
    },
  },
};

// Todo pilar fecha em nota 0-10 (média dos atributos), e a nota geral
// também — por isso `max` de cada pilar em pontuacaoPorPilar é sempre 10.
export const NOTA_MAXIMA_AVALIACAO = 10;

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

// Trava a nota em 0-10 antes de calcular, pra um valor inválido nunca
// estourar a média do pilar.
function travarNota(nota) {
  return Math.min(NOTA_MAXIMA_SUBCATEGORIA, Math.max(NOTA_MINIMA_SUBCATEGORIA, nota || 0));
}

// notasPilar: { chaveDoAtributo: nota de 0 a 10, ... }
// Retorna { pontos, max } — "pontos" é a MÉDIA do pilar (0-10) e max é sempre 10.
export function calcularPontuacaoPilar(pilarChave, notasPilar) {
  const pilar = PILARES_100[pilarChave];
  if (!pilar) return null;
  const chaves = Object.keys(pilar.subcategorias);
  const soma = chaves.reduce((total, chave) => total + travarNota((notasPilar || {})[chave]), 0);
  return { pontos: Math.round((soma / chaves.length) * 100) / 100, max: NOTA_MAXIMA_AVALIACAO };
}

// notasPorPilar: { fisico: {chave: nota, ...}, tecnico: {...}, tatico: {...}, mental: {...}, potencial: {...} }
// Retorna { porPilar: {fisico: {pontos,max}, ...}, notaFinal } — notaFinal de 0 a 10,
// média dos pilares ponderada pelo `peso` de cada um (30/20/20/20/10).
export function calcularAvaliacaoCompleta(notasPorPilar) {
  const porPilar = {};
  let notaFinal = 0;
  ORDEM_PILARES_100.forEach((chave) => {
    const resultado = calcularPontuacaoPilar(chave, (notasPorPilar || {})[chave]);
    porPilar[chave] = resultado;
    notaFinal += (resultado.pontos * PILARES_100[chave].peso) / 100;
  });
  return { porPilar, notaFinal: Math.round(notaFinal * 100) / 100 };
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
