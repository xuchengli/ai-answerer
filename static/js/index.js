function hint(level, message) {
  $("#liveToast").removeClass("text-bg-success text-bg-warning text-bg-danger").addClass(`text-bg-${level}`);
  $("#liveToast .toast-body p")[0].innerText = message;
  $("#liveToast").toast("show");
}

function disableAll(disabled, spinner = false) {
  $("#formFile").attr("disabled", disabled);
  $("#submitBtn").attr("disabled", disabled);
  if (spinner) {
    $(".spinner-border").toggleClass("d-none");
  }
}

function upload() {
  disableAll(true);

  const fileToUpload = new FormData();
  fileToUpload.append('file', $("#formFile")[0].files[0]);

  $.ajax({
    url: '/upload',
    type: 'POST',
    data: fileToUpload,
    processData: false,
    contentType: false,
    success: res => {
      disableAll(false);
      $("#imgPreview")[0].src = res;
    },
    error: res => {
      hint("danger", "upload failed, error: " + res.responseText);
      disableAll(false);
    },
  });
}

function submit() {
  const question = $("#imgPreview")[0].src;

  disableAll(true, true);

  $.ajax({
    url: '/answer',
    method: 'GET',
    data: {
      question: question.substring(question.lastIndexOf("/") + 1),
    },
    success: () => {
      disableAll(false, true);
      hint("success", "解答完成");
    },
    error: res => {
      disableAll(false, true);
      hint("danger", res.responseJSON.msg);
    }
  });
}

const APPID = "4cadc478";
const API_SECRET = "YmJhMmIzN2VmOGJlZDg3NjhiNGFmMjEz";
const API_KEY = "4463f60a44ac732ef556f15ef10a01ab";

function getWebSocketUrl(apiKey, apiSecret) {
  var url = "wss://tts-api.xfyun.cn/v2/tts";
  var host = location.host;
  var date = new Date().toGMTString();
  var algorithm = "hmac-sha256";
  var headers = "host date request-line";
  var signatureOrigin = `host: ${host}\ndate: ${date}\nGET /v2/tts HTTP/1.1`;
  var signatureSha = CryptoJS.HmacSHA256(signatureOrigin, apiSecret);
  var signature = CryptoJS.enc.Base64.stringify(signatureSha);
  var authorizationOrigin = `api_key="${apiKey}", algorithm="${algorithm}", headers="${headers}", signature="${signature}"`;
  var authorization = btoa(authorizationOrigin);
  url = `${url}?authorization=${authorization}&date=${date}&host=${host}`;
  return url;
}

function encodeText(text, type) {
  if (type === "unicode") {
    let buf = new ArrayBuffer(text.length * 4);
    let bufView = new Uint16Array(buf);
    for (let i = 0, strlen = text.length; i < strlen; i++) {
      bufView[i] = text.charCodeAt(i);
    }
    let binary = "";
    let bytes = new Uint8Array(buf);
    let len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  } else {
    return Base64.encode(text);
  }
}

const audioPlayer = new AudioPlayer("/static/js");
audioPlayer.onPlay = () => {
  console.log("onPlay");
};
audioPlayer.onStop = (audioDatas) => {
  console.log("onStop");
  console.log(audioDatas);
};

let ttsWS;
function connectWebSocket() {
  const url = getWebSocketUrl(API_KEY, API_SECRET);
  if ("WebSocket" in window) {
    ttsWS = new WebSocket(url);
  } else if ("MozWebSocket" in window) {
    ttsWS = new MozWebSocket(url);
  } else {
    alert("浏览器不支持WebSocket");
    return;
  }
  ttsWS.onopen = (e) => {
    audioPlayer.start({
      autoPlay: true,
      sampleRate: 16000,
      resumePlayDuration: 1000
    });

    var text = $('#result')[0].innerText;

    var params = {
      common: {
        app_id: APPID,
      },
      business: {
        aue: "raw",
        auf: "audio/L16;rate=16000",
        vcn: "xiaoyan",
        speed: +50,
        volume: +50,
        pitch: +50,
        bgs: 1,
        tte: "UTF8",
      },
      data: {
        status: 2,
        text: encodeText(text, "UTF8"),
      },
    };
    ttsWS.send(JSON.stringify(params));
  };
  ttsWS.onmessage = (e) => {
    let jsonData = JSON.parse(e.data);
    // 合成失败
    if (jsonData.code !== 0) {
      console.error(jsonData);
      return;
    }
    audioPlayer.postMessage({
      type: "base64",
      data: jsonData.data.audio,
      isLastData: jsonData.data.status === 2,
    });
    if (jsonData.code === 0 && jsonData.data.status === 2) {
      ttsWS.close();
    }
  };
  ttsWS.onerror = (e) => {
    console.error(e);
  };
  ttsWS.onclose = (e) => {
    // console.log(e);
  };
}

$(document).ready(() => {
  connectWebSocket();
});