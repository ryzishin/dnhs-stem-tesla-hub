// public/js/flashcards-study.js — flip, mark, bank points, finish.
(function () {
  "use strict";
  var stage = document.getElementById("deck-stage");
  if (!stage) return;
  var dataEl = document.getElementById("page-data");
  var data = dataEl ? JSON.parse(dataEl.textContent) : {};
  var cards = data.cards || [];
  if (!cards.length) return;

  var frontEl = document.getElementById("card-front");
  var backEl = document.getElementById("card-back");
  var scene = document.getElementById("flip-card");
  var progress = document.getElementById("deck-progress");
  var progressText = document.getElementById("deck-progress-text");
  var btnKnown = document.getElementById("btn-known");
  var btnAgain = document.getElementById("btn-again");

  var idx = 0, known = 0;

  // ===== swipe gestures (mobile): drag the card left/right, release to mark =====
  // right = "I knew it", left = "review again" — mirrors the two buttons.
  var dragX = null, dragY = null, dragMoved = false;
  var DRAG_COMMIT = 64;   // px of horizontal travel that counts as a swipe
  var DRAG_TINT = 14;     // px before the card starts following the finger

  function dragVisual(dx) {
    scene.style.transition = "none";
    scene.style.transform = "translateX(" + (dx * 0.45) + "px) rotate(" + (dx * 0.03) + "deg)";
    scene.style.boxShadow = dx > 0
      ? "0 10px 30px rgba(47,163,154,0.35)"   // teal — knew it
      : "0 10px 30px rgba(213,72,63,0.35)";   // coral — review again
  }
  function dragReset() {
    scene.style.transition = "transform 220ms ease, box-shadow 220ms ease";
    scene.style.transform = "";
    scene.style.boxShadow = "";
  }

  scene.addEventListener("touchstart", function (e) {
    if (e.touches.length !== 1) return;
    dragX = e.touches[0].clientX;
    dragY = e.touches[0].clientY;
    dragMoved = false;
  }, { passive: true });

  scene.addEventListener("touchmove", function (e) {
    if (dragX === null || e.touches.length !== 1) return;
    var dx = e.touches[0].clientX - dragX;
    var dy = e.touches[0].clientY - dragY;
    if (Math.abs(dx) > DRAG_TINT && Math.abs(dx) > Math.abs(dy)) {
      dragMoved = true;
      dragVisual(dx);
    }
  }, { passive: true });

  scene.addEventListener("touchend", function (e) {
    if (dragX === null) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - dragX;
    var dy = t.clientY - dragY;
    dragX = null;
    if (dragMoved && Math.abs(dx) >= DRAG_COMMIT && Math.abs(dx) > Math.abs(dy)) {
      dragReset();
      mark(dx > 0); // swipe right = knew it, swipe left = again
      return;
    }
    if (dragMoved) dragReset(); // not far enough — snap back
  });

  function show() {
    if (idx >= cards.length) return finish();
    frontEl.textContent = cards[idx].front;
    backEl.textContent = cards[idx].back;
    scene.classList.remove("is-flipped");
    progress.style.width = Math.round((idx / cards.length) * 100) + "%";
    progressText.textContent = "Card " + (idx + 1) + " of " + cards.length;
  }

  function flip() { scene.classList.toggle("is-flipped"); }

  function mark(knewIt) {
    if (knewIt) known += 1;
    idx += 1;
    show();
  }

  function finish() {
    progress.style.width = "100%";
    progressText.textContent = "Session complete";
    apiSend(stage.getAttribute("data-finish-url"), "POST", { known: known, total: cards.length })
      .then(function (res) {
        stage.innerHTML =
          '<div class="card card-pad deck-done">' +
          '<svg class="icon" aria-hidden="true"><use href="#i-cards"></use></svg>' +
          "<h2>Deck finished</h2>" +
          "<p class=\"muted\">You marked <b>" + known + " of " + cards.length + "</b> cards as known.</p>" +
          (res.pointsEarned ? '<span class="chip chip-ok">+' + res.pointsEarned + " points banked</span>" : "") +
          '<a class="btn btn-primary mt-2" href="' + stage.getAttribute("data-subject-url") + '">Back to subject</a>' +
          '<button class="btn btn-outline" id="deck-restart" type="button">Study again</button>' +
          "</div>";
        document.getElementById("deck-restart").addEventListener("click", function () { location.reload(); });
      })
      .catch(function (err) {
        window.toast(err.message || "Could not bank your points — check your connection.", "bad");
        stage.innerHTML =
          '<div class="card card-pad deck-done"><h2>Deck finished</h2>' +
          '<p class="muted">You marked <b>' + known + " of " + cards.length + '</b> as known, but the points could not be saved.</p>' +
          '<a class="btn btn-primary" href="' + stage.getAttribute("data-subject-url") + '">Back to subject</a></div>';
      });
  }

  // a finished swipe also fires a click afterwards — swallow that one so it doesn't flip.
  // the wrapper must exist BEFORE the click listener registers, or it never gets used.
  var rawFlip = flip;
  flip = function () { if (dragMoved) { dragMoved = false; return; } rawFlip(); };
  scene.addEventListener("click", flip);
  scene.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); }
  });
  btnKnown.addEventListener("click", function () { mark(true); });
  btnAgain.addEventListener("click", function () { mark(false); });
  document.addEventListener("keydown", function (e) {
    if (e.target.matches("input, textarea, select")) return;
    if (e.key === "1") mark(false);
    if (e.key === "2") mark(true);
  });

  // tell touch users the swipe exists; keyboard users already have 1 / 2
  var hint = document.querySelector(".flip-hint");
  if (hint && ("ontouchstart" in window)) hint.textContent = "Tap to flip · Swipe right if you knew it · Left to review again";

  show();
})();
