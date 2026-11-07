// previsoes.js — upload do CSV, escolha de alvo/modelo e exibição das previsões.

// Quantidade máxima de linhas mostradas na tabela (para a página não ficar pesada)
const LINHAS_NA_TABELA = 100;

// Linhas do CSV enviado (ficam vazias até um arquivo válido ser carregado)
let linhasDoArquivo = [];

// Opções de modelo mostradas nos checkboxes: os 3 modelos base + os modelos retreinados.
// tipo = chave em MODELOS (linear, arvore ou floresta), usada para escolher o gráfico do modelo.
const opcoesDeModelo = [];

// Monta os checkboxes de modelo (o primeiro já vem marcado)
function carregarOpcoesDeModelo() {
  Object.entries(MODELOS).forEach(([chave, modelo]) => {
    opcoesDeModelo.push({ nome: modelo.nome, tipo: chave });
  });

  carregarHistorico().forEach((treino) => {
    const nome = 'Retreinado: ' + MODELOS[treino.modelo].nome + ' (' + ALVOS[treino.alvo] + ') - ' + treino.data;
    opcoesDeModelo.push({ nome, tipo: treino.modelo });
  });

  opcoesDeModelo.forEach((opcao, i) => adicionarCheckbox('modelo', i, opcao.nome, i === 0));
  aoMudarSelecao();
}

// Mostra a descrição de cada modelo marcado (uma linha por tipo de modelo)
function mostrarDescricaoDosModelos() {
  const descricao = document.getElementById('descricao-modelo');
  descricao.innerHTML = '';
  const tipos = new Set(valoresMarcados('modelo').map((indice) => opcoesDeModelo[indice].tipo));
  tipos.forEach((tipo) => {
    const linha = document.createElement('div');
    linha.textContent = MODELOS[tipo].nome + ': ' + MODELOS[tipo].descricao;
    descricao.appendChild(linha);
  });
}

// Valida os checkboxes e libera o botão Prever só com arquivo válido e ao menos uma opção em cada grupo
function aoMudarSelecao() {
  const selecaoValida = validarSelecao(['alvo', 'modelo']);
  mostrarDescricaoDosModelos();
  document.getElementById('botao-prever').disabled = linhasDoArquivo.length === 0 || !selecaoValida;
}

