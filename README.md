# Veículos Elétricos — Análise de Dados e Machine Learning

Aplicação web em Python/Flask para analisar a população de veículos elétricos do estado de Washington (EUA), estimar a autonomia elétrica (`Electric Range`) e prever a elegibilidade CAFV (`Clean Alternative Fuel Vehicle Eligibility`).

## Equipe e divisão de tarefas

| Integrante (GitHub) | Frente principal |
| --- | --- |
| Tobias | Front-end: navegação, Visão geral, gráficos e seleção de modelos |
| Nicolas | Backend: retreinamento, previsão, integração e correções |
| Guilherme Sanchez | Backend: previsões, métricas e gráficos de desempenho |
| Guilherme Krelling| API Flask, limpeza/pré-processamento e estrutura inicial |


## Funcionalidades

### Visão geral

- Indicadores: total de registros, quantidade de variáveis, média de autonomia, veículos elegíveis, não elegíveis e com elegibilidade desconhecida.
- Gráficos: veículos por fabricante, distribuição da autonomia, veículos por ano e distribuição do CAFV.
- Correlação das colunas com os dois alvos: autonomia e CAFV.


### Previsões

- Upload de CSV.
- Validação das colunas obrigatórias: `Model Year`, `Make`, `Model` e `Electric Vehicle Type`.
- Seleção da variável-alvo: `Electric Range` e/ou `CAFV`.
- Seleção do modelo: regressão linear/logística ou árvore de decisão.
- Escolha entre o modelo original e o retreinado, quando existir para o par alvo + algoritmo.
- Tabela com os veículos e os valores previstos.
- Gráficos de distribuição das previsões, por tipo de veículo e por ano.
- Explicação do modelo: coeficientes da regressão ou diagrama completo da árvore.
- Comparação do desempenho dos modelos em validação cruzada agrupada: MAE, RMSE, R², acurácia, F1 macro, real × previsto e matriz de confusão.

### Retreinamento

- Upload de uma nova base CSV com as colunas de entrada e os valores reais dos dois alvos.
- Seleção da variável-alvo e do algoritmo.
- Configuração da profundidade máxima da árvore; a regressão linear não tem parâmetro obrigatório.
- Treino real no servidor com validação cruzada agrupada (5 folds) por configuração do veículo.
- Métricas: MAE, RMSE e R² para autonomia; acurácia para CAFV.
- Gráficos: real × previsto, distribuição do erro, desempenho por fabricante e evolução das métricas entre treinamentos.
- O modelo retreinado é salvo ao lado do original e fica disponível na tela de Previsões para o mesmo par alvo + algoritmo.

## Como rodar

Pré-requisitos: Python 3.12 e pip.

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

