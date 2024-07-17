import base64
from email.mime import base
import os
from flask import Flask, render_template, request, url_for, send_from_directory
from werkzeug.utils import secure_filename
from flask_sse import sse
from dotenv import load_dotenv
from zhipuai import ZhipuAI

load_dotenv()

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['REDIS_URL'] = 'redis://:passw0rd@localhost'
app.config['ZHIPU_API_KEY'] = os.getenv('zhipu_api_key')
app.register_blueprint(sse, url_prefix='/stream')

def encode_image(path):
  with open(path, "rb") as image_file:
    return base64.b64encode(image_file.read()).decode('utf-8')

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

@app.route('/answer')
def answer():
    questionImage = request.args.get('question')
    base64_image = encode_image(os.path.join(app.config['UPLOAD_FOLDER'], questionImage))

    client = ZhipuAI(api_key=app.config['ZHIPU_API_KEY'])

    questionResponse = client.chat.completions.create(
      model="glm-4v",
      messages=[
        {
          'role': 'user',
          'content': [
            {
              'type': 'text',
              'text': '图里应用题是什么',
            },
            {
              'type': 'image_url',
              'image_url': {
                'url': f'data:image/jpeg;base64,{base64_image}',
              },
            },
          ],
        },
      ],
    )
    question = questionResponse.choices[0].message.content

    answerResponse = client.chat.completions.create(
      model="glm-4-alltools",
      messages=[
        {
          'role': 'user',
          'content': [
            {
              'type': 'text',
              'text': question,
            },
            {
              'type': 'text',
              'text': '请详细解答这些应用题, 按照解答思路, 计算过程和答案的格式输出',
            },
          ],
        },
      ],
      stream = True,
    )
    for chunk in answerResponse:
      if chunk.choices[0].delta.content:
        sse.publish({"message": chunk.choices[0].delta.content}, type='answer')

    return str(True)

@app.route('/tts')
def tts():
    return render_template('tts/index.html')