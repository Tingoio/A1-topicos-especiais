from flask import Flask, render_template, send_from_directory
import os

app = Flask(__name__)

# Diretórios base
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')

# Rotas de navegação do site
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/previsoes')
def previsoes():
    return render_template('previsoes.html')

@app.route('/retreinamento')
def retreinamento():
    return render_template('retreinamento.html')

# Rota essencial para o PapaParse (JavaScript) conseguir baixar o CSV da pasta data/
@app.route('/data/<path:filename>')
def baixar_dados(filename):
    return send_from_directory(DATA_DIR, filename)

if __name__ == '__main__':
    app.run(debug=True, port=5000)