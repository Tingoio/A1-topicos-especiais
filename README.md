# Veículos Elétricos WA — Front-end

Front-end do trabalho final de **Tópicos Especiais em Software**: análise de dados e Machine Learning sobre a população de veículos elétricos do estado de Washington (EUA).

> Nesta etapa não há backend. As previsões e os treinamentos são **simulados** (veja as funções marcadas com `TODO: trocar pela chamada ao backend`).

## Como rodar

Na pasta do projeto:

```bash
python -m http.server
```

Depois abra <http://localhost:8000> no navegador.

O servidor é necessário porque o navegador não permite que a página leia o arquivo do dataset quando ela é aberta direto pelo `file://`.

## Telas

| Página | O que faz |
| --- | --- |
| `index.html` — Visão geral | Indicadores e gráficos do dataset em `data/` |
| `previsoes.html` — Previsões | Upload de CSV, escolha do alvo (Electric Range ou CAFV) e do modelo, tabela e gráfico com as previsões |
| `retreinamento.html` — Retreinamento | Upload de uma nova base, escolha do alvo, do algoritmo e dos parâmetros, métricas (MAE, RMSE, R²) e gráficos |

Os uploads aceitam arquivos de até **100 MB** (constante `MAX_UPLOAD_MB` em `js/utils.js`).

## Estrutura de pastas

```
├── index.html              # Tela 1: Visão geral (Dashboard)
├── previsoes.html          # Tela 2: Previsões
├── retreinamento.html      # Tela 3: Retreinamento
├── css/
│   └── style.css           # Estilo único das três páginas
├── js/
│   ├── utils.js            # Constantes e funções compartilhadas
│   ├── dashboard.js        # Lógica da Visão geral
│   ├── previsoes.js        # Lógica das Previsões
│   └── retreinamento.js    # Lógica do Retreinamento
├── data/
│   └── veiculos_eletricos.csv  # Dataset (Electric Vehicle Population Data)
└── specs.md                # Especificação das telas
```

## Bibliotecas (via CDN)

- [Chart.js](https://www.chartjs.org/) 4.4.1: gráficos.
- [PapaParse](https://www.papaparse.com/) 5.4.1: leitura de CSV no navegador (com `worker: true` para não travar a página).

## Observações sobre os dados

- `Electric Range = 0` significa que a autonomia **não foi pesquisada**. Por isso esses registros ficam fora da média, do histograma e do treinamento.
- Para o alvo **CAFV**, que é uma classificação, o Retreinamento mostra a **acurácia** no lugar de MAE, RMSE e R².
- O histórico de treinamentos fica salvo no `localStorage` do navegador. Os modelos retreinados aparecem como opção na tela de Previsões.
