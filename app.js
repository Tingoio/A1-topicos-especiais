const API_BASE_URL = "/api";
const MAX_PREVIEW_ROWS = 8;
const COLORS = ["#2b6555", "#c65e43", "#d3a33c", "#9aab79", "#65879b", "#9b7896"];

const state = { rows: [], columns: [], target: "", chartType: "bar", trained: false, task: "regression" };
const elements = {
  fileInput: document.querySelector("#fileInput"),
  datasetName: document.querySelector("#datasetName"),
  uploadMessage: document.querySelector("#uploadMessage"),
  rowCount: document.querySelector("#rowCount"),
  columnCount: document.querySelector("#columnCount"),
  missingCount: document.querySelector("#missingCount"),
  targetSummary: document.querySelector("#targetSummary"),
  chartColumn: document.querySelector("#chartColumn"),
  chartArea: document.querySelector("#chartArea"),
  chartTitle: document.querySelector("#chartTitle"),
  chartSubtitle: document.querySelector("#chartSubtitle"),
  tableHead: document.querySelector("#tableHead"),
  tableBody: document.querySelector("#tableBody"),
  tableSubtitle: document.querySelector("#tableSubtitle"),
  mapArea: document.querySelector("#mapArea"),
  mapCanvas: document.querySelector("#mapCanvas"),
  mapSubtitle: document.querySelector("#mapSubtitle"),
  targetColumn: document.querySelector("#targetColumn"),
  taskType: document.querySelector("#taskType"),
  modelType: document.querySelector("#modelType"),
  modelParameter: document.querySelector("#modelParameter"),
  trainButton: document.querySelector("#trainButton"),
  trainingMessage: document.querySelector("#trainingMessage"),
  modelStatus: document.querySelector("#modelStatus"),
  predictionForm: document.querySelector("#predictionForm"),
  predictionFields: document.querySelector("#predictionFields"),
  predictionResult: document.querySelector("#predictionResult"),
  predictButton: document.querySelector("#predictButton"),
  apiStatus: document.querySelector("#apiStatus")
};

elements.fileInput.addEventListener("change", handleFileSelection);
elements.chartColumn.addEventListener("change", renderChart);
elements.taskType.addEventListener("change", () => {
  state.task = elements.taskType.value;
  state.trained = false;
  updateModelOptions();
  updateModelStatus();
});
elements.targetColumn.addEventListener("change", () => {
  state.target = elements.targetColumn.value;
  state.trained = false;
  updateTargetSummary();
  renderPredictionForm();
  updateModelStatus();
});
elements.modelType.addEventListener("change", updateParameterOptions);
elements.trainButton.addEventListener("click", trainModel);
elements.predictionForm.addEventListener("submit", submitPrediction);
document.querySelectorAll("[data-chart]").forEach((button) => {
  button.addEventListener("click", () => {
    state.chartType = button.dataset.chart;
    document.querySelectorAll("[data-chart]").forEach((item) => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    renderChart();
  });
});

async function handleFileSelection(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const rows = parseFile(file.name, text);
    if (!rows.length) throw new Error("O arquivo não contém registros para análise.");
    const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    if (!columns.length) throw new Error("Não foram encontradas colunas no arquivo.");
    state.rows = rows;
    state.columns = columns;
    state.target = columns.find((column) => isNumericColumn(column)) || columns[0];
    state.trained = false;
    elements.datasetName.textContent = file.name;
    elements.uploadMessage.textContent = `${rows.length.toLocaleString("pt-BR")} registros · ${columns.length} variáveis detectadas`;
    renderDataset();
    await uploadDataset(file);
  } catch (error) {
    elements.uploadMessage.textContent = error.message || "Não foi possível ler este arquivo.";
  }
}

function parseFile(filename, text) {
  const extension = filename.split(".").pop().toLowerCase();
  if (extension === "csv") return parseCsv(text);
  if (extension === "json") return parseJson(text);
  if (extension === "xml") return parseXml(text);
  throw new Error("Formato não suportado. Use CSV, XML ou JSON.");
}

function parseCsv(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const delimiter = [",", ";", "\t"].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const records = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"' && quoted && source[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some((value) => value !== "")) records.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  row.push(cell.trim());
  if (row.some((value) => value !== "")) records.push(row);
  if (records.length < 2) throw new Error("O CSV precisa ter cabeçalho e ao menos um registro.");
  const headers = records[0].map((header, index) => header || `Coluna ${index + 1}`);
  return records.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function parseJson(text) {
  const parsed = JSON.parse(text);
  const rows = Array.isArray(parsed) ? parsed : Object.values(parsed || {}).find(Array.isArray);
  if (!Array.isArray(rows) || !rows.length || !rows.every((row) => row && typeof row === "object" && !Array.isArray(row))) {
    throw new Error("O JSON deve conter uma lista de registros estruturados.");
  }
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, formatValue(value)])));
}

