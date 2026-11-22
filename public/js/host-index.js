// public/js/host-index.js — start a live session from the host page.
(function () {
  "use strict";
  document.querySelectorAll(".js-start-live").forEach(function (btn) {
    btn.addEventListener("click", function () {
      apiSend("/api/host/start", "POST", { quizId: btn.dataset.quizId }, btn)
        .then(function (res) { if (res.redirect) location.href = res.redirect; })
        .catch(function (err) { window.toast(err.message, "bad"); });
    });
  });
})();
