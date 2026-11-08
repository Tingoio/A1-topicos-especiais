// arvore.js — árvore de decisão simples (CART de regressão), usada nos gráficos dos modelos da tela de Previsões.
// A árvore é ajustada sobre as PREVISÕES para mostrar quais regras explicam os valores previstos.
// A Random Forest usa a mesma árvore várias vezes para calcular a importância de cada variável.

// Variáveis que a árvore pode usar para dividir os veículos
const VARIAVEIS_ARVORE = [
  { nome: 'Tipo', numerica: false, pegar: (linha) => siglaTipo(linha[COL.tipo] || '') },
  { nome: 'Ano', numerica: true, pegar: (linha) => (linha[COL.ano] ? Number(linha[COL.ano]) : NaN) },
  { nome: 'Fabricante', numerica: false, pegar: (linha) => linha[COL.fabricante] || '' }
];

// Monta uma coluna por variável (mais rápido do que ler as linhas toda hora) + os valores-alvo (y)
function prepararDadosArvore(linhas, valores) {
  return {
    colunas: VARIAVEIS_ARVORE.map((variavel) => linhas.map(variavel.pegar)),
    y: valores
  };
}

// Erro quadrático de um grupo a partir de n, soma e soma dos quadrados: Σ(y - média)²
function erroDoGrupo(grupo) {
  return grupo.n === 0 ? 0 : grupo.quad - (grupo.soma * grupo.soma) / grupo.n;
}

function somarNoGrupo(grupo, valor) {
  grupo.n++;
  grupo.soma += valor;
  grupo.quad += valor * valor;
}

function diferencaDeGrupos(total, parte) {
  return { n: total.n - parte.n, soma: total.soma - parte.soma, quad: total.quad - parte.quad };
}

// Procura a divisão que mais reduz o erro. Testa:
// - variável numérica (Ano): "Ano ≤ limite?" para cada ano existente;
// - variável de categoria (Tipo, Fabricante): "Tipo = BEV?" para cada valor existente.
function melhorDivisao(dados, indices, variaveisPermitidas, minFolha) {
  const total = { n: 0, soma: 0, quad: 0 };
  indices.forEach((i) => somarNoGrupo(total, dados.y[i]));
  const erroPai = erroDoGrupo(total);

  let melhor = null;
  variaveisPermitidas.forEach((v) => {
    const coluna = dados.colunas[v];

    // Soma n, soma e quadrados de cada valor da variável (ex.: cada ano)
    const porValor = new Map();
    indices.forEach((i) => {
      if (!porValor.has(coluna[i])) porValor.set(coluna[i], { n: 0, soma: 0, quad: 0 });
      somarNoGrupo(porValor.get(coluna[i]), dados.y[i]);
    });

    const avaliar = (valor, esquerda) => {
      const direita = diferencaDeGrupos(total, esquerda);
      if (esquerda.n < minFolha || direita.n < minFolha) return;
      const ganho = erroPai - erroDoGrupo(esquerda) - erroDoGrupo(direita);
      if (ganho > 1e-9 && (!melhor || ganho > melhor.ganho)) melhor = { variavel: v, valor, ganho };
    };

    if (VARIAVEIS_ARVORE[v].numerica) {
      // Anos em ordem; a "esquerda" acumula todos os anos até o limite (anos vazios ficam sempre à direita)
      const anos = [...porValor.keys()].filter((ano) => !Number.isNaN(ano)).sort((a, b) => a - b);
      const esquerda = { n: 0, soma: 0, quad: 0 };
      anos.slice(0, -1).forEach((ano) => {
        const grupo = porValor.get(ano);
        esquerda.n += grupo.n;
        esquerda.soma += grupo.soma;
        esquerda.quad += grupo.quad;
        avaliar(ano, { ...esquerda });
      });
    } else {
      porValor.forEach((grupo, valor) => avaliar(valor, grupo));
    }
  });

  return melhor;
}

