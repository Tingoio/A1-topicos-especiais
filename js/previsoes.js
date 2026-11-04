// previsoes.js — upload do CSV, escolha de alvo/modelo e exibição das previsões.

// Quantidade máxima de linhas mostradas na tabela (para a página não ficar pesada)
const LINHAS_NA_TABELA = 100;

// Linhas do CSV enviado (ficam vazias até um arquivo válido ser carregado)
let linhasDoArquivo = [];

// Preenche o seletor de modelos: os 3 modelos base + os modelos retreinados
function carregarOpcoesDeModelo() {
  const seletor = document.getElementById('modelo');

  Object.entries(MODELOS).forEach(([chave, modelo]) => {
    seletor.add(new Option(modelo.nome, chave));
  });

  carregarHistorico().forEach((treino) => {
    const texto = 'Retreinado: ' + MODELOS[treino.modelo].nome + ' (' + ALVOS[treino.alvo] + ') - ' + treino.data;
    seletor.add(new Option(texto, treino.modelo));
  });

  mostrarDescricaoDoModelo();
}

// Mostra a descrição do modelo selecionado
function mostrarDescricaoDoModelo() {
  const chave = document.getElementById('modelo').value;
  document.getElementById('descricao-modelo').textContent = MODELOS[chave].descricao;
}

// Valida e lê o arquivo assim que ele é selecionado
function aoSelecionarArquivo(evento) {
  const arquivo = evento.target.files[0];
  linhasDoArquivo = [];
  document.getElementById('botao-prever').disabled = true;

  if (!arquivo) return;

  if (!arquivoDentroDoLimite(arquivo)) {
    mostrarMensagem('mensagem-upload', 'O arquivo excede o limite de ' + MAX_UPLOAD_MB + ' MB.', 'erro');
    return;
  }

  mostrarMensagem('mensagem-upload', 'Lendo arquivo...', 'info');
  lerCsv(arquivo, (linhas, colunas) => {
    const faltando = colunasFaltando(colunas, COLUNAS_ENTRADA);
    if (faltando.length > 0) {
      mostrarMensagem('mensagem-upload', 'Colunas obrigatórias ausentes: ' + faltando.join(', '), 'erro');
      return;
    }

    linhasDoArquivo = linhas;
    document.getElementById('botao-prever').disabled = false;
    mostrarMensagem('mensagem-upload', 'Arquivo válido: ' + linhas.length.toLocaleString('pt-BR') + ' registros.', 'sucesso');
  });
}

// Gera uma autonomia simulada: elétricos puros (BEV) têm autonomia maior que híbridos (PHEV)
function autonomiaSimulada(linha) {
  const ehEletricoPuro = linha[COL.tipo].includes('BEV');
  const valor = ehEletricoPuro ? 150 + Math.random() * 180 : 15 + Math.random() * 40;
  return Math.round(valor);
}

// TODO: trocar pela chamada ao backend
// Previsão SIMULADA: o modelo escolhido ainda não influencia o resultado.
function preverSimulado(linhas, alvo, modelo) {
  return linhas.map((linha) => {
    const autonomia = autonomiaSimulada(linha);
    if (alvo === 'autonomia') return autonomia;
    // Regra do CAFV: autonomia de pelo menos 30 milhas torna o veículo elegível
    return autonomia >= 30 ? 'Elegível' : 'Não elegível';
  });
}

// Monta a tabela com os primeiros veículos e o valor previsto
function mostrarTabela(linhas, previsoes) {
  const corpo = document.getElementById('tabela-corpo');
  corpo.innerHTML = '';

  linhas.slice(0, LINHAS_NA_TABELA).forEach((linha, i) => {
    const tr = document.createElement('tr');
    [linha[COL.fabricante], linha[COL.modelo], linha[COL.ano], linha[COL.tipo], previsoes[i]].forEach((valor) => {
      const td = document.createElement('td');
      td.textContent = valor;
      tr.appendChild(td);
    });
    corpo.appendChild(tr);
  });
}

// Gráfico com a distribuição dos valores previstos
function graficoPrevisoes(previsoes, alvo) {
  let rotulos;
  let contagens;

  if (alvo === 'autonomia') {
    const faixas = histograma(previsoes, 25);
    rotulos = faixas.rotulos;
    contagens = faixas.contagens;
  } else {
    const contagem = contarValores(previsoes);
    rotulos = Object.keys(contagem);
    contagens = Object.values(contagem);
  }

  desenharGrafico('grafico-previsoes', {
    type: 'bar',
    data: { labels: rotulos, datasets: [{ label: 'Veículos', data: contagens, backgroundColor: '#2563eb' }] },
    options: { plugins: { legend: { display: false } } }
  });
}

// Executa a previsão e mostra os resultados
function prever() {
  const alvo = document.getElementById('alvo').value;
  const modelo = document.getElementById('modelo').value;
  const previsoes = preverSimulado(linhasDoArquivo, alvo, modelo);

  document.getElementById('total-processados').textContent = linhasDoArquivo.length.toLocaleString('pt-BR');
  document.getElementById('total-previsoes').textContent = previsoes.length.toLocaleString('pt-BR');
  document.getElementById('coluna-previsao').textContent = ALVOS[alvo] + ' previsto';
  document.getElementById('aviso-tabela').textContent = 'Mostrando até ' + LINHAS_NA_TABELA + ' registros.';

  mostrarTabela(linhasDoArquivo, previsoes);
  graficoPrevisoes(previsoes, alvo);
  document.getElementById('resultados').hidden = false;
}

document.getElementById('arquivo').addEventListener('change', aoSelecionarArquivo);
document.getElementById('modelo').addEventListener('change', mostrarDescricaoDoModelo);
document.getElementById('botao-prever').addEventListener('click', prever);
carregarOpcoesDeModelo();
