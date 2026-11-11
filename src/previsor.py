"""Carrega um modelo salvo e devolve as previsões de um upload."""

from pathlib import Path

import joblib
import pandas as pd

from src.preprocessing import preencher_ano
from src.rotulos import ALVOS, COLUNAS_MODELO, COLUNAS_UPLOAD, MODELOS, ROTULOS_EXIBICAO

ARQUIVOS: dict[tuple[str, str], str] = {
    ("autonomia", "linear"): "autonomia-linear.joblib",
    ("autonomia", "arvore"): "autonomia-arvore.joblib",
    ("cafv", "linear"): "cafv-logistica.joblib",
    ("cafv", "arvore"): "cafv-arvore.joblib",
}

ORIGEM_PRE = "pre"
ORIGEM_RETREINADO = "retreinado"
ORIGENS: tuple[str, ...] = (ORIGEM_PRE, ORIGEM_RETREINADO)


class PrevisaoInvalida(ValueError):
    """O pedido não tem alvo, modelo ou colunas no formato esperado."""


def nome_arquivo(alvo: str, modelo: str, origem: str = ORIGEM_PRE) -> str:
    """Nome do .joblib. O retreinado usa o mesmo nome, com sufixo antes da extensão.

    Exemplo:
        nome_arquivo("autonomia", "linear", "retreinado")
    """
    nome = ARQUIVOS[(alvo, modelo)]
    if origem == ORIGEM_PRE:
        return nome
    if origem == ORIGEM_RETREINADO:
        return nome.replace(".joblib", "-retreinado.joblib")
    raise PrevisaoInvalida(f"origem {origem!r} inválida; esperado {ORIGENS}")


def chave_cache(diretorio: Path, alvo: str, modelo: str, origem: str) -> tuple[str, str, str, str]:
    """Chave da memória. A origem entra para o original e o retreinado não se misturarem."""
    return (str(diretorio), alvo, modelo, origem)


def esquecer_modelo(
    cache: dict[tuple[str, str, str, str], object],
    diretorio: Path,
    alvo: str,
    modelo: str,
    origem: str,
) -> None:
    """Tira o pipeline da memória para a próxima previsão ler o arquivo de novo."""
    cache.pop(chave_cache(diretorio, alvo, modelo, origem), None)


def prever_corpo(
    corpo: object,
    diretorio: Path,
    cache: dict[tuple[str, str, str, str], object],
    carregar: object | None = None,
) -> list[float | str]:
    """Valida o JSON da tela e devolve uma previsão por linha.

    Exemplo:
        prever_corpo({"alvo": "autonomia", "modelo": "linear", "origem": "pre", "linhas": [...]}, pasta, {})
    """
    if not isinstance(corpo, dict):
        raise PrevisaoInvalida("corpo JSON inválido; esperado objeto com alvo, modelo e linhas")
    alvo = str(corpo.get("alvo", ""))
    modelo = str(corpo.get("modelo", ""))
    origem = str(corpo.get("origem", ORIGEM_PRE))
    _validar_escolha(alvo, modelo, origem)
    linhas = corpo.get("linhas")
    if not isinstance(linhas, list) or len(linhas) == 0:
        raise PrevisaoInvalida("linhas deve ser uma lista com ao menos um veículo")
    leitor = carregar or _carregar
    pipeline = leitor(diretorio, alvo, modelo, cache, origem)
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
    entrada["model_year"] = preencher_ano(entrada["model_year"])
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


def _validar_escolha(alvo: str, modelo: str, origem: str) -> None:
    if alvo not in ALVOS:
        raise PrevisaoInvalida(f"alvo {alvo!r} inválido; esperado {ALVOS}")
    if modelo not in MODELOS:
        raise PrevisaoInvalida(f"modelo {modelo!r} inválido; esperado {MODELOS}")
    if origem not in ORIGENS:
        raise PrevisaoInvalida(f"origem {origem!r} inválida; esperado {ORIGENS}")


def _carregar(
    diretorio: Path,
    alvo: str,
    modelo: str,
    cache: dict[tuple[str, str, str, str], object],
    origem: str = ORIGEM_PRE,
) -> object:
    chave = chave_cache(diretorio, alvo, modelo, origem)
    if chave in cache:
        return cache[chave]
    caminho = diretorio / nome_arquivo(alvo, modelo, origem)
    if not caminho.is_file():
        raise FileNotFoundError(_mensagem_ausente(caminho, diretorio, alvo, modelo, origem))
    cache[chave] = joblib.load(caminho)
    return cache[chave]


def _mensagem_ausente(caminho: Path, diretorio: Path, alvo: str, modelo: str, origem: str) -> str:
    if origem == ORIGEM_RETREINADO:
        return (
            f"ainda não há modelo retreinado para {alvo} com {modelo}; "
            "treine esse par na tela de Retreinamento"
        )
    return f"arquivo de modelo ausente: {caminho.name}; esperado um .joblib em {diretorio}"
