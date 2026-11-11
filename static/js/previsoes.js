// previsoes.js — upload do CSV, escolha de alvo/modelo e exibição das previsões.

// Quantidade máxima de linhas mostradas na tabela (para a página não ficar pesada)
const LINHAS_NA_TABELA = 100;

// Linhas do CSV enviado (ficam vazias até um arquivo válido ser carregado)
let linhasDoArquivo = [];

// Os dois modelos fixos, gravados em modelos/. O retreinado entra na lista quando o arquivo existe.
// tipo = chave em MODELOS (linear ou arvore). origem = pre ou retreinado.
const MODELOS_FIXOS = ['linear', 'arvore'];
const opcoesDeModelo = [];

// Explicação (coeficientes ou árvore) carregada de /api/explicacoes
let explicacoes = null;
// Mesma forma, só com os pares que já foram retreinados.
let explicacoesRetreinadas = {};

// Monta os checkboxes de modelo (o primeiro já vem marcado)
async function carregarOpcoesDeModelo() {
  MODELOS_FIXOS.forEach((chave) => {
    opcoesDeModelo.push({ nome: MODELOS[chave].nome, tipo: chave, origem: 'pre' });
  });
  explicacoesRetreinadas = await buscarExplicacoesRetreinadas();
  MODELOS_FIXOS.forEach((chave) => {
    if (!temRetreinado(chave)) return;
    opcoesDeModelo.push({
      nome: MODELOS[chave].nome + ' (retreinado)',
      tipo: chave,
      origem: 'retreinado'
    });
  });

  opcoesDeModelo.forEach((opcao, i) => adicionarCheckbox('modelo', i, opcao.nome, i === 0));
  aoMudarSelecao();
}

// O arquivo pode não existir ainda. Nesse caso a lista fica só com os modelos originais.
async function buscarExplicacoesRetreinadas() {
  try {
    const resposta = await fetch('/api/explicacoes-retreinadas');
    if (!resposta.ok) return {};
    const corpo = await resposta.json();
    return corpo && typeof corpo === 'object' ? corpo : {};
  } catch (erro) {
    return {};
  }
}

// O checkbox do algoritmo aparece se ele foi retreinado para ao menos um alvo.
function temRetreinado(chave) {
  return Object.values(explicacoesRetreinadas).some((porAlvo) => porAlvo && porAlvo[chave]);
}