pip install -r requirements.txt
python -m src.treinar
python app.py
```

Abra <http://localhost:5000>.

`python -m src.treinar` lê o CSV de `data/`, treina os quatro modelos originais e grava:

- `modelos/autonomia-linear.joblib`
- `modelos/autonomia-arvore.joblib`
- `modelos/cafv-logistica.joblib`
- `modelos/cafv-arvore.joblib`
- `modelos/explicacoes.json`

## Arquivos de dados e amostras

| Arquivo | Rota | Conteúdo | Uso |
| --- | --- | --- | --- |
| `Electric_Vehicle_Population_Data_20261103.csv` | `/data/Electric_Vehicle_Population_Data_20261103.csv` | Base completa (300.142 linhas, 16 colunas) | Treino inicial e Visão geral |
| `amostra_previsao_250.csv` | `/data/amostra_previsao_250.csv` | 250 linhas com `Model Year`, `Make`, `Model` e `Electric Vehicle Type` | Teste de Previsões |
| `amostra_retreinamento.csv` | `/data/amostra_retreinamento.csv` | 862 linhas com as colunas de entrada mais `Electric Range` e `Clean Alternative Fuel Vehicle (CAFV) Eligibility` | Teste de Retreinamento |


## Estrutura do projeto

```text
├── app.py                      # Flask: páginas, API e entrega do CSV
├── requirements.txt            # Dependências do servidor
├── specs.md                    # Especificação das telas
├── data/
│   ├── Electric_Vehicle_Population_Data_20261103.csv  # Base completa
│   ├── amostra_previsao_250.csv    # 250 linhas, sem as colunas-alvo
│   └── amostra_retreinamento.csv   # 862 linhas, com os valores reais dos alvos
├── modelos/                    # Gerado por python -m src.treinar (ignorado no Git)
├── src/
│   ├── preprocessing.py        # Limpeza, renomeação e tratamento do CAFV
│   ├── rotulos.py              # Colunas e rótulos compartilhados
│   ├── treinar.py              # Treino inicial dos quatro modelos
│   ├── previsor.py             # Carregamento e execução das previsões
│   ├── retreinar.py            # Validação e treino de um novo modelo
│   ├── metricas.py             # MAE, RMSE, R², acurácia e matriz de confusão
│   └── explicacao.py           # Coeficientes e árvore para a interface
├── templates/
│   ├── index.html              # Visão geral
│   ├── previsoes.html          # Previsões
│   └── retreinamento.html      # Retreinamento
├── static/
│   ├── css/style.css
│   └── js/
│       ├── utils.js            # Funções e constantes compartilhadas
│       ├── dashboard.js        # Leitura do dataset e gráficos da Visão geral
│       ├── previsoes.js        # Upload, previsão e resultados
│       ├── desempenho.js       # Gráficos do desempenho (validação cruzada)
│       └── retreinamento.js    # Upload, treino e métricas
```

## Fluxo da aplicação

1. **Visão geral**: o navegador baixa o CSV de `data/` pela rota `/data/<arquivo>` e calcula os indicadores e gráficos em partes. O arquivo não é enviado ao servidor.
2. **Previsões**: o navegador lê o CSV, valida as colunas e envia as linhas em JSON para `POST /api/prever`. O servidor carrega o `.joblib` escolhido, executa o pipeline e devolve uma previsão por linha. 
3. **Retreinamento**: o navegador lê a nova base e envia as linhas para `POST /api/retreinar`. O servidor limpa os dados, separa 20% para treino/teste, mede em validação cruzada agrupada, treina o pipeline, grava a cópia `-retreinado.joblib` e devolve métricas e uma amostra para os gráficos.

## API

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/` | Visão geral |
| GET | `/previsoes` | Tela de Previsões |
| GET | `/retreinamento` | Tela de Retreinamento |
| GET | `/data/<arquivo>` | Entrega qualquer CSV de `data/` (base completa e amostras) |
| GET | `/api/explicacoes` | Coeficientes, árvores e métricas dos modelos originais |
| GET | `/api/explicacoes-retreinadas` | Mesmas explicações dos modelos retreinados |
| POST | `/api/prever` | Executa previsões |
| POST | `/api/retreinar` | Treina um novo modelo |

Exemplo de previsão:

```json
{
  "alvo": "autonomia",
  "modelo": "linear",
  "origem": "pre",
  "linhas": [
    {
      "Model Year": "2020",
      "Make": "TESLA",
      "Model": "MODEL 3",
      "Electric Vehicle Type": "Battery Electric Vehicle (BEV)"
    }
  ]
}
```

Resposta:

```json
{
  "previsoes": [245.8],
  "avisos": []
}
```

Se o upload tiver fabricante, modelo ou tipo de veículo que não aparece no treino, `avisos` traz uma frase avisando que a previsão daquelas linhas é pouco confiável. Autonomia prevista é limitada a zero (o modelo linear pode devolver valor negativo, por exemplo para alguns híbridos antigos).

Para `CAFV`, a resposta traz os rótulos `Elegível`, `Não elegível` ou `Desconhecido`. Para usar um modelo retreinado, envie `"origem": "retreinado"`.

Exemplo de retreinamento:

```json
{
  "alvo": "cafv",
  "modelo": "arvore",
  "parametros": { "max_depth": 5 },
  "linhas": [
    {
      "Model Year": "2020",
      "Make": "TESLA",
      "Model": "MODEL 3",
      "Electric Vehicle Type": "Battery Electric Vehicle (BEV)",
      "Electric Range": "322",
      "Clean Alternative Fuel Vehicle (CAFV) Eligibility": "Clean Alternative Fuel Vehicle Eligible"
    }
  ]
}
```

