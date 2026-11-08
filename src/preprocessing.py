import pandas as pd
import numpy as np


def carregar_e_limpar_dados(caminho_csv: str) -> pd.DataFrame:
    """
    Carrega o dataset de Veículos Elétricos e aplica os tratamentos de limpeza necessários.

    Parâmetros:
        caminho_csv (str): Caminho para o arquivo CSV do dataset.

    Retorna:
        pd.DataFrame: DataFrame tratado e pronto para análise/treinamento.
    """
    # 1. Carregar o arquivo CSV
    df = pd.read_csv(caminho_csv)

    # 2. Renomear colunas para remover espaços e caracteres especiais
    mapeamento_colunas = {
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
    df.rename(columns=mapeamento_colunas, inplace=True)

    # 3. Tratamento da variável-alvo de Classificação (CAFV)
    # Padroniza as categorias de elegibilidade CAFV em rótulos limpos
    def simplificar_cafv(status):
        if pd.isna(status):
            return 'Desconhecido'
        status_str = str(status).lower()
        if 'clean alternative fuel vehicle eligible' in status_str:
            return 'Elegivel'
        elif 'not eligible' in status_str:
            return 'Nao Elegivel'
        else:
            return 'Desconhecido'

    df['cafv_status'] = df['cafv_eligibility'].apply(simplificar_cafv)

    # 4. Tratamento da variável-alvo de Regressão (Electric Range)
    # Garante que a autonomia seja um valor numérico e substitui nulos por 0
    df['electric_range'] = pd.to_numeric(df['electric_range'], errors='coerce').fillna(0)

    # 5. Tratamento de colunas numéricas adicionais
    df['model_year'] = pd.to_numeric(df['model_year'], errors='coerce').fillna(df['model_year'].median())

    return df


if __name__ == '__main__':
    # Teste rápido do script de limpeza
    caminho_teste = '../data/Electric_Vehicle_Population_Data_20261103.csv'
    dados_limpos = carregar_e_limpar_dados(caminho_teste)
    print(f"Dataset carregado com sucesso! Linhas: {dados_limpos.shape[0]}, Colunas: {dados_limpos.shape[1]}")
    print("\nContagem por Elegibilidade CAFV:")
    print(dados_limpos['cafv_status'].value_counts())