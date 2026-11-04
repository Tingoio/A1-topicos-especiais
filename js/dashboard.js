// dashboard.js — lê o dataset da pasta data/ e monta indicadores e gráficos.

// O caminho precisa ser absoluto porque o PapaParse baixa o arquivo dentro de um worker
const CAMINHO_DATASET = new URL('data/veiculos_eletricos.csv', location.href).href;

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
