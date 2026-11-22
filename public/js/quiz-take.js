// public/js/quiz-take.js — progress bar + optional countdown.
(function () {
  "use strict";
  var form = document.getElementById("quiz-form");
  if (!form) return;

  var bar = document.getElementById("quiz-progress-bar");
  var text = document.getElementById("quiz-progress-text");
  var submitBtn = form.querySelector('button[type="submit"]');
  var inputs = form.querySelectorAll("input[name^='answers']");

  function answeredCount() {
    var seen = {};
    inputs.forEach(function (i) {
      if (i.type === "radio") { if (i.checked) seen[i.name] = 1; }
      else if (i.value.trim()) seen[i.name] = 1;
    });
    return Object.keys(seen).length;
  }
  function update() {
    var total = Number(form.getAttribute("data-total") || 0);
    var done = answeredCount();
    if (bar) bar.style.width = (total ? Math.round((done / total) * 100) : 0) + "%";
    if (text) text.textContent = done + " of " + total + " answered";
    return done;
  }
  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();

  form.addEventListener("submit", function (e) {
    if (submitBtn) { submitBtn.classList.add("is-loading"); }
    // brief delay so the loading state paints before navigation
    if (submitBtn) { e.preventDefault(); setTimeout(function () { form.submit(); }, 60); }
  });

  // warn before leaving with answers in progress
  var beforeUnloadArmed = false;
  form.addEventListener("change", function () { beforeUnloadArmed = true; });
  window.addEventListener("beforeunload", function (e) {
    if (beforeUnloadArmed) { e.preventDefault(); e.returnValue = ""; }
  });

  // countdown (server-rendered data-seconds)
  var timerBox = document.getElementById("quiz-timer");
  var timerValue = document.getElementById("timer-value");
  if (timerBox && timerValue) {
    var left = Number(timerBox.getAttribute("data-seconds") || 0);
    var t = setInterval(function () {
      left -= 1;
      if (left <= 0) {
        clearInterval(t);
        timerValue.textContent = "0:00";
        timerBox.classList.add("warn");
        window.toast("Time is up — submitting what you have.", "bad");
        if (beforeUnloadArmed) { beforeUnloadArmed = false; window.removeEventListener("beforeunload", arguments.callee); }
        form.submit();
        return;
      }
      var m = Math.floor(left / 60), s = left % 60;
      timerValue.textContent = m + ":" + (s < 10 ? "0" : "") + s;
      if (left <= 30) timerBox.classList.add("warn");
    }, 1000);
  }
})();
