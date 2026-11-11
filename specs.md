## 2. Organização das telas

A aplicação será dividida em três páginas principais:

1. Visão geral (Dashboard).
2. Previsões.
3. Retreinamento.

### 2.1. Visão geral (Dashboard)

Objetivo: apresentar informações gerais sobre o dataset utilizado atualmente no treinamento do modelo.

#### Indicadores principais

- Quantidade total de registros.
- Quantidade de variáveis.
- Média de autonomia elétrica.
- Quantidade de veículos elegíveis para CAFV.
- Quantidade de veículos não elegíveis para CAFV.
- Quantidade de veículos com elegibilidade desconhecida.

#### Gráficos

- Quantidade de veículos por fabricante (`Make`).
- Distribuição de autonomia elétrica (`Electric Range`).
- Quantidade de veículos por ano de fabricação (`Model Year`).
- Distribuição da elegibilidade CAFV (`Clean Alternative Fuel Vehicle (CAFV) Eligibility`).

### 2.2. Previsões

Objetivo: permitir que o usuário envie um arquivo CSV para realizar previsões utilizando um modelo previamente treinado.

#### Funcionalidades

- Upload de arquivo CSV.
- Validação das colunas necessárias.
- Seleção do modelo de Machine Learning.
- Realização das previsões.
- Apresentação dos resultados.

#### Variável prevista

\- `Electric Range`
\- `CAFV`

#### Modelos disponíveis

| Modelo            | Descrição                                                              |
| ----------------- | ---------------------------------------------------------------------- |
| Regressão Linear  | Identifica relações lineares entre as características e a autonomia.   |
| Árvore de Decisão | Aprende regras e divisões das características para realizar previsões. |

#### Resultados apresentados

- Quantidade de registros processados.
- Quantidade de previsões realizadas.
- Tabela com os veículos e suas autonomias estimadas.
- Gráfico de distribuição das autonomias previstas.

Observação: o arquivo enviado para previsão não precisa conter a variável `Electric Range`, pois ela será estimada pelo modelo.

### 2.3. Retreinamento

Objetivo: permitir que o usuário atualize o modelo utilizando novos dados.

#### Funcionalidades

- Upload de uma nova base CSV.
- Validação das colunas necessárias.
- Seleção da variável-alvo (`Electric Range`) (`CAFV`).
- Seleção do algoritmo de Machine Learning.
- Configuração dos parâmetros.
- Treinamento de um novo modelo.
- Apresentação das métricas de avaliação.
- Disponibilização do novo modelo para realizar previsões.

#### Parâmetros dos modelos

| Modelo            | Parâmetros                                                                  |
| ----------------- | --------------------------------------------------------------------------- |
| Regressão Linear  | Sem parâmetros obrigatórios na configuração básica.                         |
| Árvore de Decisão | Profundidade máxima (`max_depth`).                                          |

#### Métricas de avaliação

- MAE: erro médio absoluto das previsões.
- RMSE: raiz do erro quadrático médio.
- R²: capacidade explicativa do modelo.

#### Gráficos

- Comparação entre valores reais e previstos.
- Comparação do desempenho entre modelos.
- Evolução das métricas entre treinamentos.

Observação: o CSV de retreinamento precisa das colunas de entrada, de `Electric Range` e da elegibilidade CAFV. Autonomia igual a zero fica de fora só do treino de `Electric Range`. O modelo original continua disponível; o retreinado entra na previsão só para o par alvo e algoritmo que foi treinado.