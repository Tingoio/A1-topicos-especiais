// retreinamento.js — upload da nova base, configuração do modelo, treino simulado e métricas.

// Para treinar, o arquivo precisa das entradas + os valores reais dos dois alvos
const COLUNAS_TREINO = [...COLUNAS_ENTRADA, COL.autonomia, COL.cafv];

// Quantidade de registros usados no gráfico de reais vs. previstos
const TAMANHO_AMOSTRA = 300;

// Linhas válidas do CSV enviado
let linhasDoArquivo = [];

// Valida e lê o arquivo assim que ele é selecionado
function aoSelecionarArquivo(evento) {
  const arquivo = evento.target.files[0];
  linhasDoArquivo = [];
  document.getElementById('botao-treinar').disabled = true;

  if (!arquivo) return;

  if (!arquivoDentroDoLimite(arquivo)) {
    mostrarMensagem('mensagem-upload', 'O arquivo excede o limite de ' + MAX_UPLOAD_MB + ' MB.', 'erro');
    return;
  }

  mostrarMensagem('mensagem-upload', 'Lendo arquivo...', 'info');
  lerCsv(arquivo, (linhas, colunas) => {
    const faltando = colunasFaltando(colunas, COLUNAS_TREINO);
    if (faltando.length > 0) {
      mostrarMensagem('mensagem-upload', 'Colunas obrigatórias ausentes: ' + faltando.join(', '), 'erro');
      return;
    }

    // Electric Range = 0 significa "não pesquisado", então essas linhas não servem para treino
    linhasDoArquivo = linhas.filter((linha) => Number(linha[COL.autonomia]) > 0);
    document.getElementById('botao-treinar').disabled = false;
    mostrarMensagem('mensagem-upload', 'Arquivo válido: ' + linhasDoArquivo.length.toLocaleString('pt-BR') +
      ' registros com autonomia pesquisada (de ' + linhas.length.toLocaleString('pt-BR') + ').', 'sucesso');
  });
}

// Mostra apenas os parâmetros do modelo escolhido
function mostrarParametros() {
  const modelo = document.getElementById('modelo').value;
  document.getElementById('descricao-modelo').textContent = MODELOS[modelo].descricao;
  document.getElementById('campo-max-depth').hidden = modelo === 'linear';
  document.getElementById('campo-n-estimators').hidden = modelo !== 'floresta';
  document.getElementById('sem-parametros').hidden = modelo !== 'linear';
}

// Lê os parâmetros preenchidos na tela
function lerParametros(modelo) {
  const parametros = {};
  if (modelo !== 'linear') parametros.max_depth = Number(document.getElementById('max-depth').value);
  if (modelo === 'floresta') parametros.n_estimators = Number(document.getElementById('n-estimators').value);
  return parametros;
}

// Taxa de erro simulada: Random Forest erra menos, árvores mais profundas erram menos
function erroSimulado(modelo, parametros) {
  if (modelo === 'linear') return 0.35;
  if (modelo === 'arvore') return Math.max(0.1, 0.4 - parametros.max_depth * 0.03);
  return Math.max(0.05, 0.3 - parametros.max_depth * 0.02 - parametros.n_estimators / 1000);
}

// TODO: trocar pela chamada ao backend
// Treino SIMULADO: gera previsões "com erro" a partir dos valores reais de uma amostra.
function treinarSimulado(linhas, alvo, modelo, parametros) {
  const amostra = linhas.slice(0, TAMANHO_AMOSTRA);
  const erro = erroSimulado(modelo, parametros);

  if (alvo === 'autonomia') {
    const reais = amostra.map((linha) => Number(linha[COL.autonomia]));
    const previstos = reais.map((real) => Math.round(real * (1 + (Math.random() * 2 - 1) * erro)));
    return { reais, previstos };
  }

  const reais = amostra.map((linha) => nomeCafv(linha[COL.cafv]));
  const previstos = reais.map((real) => {
    if (Math.random() > erro) return real;
    return real === 'Elegível' ? 'Não elegível' : 'Elegível';
  });
  return { reais, previstos };
}

// Calcula MAE, RMSE e R² a partir dos valores reais e previstos
function metricasRegressao(reais, previstos) {
  const n = reais.length;
  const media = reais.reduce((soma, valor) => soma + valor, 0) / n;

  let somaErroAbsoluto = 0;
  let somaErroQuadrado = 0;
  let somaVariancia = 0;
  reais.forEach((real, i) => {
    const diferenca = real - previstos[i];
    somaErroAbsoluto += Math.abs(diferenca);
    somaErroQuadrado += diferenca * diferenca;
    somaVariancia += (real - media) * (real - media);
  });

  return {
    mae: somaErroAbsoluto / n,
    rmse: Math.sqrt(somaErroQuadrado / n),
    r2: 1 - somaErroQuadrado / somaVariancia
  };
}

// Para o CAFV (classificação) a métrica é a acurácia: % de acertos
function metricasClassificacao(reais, previstos) {
  const acertos = reais.filter((real, i) => real === previstos[i]).length;
  return { acuracia: acertos / reais.length };
}

// Escreve as métricas nos cards
function mostrarMetricas(metricas) {
  const cards = document.getElementById('metricas');
  if (metricas.acuracia !== undefined) {
    cards.innerHTML = '<div class="card"><span>Acurácia</span><strong>' + (metricas.acuracia * 100).toFixed(1) + '%</strong></div>';
    return;
  }
  cards.innerHTML =
    '<div class="card"><span>MAE</span><strong>' + metricas.mae.toFixed(2) + '</strong></div>' +
    '<div class="card"><span>RMSE</span><strong>' + metricas.rmse.toFixed(2) + '</strong></div>' +
    '<div class="card"><span>R²</span><strong>' + metricas.r2.toFixed(3) + '</strong></div>';
}

