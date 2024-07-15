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