// Mostra a descrição de cada modelo marcado (uma linha por tipo e origem)
function mostrarDescricaoDosModelos() {
  const descricao = document.getElementById('descricao-modelo');
  descricao.innerHTML = '';
  const vistos = new Set();
  valoresMarcados('modelo').forEach((indice) => {
    const opcao = opcoesDeModelo[indice];
    const chave = opcao.tipo + '|' + opcao.origem;
    if (vistos.has(chave)) return;
    vistos.add(chave);
    const sufixo = opcao.origem === 'retreinado' ? ' (retreinado)' : '';
    const linha = document.createElement('div');
    linha.textContent = MODELOS[opcao.tipo].nome + sufixo + ': ' + MODELOS[opcao.tipo].descricao;
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

// Busca coeficientes e árvore salvos. A segunda chamada reaproveita a primeira.
async function garantirExplicacoes() {
  if (explicacoes) return;
  const resposta = await fetch('/api/explicacoes');
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(corpo.erro || 'Não foi possível carregar a explicação dos modelos.');
  explicacoes = corpo;
  mostrarDesempenho();
}

// Envia os veículos para o modelo salvo e devolve uma previsão por linha.
async function preverNoServidor(linhas, alvo, modelo, origem) {
  const resposta = await fetch('/api/prever', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      alvo: alvo,
      modelo: modelo,
      origem: origem,
      linhas: linhas.map((linha) => ({
        'Model Year': linha[COL.ano],
        Make: linha[COL.fabricante],
        Model: linha[COL.modelo],
        'Electric Vehicle Type': linha[COL.tipo]
      }))
    })
  });
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(corpo.erro || 'Falha ao calcular as previsões.');
  return corpo.previsoes;
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

// Coeficientes do arquivo salvo, ou todos os níveis da árvore salva.
function graficoDoModelo(alvo, modelo, origem, s) {
  const fonte = origem === 'retreinado' ? explicacoesRetreinadas : explicacoes;
  const explicacao = fonte && fonte[alvo] && fonte[alvo][modelo];
  if (!explicacao) {
    document.getElementById('titulo-grafico-modelo' + s).textContent = 'Modelo';
    document.getElementById('descricao-grafico-modelo' + s).textContent = 'Explicação do modelo indisponível.';
    return;
  }
  if (modelo === 'linear') graficoCoeficientes(explicacao, s);
  else diagramaArvoreSalva(explicacao, s);
}

// Barras com os coeficientes gravados no treino. Não recalcula uma reta em cima das previsões.
function graficoCoeficientes(explicacao, s) {
  document.getElementById('titulo-grafico-modelo' + s).textContent = explicacao.titulo;
  document.getElementById('descricao-grafico-modelo' + s).textContent = explicacao.descricao;
  document.getElementById('grafico-modelo' + s).hidden = false;
  document.getElementById('arvore' + s).hidden = true;
  document.getElementById('expandir-arvore' + s).hidden = true;

  desenharGrafico('grafico-modelo' + s, {
    type: 'bar',
    data: {
      labels: explicacao.coeficientes.map((item) => item.nome),
      datasets: [{
        label: explicacao.unidade,
        data: explicacao.coeficientes.map((item) => item.valor),
        backgroundColor: '#2563eb'
      }]
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: { x: { title: { display: true, text: explicacao.unidade } } }
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

// Árvore de Decisão: desenha todos os níveis do arquivo salvo (nós azuis, folhas verdes).
function diagramaArvoreSalva(explicacao, s) {
  document.getElementById('titulo-grafico-modelo' + s).textContent = explicacao.titulo;
  document.getElementById('descricao-grafico-modelo' + s).textContent = explicacao.descricao;
  document.getElementById('grafico-modelo' + s).hidden = true;
  // O diagrama só abre no botão; o painel não mostra um preview.
  document.getElementById('arvore' + s).hidden = true;

  const medidas = medirArvore(explicacao.raiz);
  const svg = desenharSvgArvore(explicacao.raiz, medidas);
  const container = document.getElementById('arvore' + s);
  container.innerHTML = '';
  container.appendChild(svg);
  ligarExpansao(s, svg);
}

function ligarExpansao(sufixo, svg) {
  const botao = document.getElementById('expandir-arvore' + sufixo);
  botao.hidden = false;
  botao.onclick = () => abrirArvoreAmpliada(svg);
}

function abrirArvoreAmpliada(svg) {
  fecharArvoreAmpliada();
  const fundo = document.createElement('div');
  fundo.id = 'arvore-ampliada';
  fundo.className = 'arvore-ampliada';
  const palco = document.createElement('div');
  palco.className = 'arvore-ampliada-palco';
  const copia = svg.cloneNode(true);
  palco.appendChild(copia);
  fundo.append(barraDaAmpliacao(copia), palco);
  fundo.addEventListener('click', (evento) => {
    if (evento.target === fundo) fecharArvoreAmpliada();
  });
  document.body.appendChild(fundo);
  document.addEventListener('keydown', fecharAoEsc);
}

function barraDaAmpliacao(copia) {
  const barra = document.createElement('div');
  barra.className = 'arvore-ampliada-barra';
  let escala = 1;
  const largura = Number(copia.getAttribute('width'));
  const altura = Number(copia.getAttribute('height'));
  const aplicar = (delta) => {
    escala = Math.min(3, Math.max(0.25, escala + delta));
    copia.setAttribute('width', largura * escala);
    copia.setAttribute('height', altura * escala);
  };
  barra.append(botaoDaBarra('Reduzir', () => aplicar(-0.25)), botaoDaBarra('Ampliar', () => aplicar(0.25)), botaoDaBarra('Fechar', fecharArvoreAmpliada));
  return barra;
}

function botaoDaBarra(texto, aoClicar) {
  const botao = document.createElement('button');
  botao.type = 'button';
  botao.textContent = texto;
  botao.addEventListener('click', aoClicar);
  return botao;
}

function fecharAoEsc(evento) {
  if (evento.key === 'Escape') fecharArvoreAmpliada();
}

function fecharArvoreAmpliada() {
  const aberto = document.getElementById('arvore-ampliada');
  if (!aberto) return;
  aberto.remove();
  document.removeEventListener('keydown', fecharAoEsc);
}

function textoDoNoSalvo(no) {
  return no.pergunta || no.rotulo;
}

// Posição: cada folha ganha uma coluna; um nó fica no meio dos seus dois filhos.
function medirArvore(raiz) {
  const medidas = { maiorTexto: 0, colunas: 0, profundidade: 0 };
  posicionarNo(raiz, 0, medidas);
  return medidas;
}

function posicionarNo(no, nivel, medidas) {
  no.nivel = nivel;
  medidas.profundidade = Math.max(medidas.profundidade, nivel);
  medidas.maiorTexto = Math.max(medidas.maiorTexto, textoDoNoSalvo(no).length);
  if (!no.sim) {
    no.coluna = medidas.colunas++;
    return;
  }
  posicionarNo(no.sim, nivel + 1, medidas);
  posicionarNo(no.nao, nivel + 1, medidas);
  no.coluna = (no.sim.coluna + no.nao.coluna) / 2;
}

function desenharSvgArvore(raiz, medidas) {
  const larguraCaixa = Math.max(126, Math.ceil(medidas.maiorTexto * 8 + 16));
  const larguraColuna = larguraCaixa + 14;
  const alturaLinha = 95;
  const alturaCaixa = 46;
  const largura = medidas.colunas * larguraColuna;
  const altura = (medidas.profundidade + 1) * alturaLinha;
  const svg = elementoSvg('svg', { width: largura, height: altura, viewBox: '0 0 ' + largura + ' ' + altura });
  desenharNoArvore(svg, raiz, larguraCaixa, larguraColuna, alturaLinha, alturaCaixa);
  return svg;
}

function desenharNoArvore(svg, no, larguraCaixa, larguraColuna, alturaLinha, alturaCaixa) {
  const x = no.coluna * larguraColuna + larguraColuna / 2;
  const y = no.nivel * alturaLinha + 8;
  if (no.sim) {
    desenharRamo(svg, no.sim, no.ramo_sim, x, y, larguraColuna, alturaLinha, alturaCaixa);
    desenharRamo(svg, no.nao, no.ramo_nao, x, y, larguraColuna, alturaLinha, alturaCaixa);
    desenharNoArvore(svg, no.sim, larguraCaixa, larguraColuna, alturaLinha, alturaCaixa);
    desenharNoArvore(svg, no.nao, larguraCaixa, larguraColuna, alturaLinha, alturaCaixa);
  }
  const grupo = elementoSvg('g', { class: no.sim ? 'arvore-no' : 'arvore-folha' });
  grupo.appendChild(elementoSvg('rect', { x: x - larguraCaixa / 2, y: y, width: larguraCaixa, height: alturaCaixa, rx: 6 }));
  grupo.appendChild(elementoSvg('text', { class: 'arvore-texto-principal', x: x, y: y + 19, 'text-anchor': 'middle' }, textoDoNoSalvo(no)));
  grupo.appendChild(elementoSvg('text', { class: 'arvore-texto-secundario', x: x, y: y + 36, 'text-anchor': 'middle' }, no.n.toLocaleString('pt-BR') + ' veículos'));
  svg.appendChild(grupo);
}

function desenharRamo(svg, filho, rotulo, x, y, larguraColuna, alturaLinha, alturaCaixa) {
  const xFilho = filho.coluna * larguraColuna + larguraColuna / 2;
  const yFilho = filho.nivel * alturaLinha + 8;
  svg.appendChild(elementoSvg('line', { class: 'arvore-ramo', x1: x, y1: y + alturaCaixa, x2: xFilho, y2: yFilho }));
  svg.appendChild(elementoSvg('text', {
    class: 'arvore-rotulo-ramo', x: (x + xFilho) / 2, y: (y + alturaCaixa + yFilho) / 2, 'text-anchor': 'middle'
  }, rotulo));
}

// Faz a previsão de uma combinação variável × modelo e preenche o bloco com o sufixo s
async function preverCombinacao(alvo, opcao, s) {
  const previsoes = await preverNoServidor(linhasDoArquivo, alvo, opcao.tipo, opcao.origem);

  document.getElementById('titulo-bloco' + s).textContent = ALVOS[alvo] + ' · ' + opcao.nome;
  document.getElementById('total-processados' + s).textContent = linhasDoArquivo.length.toLocaleString('pt-BR');
  document.getElementById('total-previsoes' + s).textContent = previsoes.length.toLocaleString('pt-BR');
  document.getElementById('coluna-previsao' + s).textContent = ALVOS[alvo] + ' previsto';
  document.getElementById('aviso-tabela' + s).textContent = 'Mostrando até ' + LINHAS_NA_TABELA + ' registros.';

  mostrarTabela(linhasDoArquivo, previsoes, s);
  graficoPrevisoes(previsoes, alvo, s);
  graficoPorTipo(linhasDoArquivo, previsoes, alvo, s);
  graficoPorAno(linhasDoArquivo, previsoes, alvo, s);
  graficoDoModelo(alvo, opcao.tipo, opcao.origem, s);
}

// Executa a previsão para cada variável e cada modelo marcados (um bloco de resultados por combinação)
async function prever() {
  if (!validarSelecao(['alvo', 'modelo'])) return;

  const botao = document.getElementById('botao-prever');
  botao.disabled = true;
  mostrarMensagem('mensagem-upload', 'Calculando previsões...', 'info');

  try {
    await garantirExplicacoes();
    const resultados = document.getElementById('resultados');
    apagarGraficos();
    resultados.innerHTML = '';

    let n = 0;
    const pedidos = [];
    valoresMarcados('alvo').forEach((alvo) => {
      valoresMarcados('modelo').forEach((indice) => {
        const s = '-' + n++;
        // O bloco entra na página antes de desenhar, para o Chart.js saber o tamanho dos gráficos
        resultados.appendChild(clonarBloco('modelo-bloco', s));
        pedidos.push(preverCombinacao(alvo, opcoesDeModelo[indice], s));
      });
    });
    await Promise.all(pedidos);
    mostrarMensagem('mensagem-upload', 'Previsões calculadas para ' + linhasDoArquivo.length.toLocaleString('pt-BR') + ' registros.', 'sucesso');
  } catch (erro) {
    mostrarMensagem('mensagem-upload', erro.message, 'erro');
  }
  aoMudarSelecao();
}

document.getElementById('arquivo').addEventListener('change', aoSelecionarArquivo);
document.getElementById('alvo').addEventListener('change', aoMudarSelecao);
document.getElementById('modelo').addEventListener('change', aoMudarSelecao);
document.getElementById('botao-prever').addEventListener('click', prever);
carregarOpcoesDeModelo();
garantirExplicacoes().catch((erro) => {
  document.getElementById('desempenho').hidden = false;
  document.getElementById('texto-erro-autonomia').textContent = erro.message;
});
