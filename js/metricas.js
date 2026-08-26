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
export const PILARES_TABELA = [
  { campo: "tecnico", label: "Técnico" },
  { campo: "tatico", label: "Tático" },
  { campo: "fisico", label: "Físico" },
  { campo: "mental", label: "Mental" },
  { campo: "evolucao", label: "Evolução" },
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

// ------------------------------------------------------
// Fundamentos técnicos por posição — usados pra calcular o pilar "Técnico"
// a partir de notas de 1 a 10 em cada fundamento, em vez de uma nota única.
//
// ⚠️ STATUS DESTE BLOCO (26/08/2026):
// - "Volante" veio de uma conversa do Rafael com o sócio — pesos reais
//   confirmados, somam exatamente 100.
// - "Meio de campo" (usado hoje só por "Meia") veio de uma conversa anterior
//   do Rafael com o sócio (ChatGPT) — os pesos somam 93 (não 100); a função
//   calcularNotaTecnica() normaliza pela soma dos pesos, então isso não
//   quebra a conta, mas vale conferir com o sócio se não faltou um
//   fundamento. Agora que "Volante" tem peso próprio confirmado, esse
//   conjunto "Meio de campo" ficou sendo só o rascunho de "Meia".
// - Goleiro, Zagueiro, Lateral e Atacante AINDA NÃO foram combinados com o
//   sócio — são um ponto de partida razoável que eu (Claude) montei, só
//   pra existir uma estrutura pra revisar. Tratar como rascunho até vir
//   confirmação real, igual foi feito com Volante e Meio de campo.
// - Ainda NÃO está ligado nas telas de Avaliações/Atletas — é só a lógica,
//   isolada aqui, pra vocês avaliarem os números antes de eu mexer na
//   interface (formulário, tela de resultado, ranking de fundamentos).
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

const FUNDAMENTOS_ATACANTE = {
  finalizacao: { label: "Finalização", peso: 22 },
  dominioOrientado: { label: "Domínio / controle orientado", peso: 15 },
  movimentacao: { label: "Movimentação sem bola", peso: 15 },
  drible: { label: "Drible", peso: 12 },
  dueloAereo: { label: "Cabeceio / duelo aéreo", peso: 10 },
  passe: { label: "Passe / assistência", peso: 10 },
  peNaoDominante: { label: "Pé não dominante", peso: 8 },
  conducao: { label: "Condução", peso: 8 },
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
// Indicador de "inteligência defensiva" (Volante) — combina os 4
// fundamentos que mostram quem realmente entende o jogo: posicionamento,
// interceptação, desarme antecipado e leitura de jogo. O sócio pediu pra
// "combinar" esses 4 sem especificar peso relativo entre eles, então usei
// os pesos originais de cada um (16/15/12/8), recalculados só entre esses
// 4 — ou seja, mantém a mesma proporção de importância que eles já têm na
// nota geral do Volante. Ajustar aqui se o sócio preferir outro critério
// (ex: média simples, pesos diferentes).
// ------------------------------------------------------
const PESOS_INTELIGENCIA_DEFENSIVA = {
  posicionamento: 16,
  interceptacao: 15,
  desarmeAntecipado: 12,
  leituraDeJogo: 8,
};

export function calcularInteligenciaDefensiva(notasFundamentos) {
  const chaves = Object.keys(PESOS_INTELIGENCIA_DEFENSIVA);
  const somaPesos = chaves.reduce((soma, chave) => soma + PESOS_INTELIGENCIA_DEFENSIVA[chave], 0);
  const soma = chaves.reduce(
    (total, chave) => total + (notasFundamentos[chave] || 0) * PESOS_INTELIGENCIA_DEFENSIVA[chave],
    0
  );
  return Math.round((soma / somaPesos) * 10) / 10;
}
