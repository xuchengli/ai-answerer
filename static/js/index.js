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

$(document).ready(() => {
  const audioPlayer = new AudioPlayer("/static/js");
  audioPlayer.onPlay = () => {
    console.log("onPlay");
  };
  audioPlayer.onStop = (audioDatas) => {
    console.log("onStop");
    console.log(audioDatas);
  };
  audioPlayer.start({
    autoPlay: true,
    sampleRate: 16000,
    resumePlayDuration: 1000
  });

  var source = new EventSource("/stream");
  source.addEventListener('answer', function(event) {
    var data = JSON.parse(event.data);
    $('#result')[0].innerText += data.message;

    if (data.audio) {
      audioPlayer.postMessage({
        type: "base64",
        data: data.audio,
      });
    }
  }, false);
  source.addEventListener('error', function(event) {
    hint('danger', "Failed to connect to event stream. Is Redis running?");
  }, false);
});