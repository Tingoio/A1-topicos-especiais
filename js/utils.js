// utils.js — constantes e funções compartilhadas entre as três páginas.

// Tamanho máximo permitido para os uploads de CSV (Previsões e Retreinamento)
const MAX_UPLOAD_MB = 100;

// Nomes das colunas do dataset que usamos no projeto
const COL = {
  ano: 'Model Year',
  fabricante: 'Make',
  modelo: 'Model',
  tipo: 'Electric Vehicle Type',
  autonomia: 'Electric Range',
  cafv: 'Clean Alternative Fuel Vehicle (CAFV) Eligibility'
};

// Colunas que o modelo usa como entrada (características do veículo)
const COLUNAS_ENTRADA = [COL.ano, COL.fabricante, COL.modelo, COL.tipo];

// Variáveis que podem ser previstas
const ALVOS = {
  autonomia: 'Electric Range',
  cafv: 'CAFV'
};

// Modelos disponíveis e suas descrições
const MODELOS = {
  linear: {
    nome: 'Regressão Linear',
    descricao: 'Identifica relações lineares entre as características e a autonomia.'
  },
  arvore: {
    nome: 'Árvore de Decisão',
    descricao: 'Aprende regras e divisões das características para realizar previsões.'
  },
  floresta: {
    nome: 'Random Forest',
    descricao: 'Combina várias árvores de decisão para gerar previsões.'
  }
};

// Textos originais do CAFV no dataset -> nomes curtos para exibir
const CAFV_NOMES = {
  'Clean Alternative Fuel Vehicle Eligible': 'Elegível',
  'Not eligible due to low battery range': 'Não elegível',
  'Eligibility unknown as battery range has not been researched': 'Desconhecido'
};

// Converte o texto do CAFV para o nome curto
function nomeCafv(valor) {
  return CAFV_NOMES[valor] || 'Desconhecido';
}

// Verifica se o arquivo respeita o limite de tamanho (file.size está em bytes)
function arquivoDentroDoLimite(arquivo) {
  return arquivo.size <= MAX_UPLOAD_MB * 1024 * 1024;
}

// Lê um CSV enviado pelo usuário. O worker evita travar a página com arquivos grandes.
function lerCsv(arquivo, aoTerminar) {
  Papa.parse(arquivo, {
    header: true,
    skipEmptyLines: true,
    worker: true,
    complete: (resultado) => aoTerminar(resultado.data, resultado.meta.fields)
  });
}

// Retorna a lista de colunas obrigatórias que não existem no arquivo
function colunasFaltando(colunasDoArquivo, obrigatorias) {
  return obrigatorias.filter((coluna) => !colunasDoArquivo.includes(coluna));
}

// Mostra uma mensagem na tela. tipo: 'info', 'sucesso' ou 'erro'
function mostrarMensagem(idElemento, texto, tipo) {
  const elemento = document.getElementById(idElemento);
  elemento.textContent = texto;
  elemento.className = 'mensagem ' + tipo;
}

// ---------- Grupos de checkboxes (variável alvo, modelo, algoritmo) ----------

// Adiciona um checkbox (caixinha + nome) ao grupo, antes da mensagem de erro do grupo
function adicionarCheckbox(idGrupo, valor, texto, marcado) {
  const label = document.createElement('label');
  const caixa = document.createElement('input');
  caixa.type = 'checkbox';
  caixa.value = valor;
  caixa.checked = Boolean(marcado);
  label.append(caixa, ' ' + texto);
  const grupo = document.getElementById(idGrupo);
  grupo.insertBefore(label, grupo.querySelector('.erro-selecao'));
}

// Valores dos checkboxes marcados em um grupo
function valoresMarcados(idGrupo) {
  return [...document.querySelectorAll('#' + idGrupo + ' input:checked')].map((caixa) => caixa.value);
}