function parseXml(text) {
  const document = new DOMParser().parseFromString(text, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("O XML está malformado.");
  const root = document.documentElement;
  const records = [...root.children];
  if (!records.length || !records.some((record) => record.children.length)) {
    throw new Error("O XML deve conter registros com campos estruturados.");
  }
  return records.filter((record) => record.children.length).map((record) =>
    Object.fromEntries([...record.children].map((field) => [field.tagName, field.textContent.trim()]))
  );
}

function formatValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function renderDataset() {
  const missing = state.rows.reduce((total, row) => total + state.columns.filter((column) => isMissing(row[column])).length, 0);
  elements.rowCount.textContent = state.rows.length.toLocaleString("pt-BR");
  elements.columnCount.textContent = state.columns.length.toLocaleString("pt-BR");
  elements.missingCount.textContent = missing.toLocaleString("pt-BR");
  populateSelect(elements.chartColumn, state.columns);
  populateSelect(elements.targetColumn, state.columns, state.target);
  elements.chartColumn.disabled = false;
  elements.targetColumn.disabled = false;
  elements.taskType.disabled = false;
  elements.trainButton.disabled = false;
  elements.chartColumn.value = state.columns[0];
  elements.targetColumn.value = state.target;
  updateTargetSummary();
  updateModelOptions();
  renderTable();
  renderChart();
  // renderMap();
  renderPredictionForm();
  updateModelStatus();
}

function populateSelect(select, options, selected = options[0]) {
  select.replaceChildren(...options.map((option) => {
    const item = document.createElement("option");
    item.value = option;
    item.textContent = option;
    return item;
  }));
  if (selected) select.value = selected;
}

function renderTable() {
  const previewColumns = state.columns.slice(0, 7);
  elements.tableHead.replaceChildren(createRow(previewColumns, "th"));
  elements.tableBody.replaceChildren(...state.rows.slice(0, MAX_PREVIEW_ROWS).map((row) =>
    createRow(previewColumns.map((column) => formatValue(row[column]) || "—", "td"))
  ));
  elements.tableSubtitle.textContent = `Exibindo ${Math.min(state.rows.length, MAX_PREVIEW_ROWS)} de ${state.rows.length.toLocaleString("pt-BR")} registros`;
}

function createRow(values, cellTag = "td") {
  const row = document.createElement("tr");
  row.replaceChildren(...values.map((value) => {
    const cell = document.createElement(cellTag);
    cell.textContent = value;
    return cell;
  }));
  return row;
}

function getDistribution(column) {
  const values = state.rows.map((row) => row[column]).filter((value) => !isMissing(value));
  const numeric = values.length > 0 && values.every((value) => Number.isFinite(toNumber(value)));
  if (!numeric) {
    const counts = new Map();
    values.forEach((value) => counts.set(String(value), (counts.get(String(value)) || 0) + 1));
    return [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 7);
  }
  const numbers = values.map(toNumber);
  const minimum = Math.min(...numbers);
  const maximum = Math.max(...numbers);
  const binCount = Math.min(6, Math.max(1, Math.ceil(Math.sqrt(numbers.length))));
  if (minimum === maximum) return [{ label: formatNumber(minimum), count: numbers.length }];
  const bins = Array.from({ length: binCount }, (_, index) => ({
    label: `${formatNumber(minimum + ((maximum - minimum) * index) / binCount)}–${formatNumber(minimum + ((maximum - minimum) * (index + 1)) / binCount)}`,
    count: 0
  }));
  numbers.forEach((value) => {
    const index = Math.min(binCount - 1, Math.floor(((value - minimum) / (maximum - minimum)) * binCount));
    bins[index].count += 1;
  });
  return bins;
}

function renderChart() {
  if (!state.rows.length) return;
  const column = elements.chartColumn.value;
  const distribution = getDistribution(column);
  const max = Math.max(...distribution.map((item) => item.count), 1);
  elements.chartTitle.textContent = `Distribuição: ${column}`;
  elements.chartSubtitle.textContent = `${state.rows.length.toLocaleString("pt-BR")} registros · ${distribution.length} grupos exibidos`;
  elements.chartArea.className = "chart-area";
  if (state.chartType === "pie") {
    const total = distribution.reduce((sum, item) => sum + item.count, 0) || 1;
    let start = 0;
    const slices = distribution.map((item, index) => {
      const end = start + (item.count / total) * 360;
      const slice = `${COLORS[index % COLORS.length]} ${start}deg ${end}deg`;
      start = end;
      return slice;
    });
    const pie = document.createElement("div");
    pie.className = "pie-chart";
    pie.style.background = `conic-gradient(${slices.join(", ")})`;
    const legend = document.createElement("div");
    legend.className = "pie-legend";
    legend.replaceChildren(...distribution.map((item, index) => {
      const entry = document.createElement("div");
      entry.className = "legend-item";
      const swatch = document.createElement("span");
      swatch.className = "legend-swatch";
      swatch.style.backgroundColor = COLORS[index % COLORS.length];
      const label = document.createElement("span");
      label.textContent = `${item.label}: ${item.count}`;
      entry.append(swatch, label);
      return entry;
    }));
    const layout = document.createElement("div");
    layout.className = "pie-layout";
    layout.append(pie, legend);
    elements.chartArea.replaceChildren(layout);
    return;
  }
  const chart = document.createElement("div");
  chart.className = "bar-chart";
  chart.replaceChildren(...distribution.map((item) => {
    const bar = document.createElement("div");
    bar.className = "bar-item";
    const value = document.createElement("span");
    value.className = "bar-value";
    value.textContent = item.count.toLocaleString("pt-BR");
    const fill = document.createElement("span");
    fill.className = "bar-fill";
    fill.style.height = `${Math.max(3, (item.count / max) * 76)}%`;
    const label = document.createElement("span");
    label.className = "bar-label";
    label.title = item.label;
    label.textContent = item.label;
    bar.append(value, fill, label);
    return bar;
  }));
  elements.chartArea.replaceChildren(chart);
}

function renderMap() {
  const latitudeColumn = findColumn(["latitude", "lat"]);
  const longitudeColumn = findColumn(["longitude", "lon", "lng", "long"]);
  if (!latitudeColumn || !longitudeColumn) {
    elements.mapCanvas.hidden = true;
    elements.mapArea.hidden = false;
    elements.mapSubtitle.textContent = "Localizações detectadas no arquivo";
    elements.mapArea.textContent = "O mapa será exibido quando houver colunas de latitude e longitude.";
    return;
  }
  const points = state.rows.map((row) => ({ x: toNumber(row[longitudeColumn]), y: toNumber(row[latitudeColumn]) }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (!points.length) return;
  elements.mapArea.hidden = true;
  elements.mapCanvas.hidden = false;
  elements.mapSubtitle.textContent = `${points.length.toLocaleString("pt-BR")} coordenadas · ${latitudeColumn} / ${longitudeColumn}`;
  const canvas = elements.mapCanvas;
  const bounds = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(bounds.width * scale));
  canvas.height = Math.max(1, Math.floor(bounds.height * scale));
  const context = canvas.getContext("2d");
  context.scale(scale, scale);
  const padding = 15;
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  points.forEach((point) => {
    const x = padding + ((point.x - minX) / (maxX - minX || 1)) * (bounds.width - padding * 2);
    const y = bounds.height - padding - ((point.y - minY) / (maxY - minY || 1)) * (bounds.height - padding * 2);
    context.beginPath();
    context.arc(x, y, 3.5, 0, Math.PI * 2);
    context.fillStyle = "#2b6555";
    context.globalAlpha = 0.65;
    context.fill();
  });
  context.globalAlpha = 1;
}

function findColumn(aliases) {
  return state.columns.find((column) => aliases.includes(column.trim().toLowerCase().replace(/[ _-]/g, "")));
}

function updateModelOptions() {
  const models = state.task === "regression"
    ? [["linear_regression", "Regressão linear"], ["decision_tree", "Árvore de decisão"], ["knn", "K vizinhos (KNN)"]]
    : [["decision_tree", "Árvore de decisão"], ["knn", "K vizinhos (KNN)"]];
  populateSelect(elements.modelType, models.map(([value]) => value), models[0][0]);
  [...elements.modelType.options].forEach((option, index) => { option.textContent = models[index][1]; });
  elements.modelType.disabled = !state.rows.length;
  updateParameterOptions();
}

function updateParameterOptions() {
  const model = elements.modelType.value;
  const parameter = model === "knn"
    ? [["3", "3 vizinhos"], ["5", "5 vizinhos"], ["7", "7 vizinhos"]]
    : model === "decision_tree"
      ? [["3", "Profundidade 3"], ["5", "Profundidade 5"], ["10", "Profundidade 10"]]
      : [["none", "Não se aplica"]];
  populateSelect(elements.modelParameter, parameter.map(([value]) => value), parameter[0][0]);
  [...elements.modelParameter.options].forEach((option, index) => { option.textContent = parameter[index][1]; });
  elements.modelParameter.disabled = !state.rows.length || model === "linear_regression";
}

async function uploadDataset(file) {
  const formData = new FormData();
  formData.append("file", file);
  try {
    const response = await fetch(`${API_BASE_URL}/dataset`, { method: "POST", body: formData });
    if (!response.ok) throw new Error("API indisponível");
    setApiStatus(true);
    elements.uploadMessage.textContent = `${state.rows.length.toLocaleString("pt-BR")} registros · arquivo enviado para a API`;
  } catch {
    setApiStatus(false);
    elements.uploadMessage.textContent = `${state.rows.length.toLocaleString("pt-BR")} registros · prévia local; API Python ainda não conectada`;
  }
}

async function trainModel() {
  if (!state.rows.length || !state.target) return;
  elements.trainButton.disabled = true;
  elements.trainingMessage.textContent = "Enviando configuração para treinamento...";
  const model = elements.modelType.value;
  const parameters = model === "knn"
    ? { n_neighbors: Number(elements.modelParameter.value) }
    : model === "decision_tree"
      ? { max_depth: Number(elements.modelParameter.value) }
      : {};
  const payload = {
    target: state.target,
    task: state.task,
    model,
    parameters
  };
  try {
    const response = await fetch(`${API_BASE_URL}/train`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error("A API não conseguiu treinar o modelo.");
    const result = await response.json();
    state.trained = true;
    elements.trainingMessage.textContent = result.message || "Modelo treinado com sucesso.";
    setApiStatus(true);
    renderPredictionForm();
    updateModelStatus();
  } catch (error) {
    elements.trainingMessage.textContent = `${error.message || "Não foi possível conectar à API."} Verifique o backend Python.`;
    setApiStatus(false);
  } finally {
    elements.trainButton.disabled = false;
  }
}

function renderPredictionForm() {
  const columns = state.columns.filter((column) => column !== state.target);
  if (!state.trained || !columns.length) {
    elements.predictionFields.className = "prediction-fields empty-state";
    elements.predictionFields.textContent = state.trained ? "O conjunto precisa ter ao menos uma variável de entrada." : "Treine um modelo para preencher os atributos.";
    elements.predictButton.disabled = true;
    return;
  }
  elements.predictionFields.className = "prediction-fields";
  elements.predictionFields.replaceChildren(...columns.slice(0, 8).map((column) => {
    const label = document.createElement("label");
    label.className = "field";
    label.textContent = column;
    const input = document.createElement("input");
    input.name = column;
    input.type = isNumericColumn(column) ? "number" : "text";
    input.step = "any";
    input.required = true;
    label.append(input);
    return label;
  }));
  elements.predictButton.disabled = false;
}

async function submitPrediction(event) {
  event.preventDefault();
  if (!state.trained) return;
  const values = Object.fromEntries(new FormData(elements.predictionForm).entries());
  for (const column of Object.keys(values)) {
    if (values[column] !== "" && isNumericColumn(column)) values[column] = Number(values[column]);
  }
  elements.predictionResult.textContent = "Calculando...";
  try {
    const response = await fetch(`${API_BASE_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values })
    });
    if (!response.ok) throw new Error("A API não conseguiu gerar a predição.");
    const result = await response.json();
    elements.predictionResult.textContent = `Resultado: ${formatValue(result.prediction ?? result.result ?? "sem valor")}`;
    setApiStatus(true);
  } catch (error) {
    elements.predictionResult.textContent = error.message || "Não foi possível conectar à API Python.";
    setApiStatus(false);
  }
}

function updateTargetSummary() {
  elements.targetSummary.textContent = state.target || "—";
}

function updateModelStatus() {
  elements.modelStatus.textContent = state.trained ? "Modelo treinado" : "Nenhum modelo treinado";
  elements.modelStatus.classList.toggle("trained", state.trained);
}

function isNumericColumn(column) {
  const values = state.rows.map((row) => row[column]).filter((value) => !isMissing(value));
  return values.length > 0 && values.every((value) => Number.isFinite(toNumber(value)));
}

function isMissing(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

function toNumber(value) {
  if (typeof value === "number") return value;
  const normalized = String(value).trim().replace(/\s/g, "").replace(/,(?=\d{1,2}$)/, ".");
  return normalized === "" ? Number.NaN : Number(normalized);
}

function formatNumber(number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(number);
}

function setApiStatus(connected) {
  const indicator = elements.apiStatus.parentElement;
  elements.apiStatus.textContent = connected ? "API conectada" : "API desconectada";
  indicator.classList.toggle("connected", connected);
}

// window.addEventListener("resize", () => {
//   if (state.rows.length) renderMap();
// });