// Valida e lê o arquivo assim que ele é selecionado
function aoSelecionarArquivo(evento) {
  const arquivo = evento.target.files[0];
  linhasDoArquivo = [];
  aoMudarSelecao();

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
    aoMudarSelecao();
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
function mostrarTabela(linhas, previsoes, s) {
  const corpo = document.getElementById('tabela-corpo' + s);
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
function graficoPrevisoes(previsoes, alvo, s) {
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

  desenharGrafico('grafico-previsoes' + s, {
    type: 'bar',
    data: { labels: rotulos, datasets: [{ label: 'Veículos', data: contagens, backgroundColor: '#2563eb' }] },
    options: { plugins: { legend: { display: false } } }
  });
}

// Resume as previsões de um grupo: autonomia média ou % de elegíveis
function resumoDoGrupo(previsoesDoGrupo, alvo) {
  if (alvo === 'autonomia') return arredondar(media(previsoesDoGrupo));
  const elegiveis = previsoesDoGrupo.filter((valor) => valor === 'Elegível').length;
  return arredondar((elegiveis / previsoesDoGrupo.length) * 100);
}

// Texto do eixo Y dos gráficos por grupo
function rotuloDoResumo(alvo) {
  return alvo === 'autonomia' ? 'Autonomia média prevista (milhas)' : '% previsto como elegível';
}

// Desenha um gráfico com o resumo das previsões de cada grupo
function graficoPorGrupo(idCanvas, tipoGrafico, grupos, chaves, alvo) {
  desenharGrafico(idCanvas, {
    type: tipoGrafico,
    data: {
      labels: chaves,
      datasets: [{
        label: rotuloDoResumo(alvo),
        data: chaves.map((chave) => resumoDoGrupo(grupos[chave], alvo)),
        backgroundColor: '#2563eb',
        borderColor: '#2563eb'
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          max: alvo === 'cafv' ? 100 : undefined,
          title: { display: true, text: rotuloDoResumo(alvo) }
        }
      }
    }
  });
}

// Compara as previsões entre elétricos puros (BEV) e híbridos (PHEV)
function graficoPorTipo(linhas, previsoes, alvo, s) {
  const grupos = agruparPor(linhas, previsoes, (linha) => siglaTipo(linha[COL.tipo] || ''));
  graficoPorGrupo('grafico-por-tipo' + s, 'bar', grupos, Object.keys(grupos).sort(), alvo);
}

// Mostra como as previsões variam com o ano de fabricação
function graficoPorAno(linhas, previsoes, alvo, s) {
  const grupos = agruparPor(linhas, previsoes, (linha) => linha[COL.ano]);
  const anos = Object.keys(grupos).sort((a, b) => Number(a) - Number(b));
  graficoPorGrupo('grafico-por-ano' + s, 'line', grupos, anos, alvo);
}

// ---------- Gráfico do modelo escolhido ----------

// Converte as previsões em números: autonomia em milhas; CAFV vira 100 (elegível) ou 0,
// assim a média de um grupo já é a % de elegíveis
function previsoesNumericas(previsoes, alvo) {
  return alvo === 'autonomia' ? previsoes : previsoes.map((valor) => (valor === 'Elegível' ? 100 : 0));
}

// Formata o valor de um grupo: "245.3 milhas" ou "62.5% elegível"
function formatarValor(valor, alvo) {
  return arredondar(valor).toLocaleString('pt-BR') + (alvo === 'autonomia' ? ' milhas' : '% elegível');
}

// Escolhe qual gráfico mostrar de acordo com o modelo
function graficoDoModelo(previsoes, alvo, modelo, s) {
  const valores = previsoesNumericas(previsoes, alvo);
  // A regressão é um gráfico Chart.js (canvas); a árvore e a floresta são diagramas SVG (div #arvore)
  const ehDiagrama = modelo !== 'linear';
  document.getElementById('grafico-modelo' + s).hidden = ehDiagrama;
  document.getElementById('arvore' + s).hidden = !ehDiagrama;

  if (modelo === 'linear') graficoRegressao(linhasDoArquivo, valores, alvo, s);
  else if (modelo === 'arvore') diagramaArvore(linhasDoArquivo, valores, alvo, s);
  else diagramaFloresta(linhasDoArquivo, valores, alvo, s);
}

// Regressão Linear: média prevista por ano + reta ajustada por mínimos quadrados (previsão = a × ano + b)
function graficoRegressao(linhas, valores, alvo, s) {
  const pontos = [];
  linhas.forEach((linha, i) => {
    if (linha[COL.ano]) pontos.push({ x: Number(linha[COL.ano]), y: valores[i] });
  });

  // Calcula as médias primeiro e depois a inclinação (evita erro de arredondamento com anos tão grandes)
  const mediaX = media(pontos.map((p) => p.x));
  const mediaY = media(pontos.map((p) => p.y));
  let covariancia = 0;
  let variancia = 0;
  pontos.forEach((p) => {
    covariancia += (p.x - mediaX) * (p.y - mediaY);
    variancia += (p.x - mediaX) * (p.x - mediaX);
  });
  const a = variancia > 0 ? covariancia / variancia : 0;
  const b = mediaY - a * mediaX;

  const grupos = agruparPor(linhas, valores, (linha) => linha[COL.ano]);
  const anos = Object.keys(grupos).map(Number).sort((x, y) => x - y);
  const unidade = alvo === 'autonomia' ? ' milhas' : ' pontos percentuais';

  document.getElementById('titulo-grafico-modelo' + s).textContent = 'Regressão Linear: reta ajustada por ano';
  document.getElementById('descricao-grafico-modelo' + s).textContent =
    'Reta de mínimos quadrados: previsão = ' + arredondar(a).toLocaleString('pt-BR') + ' × ano ' + (b < 0 ? '- ' : '+ ') +
    Math.abs(arredondar(b)).toLocaleString('pt-BR') + '. A cada ano a previsão muda em média ' +
    arredondar(a).toLocaleString('pt-BR') + unidade + '.';

  desenharGrafico('grafico-modelo' + s, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: alvo === 'autonomia' ? 'Média prevista no ano' : '% elegível no ano',
          data: anos.map((ano) => ({ x: ano, y: arredondar(media(grupos[ano])) })),
          backgroundColor: '#2563eb',
          pointRadius: 5
        },
        {
          label: 'Reta de regressão',
          data: [anos[0], anos[anos.length - 1]].map((ano) => ({ x: ano, y: arredondar(a * ano + b) })),
          showLine: true,
          borderColor: '#dc2626',
          backgroundColor: '#dc2626',
          pointRadius: 0
        }
      ]
    },
    options: {
      aspectRatio: 3,
      scales: {
        x: { title: { display: true, text: 'Ano de fabricação' }, ticks: { stepSize: 1, callback: (valor) => valor } },
        y: { min: alvo === 'cafv' ? 0 : undefined, max: alvo === 'cafv' ? 100 : undefined, title: { display: true, text: rotuloDoResumo(alvo) } }
      }
    }
  });
}