// Mostra a mensagem em vermelho dos grupos sem nenhuma caixinha marcada.
// Retorna true se todos os grupos têm pelo menos uma opção marcada.
function validarSelecao(idsGrupos) {
  let tudoCerto = true;
  idsGrupos.forEach((idGrupo) => {
    const vazio = valoresMarcados(idGrupo).length === 0;
    document.querySelector('#' + idGrupo + ' .erro-selecao').hidden = !vazio;
    if (vazio) tudoCerto = false;
  });
  return tudoCerto;
}

// Copia o conteúdo de um <template> e acrescenta o sufixo a todos os ids,
// para que cada combinação variável × modelo tenha seus próprios gráficos na página
function clonarBloco(idTemplate, sufixo) {
  const bloco = document.getElementById(idTemplate).content.firstElementChild.cloneNode(true);
  bloco.querySelectorAll('[id]').forEach((elemento) => { elemento.id += sufixo; });
  return bloco;
}

// Guarda os gráficos criados para poder apagá-los antes de redesenhar
const graficos = {};

// Apaga todos os gráficos da página (antes de gerar um novo conjunto de resultados)
function apagarGraficos() {
  Object.keys(graficos).forEach((id) => {
    graficos[id].destroy();
    delete graficos[id];
  });
}

// Cria (ou recria) um gráfico Chart.js no canvas indicado
function desenharGrafico(idCanvas, configuracao) {
  if (graficos[idCanvas]) {
    graficos[idCanvas].destroy();
  }
  graficos[idCanvas] = new Chart(document.getElementById(idCanvas), configuracao);
}

// Agrupa valores numéricos em faixas (ex.: 0-24, 25-49...) para montar histogramas
function histograma(valores, tamanhoFaixa) {
  const contagem = {};
  valores.forEach((valor) => {
    const inicio = Math.floor(valor / tamanhoFaixa) * tamanhoFaixa;
    contagem[inicio] = (contagem[inicio] || 0) + 1;
  });

  const inicios = Object.keys(contagem).map(Number).sort((a, b) => a - b);
  return {
    rotulos: inicios.map((inicio) => inicio + '-' + (inicio + tamanhoFaixa - 1)),
    contagens: inicios.map((inicio) => contagem[inicio])
  };
}

// Conta quantas vezes cada valor aparece em uma lista
function contarValores(lista) {
  const contagem = {};
  lista.forEach((valor) => {
    contagem[valor] = (contagem[valor] || 0) + 1;
  });
  return contagem;
}

// Separa os valores em grupos usando uma chave tirada de cada linha (ex.: o ano ou o fabricante).
// valores[i] corresponde a linhas[i]. Linhas com a chave vazia são ignoradas.
function agruparPor(linhas, valores, pegarChave) {
  const grupos = {};
  linhas.forEach((linha, i) => {
    const chave = pegarChave(linha);
    if (!chave) return;
    if (!grupos[chave]) grupos[chave] = [];
    grupos[chave].push(valores[i]);
  });
  return grupos;
}

// Média de uma lista de números
function media(lista) {
  return lista.reduce((soma, valor) => soma + valor, 0) / lista.length;
}

// Arredonda para 1 casa decimal (deixa os tooltips dos gráficos mais limpos)
function arredondar(valor) {
  return Math.round(valor * 10) / 10;
}

// "Battery Electric Vehicle (BEV)" -> "BEV"
function siglaTipo(tipo) {
  const sigla = tipo.match(/\(([^)]+)\)/);
  return sigla ? sigla[1] : tipo;
}

// Histórico de treinamentos salvo no navegador (usado no Retreinamento e nas Previsões)
function carregarHistorico() {
  try {
    return JSON.parse(localStorage.getItem('historicoTreinos')) || [];
  } catch (erro) {
    return [];
  }
}

function salvarHistorico(historico) {
  try {
    localStorage.setItem('historicoTreinos', JSON.stringify(historico));
  } catch (erro) {
    // Se o navegador bloquear o localStorage, o histórico fica só nesta sessão
  }
}
