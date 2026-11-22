// public/js/builder-deck.js — the flashcard builder: rows of front/back.
(function () {
  "use strict";
  var dataEl = document.getElementById("page-data");
  var data = dataEl ? JSON.parse(dataEl.textContent) : {};
  if (!data.deckId) return;

  var deck = data.deck;
  var list = document.getElementById("card-list");
  var countEl = document.getElementById("deck-count");
  var dirtyEl = document.getElementById("dirty-note");
  var statusEl = document.getElementById("save-status");
  var publishedEl = document.getElementById("deck-published");
  var titleEl = document.getElementById("deck-title");
  var blurbEl = document.getElementById("deck-blurb");
  var saveBtn = document.getElementById("editor-save");

  publishedEl.checked = !!deck.published;
  var cards = JSON.parse(JSON.stringify(deck.cards || []));
  var dirty = false;
  function touch() { dirty = true; dirtyEl.hidden = false; }

  function el(html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function render() {
    list.innerHTML = "";
    countEl.textContent = "— " + cards.length + " card" + (cards.length === 1 ? "" : "s");
    if (!cards.length) {
      list.appendChild(el('<div class="empty"><p>No cards yet. Add the first one below.</p></div>'));
    }
    cards.forEach(function (c, i) {
      var row = el('<div class="card card-row card-pad" style="padding:var(--sp-3)"><span class="item-num">' + (i + 1) + '</span></div>');
      var col = el('<div class="card-row-cols"></div>');
      var front = el('<textarea class="textarea" rows="2" placeholder="Front — the question or term"></textarea>');
      front.value = c.front;
      front.addEventListener("input", function () { c.front = front.value; touch(); });
      var back = el('<textarea class="textarea" rows="2" placeholder="Back — the answer or definition"></textarea>');
      back.value = c.back;
      back.addEventListener("input", function () { c.back = back.value; touch(); });
      var tools = el('<div class="block-tools"></div>');
      var up = el('<button class="btn btn-outline btn-icon" type="button" aria-label="Move up" title="Move up"><svg class="icon icon-sm"><use href="#i-up"></use></svg></button>');
      var down = el('<button class="btn btn-outline btn-icon" type="button" aria-label="Move down" title="Move down"><svg class="icon icon-sm"><use href="#i-down"></use></svg></button>');
      var dup = el('<button class="btn btn-outline btn-icon" type="button" aria-label="Duplicate card" title="Duplicate"><svg class="icon icon-sm"><use href="#i-copy"></use></svg></button>');
      var del = el('<button class="btn btn-danger btn-icon" type="button" aria-label="Delete card" title="Delete card"><svg class="icon icon-sm"><use href="#i-trash"></use></svg></button>');
      up.addEventListener("click", function () { move(i, -1); });
      down.addEventListener("click", function () { move(i, 1); });
      dup.addEventListener("click", function () {
        cards.splice(i + 1, 0, { front: c.front, back: c.back });
        render(); touch();
        window.toast("Card duplicated.", "ok");
      });
      del.addEventListener("click", function () {
        window.uiConfirm("Delete card " + (i + 1) + "?", { danger: true, title: "Delete card", yes: "Delete card" })
          .then(function (ok) { if (ok) { cards.splice(i, 1); render(); touch(); } });
      });
      tools.append(up, down, dup, del);
      col.append(front, back);
      row.append(col, tools);
      list.appendChild(row);
    });
  }

  function move(i, dir) {
    var j = i + dir;
    if (j < 0 || j >= cards.length) return;
    var t = cards[i]; cards[i] = cards[j]; cards[j] = t;
    render(); touch();
  }

  document.getElementById("card-add").addEventListener("click", function () {
    cards.push({ front: "", back: "" });
    render(); touch();
    list.lastElementChild.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  [titleEl, blurbEl, publishedEl].forEach(function (input) {
    input.addEventListener("input", touch);
    input.addEventListener("change", touch);
  });

  saveBtn.addEventListener("click", function () {
    if (!titleEl.value.trim()) { titleEl.focus(); window.toast("The deck needs a title.", "bad"); return; }
    apiSend("/api/build/decks/" + data.deckId, "PUT", {
      title: titleEl.value, blurb: blurbEl.value, published: publishedEl.checked, cards: cards,
    }, saveBtn)
      .then(function () { dirty = false; dirtyEl.hidden = true; statusEl.textContent = "Saved just now."; window.toast("Deck saved.", "ok"); })
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
