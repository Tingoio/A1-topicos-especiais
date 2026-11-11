"""Treina de novo um par alvo + algoritmo e grava a cópia ao lado do modelo original."""

import json
from pathlib import Path

import pandas as pd

from src.previsor import ORIGEM_RETREINADO
from src.preprocessing import limpar_tabela
from src.rotulos import ALVOS, COLUNAS_TREINO, MODELOS, ROTULOS_EXIBICAO
from src.treinar import (
    PROFUNDIDADE_ARVORE,
    _ajustar,
    _explicar,
    _gravar_modelo,
    base_classificacao,
    base_regressao,
)

ARQUIVO_EXPLICACOES_RETREINADAS = "explicacoes-retreinadas.json"
TAMANHO_AMOSTRA = 300


class RetreinoInvalido(ValueError):
    """O pedido não tem alvo, modelo, parâmetros ou colunas no formato esperado."""


def retreinar_corpo(corpo: object, diretorio: Path) -> tuple[str, str, dict[str, object]]:
    """Valida o JSON da tela, treina e devolve métricas e a amostra dos gráficos.

    Exemplo:
        retreinar_corpo({"alvo": "autonomia", "modelo": "arvore", "parametros": {"max_depth": 5},
                         "linhas": [...]}, Path("modelos"))
    """
    alvo, modelo, profundidade, linhas = _pedido(corpo)
    dados = _tabela_de_treino(linhas)
    entradas, respostas = _base(dados, alvo)
    _validar_base(respostas, alvo)
    try:
        pipeline, texto, desempenho, teste_x, teste_y, previsto = _ajustar(
            entradas, respostas, alvo, modelo, profundidade
        )
    except ValueError as erro:
        raise RetreinoInvalido(
            "base pequena demais para o corte de 20%, ou o CAFV não tem linhas suficientes em cada classe"
        ) from erro
    diretorio.mkdir(parents=True, exist_ok=True)
    _gravar_modelo(pipeline, diretorio, alvo, modelo, ORIGEM_RETREINADO)
    explicacao = _explicar(pipeline, alvo, modelo, texto, desempenho, profundidade)
    _gravar_explicacao(diretorio, alvo, modelo, explicacao)
    amostra, reais, previstos = _amostra_da_tela(teste_x, teste_y, previsto, alvo)
    return alvo, modelo, {
        "metricas": _metricas_da_tela(desempenho),
        "amostra": amostra,
        "reais": reais,
        "previstos": previstos,
    }


def _pedido(corpo: object) -> tuple[str, str, int, list[object]]:
    if not isinstance(corpo, dict):
        raise RetreinoInvalido(
            "corpo JSON inválido; esperado objeto com alvo, modelo, parametros e linhas"
        )
    alvo = str(corpo.get("alvo", ""))
    modelo = str(corpo.get("modelo", ""))
    if alvo not in ALVOS:
        raise RetreinoInvalido(f"alvo {alvo!r} inválido; esperado {ALVOS}")
    if modelo not in MODELOS:
        raise RetreinoInvalido(f"modelo {modelo!r} inválido; esperado {MODELOS}")
    linhas = corpo.get("linhas")
    if not isinstance(linhas, list) or len(linhas) == 0:
        raise RetreinoInvalido("linhas deve ser uma lista com ao menos um veículo")
    return alvo, modelo, _profundidade(modelo, corpo.get("parametros") or {}), linhas


def _profundidade(modelo: str, parametros: object) -> int:
    if modelo != "arvore":
        return PROFUNDIDADE_ARVORE
    if not isinstance(parametros, dict):
        raise RetreinoInvalido("parametros deve ser um objeto")
    if "max_depth" not in parametros:
        return PROFUNDIDADE_ARVORE
    valor = parametros["max_depth"]
    if isinstance(valor, bool) or not isinstance(valor, int) or not 1 <= valor <= 30:
        raise RetreinoInvalido("max_depth deve ser um inteiro de 1 a 30")
    return valor


def _tabela_de_treino(linhas: list[object]) -> pd.DataFrame:
    tabela = pd.DataFrame(linhas)
    faltando = [coluna for coluna in COLUNAS_TREINO if coluna not in tabela.columns]
    if faltando:
        raise RetreinoInvalido(
            f"colunas ausentes: {faltando}; esperado {list(COLUNAS_TREINO)}"
        )
    return limpar_tabela(tabela)


def _base(dados: pd.DataFrame, alvo: str) -> tuple[pd.DataFrame, pd.Series]:
    if alvo == "autonomia":
        return base_regressao(dados)
    return base_classificacao(dados)


def _validar_base(respostas: pd.Series, alvo: str) -> None:
    if alvo == "autonomia" and len(respostas) < 2:
        raise RetreinoInvalido(
            "autonomia precisa de pelo menos duas linhas com Electric Range maior que zero"
        )
    if alvo != "cafv":
        return
    if len(respostas) < 2:
        raise RetreinoInvalido("base pequena demais para separar 20% de teste")
    contagem = respostas.value_counts()
    if len(contagem) < 2 or bool((contagem < 2).any()):
        raise RetreinoInvalido(
            "o CAFV precisa de pelo menos duas classes, com duas linhas ou mais em cada uma"
        )


def _gravar_explicacao(diretorio: Path, alvo: str, modelo: str, explicacao: dict[str, object]) -> None:
    caminho = diretorio / ARQUIVO_EXPLICACOES_RETREINADAS
    atual: dict[str, object] = {}
    if caminho.is_file():
        carregado = json.loads(caminho.read_text(encoding="utf-8"))
        if isinstance(carregado, dict):
            atual = carregado
    por_alvo = atual.get(alvo)
    if not isinstance(por_alvo, dict):
        por_alvo = {}
    por_alvo[modelo] = explicacao
    atual[alvo] = por_alvo
    caminho.write_text(json.dumps(atual, ensure_ascii=False, indent=2), encoding="utf-8")


def _metricas_da_tela(desempenho: dict[str, object]) -> dict[str, float]:
    """Os cards da tela usam o teste inteiro. A acurácia entra entre 0 e 1."""
    if desempenho["tipo"] == "regressao":
        return {
            "mae": float(desempenho["mae"]),
            "rmse": float(desempenho["rmse"]),
            "r2": float(desempenho["r2"]),
        }
    return {"acuracia": round(float(desempenho["acuracia"]) / 100, 4)}


def _amostra_da_tela(
    teste_x: pd.DataFrame, teste_y: pd.Series, previsto: object, alvo: str
) -> tuple[list[dict[str, str]], list[float | str], list[float | str]]:
    """Até 300 linhas do teste, na ordem do corte, para os gráficos da tela."""
    quantidade = min(TAMANHO_AMOSTRA, len(teste_x))
    tabela = teste_x.iloc[:quantidade]
    reais_brutos = list(teste_y.iloc[:quantidade])
    previstos_brutos = list(previsto[:quantidade])
    amostra = [{"Make": "" if pd.isna(valor) else str(valor)} for valor in tabela["make"]]
    if alvo == "autonomia":
        reais = [round(float(valor), 1) for valor in reais_brutos]
        previstos = [round(float(valor), 1) for valor in previstos_brutos]
        return amostra, reais, previstos
    return amostra, _rotulos(reais_brutos), _rotulos(previstos_brutos)


def _rotulos(valores: list[object]) -> list[str]:
    return [ROTULOS_EXIBICAO.get(str(valor), str(valor)) for valor in valores]
