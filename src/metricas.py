"""Métricas do teste de 20% usadas nos gráficos de erro e de acerto."""

import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    mean_absolute_error,
    r2_score,
    root_mean_squared_error,
)

from src.rotulos import ROTULOS_EXIBICAO

LIMITE_PONTOS = 400
SEMENTE_AMOSTRA = 42
ORDEM_CAFV: tuple[str, ...] = ("Elegivel", "Nao Elegivel", "Desconhecido")


def medir_regressao(reais: pd.Series, previstos: object) -> dict[str, object]:
    """Erro da autonomia e uma amostra de pontos para o gráfico real × previsto.

    Exemplo:
        medir_regressao(pd.Series([10.0, 20.0]), [10.0, 24.0])
    """
    reais_np = _como_array(reais)
    previstos_np = _como_array(previstos)
    mae = float(mean_absolute_error(reais_np, previstos_np))
    rmse = float(root_mean_squared_error(reais_np, previstos_np))
    r2 = float(r2_score(reais_np, previstos_np))
    return {
        "tipo": "regressao",
        "n_teste": int(len(reais_np)),
        "mae": round(mae, 2),
        "rmse": round(rmse, 2),
        "r2": round(r2, 3),
        "proximidade": taxas_de_proximidade(reais_np, previstos_np),
        "pontos": amostra_pontos(reais_np, previstos_np),
        "texto": texto_regressao(mae, r2),
    }


def medir_classificacao(reais: pd.Series, previstos: object) -> dict[str, object]:
    """Acurácia e matriz de confusão do CAFV, nas três classes da tela.

    Exemplo:
        medir_classificacao(pd.Series(["Elegivel"]), ["Elegivel"])
    """
    acuracia = float(accuracy_score(reais, previstos) * 100)
    matriz = confusion_matrix(reais, previstos, labels=list(ORDEM_CAFV))
    return {
        "tipo": "classificacao",
        "n_teste": int(len(reais)),
        "acuracia": round(acuracia, 1),
        "classes": [ROTULOS_EXIBICAO[classe] for classe in ORDEM_CAFV],
        "matriz": matriz.tolist(),
        "texto": texto_classificacao(acuracia),
    }


def taxas_de_proximidade(reais: np.ndarray, previstos: np.ndarray) -> dict[str, float]:
    """Percentual do teste na milha, em até 5 milhas e em até 10 milhas.

    Exemplo:
        taxas_de_proximidade(np.array([10.0]), np.array([10.0]))
    """
    erros = np.abs(reais - previstos)
    return {
        "na_milha": _percentual(erros <= 0.5),
        "ate_5": _percentual(erros <= 5),
        "ate_10": _percentual(erros <= 10),
    }


def amostra_pontos(reais: np.ndarray, previstos: np.ndarray) -> list[dict[str, float]]:
    """Até 400 pares real/previsto, sempre na mesma ordem, para o gráfico de dispersão.

    Exemplo:
        amostra_pontos(np.array([1.0, 2.0]), np.array([1.1, 2.4]))
    """
    if len(reais) == 0:
        raise ValueError("teste vazio; esperado ao menos um par real/previsto")
    gerador = np.random.default_rng(SEMENTE_AMOSTRA)
    quantidade = min(LIMITE_PONTOS, len(reais))
    indices = np.sort(gerador.choice(len(reais), size=quantidade, replace=False))
    return [_ponto(reais[indice], previstos[indice]) for indice in indices]


def texto_regressao(mae: float, r2: float) -> str:
    """Frase de erro da autonomia, com vírgula decimal.

    Exemplo:
        texto_regressao(13.41, 0.955)
    """
    return f"No teste de 20%: MAE {formatar_decimal(mae, 1)} milhas, R² {formatar_decimal(r2, 3)}."


def texto_classificacao(acuracia: float) -> str:
    """Frase de acerto do CAFV, com vírgula decimal.

    Exemplo:
        texto_classificacao(99.66)
    """
    return f"No teste de 20%: acurácia {formatar_decimal(acuracia, 1)}%."


def formatar_decimal(valor: float, casas: int) -> str:
    """Troca o ponto pela vírgula, no padrão da tela.

    Exemplo:
        formatar_decimal(13.4, 1)
    """
    return f"{valor:.{casas}f}".replace(".", ",")


def _como_array(valores: object) -> np.ndarray:
    return np.asarray(valores, dtype=float)


def _ponto(real: float, previsto: float) -> dict[str, float]:
    return {"real": round(float(real), 1), "previsto": round(float(previsto), 1)}


def _percentual(mascara: np.ndarray) -> float:
    if len(mascara) == 0:
        raise ValueError("lista de erros vazia; esperado ao menos um valor do teste")
    return round(float(np.mean(mascara) * 100), 1)
