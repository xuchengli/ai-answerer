import base64
import os
from flask import Flask, render_template, request, url_for, send_from_directory
from werkzeug.utils import secure_filename
from flask_sse import sse
from dotenv import load_dotenv
from zhipuai import ZhipuAI
from tts_ws import Ws_Param
import _thread as thread
import json
import websocket
import ssl

load_dotenv()

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['REDIS_URL'] = 'redis://:passw0rd@localhost'
app.config['ZHIPU_API_KEY'] = os.getenv('zhipu_api_key')
app.config['TTS_APP_ID'] = os.getenv('tts_app_id')
app.config['TTS_API_SECRET'] = os.getenv('tts_api_secret')
app.config['TTS_API_KEY'] = os.getenv('tts_api_key')
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

    # TTS websocket
    # 收到websocket连接建立的处理
    def on_open(ws):
      print("### opened ###")

    def on_message(ws, message):
      try:
          message =json.loads(message)
          code = message["code"]
          sid = message["sid"]
          audio = message["data"]["audio"]
          audio = base64.b64decode(audio)
          status = message["data"]["status"]
          print(message)
          if status == 2:
              print("ws is closed")
              # ws.close()
          if code != 0:
              errMsg = message["message"]
              print("sid:%s call error:%s code is:%s" % (sid, errMsg, code))
          else:
             sse.publish({"audio": audio}, type='answer')

      except Exception as e:
          print("receive msg,but parse exception:", e)

    # 收到websocket错误的处理
    def on_error(ws, error):
      print("### error:", error)

    # 收到websocket关闭的处理
    def on_close(ws):
      print("### closed ###")

    # 向websocket发送消息的处理
    def run(text):
        d = {"common": wsParam.CommonArgs,
             "business": wsParam.BusinessArgs,
             "data": wsParam.set_text(text),
             }
        d = json.dumps(d)
        print("------>开始发送文本数据")
        ws.send(d)

    wsParam = Ws_Param(APPID=app.config['TTS_APP_ID'],
                       APISecret=app.config['TTS_API_SECRET'],
                       APIKey=app.config['TTS_API_KEY'])
    websocket.enableTrace(False)
    wsUrl = wsParam.create_url()
    ws = websocket.WebSocketApp(wsUrl, on_message=on_message, on_error=on_error, on_close=on_close)
    ws.on_open = on_open
    ws.run_forever(sslopt={"cert_reqs": ssl.CERT_NONE})

    # 调LLM API
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
    ttsText = ''
    for chunk in answerResponse:
      if chunk.choices[0].delta.content:
        sse.publish({"message": chunk.choices[0].delta.content}, type='answer')

        if chunk.choices[0].delta.content != '\r' and chunk.choices[0].delta.content != '\n':
            ttsText += chunk.choices[0].delta.content
        else:
          if ttsText:
            thread.start_new_thread(run, (ttsText,))
          ttsText = ''

    return str(True)

@app.route('/tts')
def tts():
    return render_template('tts/index.html')