import os
from flask import Flask, render_template, request, url_for, send_from_directory
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'

@app.route('/')
def index():
    return render_template('index.html')

@app.post('/upload')
def upload():
    file = request.files['file']
    if file:
        filename = secure_filename(file.filename)
        file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
    return url_for('download_file', name=filename)

@app.route('/uploads/<name>')
def download_file(name):
    return send_from_directory(app.config["UPLOAD_FOLDER"], name)