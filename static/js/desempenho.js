// Gráficos do teste de 20%: erro da autonomia e acerto do CAFV.

const COR_LINEAR = '#2563eb';
const COR_ARVORE = '#16a34a';

function mostrarDesempenho() {
  const autonomia = explicacoes && explicacoes.autonomia;
  const cafv = explicacoes && explicacoes.cafv;
  if (!autonomia || !autonomia.linear.desempenho) return;
  document.getElementById('desempenho').hidden = false;
  graficoDeErro(autonomia);
  graficoDeProximidade(autonomia);
  graficoDispersao('linear', autonomia.linear.desempenho, COR_LINEAR);
  graficoDispersao('arvore', autonomia.arvore.desempenho, COR_ARVORE);
  graficoDeAcerto(cafv);
  desenharMatriz('linear', cafv.linear.desempenho);
  desenharMatriz('arvore', cafv.arvore.desempenho);
}

function graficoDeErro(autonomia) {
  const linear = autonomia.linear.desempenho;
  const arvore = autonomia.arvore.desempenho;
  document.getElementById('texto-erro-autonomia').textContent =
    'Modelo linear: MAE ' + milhas(linear.mae) + ' e RMSE ' + milhas(linear.rmse) +
    '. Árvore: MAE ' + milhas(arvore.mae) + ' e RMSE ' + milhas(arvore.rmse) + '.';
  desenharGrafico('grafico-erro-autonomia', {
    type: 'bar',
    data: {
      labels: ['MAE', 'RMSE'],
      datasets: [
        { label: 'Modelo linear', data: [linear.mae, linear.rmse], backgroundColor: COR_LINEAR },
        { label: 'Árvore', data: [arvore.mae, arvore.rmse], backgroundColor: COR_ARVORE }
      ]
    },
    options: opcoesDeBarra('Milhas')
  });
}

function graficoDeProximidade(autonomia) {
  const linear = autonomia.linear.desempenho.proximidade;
  const arvore = autonomia.arvore.desempenho.proximidade;
  document.getElementById('texto-proximidade').textContent =
    'Parcela do teste cuja previsão ficou na milha certa, a até 5 milhas ou a até 10 milhas do valor real.';
  desenharGrafico('grafico-proximidade', {
    type: 'bar',
    data: {
      labels: ['Na milha', 'Até 5 milhas', 'Até 10 milhas'],
      datasets: [
        { label: 'Modelo linear', data: [linear.na_milha, linear.ate_5, linear.ate_10], backgroundColor: COR_LINEAR },
        { label: 'Árvore', data: [arvore.na_milha, arvore.ate_5, arvore.ate_10], backgroundColor: COR_ARVORE }
      ]
    },
    options: opcoesDeBarra('%', 100)
  });
}

function graficoDispersao(modelo, desempenho, cor) {
  const pontos = desempenho.pontos.map((ponto) => ({ x: ponto.real, y: ponto.previsto }));
  document.getElementById('texto-dispersao-' + modelo).textContent = textoDaDispersao(desempenho, pontos.length);
  desenharGrafico('grafico-dispersao-' + modelo, {
    type: 'scatter',
    data: { datasets: [pontosDeTeste(pontos, cor), linhaDeAcerto(desempenho.pontos)] },
    options: opcoesDeDispersao()
  });
}

function graficoDeAcerto(cafv) {
  const linear = cafv.linear.desempenho;
  const arvore = cafv.arvore.desempenho;
  document.getElementById('texto-acerto-cafv').textContent =
    textoDeAcerto('Modelo linear', linear) + '. ' + textoDeAcerto('Árvore', arvore) + '.';
  desenharGrafico('grafico-acerto-cafv', {
    type: 'bar',
    data: {
      labels: ['Modelo linear', 'Árvore'],
      datasets: [{ data: [linear.acuracia, arvore.acuracia], backgroundColor: [COR_LINEAR, COR_ARVORE] }]
    },
    options: opcoesDeBarra('%', 100, false)
  });
}

