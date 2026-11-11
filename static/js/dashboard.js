// dashboard.js — lê o dataset da pasta data/ e monta indicadores e gráficos.

// O caminho precisa ser absoluto porque o PapaParse baixa o arquivo dentro de um worker
const CAMINHO_DATASET = new URL('data/Electric_Vehicle_Population_Data_20261103.csv', location.href).href;

// Totais acumulados enquanto o arquivo é lido em partes (chunks)
const resumo = {
  total: 0,
  variaveis: 0,
  autonomias: [], // apenas autonomias > 0 (0 significa "não pesquisado")
  fabricantes: {},
  anos: {},
  cafv: { 'Elegível': 0, 'Não elegível': 0, 'Desconhecido': 0 }
};

// Soma uma linha do dataset ao resumo
function contarLinha(linha) {
  resumo.total++;

  const autonomia = Number(linha[COL.autonomia]);
  if (autonomia > 0) {
    resumo.autonomias.push(autonomia);
  }

  const fabricante = linha[COL.fabricante];
  resumo.fabricantes[fabricante] = (resumo.fabricantes[fabricante] || 0) + 1;

  const ano = linha[COL.ano];
  resumo.anos[ano] = (resumo.anos[ano] || 0) + 1;

  resumo.cafv[nomeCafv(linha[COL.cafv])]++;

  acumularCorrelacao(linha, autonomia);
}

// ---------- Correlação das colunas com os alvos ----------

// Colunas comparadas com os alvos. VIN, DOL Vehicle ID e Vehicle Location ficam de fora:
// identificam um único veículo, então não dizem nada sobre outros veículos.
const COLUNAS_CORRELACAO = [
  COL.ano, COL.fabricante, COL.modelo, COL.tipo,
  'County', 'City', 'State', 'Postal Code', 'Legislative District', 'Electric Utility', '2020 GEOID'
];

// Somas guardadas durante a leitura (as linhas não ficam na memória):
// - autonomia: quantidade e soma da autonomia em cada categoria de cada coluna
// - cafv: quantos veículos de cada classe CAFV existem em cada categoria de cada coluna
const correlacao = {
  autonomia: { n: 0, soma: 0, somaQuadrados: 0, grupos: {} },
  cafv: {}
};
COLUNAS_CORRELACAO.forEach((coluna) => {
  correlacao.autonomia.grupos[coluna] = {};
  correlacao.cafv[coluna] = {};
});

function acumularCorrelacao(linha, autonomia) {
  const classeCafv = nomeCafv(linha[COL.cafv]);
  const pesquisada = autonomia > 0; // 0 = autonomia não pesquisada
  if (pesquisada) {
    correlacao.autonomia.n++;
    correlacao.autonomia.soma += autonomia;
    correlacao.autonomia.somaQuadrados += autonomia * autonomia;
  }

  COLUNAS_CORRELACAO.forEach((coluna) => {
    const categoria = linha[coluna] || '(vazio)';

    const contagem = correlacao.cafv[coluna];
    if (!contagem[categoria]) contagem[categoria] = { 'Elegível': 0, 'Não elegível': 0, 'Desconhecido': 0 };
    contagem[categoria][classeCafv]++;

    if (pesquisada) {
      const grupo = correlacao.autonomia.grupos[coluna];
      if (!grupo[categoria]) grupo[categoria] = { n: 0, soma: 0 };
      grupo[categoria].n++;
      grupo[categoria].soma += autonomia;
    }
  });
}