// true se o veículo i responde "sim" para a regra da divisão
function respondeSim(dados, divisao, i) {
  const valor = dados.colunas[divisao.variavel][i];
  return VARIAVEIS_ARVORE[divisao.variavel].numerica ? valor <= divisao.valor : valor === divisao.valor;
}

// Escolhe aleatoriamente "quantas" variáveis (é o que a Random Forest faz em cada nó)
function sortearVariaveis(quantas) {
  const todas = VARIAVEIS_ARVORE.map((variavel, i) => i);
  for (let i = todas.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [todas[i], todas[j]] = [todas[j], todas[i]];
  }
  return todas.slice(0, quantas);
}

// Constrói a árvore recursivamente. Cada nó guarda quantos veículos tem e a média do alvo.
// importancia[v] acumula quanto erro a variável v ajudou a reduzir.
function construirNo(dados, indices, profundidade, opcoes, importancia) {
  const no = { n: indices.length, media: media(indices.map((i) => dados.y[i])) };
  if (profundidade >= opcoes.profundidadeMaxima || indices.length < 2 * opcoes.minFolha) return no;

  const variaveis = opcoes.variaveisPorNo
    ? sortearVariaveis(opcoes.variaveisPorNo)
    : VARIAVEIS_ARVORE.map((variavel, i) => i);
  const divisao = melhorDivisao(dados, indices, variaveis, opcoes.minFolha);
  if (!divisao) return no;

  importancia[divisao.variavel] += divisao.ganho;
  no.divisao = divisao;
  no.sim = construirNo(dados, indices.filter((i) => respondeSim(dados, divisao, i)), profundidade + 1, opcoes, importancia);
  no.nao = construirNo(dados, indices.filter((i) => !respondeSim(dados, divisao, i)), profundidade + 1, opcoes, importancia);
  return no;
}

// Treina uma árvore de decisão sobre todos os veículos
function treinarArvore(linhas, valores, profundidadeMaxima) {
  const dados = prepararDadosArvore(linhas, valores);
  const indices = linhas.map((linha, i) => i);
  // Cada folha precisa de pelo menos 1% dos veículos (mínimo 5) para não criar regras com pouquíssimos casos
  const minFolha = Math.max(5, Math.round(linhas.length * 0.01));
  const importancia = VARIAVEIS_ARVORE.map(() => 0);
  return construirNo(dados, indices, 0, { profundidadeMaxima, minFolha }, importancia);
}

// Random Forest: treina várias árvores, cada uma com uma amostra sorteada (com reposição) dos veículos
// (bootstrap) e com 2 variáveis sorteadas em cada nó, para que as árvores fiquem diferentes entre si.
function treinarFloresta(linhas, valores, quantidadeArvores, profundidadeMaxima, tamanhoAmostra) {
  const dados = prepararDadosArvore(linhas, valores);
  const tamanho = Math.min(linhas.length, tamanhoAmostra);
  const minFolha = Math.max(5, Math.round(tamanho * 0.01));
  const importancia = VARIAVEIS_ARVORE.map(() => 0);

  const arvores = [];
  for (let arvore = 0; arvore < quantidadeArvores; arvore++) {
    const amostra = Array.from({ length: tamanho }, () => Math.floor(Math.random() * linhas.length));
    arvores.push(construirNo(dados, amostra, 0, { profundidadeMaxima, minFolha, variaveisPorNo: 2 }, importancia));
  }
  return { dados, arvores };
}

// Caminho que o veículo i percorre na árvore, da raiz até a folha (a última posição é a folha)
function caminhoNaArvore(raiz, dados, i) {
  const caminho = [raiz];
  let no = raiz;
  while (no.divisao) {
    no = respondeSim(dados, no.divisao, i) ? no.sim : no.nao;
    caminho.push(no);
  }
  return caminho;
}

// Texto da pergunta de um nó, ex.: "Tipo = BEV?" ou "Ano ≤ 2018?"
function textoDaRegra(divisao) {
  const variavel = VARIAVEIS_ARVORE[divisao.variavel];
  return variavel.nome + (variavel.numerica ? ' ≤ ' : ' = ') + divisao.valor + '?';
}
