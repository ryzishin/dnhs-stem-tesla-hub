// public/js/live-host.js — the host's monitor console (adviser only).
(function () {
  "use strict";
  var dataEl = document.getElementById("page-data");
  var data = dataEl ? JSON.parse(dataEl.textContent) : {};
  if (!data.sessionId) return;

  var qEl = document.getElementById("mon-question");
  var optsEl = document.getElementById("mon-options");
  var progressEl = document.getElementById("mon-progress");
  var stripEl = document.getElementById("mon-strip");
  var standingsEl = document.getElementById("mon-standings");
  var participantsEl = document.getElementById("mon-participants");
  var warnsEl = document.getElementById("mon-warns");
  var answerNote = document.getElementById("mon-answer-note");
  var countBox = document.getElementById("mon-count");
  var countValue = document.getElementById("mon-count-value");
  var retryPanel = document.getElementById("retry-panel");
  var retryList = document.getElementById("retry-list");
  var retryCount = document.getElementById("retry-count");
  var itemProgress = document.getElementById("mon-item-progress");
  var itemProgressText = document.getElementById("mon-item-progress-text");
  var itemProgressNote = document.getElementById("mon-item-progress-note");
  var itemProgressBar = document.getElementById("mon-item-progress-bar");

  var state = { status: data.status, index: data.index || 0, itemStartedAt: data.itemStartedAt };
  var items = data.items || [];
  var timerInterval = null;
  var lastStandings = [];

  function stripInit() {
    stripEl.innerHTML = "";
    items.forEach(function (it, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "btn btn-outline btn-sm";
      b.textContent = "Q" + (i + 1);
      b.style.minHeight = "34px";
      b.setAttribute("aria-label", "Jump to item " + (i + 1));
      b.addEventListener("click", function () { control("goto", { index: i }); });
      stripEl.appendChild(b);
    });
    stripMark();
  }
  function stripMark() {
    stripEl.querySelectorAll("button").forEach(function (b, i) {
      b.classList.toggle("btn-navy", state.status === "active" && i === state.index);
    });
  }

  function renderQuestion() {
    var statusChip = document.getElementById("mon-status");
    var statusText = document.getElementById("mon-status-text");
    if (statusChip && statusText) {
      statusText.textContent = state.status;
      statusChip.className = "chip " + (state.status === "active" ? "chip-coral" : state.status === "lobby" ? "chip-navy" : "chip-plain");
    }
    if (state.status === "lobby") {
      qEl.textContent = "Lobby open — your section joins at /live. Open item 1 when everyone is ready.";
      optsEl.innerHTML = "";
      progressEl.textContent = "0 of " + items.length;
    } else if (state.status === "active") {
      var it = items[state.index];
      progressEl.textContent = "Item " + (state.index + 1) + " of " + items.length;
      if (!it) { qEl.textContent = "All items shown. End the test when ready."; optsEl.innerHTML = ""; return; }
      qEl.textContent = it.question;
      optsEl.innerHTML = "";
      if (it.options) {
        it.options.forEach(function (o, i) {
          var p = document.createElement("p");
          p.className = "muted small";
          p.innerHTML = "<b style=\"color:var(--faint)\">" + String.fromCharCode(65 + i) + ".</b> " + escapeHtml(o.text);
          optsEl.appendChild(p);
        });
      } else if (it.type === "tf") {
        optsEl.innerHTML = "<p class=\"muted small\">True / False item.</p>";
      } else {
        optsEl.innerHTML = "<p class=\"muted small\">Short-answer item — the server matches the keyword.</p>";
      }
      answerNote.hidden = false;
      tickCountdown();
    } else {
      qEl.textContent = "Test ended. Export the CSV or start a fresh session anytime.";
      optsEl.innerHTML = "";
      answerNote.hidden = true;
      stopTimer();
    }
    stripMark();
    if (ctlStart) ctlStart.hidden = state.status !== "lobby";
    if (ctlPrev) ctlPrev.hidden = state.status !== "active";
    if (ctlNext) { ctlNext.hidden = state.status !== "active"; ctlNext.disabled = state.status === "active" && state.index >= items.length - 1; }
  }

  function tickCountdown() {
    stopTimer();
    if (!countBox || !countValue) return; // no countdown element when the quiz advances manually
    if (!data.autoAdvanceSec || !state.itemStartedAt) { countBox.hidden = true; return; }
    countBox.hidden = false;
    var deadline = new Date(state.itemStartedAt).getTime() + data.autoAdvanceSec * 1000;
    var update = function () {
      var left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      countValue.textContent = left + "s";
    };
    update();
    timerInterval = setInterval(update, 500);
  }
  function stopTimer() { if (timerInterval) { clearInterval(timerInterval); timerInterval = null; } }

  function statusChipHtml(p) {
    if (p.kicked) return ' <span class="chip chip-bad">removed</span>';
    if (p.autoSubmitted) return ' <span class="chip chip-amber">auto-submitted</span>';
    if (p.finished) return ' <span class="chip chip-ok">done</span>';
    return "";
  }

  function renderItemProgress() {
    if (!itemProgress) return;
    var eligible = lastStandings.filter(function (p) { return !p.kicked; });
    var show = state.status === "active" && eligible.length > 0;
    itemProgress.hidden = !show;
    if (!show) return;
    var answered = eligible.filter(function (p) { return p.answeredCurrent; }).length;
    var stillIn = eligible.filter(function (p) { return !p.finished; }).length;
    itemProgressText.textContent = answered + " of " + eligible.length + " answered this item";
    itemProgressNote.textContent = stillIn === eligible.length ? "still open" : stillIn + " still in play";
    itemProgressBar.style.width = Math.round((answered / eligible.length) * 100) + "%";
  }

  function renderStandings(list) {
    lastStandings = list || [];
    participantsEl.textContent = lastStandings.length + " joined";
    standingsEl.innerHTML = "";
    lastStandings.forEach(function (p, i) {
      var tr = document.createElement("tr");
      if (p.kicked) tr.style.opacity = "0.5";
      tr.innerHTML =
        "<td><b>" + (i + 1) + "</b></td>" +
        "<td>" + escapeHtml(p.name) + (p.attemptNo > 1 ? ' <span class="chip chip-plain">try ' + p.attemptNo + "</span>" : "") + statusChipHtml(p) + "</td>" +
        "<td><b>" + p.score + "</b></td>" +
        "<td>" + p.answered + "</td>" +
        "<td>" + (p.warnings >= 2 ? "<b style=\"color:var(--bad)\">" + p.warnings + "</b>" : p.warnings) + "</td>" +
        "<td class=\"t-right\">" +
        (state.status === "active" && !p.kicked && !p.finished
          ? '<button class="btn btn-ghost btn-sm js-remove" data-user="' + p.id + '" data-name="' + escapeHtml(p.name) + '" type="button">Remove</button>'
          : "") +
        "</td>";
      standingsEl.appendChild(tr);
    });
    renderItemProgress();
    standingsEl.querySelectorAll(".js-remove").forEach(function (btn) {
      btn.addEventListener("click", function () {
        window.uiConfirm("Remove " + btn.dataset.name + " from this test? Their answers so far are kept, and they can only come back if you approve a re-attempt request.", { danger: true, title: "Remove student", yes: "Remove" })
          .then(function (ok) { if (ok) control("remove", { userId: btn.dataset.user }); });
      });
    });
  }

  // ===== re-attempt requests =====
  function renderRequests(reqs) {
    var list = reqs || [];
    if (!retryPanel || !retryList) return;
    retryPanel.hidden = list.length === 0 && !pendingRequests.length;
    retryCount.textContent = list.length + " waiting";
    retryList.innerHTML = "";
    list.forEach(function (r) {
      var row = document.createElement("div");
      row.className = "retry-row";
      row.innerHTML =
        '<div class="retry-info"><b>' + escapeHtml(r.name) + "</b> <span class=\"muted small\">try " + (r.attemptNo || 1) + " · " +
        (r.warnings || 0) + " warning" + ((r.warnings || 0) === 1 ? "" : "s") + "</span>" +
        (r.reason ? '<br><span class="small muted">“' + escapeHtml(r.reason) + "”</span>" : "") + "</div>" +
        '<div class="row" style="gap:6px">' +
        '<button class="btn btn-primary btn-sm" data-approve type="button">Allow new attempt</button>' +
        '<button class="btn btn-outline btn-sm" data-decline type="button">Decline</button>' +
        "</div>";
      row.querySelector("[data-approve]").addEventListener("click", function () {
        window.uiConfirm("Give " + r.name + " a fresh attempt? Their score and warnings reset and they rejoin the test.", { title: "Allow re-attempt", yes: "Allow" })
          .then(function (ok) { if (ok) decide(r.userId, "approve", row); });
      });
      row.querySelector("[data-decline]").addEventListener("click", function () {
        decide(r.userId, "decline", row);
      });
      retryList.appendChild(row);
    });
  }

  var pendingRequests = (data.retryRequests || []).slice();
  function decide(userId, decision, row) {
    apiSend("/api/host/" + data.sessionId + "/retry/" + userId, "POST", { decision: decision })
      .then(function (res) {
        pendingRequests = pendingRequests.filter(function (r) { return r.userId !== userId; });
        if (row) row.remove();
        renderRequests([]);
        window.toast(decision === "approve" ? (res.attemptNo ? "New attempt granted — they can rejoin now." : "Re-attempt granted.") : "Request declined.", decision === "approve" ? "ok" : "ok");
      })
      .catch(function (err) { window.toast(err.message, "bad"); });
  }

  function addWarn(w) {
    var div = document.createElement("div");
    div.className = "warn-item";
    div.innerHTML = '<svg class="icon icon-sm" aria-hidden="true"><use href="#i-alert"></use></svg><span><b>' + escapeHtml(w.name) + "</b> — " + escapeHtml(w.reason || "left the page") + " (warning " + w.warnings + " of " + w.cap + ")" +
      (w.autoSubmitted ? " · <b>test auto-submitted</b>" : "") + "</span>";
    if (warnsEl.querySelector("p")) warnsEl.innerHTML = "";
    warnsEl.prepend(div);
    // NOTE: a re-attempt row only appears when the student actually asks (live:retry_request)
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function control(action, body) {
    return apiSend("/api/host/" + data.sessionId + "/" + action, "POST", body || {})
      .catch(function (err) { window.toast(err.message, "bad"); });
  }

  var ctlStart = document.getElementById("ctl-start");
  var ctlPrev = document.getElementById("ctl-prev");
  var ctlNext = document.getElementById("ctl-next");
  var ctlEnd = document.getElementById("ctl-end");
  if (ctlStart) ctlStart.addEventListener("click", function () { control("start"); });
  if (ctlPrev) ctlPrev.addEventListener("click", function () { control("prev"); });
  if (ctlNext) ctlNext.addEventListener("click", function () { control("next"); });
  if (ctlEnd) ctlEnd.addEventListener("click", function () {
    window.uiConfirm("End the test for everyone and lock the scores?", { danger: true, title: "End live test", yes: "End test" })
      .then(function (ok) { if (ok) control("end"); });
  });

  var socket = io({ auth: { userId: data.userId } });
  socket.on("connect", function () { socket.emit("live:monitor", { sessionId: data.sessionId }); });
  socket.on("live:state", function (s) {
    state.status = s.status; state.index = s.index; state.itemStartedAt = s.itemStartedAt;
    renderQuestion();
    renderItemProgress();
  });
  socket.on("live:standings", function (payload) { renderStandings(payload.standings); });
  socket.on("live:warning", addWarn);
  socket.on("live:retry_request", function (r) {
    if (!pendingRequests.some(function (x) { return x.userId === r.userId; })) pendingRequests.push(r);
    renderRequests(pendingRequests);
    window.toast(r.name + " asked for another attempt.", "ok");
  });
  // the server's list is the source of truth after every approve/decline
  socket.on("live:retry_requests", function (payload) {
    pendingRequests = payload.requests || [];
    renderRequests(pendingRequests);
  });
  socket.on("live:removed", function (p) { window.toast(p.name + " was removed from the test.", "bad"); });
  socket.on("live:ended", function () {
    state.status = "ended";
    renderQuestion();
    window.toast("Test ended — standings locked.", "ok");
  });

  renderQuestion();
  stripInit();
  renderStandings(data.standings || []);
  pendingRequests = data.retryRequests || [];
  renderRequests(pendingRequests);
})();