// Razão de correlação (η) entre uma coluna e a autonomia: quanto da variação da autonomia
// é explicada pela categoria do veículo (ex.: saber o modelo explica quase toda a autonomia).
// η² = variação entre as categorias / variação total. A correção desconta o ganho "de graça"
// que colunas com muitas categorias (CEP, cidade) teriam só por terem muitos grupos.
function forcaNaAutonomia(coluna) {
  const { n, soma, somaQuadrados, grupos } = correlacao.autonomia;
  const variacaoTotal = somaQuadrados - (soma * soma) / n;
  let variacaoEntreGrupos = -(soma * soma) / n;
  Object.values(grupos[coluna]).forEach((grupo) => {
    variacaoEntreGrupos += (grupo.soma * grupo.soma) / grupo.n;
  });

  const categorias = Object.keys(grupos[coluna]).length;
  const eta2 = variacaoEntreGrupos / variacaoTotal;
  const eta2Corrigido = 1 - ((1 - eta2) * (n - 1)) / (n - categorias);
  return Math.sqrt(Math.max(0, eta2Corrigido));
}

// V de Cramér entre uma coluna e a classe CAFV, com a correção de Bergsma para muitas categorias.
// Compara a contagem real de cada categoria × classe com a esperada se não houvesse relação (qui-quadrado).
function forcaNoCafv(coluna) {
  const tabela = Object.values(correlacao.cafv[coluna]);
  const classes = ['Elegível', 'Não elegível', 'Desconhecido'];
  const totalPorClasse = {};
  classes.forEach((classe) => {
    totalPorClasse[classe] = tabela.reduce((total, linha) => total + linha[classe], 0);
  });
  const n = classes.reduce((total, classe) => total + totalPorClasse[classe], 0);

  let quiQuadrado = 0;
  tabela.forEach((linha) => {
    const totalDaCategoria = classes.reduce((total, classe) => total + linha[classe], 0);
    classes.forEach((classe) => {
      const esperado = (totalDaCategoria * totalPorClasse[classe]) / n;
      if (esperado > 0) quiQuadrado += ((linha[classe] - esperado) ** 2) / esperado;
    });
  });

  const r = tabela.length;
  const k = classes.filter((classe) => totalPorClasse[classe] > 0).length;
  const phi2 = Math.max(0, quiQuadrado / n - ((k - 1) * (r - 1)) / (n - 1));
  const rCorrigido = r - ((r - 1) ** 2) / (n - 1);
  const kCorrigido = k - ((k - 1) ** 2) / (n - 1);
  const divisor = Math.min(kCorrigido - 1, rCorrigido - 1);
  return divisor > 0 ? Math.sqrt(phi2 / divisor) : 0;
}

// Barras horizontais da maior para a menor força. Em azul, as colunas que o modelo usa como entrada.
function graficoCorrelacao(idCanvas, calcularForca, rotuloEixo) {
  const forcas = COLUNAS_CORRELACAO
    .map((coluna) => ({ coluna, valor: Math.round(calcularForca(coluna) * 1000) / 1000 }))
    .sort((a, b) => b.valor - a.valor);
  const usada = (coluna) => COLUNAS_ENTRADA.includes(coluna);

  // Dois conjuntos (usadas / não usadas) só para a legenda explicar as cores; grouped: false
  // mantém cada barra no centro da sua linha.
  const conjunto = (rotulo, cor, usadaPeloModelo) => ({
    label: rotulo,
    data: forcas.map((item) => (usada(item.coluna) === usadaPeloModelo ? item.valor : null)),
    backgroundColor: cor,
    borderRadius: 4,
    grouped: false
  });

  desenharGrafico(idCanvas, {
    type: 'bar',
    data: {
      labels: forcas.map((item) => item.coluna),
      datasets: [
        conjunto('Usada pelo modelo', '#2563eb', true),
        conjunto('Não usada pelo modelo', '#8b929e', false)
      ]
    },
    options: {
      indexAxis: 'y',
      aspectRatio: 1.3,
      scales: {
        x: { min: 0, max: 1, title: { display: true, text: rotuloEixo } },
        y: { grid: { display: false } }
      },
      plugins: {
        tooltip: {
          filter: (item) => item.raw !== null,
          callbacks: { label: (item) => rotuloEixo + ': ' + item.raw.toLocaleString('pt-BR') }
        }
      }
    }
  });
}

