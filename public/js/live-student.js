// public/js/live-student.js — the student's live-test client.
// The server never sends answers; the student can only answer the currently open item.
// Anti-cheat: leaving the page (tab, app, fullscreen exit, sign-out) is reported and
// counts toward auto-submit at the cap set by the adviser.
(function () {
  "use strict";
  var dataEl = document.getElementById("page-data");
  var data = dataEl ? JSON.parse(dataEl.textContent) : {};
  if (!data.userId) return;

  var wait = document.getElementById("live-wait");
  var waitMsg = document.getElementById("live-wait-msg");
  var waitMeta = document.getElementById("live-wait-meta");
  var itemBox = document.getElementById("live-item");
  var resultBox = document.getElementById("live-result");
  var submittedBox = document.getElementById("live-submitted");
  var submittedMsg = document.getElementById("live-submitted-msg");
  var removedBox = document.getElementById("live-removed");
  var errorBox = document.getElementById("live-error");
  var errorMsg = document.getElementById("live-error-msg");
  var attemptChip = document.getElementById("live-attempt-chip");
  var retryReasonEl = document.getElementById("retry-reason");
  var retryAskBtn = document.getElementById("retry-ask");
  var retryStatusEl = document.getElementById("retry-status");

  var optionsWrap = document.getElementById("live-options");
  var shortWrap = document.getElementById("live-short-wrap");
  var shortInput = document.getElementById("live-short");
  var shortSubmit = document.getElementById("live-short-submit");
  var questionEl = document.getElementById("live-question");
  var pointsEl = document.getElementById("live-item-points");
  var progressLabel = document.getElementById("live-progress-label");
  var progressBar = document.getElementById("live-progress-bar");
  var feedback = document.getElementById("live-feedback");
  var answeredNote = document.getElementById("live-answered-note");
  var countBox = document.getElementById("live-count");
  var countValue = document.getElementById("live-count-value");

  var socket = null;
  var current = null; // { item, index, total, itemStartedAt, autoAdvanceSec, status, quizTitle, sessionId, antiCheat }
  var myAnswers = {};
  var me = { finished: false, autoSubmitted: false, attemptNo: 1, retryStatus: "none" };
  var answeredThisItem = false;
  var timerInterval = null;
  var sessionActive = false; // true once we're actually inside a session
  var lastLeaveSent = 0;     // dedupe: one user action fires several browser events (blur+visibility+pagehide)

  function show(box) {
    [wait, itemBox, resultBox, submittedBox, removedBox].forEach(function (b) { b.hidden = b !== box; });
  }
  function fail(msg) {
    errorBox.hidden = false;
    errorMsg.textContent = msg;
  }

  // ===== anti-cheat reporting =====
  function reportLeave(reason) {
    if (!socket || !sessionActive || !current || !current.sessionId) return;
    if (me.finished) return;
    var now = Date.now();
    if (now - lastLeaveSent < 1500) return; // same physical action, multiple events — count it once
    lastLeaveSent = now;
    socket.emit("live:warning", { sessionId: current.sessionId, reason: reason });
    // best-effort HTTP fallback in case the socket dies with the tab
    try {
      fetch("/api/live/warning", {
        method: "POST", keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason }),
      }).catch(function () {});
    } catch (e) { /* older browsers */ }
  }

  function startAntiCheat() {
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) reportLeave("Left the tab during the test");
    });
    // clicking into another app / another window
    window.addEventListener("blur", function () {
      if (!document.hidden) reportLeave("Left the test window");
    });
    // closing or navigating away from the tab
    ["pagehide", "beforeunload"].forEach(function (ev) {
      window.addEventListener(ev, function () { reportLeave("Closed or reloaded the page"); });
    });
    // escaping fullscreen mid-test counts as leaving
    document.addEventListener("fullscreenchange", fullscreenChanged);
    ["copy", "cut", "paste", "contextmenu"].forEach(function (ev) {
      document.addEventListener(ev, function (e) { e.preventDefault(); });
    });
  }
  startAntiCheat();

  function requestFullscreen() {
    var el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement) {
      var p = el.requestFullscreen();
      if (p && p.catch) p.catch(function () {
        // the browser refused (no user gesture yet) — offer a tap-to-enter button instead
        var cta = document.getElementById("fs-cta");
        if (cta && sessionActive && !me.finished) cta.hidden = false;
      });
    }
  }

  function wantsFullscreen() {
    return !!(sessionActive && current && current.antiCheat && current.antiCheat.fullscreen && !me.finished);
  }

  function fullscreenChanged() {
    var cta = document.getElementById("fs-cta");
    if (cta) cta.hidden = !!document.fullscreenElement || !wantsFullscreen();
    if (!document.fullscreenElement) {
      reportLeave("Exited fullscreen during the test"); // no-op unless the test is live
    }
  }

  // a tap anywhere doubles as a user gesture, so browsers accept the fullscreen request
  document.addEventListener("click", function () {
    if (wantsFullscreen() && !document.fullscreenElement) requestFullscreen();
  }, true);

  function stopTimer() { if (timerInterval) { clearInterval(timerInterval); timerInterval = null; } }

  function tickCountdown() {
    stopTimer();
    if (!current || !current.autoAdvanceSec || !current.itemStartedAt) { countBox.hidden = true; return; }
    countBox.hidden = false;
    var deadline = new Date(current.itemStartedAt).getTime() + current.autoAdvanceSec * 1000;
    var update = function () {
      var left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      countValue.textContent = left + "s";
      countBox.classList.toggle("warn", left <= 5);
    };
    update();
    timerInterval = setInterval(update, 500);
  }

  function renderWait(state) {
    show(wait);
    waitMsg.textContent = state.status === "lobby"
      ? "You're in the lobby. The host will open the first item in a moment…"
      : "Getting the current item…";
    waitMeta.textContent = state.quizTitle ? ("Quiz: " + state.quizTitle) : "";
  }

  function renderState(state) {
    var sessionId = current && current.sessionId;
    current = Object.assign({}, state, { sessionId: sessionId });
    if (state.me) me = Object.assign(me, state.me);
    if (state.myAnswers) myAnswers = state.myAnswers;

    if (state.status === "ended") return renderEnded(null);
    // finished (auto-submitted or manually finished) → the submitted screen, not more items
    if (me.finished || me.autoSubmitted) return renderSubmitted();
    if (state.status !== "active" || !state.item) return renderWait(state);

    sessionActive = true;
    show(itemBox);
    if (attemptChip) {
      attemptChip.hidden = !(me.attemptNo > 1);
      attemptChip.textContent = "attempt " + me.attemptNo;
    }
    progressLabel.textContent = "Item " + (state.index + 1) + " of " + state.total;
    progressBar.style.width = Math.round(((state.index + 1) / state.total) * 100) + "%";
    pointsEl.textContent = state.item.points + (state.item.points === 1 ? " point" : " points");
    questionEl.textContent = state.item.question;
    feedback.hidden = true;
    answeredThisItem = !!myAnswers[state.item.id];
    answeredNote.hidden = !answeredThisItem;

    // options
    optionsWrap.innerHTML = "";
    if (state.item.type === "mcq") {
      (state.item.options || []).forEach(function (o) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-outline live-option";
        btn.textContent = o.text;
        btn.disabled = answeredThisItem;
        btn.addEventListener("click", function () { answer(state.item.id, o.id, btn); });
        optionsWrap.appendChild(btn);
      });
      shortWrap.hidden = true;
    } else if (state.item.type === "tf") {
      ["true", "false"].forEach(function (v) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-outline live-option";
        btn.textContent = v === "true" ? "True" : "False";
        btn.disabled = answeredThisItem;
        btn.addEventListener("click", function () { answer(state.item.id, v, btn); });
        optionsWrap.appendChild(btn);
      });
      shortWrap.hidden = true;
    } else {
      optionsWrap.hidden = true;
      shortWrap.hidden = false;
      shortInput.value = "";
      shortInput.disabled = answeredThisItem;
      shortSubmit.disabled = answeredThisItem;
      if (!answeredThisItem) shortInput.focus();
    }
    optionsWrap.hidden = state.item.type === "short";
    tickCountdown();
    if (!answeredThisItem && current.antiCheat && current.antiCheat.fullscreen) requestFullscreen();
  }

  function answer(itemId, value, btn) {
    if (!socket || answeredThisItem) return;
    if (btn) btn.classList.add("is-picked");
    socket.emit("live:answer", { sessionId: current.sessionId, itemId: itemId, answer: value });
    answeredThisItem = true;
    answeredNote.hidden = false;
    optionsWrap.querySelectorAll(".live-option").forEach(function (b) { b.disabled = true; });
    shortInput.disabled = true; shortSubmit.disabled = true;
  }

  function renderSubmitted() {
    stopTimer();
    show(submittedBox);
    var icon = document.getElementById("live-submitted-icon");
    var title = document.getElementById("live-submitted-title");
    var scoreChip = document.getElementById("live-submitted-score");
    if (me.autoSubmitted) {
      // distinct amber state: this is a warning, not a failure — score kept, adviser decides on retries
      if (icon) {
        icon.className = "modal-icon is-amber";
        icon.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-alert"></use></svg>';
      }
      if (title) title.textContent = "Your test was submitted";
      submittedMsg.textContent = "You hit the warning limit (" + (me.warnings || "?") + " leaves), so what you answered was locked in as-is. You can't answer more items.";
    } else {
      if (icon) {
        icon.className = "modal-icon is-ok";
        icon.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-check"></use></svg>';
      }
      if (title) title.textContent = "Attempt finished";
      submittedMsg.textContent = "You've finished your attempt. Waiting for the rest of the section.";
      if (retryReasonEl) retryReasonEl.hidden = true;
      if (retryAskBtn) retryAskBtn.hidden = true;
    }
    if (scoreChip) {
      var scoreEl = scoreChip.querySelector(".chip");
      if (typeof me.score === "number") {
        scoreEl.textContent = "Score banked: " + me.score + (me.score === 1 ? " point" : " points");
        scoreChip.hidden = false;
      } else {
        scoreChip.hidden = true;
      }
    }
    if (me.retryStatus === "pending" && retryStatusEl) {
      retryStatusEl.textContent = "Request sent — waiting for the adviser to decide.";
      if (retryAskBtn) { retryAskBtn.disabled = true; retryAskBtn.textContent = "Request sent"; }
    }
    if (me.retryStatus === "declined" && retryStatusEl) {
      retryStatusEl.textContent = "The adviser declined your re-attempt request. Talk to them after class.";
    }
  }

  function renderEnded(payload) {
    stopTimer();
    show(resultBox);
    var body = document.getElementById("live-result-body");
    body.innerHTML = "";
    var standings = (payload && payload.standings) || [];
    standings.forEach(function (p, i) {
      var tr = document.createElement("tr");
      if (p.id && data.userId && p.id === data.userId) tr.className = "is-me";
      tr.innerHTML = "<td><b>" + (i + 1) + "</b></td><td>" + escapeHtml(p.name) +
        (p.autoSubmitted ? ' <span class="chip chip-amber">auto-submitted</span>' : "") +
        "</td><td><b>" + p.score + "</b></td>";
      body.appendChild(tr);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  shortSubmit.addEventListener("click", function () {
    if (!current || !current.item || answeredThisItem) return;
    var v = shortInput.value.trim();
    if (!v) { shortInput.focus(); return; }
    answer(current.item.id, v);
  });
  shortInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); shortSubmit.click(); }
  });

  var fsCta = document.getElementById("fs-cta");
  if (fsCta) fsCta.addEventListener("click", function () { requestFullscreen(); });

  if (retryAskBtn) {
    retryAskBtn.addEventListener("click", function () {
      if (!current || !current.sessionId) return;
      retryAskBtn.disabled = true;
      socket.emit("live:retry_request", { sessionId: current.sessionId, reason: (retryReasonEl && retryReasonEl.value || "").trim() });
    });
  }

  function isForMe(payload) { return !payload || !payload.targetUser || payload.targetUser === data.userId; }

  function connect() {
    socket = io({ auth: { userId: data.userId }, reconnection: true, reconnectionDelay: 1200 });
    socket.on("connect", function () {
      errorBox.hidden = true;
      if (current && current.sessionId) {
        socket.emit("live:join", { sessionId: current.sessionId });
      } else {
        fetch("/api/live/current").then(function (r) { return r.json(); }).then(function (res) {
          if (!res.session) {
            renderWait({ status: "lobby" });
            waitMsg.textContent = "No live test is running right now. Keep this page open — it will start by itself once your host begins.";
            setTimeout(connect, 4000);
            return;
          }
          current = { sessionId: res.session.id, quizTitle: res.session.quizTitle };
          if (res.session.finished) me.finished = true;
          waitMeta.textContent = res.session.quizTitle ? ("Quiz: " + res.session.quizTitle + " · hosted by " + (res.session.hostName || "your host")) : "";
          socket.emit("live:join", { sessionId: res.session.id });
        }).catch(function () { fail("Could not reach the server. Retrying…"); setTimeout(connect, 4000); });
      }
    });
    socket.on("live:state", renderState);
    socket.on("live:ended", renderEnded);
    socket.on("live:answer_ack", function (ack) {
      if (typeof me.score !== "number") me.score = 0;
      me.score += ack.points || 0; // keeps the "score banked" chip honest without a rejoin
      feedback.hidden = false;
      feedback.className = "live-feedback " + (ack.correct ? "ok" : "no");
      feedback.innerHTML = ack.correct
        ? '<svg class="icon icon-sm" aria-hidden="true"><use href="#i-check"></use></svg><span>Correct — +' + ack.points + " point" + (ack.points === 1 ? "" : "s") + " banked.</span>"
        : '<svg class="icon icon-sm" aria-hidden="true"><use href="#i-x"></use></svg><span>Missed this one. The next item decides it.</span>';
    });
    socket.on("live:warning_ack", function (w) {
      if (!isForMe(w)) return;
      me.warnings = w.warnings;
      if (w.autoSubmitted) return; // the auto_submitted screen explains it
      window.toast("Warning " + w.warnings + " of " + w.cap + " — every leave counts. Stay on this page.", "bad");
    });
    socket.on("live:auto_submitted", function (w) {
      if (!isForMe(w)) return;
      me.autoSubmitted = true;
      me.finished = true;
      me.warnings = w.warnings || me.warnings;
      renderSubmitted();
    });
    // room-level warning events also carry the running count
    socket.on("live:warning", function (w) {
      if (!isForMe(w)) return;
      if (w.autoSubmitted) { me.autoSubmitted = true; me.finished = true; me.warnings = w.warnings; renderSubmitted(); }
      else if (typeof w.warnings === "number") me.warnings = w.warnings;
    });
    socket.on("live:retry_status", function (p) {
      if (!isForMe(p)) return;
      me.retryStatus = "pending";
      if (retryStatusEl) retryStatusEl.textContent = "Request sent — waiting for the adviser to decide.";
      if (retryAskBtn) { retryAskBtn.disabled = true; retryAskBtn.textContent = "Request sent"; }
    });
    socket.on("live:retry_result", function (p) {
      if (!isForMe(p)) return;
      if (p.approved) {
        me = { finished: false, autoSubmitted: false, attemptNo: p.attemptNo || 2, retryStatus: "none" };
        myAnswers = {};
        window.toast("Re-attempt approved — you're back in. Attempt " + (p.attemptNo || 2) + ".", "ok");
        socket.emit("live:join", { sessionId: current && current.sessionId });
        if (current && current.antiCheat && current.antiCheat.fullscreen) requestFullscreen();
      } else {
        me.retryStatus = "declined";
        if (retryStatusEl) retryStatusEl.textContent = p.message || "The adviser declined your re-attempt request.";
        if (retryAskBtn) retryAskBtn.disabled = true;
      }
    });
    socket.on("live:removed", function (p) { if (isForMe(p)) show(removedBox); });
    socket.on("live:error", function (e) { fail(e.message || "Live test error."); });
    socket.on("disconnect", function () {
      if (wait.hidden) return;
      waitMsg.textContent = "Connection dropped — reconnecting…";
    });
  }

  connect();
})();
