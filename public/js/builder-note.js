// public/js/builder-note.js — the note builder: blocks + sources, one save.
(function () {
  "use strict";
  var dataEl = document.getElementById("page-data");
  var data = dataEl ? JSON.parse(dataEl.textContent) : {};
  if (!data.noteId) return;

  var list = document.getElementById("block-list");
  var srcList = document.getElementById("source-list");
  var dirtyEl = document.getElementById("dirty-note");
  var statusEl = document.getElementById("save-status");
  var publishedEl = document.getElementById("note-published");
  var titleEl = document.getElementById("note-title");
  var blurbEl = document.getElementById("note-blurb");
  var saveBtn = document.getElementById("editor-save");
  var backBtn = document.getElementById("editor-back");

  var note = data.note;
  publishedEl.checked = !!note.published;

  // deep state
  var blocks = JSON.parse(JSON.stringify(note.blocks || []));
  var sources = JSON.parse(JSON.stringify(note.sources || []));
  var dirty = false;
  function touch() { dirty = true; dirtyEl.hidden = false; }

  var FIELD_LABEL = { heading: "Heading", paragraph: "Paragraph", bullets: "Bullet list", numbered: "Numbered list", image: "Image", callout: "Callout", keyterm: "Key term", divider: "Divider" };

  function el(html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function textInput(value, placeholder, onInput, rows) {
    var input = document.createElement(rows ? "textarea" : "input");
    if (rows) input.setAttribute("rows", rows);
    input.className = rows ? "textarea" : "input";
    input.placeholder = placeholder || "";
    input.value = value || "";
    input.addEventListener("input", function () { onInput(input.value); touch(); });
    return input;
  }

  function renderBlock(b, i) {
    var card = el('<div class="card block-editor" data-i="' + i + '"></div>');

    // header: label + tools
    var head = el('<div class="item-head"><span class="item-num">' + (i + 1) + '</span><b style="font-size:13.5px; color:var(--muted)">' + FIELD_LABEL[b.type] + '</b></div>');
    var tools = el('<div class="block-tools"></div>');
    var up = el('<button class="btn btn-outline btn-icon" type="button" aria-label="Move up" title="Move up"><svg class="icon icon-sm"><use href="#i-up"></use></svg></button>');
    var down = el('<button class="btn btn-outline btn-icon" type="button" aria-label="Move down" title="Move down"><svg class="icon icon-sm"><use href="#i-down"></use></svg></button>');
    var dup = el('<button class="btn btn-outline btn-icon" type="button" aria-label="Duplicate block" title="Duplicate"><svg class="icon icon-sm"><use href="#i-copy"></use></svg></button>');
    var del = el('<button class="btn btn-danger btn-icon" type="button" aria-label="Delete block" title="Delete block"><svg class="icon icon-sm"><use href="#i-trash"></use></svg></button>');
    up.addEventListener("click", function () { move(i, -1); });
    down.addEventListener("click", function () { move(i, 1); });
    dup.addEventListener("click", function () {
      blocks.splice(i + 1, 0, JSON.parse(JSON.stringify(b)));
      render(); touch();
      window.toast("Block duplicated.", "ok");
    });
    del.addEventListener("click", function () {
      window.uiConfirm("Delete this " + FIELD_LABEL[b.type].toLowerCase() + " block?", { danger: true, title: "Delete block", yes: "Delete block" })
        .then(function (ok) { if (ok) { blocks.splice(i, 1); render(); touch(); } });
    });
    tools.append(up, down, dup, del);
    head.appendChild(tools);
    card.appendChild(head);

    // type-specific fields
    if (b.type === "heading") {
      var lvl = el('<select class="select" style="max-width:140px"><option value="2">Section (H2)</option><option value="3">Sub (H3)</option></select>');
      lvl.value = String(b.level || 2);
      lvl.addEventListener("change", function () { b.level = Number(lvl.value); touch(); });
      card.appendChild(lvl);
      card.appendChild(textInput(b.text, "Heading text", function (v) { b.text = v; }));
    } else if (b.type === "paragraph") {
      card.appendChild(textInput(b.text, "Write the paragraph here…", function (v) { b.text = v; }, 5));
    } else if (b.type === "bullets" || b.type === "numbered") {
      b.items = b.items && b.items.length ? b.items : [""];
      var wrap = el('<div class="stack" style="gap:8px"></div>');
      function renderItems() {
        wrap.innerHTML = "";
        b.items.forEach(function (item, ii) {
          var row = el('<div class="row" style="flex-wrap:nowrap"></div>');
          var input = textInput(item, "List item…", function (v) { b.items[ii] = v; });
          input.style.flex = "1";
          row.appendChild(input);
          var rm = el('<button class="btn btn-ghost btn-icon" aria-label="Remove item"><svg class="icon icon-sm"><use href="#i-x"></use></svg></button>');
          rm.addEventListener("click", function () { b.items.splice(ii, 1); renderItems(); touch(); });
          row.appendChild(rm);
          wrap.appendChild(row);
        });
        var add = el('<button class="btn btn-outline btn-sm" type="button"><svg class="icon icon-sm"><use href="#i-plus"></use></svg> Add item</button>');
        add.addEventListener("click", function () { b.items.push(""); renderItems(); touch(); });
        wrap.appendChild(add);
      }
      renderItems();
      card.appendChild(wrap);
    } else if (b.type === "image") {
      card.appendChild(textInput(b.url, "https://… image link", function (v) { b.url = v; }));
      card.appendChild(textInput(b.caption, "Caption (optional)", function (v) { b.caption = v; }));
    } else if (b.type === "callout") {
      var variant = el('<select class="select" style="max-width:160px"><option value="info">Info (blue)</option><option value="tip">Tip (teal)</option><option value="warn">Careful (amber)</option></select>');
      variant.value = b.variant || "info";
      variant.addEventListener("change", function () { b.variant = variant.value; touch(); });
      card.appendChild(variant);
      card.appendChild(textInput(b.text, "Callout text…", function (v) { b.text = v; }, 3));
    } else if (b.type === "keyterm") {
      card.appendChild(textInput(b.term, "Term — e.g. allele", function (v) { b.term = v; }));
      card.appendChild(textInput(b.definition, "Definition…", function (v) { b.definition = v; }, 2));
    } else if (b.type === "divider") {
      card.appendChild(el('<p class="muted small">A horizontal line between sections.</p>'));
    }
    return card;
  }

  function move(i, dir) {
    var j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    var t = blocks[i]; blocks[i] = blocks[j]; blocks[j] = t;
    render(); touch();
  }

  function render() {
    list.innerHTML = "";
    blocks.forEach(function (b, i) { list.appendChild(renderBlock(b, i)); });
    if (!blocks.length) {
      list.appendChild(el('<div class="empty"><p>No blocks yet — add your first heading or paragraph with a button below.</p></div>'));
    }
    var statsEl = document.getElementById("block-stats");
    if (statsEl) statsEl.textContent = blocks.length
      ? blocks.length + " block" + (blocks.length === 1 ? "" : "s") + " · " + sources.length + " source" + (sources.length === 1 ? "" : "s")
      : "Nothing written yet.";
    renderSources();
    window.uiSelect.syncAll(list);
  }

  function renderSources() {
    srcList.innerHTML = "";
    sources.forEach(function (s, i) {
      var row = el('<div class="source-row"></div>');
      var label = textInput(s.label, "Label — e.g. OpenStax Biology 2e, Ch. 12", function (v) { s.label = v; });
      var url = textInput(s.url, "https://… link to the source", function (v) { s.url = v; });
      var rm = el('<button class="btn btn-ghost btn-icon" aria-label="Remove source"><svg class="icon icon-sm"><use href="#i-trash"></use></svg></button>');
      rm.addEventListener("click", function () { sources.splice(i, 1); renderSources(); touch(); });
      row.append(label, url, rm);
      srcList.appendChild(row);
    });
  }

  document.getElementById("block-add").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-add]");
    if (!btn) return;
    var type = btn.dataset.add;
    var fresh = { type: type };
    if (type === "heading") fresh.level = 2;
    if (type === "bullets" || type === "numbered") fresh.items = [""];
    if (type === "callout") fresh.variant = "info";
    blocks.push(fresh);
    render(); touch();
    list.lastElementChild.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  document.getElementById("source-add").addEventListener("click", function () {
    sources.push({ label: "", url: "" });
    renderSources(); touch();
    srcList.lastElementChild.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  [titleEl, blurbEl, publishedEl].forEach(function (input) {
    input.addEventListener("input", touch);
    input.addEventListener("change", touch);
  });

  saveBtn.addEventListener("click", function () {
    if (!titleEl.value.trim()) { titleEl.focus(); window.toast("The note needs a title.", "bad"); return; }
    apiSend("/api/build/notes/" + data.noteId, "PUT", {
      title: titleEl.value, blurb: blurbEl.value, published: publishedEl.checked,
      blocks: blocks, sources: sources,
    }, saveBtn)
      .then(function () {
        dirty = false; dirtyEl.hidden = true;
        statusEl.textContent = "Saved just now.";
        window.toast("Note saved.", "ok");
      })
      .catch(function (err) { window.toast(err.message, "bad"); });
  });

  backBtn.addEventListener("click", function () {
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