function textoDeAcerto(nome, desempenho) {
  const resumo = errosDaMatriz(desempenho.matriz);
  return nome + ': ' + porcento(desempenho.acuracia) + ' (' +
    resumo.erros.toLocaleString('pt-BR') + ' erros em ' + resumo.total.toLocaleString('pt-BR') + ')';
}

function errosDaMatriz(matriz) {
  const total = matriz.flat().reduce((soma, valor) => soma + valor, 0);
  const acertos = matriz.reduce((soma, linha, indice) => soma + linha[indice], 0);
  return { total: total, erros: total - acertos };
}

function desenharMatriz(modelo, desempenho) {
  const tabela = document.createElement('table');
  tabela.className = 'matriz';
  tabela.appendChild(cabecalhoDaMatriz(desempenho.classes));
  const maior = maiorDaMatriz(desempenho.matriz);
  desempenho.matriz.forEach((linha, indice) => {
    tabela.appendChild(linhaDaMatriz(desempenho.classes[indice], linha, maior, indice));
  });
  const destino = document.getElementById('matriz-' + modelo);
  destino.replaceChildren(tabela);
}

function cabecalhoDaMatriz(classes) {
  const linha = document.createElement('tr');
  linha.appendChild(celulaTitulo('Real \\ Previsto'));
  classes.forEach((classe) => linha.appendChild(celulaTitulo(classe)));
  const cabecalho = document.createElement('thead');
  cabecalho.appendChild(linha);
  return cabecalho;
}

function linhaDaMatriz(classeReal, valores, maior, indiceLinha) {
  const linha = document.createElement('tr');
  linha.appendChild(celulaTitulo(classeReal));
  valores.forEach((valor, coluna) => {
    linha.appendChild(celulaValor(valor, maior, coluna === indiceLinha));
  });
  return linha;
}

function celulaTitulo(texto) {
  const celula = document.createElement('th');
  celula.textContent = texto;
  return celula;
}

function celulaValor(valor, maior, acerto) {
  const celula = document.createElement('td');
  celula.textContent = Number(valor).toLocaleString('pt-BR');
  celula.style.background = corDaCelula(valor, maior, acerto);
  return celula;
}

function corDaCelula(valor, maior, acerto) {
  const forca = maior === 0 ? 0 : valor / maior;
  if (acerto) return 'rgba(22, 163, 74, ' + (0.18 + forca * 0.72) + ')';
  return 'rgba(220, 38, 38, ' + (0.06 + forca * 0.55) + ')';
}

function maiorDaMatriz(matriz) {
  return Math.max(...matriz.flat());
}

function textoDaDispersao(desempenho, quantidade) {
  return desempenho.n_teste.toLocaleString('pt-BR') + ' veículos no teste. O gráfico mostra ' +
    quantidade.toLocaleString('pt-BR') + ' deles. R² ' + desempenho.r2.toLocaleString('pt-BR') + '.';
}

function pontosDeTeste(pontos, cor) {
  return { label: 'Teste', data: pontos, backgroundColor: cor };
}

function opcoesDeDispersao() {
  return {
    plugins: { legend: { position: 'bottom' } },
    scales: {
      x: { title: { display: true, text: 'Autonomia real (milhas)' } },
      y: { title: { display: true, text: 'Autonomia prevista (milhas)' } }
    }
  };
}
function linhaDeAcerto(pontos) {
  const valores = pontos.flatMap((ponto) => [ponto.real, ponto.previsto]);
  const menor = Math.min(...valores);
  const maior = Math.max(...valores);
  return {
    type: 'line',
    label: 'Previsão igual ao real',
    data: [{ x: menor, y: menor }, { x: maior, y: maior }],
    borderColor: '#6b7280',
    borderDash: [6, 4],
    pointRadius: 0
  };
}

function opcoesDeBarra(unidade, maximo, legenda) {
  const eixo = { beginAtZero: true, title: { display: true, text: unidade } };
  if (maximo) eixo.max = maximo;
  return { plugins: { legend: { display: legenda !== false, position: 'bottom' } }, scales: { y: eixo } };
}

function milhas(valor) {
  return valor.toLocaleString('pt-BR') + ' milhas';
}

function porcento(valor) {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}