// Cria um elemento SVG. O texto entra com textContent, então nomes vindos do CSV não viram HTML.
function elementoSvg(tag, atributos, texto) {
  const elemento = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(atributos).forEach(([nome, valor]) => elemento.setAttribute(nome, valor));
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

// Árvore de Decisão: desenha o diagrama (perguntas nos nós azuis, resultado nas folhas verdes)
function diagramaArvore(linhas, valores, alvo, s) {
  const PROFUNDIDADE = 3;
  const raiz = treinarArvore(linhas, valores, PROFUNDIDADE);

  document.getElementById('titulo-grafico-modelo' + s).textContent = 'Árvore de Decisão';
  document.getElementById('descricao-grafico-modelo' + s).textContent =
    'Árvore com profundidade ' + PROFUNDIDADE + ' ajustada sobre as previsões. Cada nó faz uma pergunta ' +
    '(sim à esquerda, não à direita) e cada folha mostra o valor médio previsto e quantos veículos caíram nela.';

  // Texto principal de cada caixa: a pergunta (nó) ou o valor previsto (folha)
  const textoDoNo = (no) => (no.divisao ? textoDaRegra(no.divisao) : formatarValor(no.media, alvo));

  // Posição: cada folha ganha uma coluna; um nó fica no meio dos seus dois filhos.
  // A largura da caixa acompanha o texto mais longo (ex.: "Fabricante = MERCEDES-BENZ?").
  let maiorTexto = 0;
  let proximaColuna = 0;
  let profundidadeReal = 0;
  function posicionar(no, nivel) {
    no.nivel = nivel;
    profundidadeReal = Math.max(profundidadeReal, nivel);
    maiorTexto = Math.max(maiorTexto, textoDoNo(no).length);
    if (!no.divisao) {
      no.coluna = proximaColuna++;
      return;
    }
    posicionar(no.sim, nivel + 1);
    posicionar(no.nao, nivel + 1);
    no.coluna = (no.sim.coluna + no.nao.coluna) / 2;
  }
  posicionar(raiz, 0);

  const LARGURA_CAIXA = Math.max(126, Math.ceil(maiorTexto * 8 + 16)); // ~8px por letra em negrito 13px
  const LARGURA_COLUNA = LARGURA_CAIXA + 14;
  const ALTURA_LINHA = 95;
  const ALTURA_CAIXA = 46;
  const largura = proximaColuna * LARGURA_COLUNA;
  const altura = (profundidadeReal + 1) * ALTURA_LINHA;
  const svg = elementoSvg('svg', { width: largura, height: altura, viewBox: '0 0 ' + largura + ' ' + altura });
  const centroX = (no) => no.coluna * LARGURA_COLUNA + LARGURA_COLUNA / 2;
  const topoY = (no) => no.nivel * ALTURA_LINHA + 8;

  function desenhar(no) {
    const x = centroX(no);
    const y = topoY(no);

    if (no.divisao) {
      [[no.sim, 'sim'], [no.nao, 'não']].forEach(([filho, resposta]) => {
        const xFilho = centroX(filho);
        const yFilho = topoY(filho);
        svg.appendChild(elementoSvg('line', { class: 'arvore-ramo', x1: x, y1: y + ALTURA_CAIXA, x2: xFilho, y2: yFilho }));
        svg.appendChild(elementoSvg('text', {
          class: 'arvore-rotulo-ramo',
          x: (x + xFilho) / 2 + (resposta === 'sim' ? -14 : 14),
          y: (y + ALTURA_CAIXA + yFilho) / 2 + 4,
          'text-anchor': 'middle'
        }, resposta));
        desenhar(filho);
      });
    }

    const grupo = elementoSvg('g', { class: no.divisao ? 'arvore-no' : 'arvore-folha' });
    grupo.appendChild(elementoSvg('rect', { x: x - LARGURA_CAIXA / 2, y, width: LARGURA_CAIXA, height: ALTURA_CAIXA, rx: 6 }));
    const textoPrincipal = textoDoNo(no);
    const textoSecundario = no.n.toLocaleString('pt-BR') + ' veículos';
    grupo.appendChild(elementoSvg('text', { class: 'arvore-texto-principal', x, y: y + 19, 'text-anchor': 'middle' }, textoPrincipal));
    grupo.appendChild(elementoSvg('text', { class: 'arvore-texto-secundario', x, y: y + 36, 'text-anchor': 'middle' }, textoSecundario));
    svg.appendChild(grupo);
  }
  desenhar(raiz);

  const container = document.getElementById('arvore' + s);
  container.innerHTML = '';
  container.appendChild(svg);
}

// Random Forest: diagrama "conjunto de dados -> várias árvores -> resultado de cada árvore -> média/votação -> resultado final".
// O caminho em azul claro mostra as respostas de um veículo de exemplo (o primeiro do arquivo) em cada árvore.
function diagramaFloresta(linhas, valores, alvo, s) {
  const ARVORES = 10;
  const ARVORES_DESENHADAS = 3;
  const PROFUNDIDADE = 2;
  const AMOSTRA = 5000;
  const { dados, arvores } = treinarFloresta(linhas, valores, ARVORES, PROFUNDIDADE, AMOSTRA);

  // Veículo de exemplo: o primeiro com tipo e ano preenchidos
  let exemplo = linhas.findIndex((linha) => linha[COL.tipo] && linha[COL.ano]);
  if (exemplo < 0) exemplo = 0;
  const caminhos = arvores.map((raiz) => caminhoNaArvore(raiz, dados, exemplo));
  const resultados = caminhos.map((caminho) => caminho[caminho.length - 1].media);

  // Resultado de cada árvore e resultado final:
  // Electric Range (regressão) -> média das árvores; CAFV (classificação) -> votação da maioria
  let textoResultado;
  let textoCombinacao;
  let textoFinal;
  if (alvo === 'autonomia') {
    textoResultado = (valor) => formatarValor(valor, alvo);
    textoCombinacao = 'Média das ' + ARVORES + ' árvores';
    textoFinal = 'Resultado final: ' + formatarValor(media(resultados), alvo);
  } else {
    textoResultado = (valor) => (valor >= 50 ? 'Elegível' : 'Não elegível');
    const votosElegivel = resultados.filter((valor) => valor >= 50).length;
    const vencedor = votosElegivel * 2 >= ARVORES ? 'Elegível' : 'Não elegível';
    const votosVencedor = vencedor === 'Elegível' ? votosElegivel : ARVORES - votosElegivel;
    textoCombinacao = 'Votação das ' + ARVORES + ' árvores';
    textoFinal = 'Resultado final: ' + vencedor + ' (' + votosVencedor + ' de ' + ARVORES + ' votos)';
  }

  const linhaExemplo = linhas[exemplo];
  document.getElementById('titulo-grafico-modelo' + s).textContent = 'Random Forest: funcionamento';
  document.getElementById('descricao-grafico-modelo' + s).textContent =
    'Floresta com ' + ARVORES + ' árvores (profundidade ' + PROFUNDIDADE + '), cada uma treinada com até ' +
    AMOSTRA.toLocaleString('pt-BR') + ' veículos sorteados com reposição; aqui aparecem ' + ARVORES_DESENHADAS +
    '. O caminho em azul claro mostra as respostas do 1º veículo do arquivo (' +
    [linhaExemplo[COL.fabricante], linhaExemplo[COL.modelo], linhaExemplo[COL.ano], siglaTipo(linhaExemplo[COL.tipo] || '')]
      .filter(Boolean).join(' ') +
    ') em cada árvore. Passe o mouse sobre os círculos para ver a pergunta de cada nó.';

  // ----- Medidas do desenho
  const LARGURA_ARVORE = 250;
  const LARGURA_RETICENCIAS = 90;
  const ESPACO_FOLHA = 56;
  const RAIO = 13;
  const Y_DADOS = 8;
  const Y_RAIZ = 110;
  const ALTURA_NIVEL = 55;
  const Y_RESULTADO = Y_RAIZ + PROFUNDIDADE * ALTURA_NIVEL + 45;
  const Y_COMBINACAO = Y_RESULTADO + 70;
  const Y_FINAL = Y_COMBINACAO + 65;
  const largura = ARVORES_DESENHADAS * LARGURA_ARVORE + LARGURA_RETICENCIAS;
  const altura = Y_FINAL + 44;
  const centroArvore = (t) => t * LARGURA_ARVORE + LARGURA_ARVORE / 2;
  const xCentral = centroArvore(Math.floor(ARVORES_DESENHADAS / 2));

  const svg = elementoSvg('svg', { width: largura, height: altura, viewBox: '0 0 ' + largura + ' ' + altura });

  // Ponta de seta usada nas linhas
  const defs = elementoSvg('defs', {});
  const seta = elementoSvg('marker', { id: 'seta' + s, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' });
  seta.appendChild(elementoSvg('path', { d: 'M0,0 L10,5 L0,10 z', class: 'floresta-seta' }));
  defs.appendChild(seta);
  svg.appendChild(defs);

  const linha = (pontos, comSeta) => {
    const atributos = { class: 'floresta-linha', points: pontos.map((p) => p.join(',')).join(' ') };
    if (comSeta) atributos['marker-end'] = 'url(#seta' + s + ')';
    svg.appendChild(elementoSvg('polyline', atributos));
  };
  const caixa = (xCentro, y, larguraCaixa, alturaCaixa, classe, texto) => {
    const grupo = elementoSvg('g', { class: classe });
    grupo.appendChild(elementoSvg('rect', { x: xCentro - larguraCaixa / 2, y, width: larguraCaixa, height: alturaCaixa, rx: 4 }));
    grupo.appendChild(elementoSvg('text', { x: xCentro, y: y + alturaCaixa / 2 + 5, 'text-anchor': 'middle' }, texto));
    svg.appendChild(grupo);
  };

  // ----- Conjunto de dados no topo, com linhas descendo até a raiz de cada árvore
  caixa(xCentral, Y_DADOS, 190, 40, 'floresta-dados', 'Conjunto de dados');
  const yRamal = Y_DADOS + 40 + 25;
  linha([[xCentral, Y_DADOS + 40], [xCentral, yRamal]]);
  linha([[centroArvore(0), yRamal], [centroArvore(ARVORES_DESENHADAS - 1), yRamal]]);

  for (let t = 0; t < ARVORES_DESENHADAS; t++) {
    const raiz = arvores[t];
    const noCaminho = new Set(caminhos[t]);
    linha([[centroArvore(t), yRamal], [centroArvore(t), Y_RAIZ - RAIO - 2]], true);
    svg.appendChild(elementoSvg('text', {
      class: 'floresta-rotulo', x: centroArvore(t) - RAIO - 8, y: Y_RAIZ - RAIO - 8, 'text-anchor': 'end'
    }, 'Árvore ' + (t + 1)));

    // Posição dos nós: folhas lado a lado, cada nó no meio dos filhos (como no diagrama da Árvore de Decisão)
    let proximaFolha = 0;
    const posicionar = (no, nivel) => {
      no.yDesenho = Y_RAIZ + nivel * ALTURA_NIVEL;
      if (!no.divisao) {
        no.xDesenho = proximaFolha++;
        return;
      }
      posicionar(no.sim, nivel + 1);
      posicionar(no.nao, nivel + 1);
      no.xDesenho = (no.sim.xDesenho + no.nao.xDesenho) / 2;
    };
    posicionar(raiz, 0);
    // Centraliza as folhas dentro da área da árvore
    const deslocamento = centroArvore(t) - ((proximaFolha - 1) * ESPACO_FOLHA) / 2;
    const xNo = (no) => deslocamento + no.xDesenho * ESPACO_FOLHA;

    // Ramos primeiro (ficam por baixo dos círculos)
    const ramos = (no) => {
      if (!no.divisao) return;
      [no.sim, no.nao].forEach((filho) => {
        svg.appendChild(elementoSvg('line', { class: 'floresta-ramo', x1: xNo(no), y1: no.yDesenho, x2: xNo(filho), y2: filho.yDesenho }));
        ramos(filho);
      });
    };
    ramos(raiz);

    const circulos = (no) => {
      const circulo = elementoSvg('circle', {
        class: noCaminho.has(no) ? 'floresta-no floresta-no-caminho' : 'floresta-no', cx: xNo(no), cy: no.yDesenho, r: RAIO
      });
      // Dica ao passar o mouse: a pergunta do nó ou o valor da folha
      circulo.appendChild(elementoSvg('title', {}, no.divisao
        ? textoDaRegra(no.divisao) + ' (' + no.n.toLocaleString('pt-BR') + ' veículos)'
        : formatarValor(no.media, alvo) + ' (' + no.n.toLocaleString('pt-BR') + ' veículos)'));
      svg.appendChild(circulo);
      if (no.divisao) {
        circulos(no.sim);
        circulos(no.nao);
      }
    };
    circulos(raiz);

    // Da folha do exemplo até a caixa "Resultado" da árvore
    const folha = caminhos[t][caminhos[t].length - 1];
    const yCotovelo = Y_RESULTADO - 14;
    linha([[xNo(folha), folha.yDesenho + RAIO], [xNo(folha), yCotovelo], [centroArvore(t), yCotovelo], [centroArvore(t), Y_RESULTADO - 2]], true);
    caixa(centroArvore(t), Y_RESULTADO, 170, 32, 'floresta-resultado', textoResultado(resultados[t]));

    // Da caixa "Resultado" até a linha que leva à média/votação
    linha([[centroArvore(t), Y_RESULTADO + 32], [centroArvore(t), Y_COMBINACAO - 20]]);
  }

  // Reticências: as outras árvores da floresta
  const xReticencias = ARVORES_DESENHADAS * LARGURA_ARVORE + LARGURA_RETICENCIAS / 2;
  svg.appendChild(elementoSvg('text', { class: 'floresta-reticencias', x: xReticencias, y: Y_RAIZ + ALTURA_NIVEL, 'text-anchor': 'middle' }, '• • •'));
  svg.appendChild(elementoSvg('text', { class: 'floresta-rotulo', x: xReticencias, y: Y_RAIZ + ALTURA_NIVEL + 24, 'text-anchor': 'middle' },
    '+' + (ARVORES - ARVORES_DESENHADAS) + ' árvores'));

  // Combinação (média ou votação) e resultado final
  linha([[centroArvore(0), Y_COMBINACAO - 20], [centroArvore(ARVORES_DESENHADAS - 1), Y_COMBINACAO - 20]]);
  linha([[xCentral, Y_COMBINACAO - 20], [xCentral, Y_COMBINACAO - 2]], true);
  caixa(xCentral, Y_COMBINACAO, 220, 34, 'floresta-combinacao', textoCombinacao);
  linha([[xCentral, Y_COMBINACAO + 34], [xCentral, Y_FINAL - 2]], true);
  caixa(xCentral, Y_FINAL, 320, 36, 'floresta-final', textoFinal);

  const container = document.getElementById('arvore' + s);
  container.innerHTML = '';
  container.appendChild(svg);
}

// Faz a previsão de uma combinação variável × modelo e preenche o bloco com o sufixo s
function preverCombinacao(alvo, opcao, s) {
  const previsoes = preverSimulado(linhasDoArquivo, alvo, opcao.tipo);

  document.getElementById('titulo-bloco' + s).textContent = ALVOS[alvo] + ' · ' + opcao.nome;
  document.getElementById('total-processados' + s).textContent = linhasDoArquivo.length.toLocaleString('pt-BR');
  document.getElementById('total-previsoes' + s).textContent = previsoes.length.toLocaleString('pt-BR');
  document.getElementById('coluna-previsao' + s).textContent = ALVOS[alvo] + ' previsto';
  document.getElementById('aviso-tabela' + s).textContent = 'Mostrando até ' + LINHAS_NA_TABELA + ' registros.';

  mostrarTabela(linhasDoArquivo, previsoes, s);
  graficoPrevisoes(previsoes, alvo, s);
  graficoPorTipo(linhasDoArquivo, previsoes, alvo, s);
  graficoPorAno(linhasDoArquivo, previsoes, alvo, s);
  graficoDoModelo(previsoes, alvo, opcao.tipo, s);
}

// Executa a previsão para cada variável e cada modelo marcados (um bloco de resultados por combinação)
function prever() {
  if (!validarSelecao(['alvo', 'modelo'])) return;

  const resultados = document.getElementById('resultados');
  apagarGraficos();
  resultados.innerHTML = '';

  let n = 0;
  valoresMarcados('alvo').forEach((alvo) => {
    valoresMarcados('modelo').forEach((indice) => {
      const s = '-' + n++;
      // O bloco entra na página antes de desenhar, para o Chart.js saber o tamanho dos gráficos
      resultados.appendChild(clonarBloco('modelo-bloco', s));
      preverCombinacao(alvo, opcoesDeModelo[indice], s);
    });
  });
}

document.getElementById('arquivo').addEventListener('change', aoSelecionarArquivo);
document.getElementById('alvo').addEventListener('change', aoMudarSelecao);
document.getElementById('modelo').addEventListener('change', aoMudarSelecao);
document.getElementById('botao-prever').addEventListener('click', prever);
carregarOpcoesDeModelo();
