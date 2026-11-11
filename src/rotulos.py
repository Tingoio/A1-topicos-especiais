"""Nomes de colunas e rótulos de CAFV compartilhados pelo treino e pela previsão."""

COLUNAS_MODELO: list[str] = ["model_year", "make", "model", "ev_type"]

COLUNAS_UPLOAD: dict[str, str] = {
    "Model Year": "model_year",
    "Make": "make",
    "Model": "model",
    "Electric Vehicle Type": "ev_type",
}

# O retreino precisa das entradas e dos dois alvos reais.
COLUNAS_TREINO: dict[str, str] = {
    **COLUNAS_UPLOAD,
    "Electric Range": "electric_range",
    "Clean Alternative Fuel Vehicle (CAFV) Eligibility": "cafv_eligibility",
}

ROTULOS_EXIBICAO: dict[str, str] = {
    "Elegivel": "Elegível",
    "Nao Elegivel": "Não elegível",
    "Desconhecido": "Desconhecido",
}

ALVOS: tuple[str, ...] = ("autonomia", "cafv")
MODELOS: tuple[str, ...] = ("linear", "arvore")


def sigla_tipo(texto: str) -> str:
    """Reduz o tipo do veículo à sigla entre parênteses, quando existe.

    Exemplo:
        sigla_tipo("Battery Electric Vehicle (BEV)")
    """
    if "(" not in texto or ")" not in texto:
        return texto
    return texto.split("(", 1)[1].split(")", 1)[0]