// Preenche os cards de indicadores
function mostrarIndicadores() {
  const soma = resumo.autonomias.reduce((total, valor) => total + valor, 0);
  const media = soma / resumo.autonomias.length;

  document.getElementById('kpi-total').textContent = resumo.total.toLocaleString('pt-BR');
  document.getElementById('kpi-variaveis').textContent = resumo.variaveis;
  document.getElementById('kpi-media').textContent = media.toFixed(1) + ' milhas';
  document.getElementById('kpi-elegiveis').textContent = resumo.cafv['Elegível'].toLocaleString('pt-BR');
  document.getElementById('kpi-nao-elegiveis').textContent = resumo.cafv['Não elegível'].toLocaleString('pt-BR');
  document.getElementById('kpi-desconhecidos').textContent = resumo.cafv['Desconhecido'].toLocaleString('pt-BR');
}

// Gráfico de barras com os 10 maiores fabricantes; o restante vira "Outros"
function graficoFabricantes() {
  const ordenados = Object.entries(resumo.fabricantes).sort((a, b) => b[1] - a[1]);
  const top10 = ordenados.slice(0, 10);
  const outros = ordenados.slice(10).reduce((total, item) => total + item[1], 0);
  top10.push(['Outros', outros]);

  desenharGrafico('grafico-fabricantes', {
    type: 'bar',
    data: {
      labels: top10.map((item) => item[0]),
      datasets: [{ label: 'Veículos', data: top10.map((item) => item[1]), backgroundColor: '#2563eb' }]
    },
    options: { plugins: { legend: { display: false } } }
  });
}

// Histograma da autonomia (sem os valores 0, que não foram pesquisados)
function graficoAutonomia() {
  const faixas = histograma(resumo.autonomias, 25);

  desenharGrafico('grafico-autonomia', {
    type: 'bar',
    data: {
      labels: faixas.rotulos,
      datasets: [{ label: 'Veículos', data: faixas.contagens, backgroundColor: '#16a34a' }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { x: { title: { display: true, text: 'Autonomia (milhas)' } } }
    }
  });
}

// Quantidade de veículos por ano de fabricação
function graficoAnos() {
  const anos = Object.keys(resumo.anos).sort();

  desenharGrafico('grafico-anos', {
    type: 'line',
    data: {
      labels: anos,
      datasets: [{ label: 'Veículos', data: anos.map((ano) => resumo.anos[ano]), borderColor: '#9333ea' }]
    },
    options: { plugins: { legend: { display: false } } }
  });
}

// Distribuição da elegibilidade CAFV
function graficoCafv() {
  desenharGrafico('grafico-cafv', {
    type: 'doughnut',
    data: {
      labels: Object.keys(resumo.cafv),
      datasets: [{ data: Object.values(resumo.cafv), backgroundColor: ['#16a34a', '#dc2626', '#9ca3af'] }]
    },
    options: { aspectRatio: 2 } // deixa a rosca com a mesma altura dos outros gráficos
  });
}

// Chamado quando o arquivo terminou de ser lido
function finalizarLeitura() {
  mostrarIndicadores();
  graficoFabricantes();
  graficoAutonomia();
  graficoAnos();
  graficoCafv();
  graficoCorrelacao('grafico-correlacao-autonomia', forcaNaAutonomia, 'Razão de correlação (η)');
  graficoCorrelacao('grafico-correlacao-cafv', forcaNoCafv, 'V de Cramér');
  document.getElementById('status').style.display = 'none';
}

// Lê o dataset em partes para não guardar as 300 mil linhas na memória
Papa.parse(CAMINHO_DATASET, {
  download: true,
  header: true,
  skipEmptyLines: true,
  worker: true,
  chunk: (parte) => {
    resumo.variaveis = parte.meta.fields.length;
    parte.data.forEach(contarLinha);
  },
  complete: finalizarLeitura,
  error: () => mostrarMensagem('status', 'Não foi possível carregar o dataset. Rode o projeto com "python -m http.server".', 'erro')
});
