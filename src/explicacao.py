"""Converte um modelo salvo em texto e números para os gráficos da tela."""

import numpy as np

from src.rotulos import ROTULOS_EXIBICAO, sigla_tipo

LIMITE_COEFICIENTES = 8


def separar_feature(feature: str) -> tuple[str, str]:
    """Separa 'cat__make_TESLA' em ('make', 'TESLA').

    Exemplo:
        separar_feature("ano__model_year")
    """
    bruto = feature.split("__", 1)[-1]
    if bruto == "model_year":
        return "model_year", ""
    for coluna in ("ev_type", "make", "model"):
        prefixo = coluna + "_"
        if bruto.startswith(prefixo):
            return coluna, bruto[len(prefixo):]
    return bruto, ""


def nome_legivel(feature: str) -> str:
    """Nome curto de uma coluna do modelo, para o gráfico de coeficientes.

    Exemplo:
        nome_legivel("cat__ev_type_Battery Electric Vehicle (BEV)")
    """
    coluna, valor = separar_feature(feature)
    if coluna == "model_year":
        return "Ano de fabricação"
    if coluna == "ev_type":
        return "Tipo " + sigla_tipo(valor)
    if coluna == "make":
        return "Fabricante " + valor
    if coluna == "model":
        return "Modelo " + valor
    return feature


def ramos_da_divisao(feature: str, limite: float) -> tuple[str, str, str]:
    """Pergunta do nó e os textos do ramo esquerdo e do direito.

    Exemplo:
        ramos_da_divisao("ano__model_year", 2018.5)
    """
    coluna, _valor = separar_feature(feature)
    if coluna == "model_year":
        ano = int(limite)
        return f"Ano ≤ {ano}?", "sim", "não"
    return f"{nome_legivel(feature)}?", "não", "sim"


def escolher_coeficientes(pares: list[tuple[str, float]]) -> list[dict[str, float | str]]:
    """Ano e tipo sempre entram; o restante completa até o limite, pelo módulo.

    Exemplo:
        escolher_coeficientes([("ano__model_year", 1.5)])
    """
    def coluna(feature: str) -> str:
        return separar_feature(feature)[0]

    fixos = [par for par in pares if coluna(par[0]) in ("model_year", "ev_type")]
    outros = [par for par in pares if coluna(par[0]) not in ("model_year", "ev_type")]
    outros.sort(key=lambda par: abs(par[1]), reverse=True)
    saida: list[dict[str, float | str]] = []
    for feature, valor in fixos + outros:
        saida.append({"nome": nome_legivel(feature), "valor": round(float(valor), 2)})
        if len(saida) >= LIMITE_COEFICIENTES:
            break
    return saida


def coeficientes_do_modelo(pipeline: object, alvo: str) -> list[tuple[str, float]]:
    """Coeficientes no espaço original. O ano padronizado volta para 'por ano'.

    Exemplo:
        coeficientes_do_modelo(pipeline, "autonomia")
    """
    preparo = pipeline.named_steps["prep"]
    estimador = pipeline.named_steps["modelo"]
    nomes = list(preparo.get_feature_names_out())
    if alvo == "autonomia":
        valores = [float(valor) for valor in estimador.coef_]
    else:
        indice = list(estimador.classes_).index("Elegivel")
        valores = [float(valor) for valor in estimador.coef_[indice]]
    return _ajustar_ano(preparo, nomes, valores)


def _ajustar_ano(preparo: object, nomes: list[str], valores: list[float]) -> list[tuple[str, float]]:
    escala = getattr(preparo.named_transformers_["ano"], "scale_", None)
    desvio = float(escala[0]) if escala is not None else 1.0
    if desvio == 0:
        raise ValueError("desvio padrão do ano deve ser > 0 para converter o coeficiente")
    ajustados: list[tuple[str, float]] = []
    for nome, valor in zip(nomes, valores):
        if separar_feature(nome)[0] == "model_year" and escala is not None:
            valor = valor / desvio
        ajustados.append((nome, valor))
    return ajustados


def exportar_coeficientes(pipeline: object, alvo: str, metricas: str) -> dict[str, object]:
    """Barras do modelo linear e o texto que a tela mostra embaixo do título.

    Exemplo:
        exportar_coeficientes(pipeline, "autonomia", "No teste: MAE 13 milhas.")
    """
    estimador = pipeline.named_steps["modelo"]
    if alvo == "autonomia":
        titulo = "Regressão linear: coeficientes"
        unidade = "milhas"
        detalhe = f"Intercepto {estimador.intercept_:.1f} milhas. {metricas}"
    else:
        titulo = "Regressão logística: chance de Elegível"
        unidade = "log-chance"
        detalhe = "Valor positivo aumenta a chance da classe Elegível. " + metricas
    return {
        "titulo": titulo,
        "descricao": detalhe,
        "unidade": unidade,
        "coeficientes": escolher_coeficientes(coeficientes_do_modelo(pipeline, alvo)),
    }


def exportar_arvore(pipeline: object, alvo: str, metricas: str) -> dict[str, object]:
    """A árvore salva inteira, no formato do diagrama da tela.

    Exemplo:
        exportar_arvore(pipeline, "cafv", "No teste: acurácia 99%.")
    """
    estimador = pipeline.named_steps["modelo"]
    nomes = list(pipeline.named_steps["prep"].get_feature_names_out())
    classes = list(getattr(estimador, "classes_", []))
    niveis = int(estimador.tree_.max_depth)
    return {
        "titulo": "Árvore de decisão",
        "descricao": f"Profundidade máxima 16, escolhida pelo erro no teste. O desenho tem {niveis} níveis. " + metricas,
        "raiz": _exportar_no(estimador.tree_, 0, nomes, classes, alvo),
    }


def _exportar_no(arvore: object, indice: int, nomes: list[str], classes: list[str], alvo: str) -> dict[str, object]:
    no: dict[str, object] = {
        "pergunta": None,
        "n": int(arvore.n_node_samples[indice]),
        "rotulo": _rotulo_no(arvore, indice, classes, alvo),
        "ramo_sim": "",
        "ramo_nao": "",
        "sim": None,
        "nao": None,
    }
    if int(arvore.feature[indice]) < 0:
        return no
    feature = nomes[int(arvore.feature[indice])]
    pergunta, ramo_sim, ramo_nao = ramos_da_divisao(feature, float(arvore.threshold[indice]))
    no["pergunta"] = pergunta
    no["ramo_sim"] = ramo_sim
    no["ramo_nao"] = ramo_nao
    no["sim"] = _exportar_no(arvore, int(arvore.children_left[indice]), nomes, classes, alvo)
    no["nao"] = _exportar_no(arvore, int(arvore.children_right[indice]), nomes, classes, alvo)
    return no


def _rotulo_no(arvore: object, indice: int, classes: list[str], alvo: str) -> str:
    valores = np.asarray(arvore.value[indice][0])
    if alvo == "autonomia":
        return f"{float(valores[0]):.1f} milhas"
    classe = classes[int(np.argmax(valores))]
    return ROTULOS_EXIBICAO.get(str(classe), str(classe))
