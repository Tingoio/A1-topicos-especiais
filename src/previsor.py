"""Carrega um modelo salvo e devolve as previsões de um upload."""

from pathlib import Path

import joblib
import pandas as pd

from src.rotulos import ALVOS, COLUNAS_MODELO, COLUNAS_UPLOAD, MODELOS, ROTULOS_EXIBICAO

ARQUIVOS: dict[tuple[str, str], str] = {
    ("autonomia", "linear"): "autonomia-linear.joblib",
    ("autonomia", "arvore"): "autonomia-arvore.joblib",
    ("cafv", "linear"): "cafv-logistica.joblib",
    ("cafv", "arvore"): "cafv-arvore.joblib",
}


class PrevisaoInvalida(ValueError):
    """O pedido não tem alvo, modelo ou colunas no formato esperado."""


def prever_corpo(
    corpo: object,
    diretorio: Path,
    cache: dict[tuple[str, str, str], object],
    carregar: object | None = None,
) -> list[float | str]:
    """Valida o JSON da tela e devolve uma previsão por linha.

    Exemplo:
        prever_corpo({"alvo": "autonomia", "modelo": "linear", "linhas": [...]}, pasta, {})
    """
    if not isinstance(corpo, dict):
        raise PrevisaoInvalida("corpo JSON inválido; esperado objeto com alvo, modelo e linhas")
    alvo = str(corpo.get("alvo", ""))
    modelo = str(corpo.get("modelo", ""))
    _validar_escolha(alvo, modelo)
    linhas = corpo.get("linhas")
    if not isinstance(linhas, list) or len(linhas) == 0:
        raise PrevisaoInvalida("linhas deve ser uma lista com ao menos um veículo")
    leitor = carregar or _carregar
    pipeline = leitor(diretorio, alvo, modelo, cache)
    entrada = montar_entrada(linhas)
    return formatar_previsoes(pipeline.predict(entrada), alvo)


def montar_entrada(linhas: list[object]) -> pd.DataFrame:
    """Traduz as colunas do CSV enviado para as colunas usadas no treino.

    Exemplo:
        montar_entrada([{"Model Year": "2020", "Make": "TESLA", "Model": "MODEL 3",
                         "Electric Vehicle Type": "Battery Electric Vehicle (BEV)"}])
    """
    tabela = pd.DataFrame(linhas)
    faltando = [coluna for coluna in COLUNAS_UPLOAD if coluna not in tabela.columns]
    if faltando:
        raise PrevisaoInvalida(
            f"colunas ausentes: {faltando}; esperado {list(COLUNAS_UPLOAD)}"
        )
    entrada = tabela.rename(columns=COLUNAS_UPLOAD)[COLUNAS_MODELO].copy()
    entrada["model_year"] = pd.to_numeric(entrada["model_year"], errors="coerce").fillna(0)
    for coluna in ("make", "model", "ev_type"):
        entrada[coluna] = entrada[coluna].fillna("").astype(str)
    return entrada


def formatar_previsoes(valores: object, alvo: str) -> list[float | str]:
    """Autonomia em milhas com 1 casa; CAFV nos rótulos curtos da tela.

    Exemplo:
        formatar_previsoes([210.26], "autonomia")
    """
    if alvo == "autonomia":
        return [round(float(valor), 1) for valor in valores]
    return [ROTULOS_EXIBICAO.get(str(valor), str(valor)) for valor in valores]


def _validar_escolha(alvo: str, modelo: str) -> None:
    if alvo not in ALVOS:
        raise PrevisaoInvalida(f"alvo {alvo!r} inválido; esperado {ALVOS}")
    if modelo not in MODELOS:
        raise PrevisaoInvalida(f"modelo {modelo!r} inválido; esperado {MODELOS}")


def _carregar(diretorio: Path, alvo: str, modelo: str, cache: dict[tuple[str, str, str], object]) -> object:
    chave = (str(diretorio), alvo, modelo)
    if chave in cache:
        return cache[chave]
    caminho = diretorio / ARQUIVOS[(alvo, modelo)]
    if not caminho.is_file():
        raise FileNotFoundError(
            f"arquivo de modelo ausente: {caminho.name}; esperado um .joblib em {diretorio}"
        )
    cache[chave] = joblib.load(caminho)
    return cache[chave]