// Gráfico de valores reais vs. previstos
function graficoReaisVsPrevistos(resultado, alvo) {
  if (alvo === 'autonomia') {
    // Dispersão: quanto mais perto da diagonal, melhor a previsão
    const pontos = resultado.reais.map((real, i) => ({ x: real, y: resultado.previstos[i] }));
    desenharGrafico('grafico-reais-previstos', {
      type: 'scatter',
      data: { datasets: [{ label: 'Veículos', data: pontos, backgroundColor: '#2563eb' }] },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { title: { display: true, text: 'Autonomia real' } },
          y: { title: { display: true, text: 'Autonomia prevista' } }
        }
      }
    });
    return;
  }

  // CAFV: compara a quantidade real e prevista de cada classe
  const reais = contarValores(resultado.reais);
  const previstos = contarValores(resultado.previstos);
  const classes = ['Elegível', 'Não elegível'];
  desenharGrafico('grafico-reais-previstos', {
    type: 'bar',
    data: {
      labels: classes,
      datasets: [
        { label: 'Real', data: classes.map((c) => reais[c] || 0), backgroundColor: '#16a34a' },
        { label: 'Previsto', data: classes.map((c) => previstos[c] || 0), backgroundColor: '#2563eb' }
      ]
    }
  });
}

// Métrica principal de cada alvo (usada nos gráficos de comparação)
function metricaPrincipal(treino) {
  return treino.alvo === 'autonomia' ? treino.metricas.r2 : treino.metricas.acuracia;
}

// Compara o último treino de cada modelo para o alvo atual
function graficoComparacaoModelos(historico, alvo) {
  const treinosDoAlvo = historico.filter((treino) => treino.alvo === alvo);
  const chaves = Object.keys(MODELOS);
  const valores = chaves.map((chave) => {
    const treinos = treinosDoAlvo.filter((treino) => treino.modelo === chave);
    return treinos.length > 0 ? metricaPrincipal(treinos[treinos.length - 1]) : 0;
  });

  desenharGrafico('grafico-comparacao', {
    type: 'bar',
    data: {
      labels: chaves.map((chave) => MODELOS[chave].nome),
      datasets: [{ label: alvo === 'autonomia' ? 'R²' : 'Acurácia', data: valores, backgroundColor: '#9333ea' }]
    },
    options: { scales: { y: { min: 0, max: 1 } } }
  });
}

// Mostra como as métricas mudaram ao longo dos treinamentos do alvo atual
function graficoEvolucao(historico, alvo) {
  const treinos = historico.filter((treino) => treino.alvo === alvo);
  const rotulos = treinos.map((treino, i) => '#' + (i + 1) + ' ' + MODELOS[treino.modelo].nome);

  let datasets;
  if (alvo === 'autonomia') {
    datasets = [
      { label: 'MAE', data: treinos.map((t) => t.metricas.mae), borderColor: '#dc2626', yAxisID: 'y' },
      { label: 'RMSE', data: treinos.map((t) => t.metricas.rmse), borderColor: '#f59e0b', yAxisID: 'y' },
      { label: 'R²', data: treinos.map((t) => t.metricas.r2), borderColor: '#2563eb', yAxisID: 'y1' }
    ];
  } else {
    datasets = [{ label: 'Acurácia', data: treinos.map((t) => t.metricas.acuracia), borderColor: '#2563eb', yAxisID: 'y1' }];
  }

  desenharGrafico('grafico-evolucao', {
    type: 'line',
    data: { labels: rotulos, datasets },
    options: {
      scales: {
        y: { position: 'left', title: { display: true, text: 'Erro (milhas)' }, display: alvo === 'autonomia' },
        y1: { position: 'right', min: 0, max: 1 }
      }
    }
  });
}

// Executa o treino, salva no histórico e atualiza a tela
function treinar() {
  const alvo = document.getElementById('alvo').value;
  const modelo = document.getElementById('modelo').value;
  const parametros = lerParametros(modelo);

  const resultado = treinarSimulado(linhasDoArquivo, alvo, modelo, parametros);
  const metricas = alvo === 'autonomia'
    ? metricasRegressao(resultado.reais, resultado.previstos)
    : metricasClassificacao(resultado.reais, resultado.previstos);

  const historico = carregarHistorico();
  historico.push({ data: new Date().toLocaleString('pt-BR'), alvo, modelo, parametros, metricas });
  salvarHistorico(historico);

  mostrarMetricas(metricas);
  graficoReaisVsPrevistos(resultado, alvo);
  graficoComparacaoModelos(historico, alvo);
  graficoEvolucao(historico, alvo);

  document.getElementById('resultados').hidden = false;
  mostrarMensagem('mensagem-treino', 'Novo modelo (' + MODELOS[modelo].nome + ' - ' + ALVOS[alvo] +
    ') treinado e disponível na tela de Previsões.', 'sucesso');
}

document.getElementById('arquivo').addEventListener('change', aoSelecionarArquivo);
document.getElementById('modelo').addEventListener('change', mostrarParametros);
document.getElementById('botao-treinar').addEventListener('click', treinar);
mostrarParametros();
