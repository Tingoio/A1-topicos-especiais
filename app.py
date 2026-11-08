from flask import Flask, jsonify, render_template, request, send_from_directory
from pathlib import Path
import os

from src.previsor import PrevisaoInvalida, prever_corpo

app = Flask(__name__)

# Diretórios base
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
app.config["DIRETORIO_MODELOS"] = os.path.join(BASE_DIR, "modelos")
app.config["MAX_CONTENT_LENGTH"] = 150 * 1024 * 1024
app.extensions["cache_modelos"] = {}

# Rotas de navegação do site
@app.route('/')
@app.route('/index.html')
def index():
    return render_template('index.html')

@app.route('/previsoes')
@app.route('/previsoes.html')
def previsoes():
    return render_template('previsoes.html')

@app.route('/retreinamento')
@app.route('/retreinamento.html')
def retreinamento():
    return render_template('retreinamento.html')

# Rota essencial para o PapaParse (JavaScript) conseguir baixar o CSV da pasta data/
@app.route('/data/<path:filename>')
def baixar_dados(filename):
    return send_from_directory(DATA_DIR, filename)


@app.route("/api/explicacoes")
def api_explicacoes():
    caminho = Path(app.config["DIRETORIO_MODELOS"]) / "explicacoes.json"
    if not caminho.is_file():
        return jsonify({"erro": f"arquivo ausente: {caminho.name}; rode python -m src.treinar"}), 503
    return app.response_class(
        caminho.read_text(encoding="utf-8"),
        mimetype="application/json; charset=utf-8",
    )


@app.route("/api/prever", methods=["POST"])
def api_prever():
    try:
        previsoes = prever_corpo(
            request.get_json(silent=True),
            Path(app.config["DIRETORIO_MODELOS"]),
            app.extensions["cache_modelos"],
        )
    except PrevisaoInvalida as erro:
        return jsonify({"erro": str(erro)}), 400
    except FileNotFoundError as erro:
        return jsonify({"erro": str(erro)}), 503
    return jsonify({"previsoes": previsoes})

if __name__ == '__main__':
    app.run(debug=True, port=5000)