A resposta inclui `metricas`, `amostra`, `reais` e `previstos`.

## Dados e pré-processamento

O dataset usado é o **Electric Vehicle Population Data**, publicado pelo Washington State Department of Licensing:

- Página oficial: <https://data.wa.gov/Transportation/Electric-Vehicle-Population-Data/f6w7-q2d2>
- Snapshot do projeto: `data/Electric_Vehicle_Population_Data_20261103.csv`
- Dimensões: 300.142 registros e 16 colunas.

Tratamentos aplicados em `src/preprocessing.py`:

- Tradução dos nomes originais do CSV para nomes internos (`Model Year` → `model_year`, etc.).
- `Electric Range` convertido para número; valores vazios viram `0`.
- `Electric Range = 0` significa que a autonomia não foi pesquisada. Esses registros ficam fora da média, do histograma e do treino de autonomia, mas continuam no treino de CAFV.
- `Model Year` vazio recebe a mediana dos anos da própria tabela enviada; se não houver nenhum ano, fica `0`.
- O texto do CAFV é reduzido a três rótulos: `Elegivel`, `Nao Elegivel` e `Desconhecido`.

Colunas usadas como entrada pelos modelos:

- `Model Year`
- `Make`
- `Model`
- `Electric Vehicle Type`

Variáveis-alvo:

- `Electric Range` (regressão)
- `CAFV` (classificação)

## Modelos e métricas

A medição é feita em **validação cruzada agrupada com 5 folds**: as dobras são separadas por configuração do veículo (`Model Year + Make + Model + Electric Vehicle Type`), então nenhuma configuração aparece no treino e no teste da mesma dobra. O baseline é o chute mais simples possível — prever a média (autonomia) ou a classe majoritária (CAFV) do treino.

| Alvo | Modelo | Métricas (média dos 5 folds) | Baseline |
| --- | --- | --- | --- |
| `Electric Range` | Regressão linear | MAE 18,48 milhas; RMSE 26,59; R² 0,920 | MAE 87,20 |
| `Electric Range` | Árvore de decisão | MAE 9,62 milhas; RMSE 21,93; R² 0,943 | MAE 87,20 |
| `CAFV` | Regressão logística | Acurácia 96,64%; F1 macro 0,962 | Acurácia 65,66% |
| `CAFV` | Árvore de decisão | Acurácia 98,15%; F1 macro 0,954 | Acurácia 65,66% |

Valores de referência do treino inicial. Eles mudam se a base for atualizada.

O treino inicial usa `max_depth = 12` para as árvores. No retreinamento, a profundidade é escolhida pelo usuário; a métrica continua sendo de validação cruzada, então profundidade alta aparece como overfitting em vez de "melhora".

## Como testar

1. Execute `python -m src.treinar` e depois `python app.py`.
2. Abra as três páginas e confira os indicadores e gráficos.
3. Na tela de Previsões, envie `data/amostra_previsao_250.csv` (250 linhas), marque os dois alvos e os dois modelos e clique em **Prever**; confira as primeiras 100 linhas da tabela, os gráficos de distribuição e a explicação do modelo.
4. Na tela de Retreinamento, envie `data/amostra_retreinamento.csv` (862 linhas com os valores reais de autonomia e CAFV) e treine os quatro pares alvo + algoritmo.
5. Se quiser usar as amostras pela rota de dados, acesse `/data/amostra_previsao_250.csv` ou `/data/amostra_retreinamento.csv` e salve o arquivo baixado.
6. Depois de retreinar, volte à tela de Previsões, marque apenas o alvo que foi retreinado e escolha a opção **(retreinado)** para confirmar que o novo modelo está disponível.

## Bibliotecas

Servidor (`requirements.txt`):

- Flask 3.0.3
- pandas 2.2.2
- numpy 1.26.4
- scikit-learn 1.5.0

O `joblib`, usado para salvar e carregar os modelos, é instalado como dependência do scikit-learn.

Navegador, via CDN:

- [Chart.js](https://www.chartjs.org/) 4.4.1 — gráficos;
- [PapaParse](https://www.papaparse.com/) 5.4.1 — leitura de CSV com `worker: true`.
