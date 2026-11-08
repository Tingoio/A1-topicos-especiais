"""Treina os dois modelos fixos (linear e árvore) para autonomia e CAFV."""

import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor

from src.explicacao import exportar_arvore, exportar_coeficientes
from src.metricas import medir_classificacao, medir_regressao
from src.previsor import ARQUIVOS
from src.preprocessing import carregar_e_limpar_dados
from src.rotulos import COLUNAS_MODELO

PROFUNDIDADE_ARVORE = 16
SEMENTE = 42
CAMINHO_CSV = (
    Path(__file__).resolve().parents[1]
    / "data"
    / "Electric_Vehicle_Population_Data_20261103.csv"
)


def base_regressao(dados: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    """Veículos com autonomia pesquisada. Zero significa 'não pesquisada'.

    Exemplo:
        base_regressao(dados_limpos)
    """
    pesquisada = dados.loc[dados["electric_range"] > 0]
    return pesquisada[COLUNAS_MODELO], pesquisada["electric_range"]


def base_classificacao(dados: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    """Todas as linhas, com o CAFV já reduzido a três rótulos.

    Exemplo:
        base_classificacao(dados_limpos)
    """
    return dados[COLUNAS_MODELO], dados["cafv_status"]


def criar_pipeline(alvo: str, modelo: str) -> Pipeline:
    """Pipeline de treino. A logística padroniza o ano para conseguir convergir.

    Exemplo:
        criar_pipeline("autonomia", "arvore")
    """
    escalar_ano = alvo == "cafv" and modelo == "linear"
    esparso = modelo == "linear"
    preparo = ColumnTransformer([
        ("ano", StandardScaler() if escalar_ano else "passthrough", ["model_year"]),
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=esparso), ["make", "model", "ev_type"]),
    ])
    return Pipeline([("prep", preparo), ("modelo", _estimador(alvo, modelo))])


def treinar_todos(dados: pd.DataFrame, diretorio: Path) -> dict[str, dict[str, object]]:
    """Grava os quatro arquivos e o JSON com coeficientes e árvore.

    Exemplo:
        treinar_todos(dados_limpos, Path("modelos"))
    """
    diretorio.mkdir(parents=True, exist_ok=True)
    explicacoes: dict[str, dict[str, object]] = {}
    for alvo in ("autonomia", "cafv"):
        entradas, respostas = _bases(dados)[alvo]
        explicacoes[alvo] = {}
        for modelo in ("linear", "arvore"):
            pipeline, metricas, desempenho = _ajustar(entradas, respostas, alvo, modelo)
            _gravar_modelo(pipeline, diretorio, alvo, modelo)
            explicacoes[alvo][modelo] = _explicar(pipeline, alvo, modelo, metricas, desempenho)
    destino = diretorio / "explicacoes.json"
    destino.write_text(json.dumps(explicacoes, ensure_ascii=False, indent=2), encoding="utf-8")
    return explicacoes


def main() -> None:
    """Treina a partir do CSV do projeto e grava a pasta modelos/.

    Exemplo:
        python -m src.treinar
    """
    dados = carregar_e_limpar_dados(str(CAMINHO_CSV))
    diretorio = CAMINHO_CSV.parents[1] / "modelos"
    treinar_todos(dados, diretorio)
    print(f"Modelos salvos em {diretorio}")


def _bases(dados: pd.DataFrame) -> dict[str, tuple[pd.DataFrame, pd.Series]]:
    return {"autonomia": base_regressao(dados), "cafv": base_classificacao(dados)}


def _estimador(alvo: str, modelo: str) -> object:
    if modelo == "arvore" and alvo == "autonomia":
        return DecisionTreeRegressor(max_depth=PROFUNDIDADE_ARVORE, random_state=SEMENTE)
    if modelo == "arvore":
        return DecisionTreeClassifier(max_depth=PROFUNDIDADE_ARVORE, random_state=SEMENTE)
    if alvo == "autonomia":
        return LinearRegression()
    return LogisticRegression(max_iter=1000, random_state=SEMENTE)


def _ajustar(
    entradas: pd.DataFrame, respostas: pd.Series, alvo: str, modelo: str
) -> tuple[Pipeline, str, dict[str, object]]:
    pipeline = criar_pipeline(alvo, modelo)
    estratificar = respostas if alvo == "cafv" else None
    treino_x, teste_x, treino_y, teste_y = train_test_split(
        entradas, respostas, test_size=0.2, random_state=SEMENTE, stratify=estratificar
    )
    avaliacao = criar_pipeline(alvo, modelo)
    avaliacao.fit(treino_x, treino_y)
    # A métrica sai deste ajuste, que não viu o teste. O arquivo salvo usa a base inteira.
    texto, desempenho = _medir(avaliacao, teste_x, teste_y, alvo)
    pipeline.fit(entradas, respostas)
    return pipeline, texto, desempenho


def _medir(
    pipeline: Pipeline, teste_x: pd.DataFrame, teste_y: pd.Series, alvo: str
) -> tuple[str, dict[str, object]]:
    previsto = pipeline.predict(teste_x)
    if alvo == "autonomia":
        desempenho = medir_regressao(teste_y, previsto)
    else:
        desempenho = medir_classificacao(teste_y, previsto)
    return str(desempenho["texto"]), desempenho


def _explicar(
    pipeline: Pipeline, alvo: str, modelo: str, metricas: str, desempenho: dict[str, object]
) -> dict[str, object]:
    if modelo == "linear":
        explicacao = exportar_coeficientes(pipeline, alvo, metricas)
    else:
        explicacao = exportar_arvore(pipeline, alvo, metricas)
    explicacao["desempenho"] = desempenho
    return explicacao


def _gravar_modelo(pipeline: Pipeline, diretorio: Path, alvo: str, modelo: str) -> None:
    joblib.dump(pipeline, diretorio / ARQUIVOS[(alvo, modelo)])


if __name__ == "__main__":
    main()
