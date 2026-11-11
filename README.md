# Veículos Elétricos

Trabalho de **Tópicos Especiais em Software**: análise e Machine Learning sobre a população de veículos elétricos do estado de Washington (EUA).

## Como rodar

Na pasta do projeto, com o ambiente virtual ativo:

```bash
pip install -r requirements.txt
python -m src.treinar
python app.py
```

Abra <http://localhost:5000>.

`python -m src.treinar` lê o CSV em `data/` e grava os quatro modelos originais em `modelos/`. Sem essa pasta, a tela de Previsões não encontra os modelos. O retreino não apaga esses arquivos: ele grava uma cópia ao lado, com o sufixo `-retreinado`.

## Telas

| Página | O que faz |
| --- | --- |
| Visão geral | Indicadores, gráficos e correlação das colunas com os alvos |
| Previsões | Upload de CSV, escolha do alvo, do algoritmo e da origem (original ou retreinado) |
| Retreinamento | Upload de uma nova base, treino de verdade e métricas (MAE, RMSE, R² ou acurácia) |

Os uploads aceitam arquivos de até **100 MB** (constante `MAX_UPLOAD_MB` em `static/js/utils.js`).

## Estrutura

```
├── app.py                  # Flask: páginas e API
├── templates/              # Visão geral, Previsões e Retreinamento
├── static/
│   ├── css/style.css
│   └── js/                 # utils, dashboard, previsões, retreinamento e desempenho
├── src/                    # Limpeza, treino, retreino e previsão
├── data/                   # CSV da população de veículos elétricos
└── specs.md                # Especificação das telas
```

## Bibliotecas

No navegador, via CDN:

- [Chart.js](https://www.chartjs.org/) 4.4.1: gráficos.
- [PapaParse](https://www.papaparse.com/) 5.4.1: leitura de CSV (com `worker: true` para não travar a página).

No servidor: Flask, pandas, numpy e scikit-learn (`requirements.txt`).

## Observações sobre os dados

- `Electric Range = 0` significa que a autonomia **não foi pesquisada**. Esses registros ficam fora da média, do histograma e do treino de autonomia. No CAFV eles continuam, porque em geral são a classe Desconhecido.
- Ano vazio recebe a mediana dos anos da tabela enviada. Se não houver nenhum ano, fica 0.
- Para o alvo **CAFV**, o Retreinamento mostra a **acurácia** no lugar de MAE, RMSE e R².
- O histórico de métricas fica no `localStorage` do navegador. O modelo em si fica em `modelos/`.
- O modelo retreinado só aparece na Previsão para o par alvo e algoritmo que foi treinado. O original continua na lista.
