// public/js/builder-quiz.js — the quiz editor: items with options, TF, short answer.
// Feels like a document editor: labeled tools, letter-chipped options, duplicate support.
(function () {
  "use strict";
  var dataEl = document.getElementById("page-data");
  var data = dataEl ? JSON.parse(dataEl.textContent) : {};
  if (!data.quizId) return;

  var quiz = data.quiz;
  var list = document.getElementById("item-list");
  var dirtyEl = document.getElementById("dirty-note");
  var statusEl = document.getElementById("save-status");
  var publishedEl = document.getElementById("quiz-published");
  var titleEl = document.getElementById("quiz-title");
  var blurbEl = document.getElementById("quiz-blurb");
  var limitEl = document.getElementById("quiz-time");
  var autoEl = document.getElementById("quiz-auto");
  var saveBtn = document.getElementById("editor-save");
  var statsEl = document.getElementById("item-stats");

  publishedEl.checked = !!quiz.published;
  var items = JSON.parse(JSON.stringify(quiz.items || []));
  var dirty = false;
  function touch() { dirty = true; dirtyEl.hidden = false; }

  function el(html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function field(labelText, input) {
    var f = el('<div class="field"></div>');
    var label = el("<label></label>");
    label.textContent = labelText;
    f.append(label, input);
    return f;
  }
  function inputEl(value, type, onInput, attrs) {
    var input = document.createElement("input");
    input.className = "input";
    input.type = type || "text";
    input.value = value == null ? "" : value;
    if (attrs) for (var k in attrs) input.setAttribute(k, attrs[k]);
    input.addEventListener("input", function () { onInput(input.value); touch(); });
    return input;
  }
  function areaEl(value, onInput, rows) {
    var t = document.createElement("textarea");
    t.className = "textarea";
    t.setAttribute("rows", rows || 2);
    t.value = value || "";
    t.addEventListener("input", function () { onInput(t.value); touch(); });
    return t;
  }

  function defaultItem(type) {
    var it = { type: type || "mcq", question: "", points: 1, explanation: "" };
    if (it.type === "mcq") it.options = [{ text: "", isCorrect: true }, { text: "", isCorrect: false }];
    if (it.type === "tf") it.answer = "true";
    if (it.type === "short") it.answer = "";
    return it;
  }
  var TYPE_LABEL = { mcq: "Multiple choice", tf: "True / False", short: "Short answer" };

  function renderOption(it, oi, idx) {
    var row = el('<div class="opt-row"></div>');
    var chip = el('<span class="opt-letter">' + String.fromCharCode(65 + oi) + "</span>");
    var input = inputEl(it.options[oi].text, "text", function (v) { it.options[oi].text = v; }, { placeholder: "Option " + String.fromCharCode(65 + oi) });
    var pick = el('<label class="correct-pick"><input type="radio" name="correct-' + idx + '"> <span>correct</span></label>');
    pick.querySelector("input").checked = !!it.options[oi].isCorrect;
    pick.querySelector("input").addEventListener("change", function () {
      it.options.forEach(function (o) { o.isCorrect = false; });
      it.options[oi].isCorrect = true;
      syncCorrect(it, idx);
      touch();
    });
    var rm = el('<button class="btn btn-outline btn-icon" type="button" aria-label="Remove option" title="Remove option"><svg class="icon icon-sm"><use href="#i-x"></use></svg></button>');
    rm.addEventListener("click", function () {
      if (it.options.length <= 2) { window.toast("Multiple-choice needs at least 2 options.", "bad"); return; }
      var wasCorrect = it.options[oi].isCorrect;
      it.options.splice(oi, 1);
      if (wasCorrect) it.options[0].isCorrect = true;
      render(); touch();
    });
    row.append(chip, input, pick, rm);
    if (it.options[oi].isCorrect) row.classList.add("is-picked");
    return row;
  }
  function syncCorrect(it, idx) {
    var card = list.querySelector('[data-i="' + idx + '"]');
    if (!card) return;
    card.querySelectorAll(".opt-row").forEach(function (row, oi) {
      row.classList.toggle("is-picked", !!it.options[oi].isCorrect);
    });
  }

  function renderItem(it, i) {
    var card = el('<div class="card item-editor" data-i="' + i + '"></div>');

    // header: number badge + type dropdown + tools
    var head = el('<div class="item-head"></div>');
    var num = el('<span class="item-num">' + (i + 1) + "</span>");
    var type = el('<select class="select item-type"><option value="mcq">Multiple choice</option><option value="tf">True / False</option><option value="short">Short answer</option></select>');
    type.value = it.type;
    type.addEventListener("change", function () {
      var keepQ = it.question;
      it = defaultItem(type.value);
      it.question = keepQ;
      items[i] = it;
      render(); touch();
    });
    var tools = el('<div class="block-tools"></div>');
    var up = el('<button class="btn btn-outline btn-icon" type="button" aria-label="Move up" title="Move up"><svg class="icon icon-sm"><use href="#i-up"></use></svg></button>');
    var down = el('<button class="btn btn-outline btn-icon" type="button" aria-label="Move down" title="Move down"><svg class="icon icon-sm"><use href="#i-down"></use></svg></button>');
    var dup = el('<button class="btn btn-outline btn-icon" type="button" aria-label="Duplicate item" title="Duplicate"><svg class="icon icon-sm"><use href="#i-copy"></use></svg></button>');
    var del = el('<button class="btn btn-danger btn-icon" type="button" aria-label="Delete item" title="Delete item"><svg class="icon icon-sm"><use href="#i-trash"></use></svg></button>');
    up.addEventListener("click", function () { move(i, -1); });
    down.addEventListener("click", function () { move(i, 1); });
    dup.addEventListener("click", function () {
      var copy = JSON.parse(JSON.stringify(it));
      copy.id = null;
      if (copy.options) copy.options.forEach(function (o) { o.id = null; });
      items.splice(i + 1, 0, copy);
      render(); touch();
      window.toast("Item duplicated.", "ok");
    });
    del.addEventListener("click", function () {
      window.uiConfirm("Delete item " + (i + 1) + "?", { danger: true, title: "Delete item", yes: "Delete item" })
        .then(function (ok) { if (ok) { items.splice(i, 1); render(); touch(); } });
    });
    tools.append(up, down, dup, del);
    head.append(num, type, tools);
    card.appendChild(head);

    var qArea = areaEl(it.question, function (v) { it.question = v; }, 3);
    qArea.placeholder = "Type the question here…";
    card.appendChild(qArea);

    // points + answer controls
    var meta = el('<div class="form-row"></div>');
    meta.appendChild(field("Points", inputEl(it.points, "number", function (v) { it.points = Math.max(1, Math.min(10, Number(v) || 1)); }, { min: "1", max: "10" })));
    if (it.type === "tf") {
      var tf = el('<select class="select"><option value="true">Correct: True</option><option value="false">Correct: False</option></select>');
      tf.value = it.answer || "true";
      tf.addEventListener("change", function () { it.answer = tf.value; touch(); });
      meta.appendChild(field("Answer", tf));
    }
    if (it.type === "short") {
      meta.appendChild(field("Accepted keyword (case-insensitive)", inputEl(it.answer, "text", function (v) { it.answer = v; }, { placeholder: "e.g. mitochondria" })));
    }
    card.appendChild(meta);

    if (it.type === "mcq") {
      var optsWrap = el('<div class="stack" style="gap:8px"></div>');
      it.options.forEach(function (_o, oi) { optsWrap.appendChild(renderOption(it, oi, i)); });
      var addOpt = el('<button class="btn btn-outline btn-sm" type="button"><svg class="icon icon-sm"><use href="#i-plus"></use></svg> Add option</button>');
      addOpt.addEventListener("click", function () {
        if (it.options.length >= 6) { window.toast("Six options max.", "bad"); return; }
        it.options.push({ text: "", isCorrect: false });
        render(); touch();
      });
      optsWrap.appendChild(addOpt);
      card.appendChild(optsWrap);
    }

    card.appendChild(field("Explanation (shown after the attempt)", areaEl(it.explanation, function (v) { it.explanation = v; }, 2)));
    return card;
  }

  function move(i, dir) {
    var j = i + dir;
    if (j < 0 || j >= items.length) return;
    var t = items[i]; items[i] = items[j]; items[j] = t;
    render(); touch();
  }

  function render() {
    list.innerHTML = "";
    items.forEach(function (it, i) { list.appendChild(renderItem(it, i)); });
    if (!items.length) {
      list.appendChild(el('<div class="empty"><p>No items yet — add the first question with a button above.</p></div>'));
    }
    var totalPoints = items.reduce(function (s, it) { return s + (Number(it.points) || 1); }, 0);
    if (statsEl) statsEl.textContent = items.length
      ? items.length + " item" + (items.length === 1 ? "" : "s") + " · " + totalPoints + " possible point" + (totalPoints === 1 ? "" : "s")
      : "Nothing added yet.";
    window.uiSelect.syncAll(list);
  }

  function addItem(type) {
    items.push(defaultItem(type));
    render(); touch();
    list.lastElementChild.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  document.getElementById("item-add-mcq").addEventListener("click", function () { addItem("mcq"); });
  document.getElementById("item-add-tf").addEventListener("click", function () { addItem("tf"); });
  document.getElementById("item-add-short").addEventListener("click", function () { addItem("short"); });

  [titleEl, blurbEl, publishedEl, limitEl, autoEl].filter(Boolean).forEach(function (input) {
    input.addEventListener("input", touch);
    input.addEventListener("change", touch);
  });

  saveBtn.addEventListener("click", function () {
    if (!titleEl.value.trim()) { titleEl.focus(); window.toast("The quiz needs a title.", "bad"); return; }
    apiSend("/api/build/quiz/" + data.quizId, "PUT", {
      title: titleEl.value, blurb: blurbEl.value, published: publishedEl.checked,
      timeLimitMin: Number(limitEl ? limitEl.value : 0),
      autoAdvanceSec: Number(autoEl ? autoEl.value : 0),
      items: items,
    }, saveBtn)
      .then(function () { dirty = false; dirtyEl.hidden = true; statusEl.textContent = "Saved just now."; window.toast("Quiz saved.", "ok"); })
      .catch(function (err) { window.toast(err.message, "bad"); });
  });

  document.getElementById("editor-back").addEventListener("click", function () {
    if (dirty) {
      window.uiConfirm("You have unsaved changes. Leave without saving?", { danger: true, title: "Unsaved changes" })
        .then(function (ok) { if (ok) location.href = data.backUrl; });
    } else location.href = data.backUrl;
  });
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); saveBtn.click(); }
  });

  render();
})();
