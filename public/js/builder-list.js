// public/js/builder-list.js — create (styled dialog) + delete from a builder list page.
(function () {
  "use strict";

  var KIND_META = {
    notes: { noun: "note", title: "New note", label: "Note title", blurb: "One line classmates see on the subject page", icon: "book" },
    decks: { noun: "deck", title: "New flashcard deck", label: "Deck title", blurb: "What this deck helps memorize", icon: "cards" },
    quizzes: { noun: "quiz", title: "New quiz", label: "Quiz title", blurb: "What this quiz covers", icon: "quiz" },
  };

  document.querySelectorAll(".js-create").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var kind = btn.dataset.kind;
      var meta = KIND_META[kind] || KIND_META.notes;
      var modeEl = document.getElementById("quiz-mode");

      window.uiPrompt({
        title: meta.title,
        message: "You can rename it later. " + (modeEl && modeEl.value === "live" ? "This will be a live test — hosted from the Host tab." : ""),
        label: meta.label,
        placeholder: "e.g. Photosynthesis basics",
        ok: "Create & open editor",
        icon: meta.icon,
      }).then(function (title) {
        if (!title) return;
        var body = { subjectId: btn.dataset.subject, title: title, blurb: "" };
        if (kind === "quizzes") body.mode = modeEl ? modeEl.value : "practice";
        apiSend("/api/build/" + kind, "POST", body, btn)
          .then(function (res) { window.toast(meta.title + " created.", "ok"); location.href = "/build/" + (kind === "quizzes" ? "quiz/" + res.id : kind + "/" + res.id); })
          .catch(function (err) { window.toast(err.message, "bad"); });
      });
    });
  });

  document.querySelectorAll(".js-delete").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var kind = btn.dataset.kind;
      var meta = KIND_META[kind] || KIND_META.notes;
      window.uiConfirm('Delete "' + btn.dataset.title + '"? Classmates lose access immediately. This cannot be undone.', { danger: true, title: "Delete " + meta.noun, yes: "Delete " + meta.noun })
        .then(function (ok) {
          if (!ok) return;
          apiSend("/api/build/" + (kind === "quizzes" ? "quizzes" : kind) + "/" + btn.dataset.id, "DELETE")
            .then(function () { window.toast("Deleted.", "ok"); location.reload(); })
            .catch(function (err) { window.toast(err.message, "bad"); });
        });
    });
  });
})();
