import pandas as pd

# Nomes do CSV oficial -> nomes internos. Colunas que não vierem no upload são ignoradas.
MAPEAMENTO_COLUNAS = {
    'VIN (1-10)': 'vin',
    'County': 'county',
    'City': 'city',
    'State': 'state',
    'Postal Code': 'postal_code',
    'Model Year': 'model_year',
    'Make': 'make',
    'Model': 'model',
    'Electric Vehicle Type': 'ev_type',
    'Clean Alternative Fuel Vehicle (CAFV) Eligibility': 'cafv_eligibility',
    'Electric Range': 'electric_range',
    'Legislative District': 'legislative_district',
    'DOL Vehicle ID': 'dol_vehicle_id',
    'Vehicle Location': 'vehicle_location',
    'Electric Utility': 'electric_utility',
    '2020 GEOID': 'geoid_2020'
}


def simplificar_cafv(status: object) -> str:
    """Reduz o texto do CAFV aos três rótulos usados no treino."""
    if pd.isna(status):
        return 'Desconhecido'
    status_str = str(status).lower()
    if 'clean alternative fuel vehicle eligible' in status_str:
        return 'Elegivel'
    if 'not eligible' in status_str:
        return 'Nao Elegivel'
    return 'Desconhecido'


def preencher_ano(serie: pd.Series) -> pd.Series:
    """Ano vazio recebe a mediana dos anos da própria tabela. Sem nenhum ano, fica 0."""
    anos = pd.to_numeric(serie, errors='coerce')
    mediana = anos.median()
    if pd.isna(mediana):
        mediana = 0
    return anos.fillna(mediana)


def limpar_tabela(df: pd.DataFrame) -> pd.DataFrame:
    """Aplica o tratamento do CSV oficial a uma tabela já carregada.

    O treino inicial e o retreino usam esta função, para os dois falarem a mesma língua.
    A tabela precisa ter Model Year, Electric Range e a coluna de elegibilidade CAFV.
    """
    dados = df.rename(columns=MAPEAMENTO_COLUNAS)
    dados['cafv_status'] = dados['cafv_eligibility'].apply(simplificar_cafv)
    dados['electric_range'] = pd.to_numeric(dados['electric_range'], errors='coerce').fillna(0)
    dados['model_year'] = preencher_ano(dados['model_year'])
    return dados


def carregar_e_limpar_dados(caminho_csv: str) -> pd.DataFrame:
    """
    Carrega o dataset de Veículos Elétricos e aplica os tratamentos de limpeza necessários.

    Parâmetros:
        caminho_csv (str): Caminho para o arquivo CSV do dataset.

    Retorna:
        pd.DataFrame: DataFrame tratado e pronto para análise/treinamento.
    """
    return limpar_tabela(pd.read_csv(caminho_csv))


if __name__ == '__main__':
    # Teste rápido do script de limpeza
    caminho_teste = '../data/Electric_Vehicle_Population_Data_20261103.csv'
    dados_limpos = carregar_e_limpar_dados(caminho_teste)
    print(f"Dataset carregado com sucesso! Linhas: {dados_limpos.shape[0]}, Colunas: {dados_limpos.shape[1]}")
    print("\nContagem por Elegibilidade CAFV:")
    print(dados_limpos['cafv_status'].value_counts())