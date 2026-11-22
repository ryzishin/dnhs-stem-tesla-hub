// public/js/admin.js — admin pages: subjects, people & roles, settings.
// Role changes are STAGED per row and only applied after an explicit Save + confirm.
(function () {
  "use strict";
  var dataEl = document.getElementById("page-data");
  var data = dataEl ? JSON.parse(dataEl.textContent) : {};
  var page = data.adminPage;
  if (!page) return;

  // ---------- subjects ----------
  if (page === "subjects") {
    var addBtn = document.getElementById("subject-add");
    if (addBtn) {
      addBtn.addEventListener("click", function () {
        window.uiPrompt({
          title: "Add a subject",
          message: "Classmates see it on the hub right away. Its tile color is picked automatically.",
          label: "Subject name",
          placeholder: "e.g. Research 1",
          ok: "Add subject",
          icon: "atom",
        }).then(function (name) {
          if (!name) return;
          apiSend("/api/admin/subjects", "POST", { name: name, blurb: "" })
            .then(function () { window.toast("Subject added.", "ok"); location.reload(); })
            .catch(function (err) { window.toast(err.message, "bad"); });
        });
      });
    }

    document.querySelectorAll(".js-edit-subject").forEach(function (btn) {
      btn.addEventListener("click", function () {
        window.uiPrompt({
          title: "Rename subject",
          message: "The web address keeps working after a rename.",
          label: "Subject name",
          value: btn.dataset.name,
          ok: "Save changes",
          icon: "edit",
        }).then(function (name) {
          if (!name || name === btn.dataset.name) return;
          apiSend("/api/admin/subjects/" + btn.dataset.id, "PUT", { name: name, blurb: btn.dataset.blurb || "" })
            .then(function () { window.toast("Subject renamed.", "ok"); location.reload(); })
            .catch(function (err) { window.toast(err.message, "bad"); });
        });
      });
    });

    document.querySelectorAll(".js-archive").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var archiving = !btn.dataset.archived;
        var msg = archiving
          ? "Archived subjects stay on the site for builders but disappear from the hub for students."
          : "Bring this subject back to every student's hub?";
        window.uiConfirm(msg, { title: archiving ? "Archive subject" : "Unarchive subject", yes: archiving ? "Archive it" : "Unarchive" })
          .then(function (ok) {
            if (!ok) return;
            apiSend("/api/admin/subjects/" + btn.dataset.id, "PUT", { archived: archiving })
              .then(function () { window.toast(archiving ? "Subject archived." : "Subject is back on the hub.", "ok"); location.reload(); })
              .catch(function (err) { window.toast(err.message, "bad"); });
          });
      });
    });

    document.querySelectorAll(".js-delete-subject").forEach(function (btn) {
      btn.addEventListener("click", function () {
        window.uiConfirm('Permanently delete "' + btn.dataset.name + '"? Only possible when it has no notes, quizzes or decks. Otherwise archive it.', { danger: true, title: "Delete subject", yes: "Delete subject" })
          .then(function (ok) {
            if (!ok) return;
            apiSend("/api/admin/subjects/" + btn.dataset.id, "DELETE")
              .then(function () { window.toast("Subject deleted.", "ok"); location.reload(); })
              .catch(function (err) { window.toast(err.message, "bad"); });
          });
      });
    });
  }

  // ---------- users & roles (staged, confirmed) ----------
  if (page === "users") {
    function rowOf(id) { return document.querySelector('tr[data-row="' + id + '"]'); }

    function stageRow(row) {
      var select = row.querySelector(".js-role");
      var saveBtn = row.querySelector(".js-save-role");
      var picker = row.querySelector(".js-subjects");
      var noScope = row.querySelector(".js-no-scope");
      var changed = select.value !== select.dataset.original;
      if (picker) {
        picker.hidden = select.value !== "moderator";
        changed = changed || Array.prototype.some.call(picker.querySelectorAll("input"), function (c) { return c.dirty; });
      }
      if (noScope) noScope.hidden = select.value === "moderator";
      saveBtn.hidden = !changed;
      // warn visually while unsaved (the custom dropdown wrapper carries the state)
      var wrap = select.closest(".ui-select");
      if (wrap) wrap.classList.toggle("is-dirty", changed);
    }

    document.querySelectorAll(".js-role").forEach(function (select) {
      select.addEventListener("change", function () {
        stageRow(select.closest("tr"));
        // mark subjects dirty when the role flips so the picker re-opens with current state
        var picker = select.closest("tr").querySelector(".js-subjects");
        if (picker && select.value === "moderator" && select.dataset.original !== "moderator") {
          picker.querySelectorAll("input").forEach(function (c) { c.dirty = false; });
        }
        stageRow(select.closest("tr"));
      });
    });

    document.querySelectorAll(".js-subjects input").forEach(function (c) {
      c.addEventListener("change", function () { c.dirty = true; stageRow(c.closest("tr")); });
    });

    document.querySelectorAll(".js-save-role").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.dataset.id;
        var row = rowOf(id);
        if (!row) return;
        var select = row.querySelector(".js-role");
        var role = select.value;
        var picker = row.querySelector(".js-subjects");
        var subjectIds = picker ? Array.from(picker.querySelectorAll("input:checked")).map(function (c) { return c.value; }) : [];

        var messages = {
          admin: "Give " + select.dataset.name + " full admin access? They could change roles, delete subjects and host live tests.",
          moderator: "Make " + select.dataset.name + " a moderator" + (subjectIds.length ? " of " + subjectIds.length + " subject" + (subjectIds.length === 1 ? "" : "s") : " with no subjects yet?") + " They can build notes, practice quizzes and flashcards there — live tests stay with you.",
          student: "Set " + select.dataset.name + " back to a plain student? They lose builder access and their subject assignments.",
        };
        window.uiConfirm(messages[role], {
          title: role === "student" ? "Update role" : "Confirm " + role,
          danger: role === "admin" || role === "student",
          yes: "Save role",
        }).then(function (ok) {
          if (!ok) {
            select.value = select.dataset.original;
            select.dispatchEvent(new Event("change", { bubbles: true }));
            stageRow(row);
            return;
          }
          apiSend("/api/admin/users/" + id + "/role", "POST", { role: role, subjectIds: subjectIds }, btn)
            .then(function (res) {
              select.dataset.original = role;
              row.querySelectorAll(".js-subjects input").forEach(function (c) { c.dirty = false; });
              stageRow(row);
              window.toast(res.message || "Role updated.", "ok");
            })
            .catch(function (err) { window.toast(err.message, "bad"); location.reload(); });
        });
      });
    });

    document.querySelectorAll(".js-reset-pw").forEach(function (btn) {
      btn.addEventListener("click", function () {
        window.uiPrompt({
          title: "Set a new password",
          message: "For " + btn.dataset.name + " — give it to them privately.",
          label: "New password (6+ characters)",
          placeholder: "e.g. tesla2026",
          ok: "Update password",
          icon: "key",
          maxlength: 60,
        }).then(function (pw) {
          if (!pw) return;
          apiSend("/api/admin/users/" + btn.dataset.id + "/reset", "POST", { password: pw })
            .then(function (res) { window.toast(res.message || "Password updated.", "ok"); })
            .catch(function (err) { window.toast(err.message, "bad"); });
        });
      });
    });

    document.querySelectorAll(".js-delete-user").forEach(function (btn) {
      btn.addEventListener("click", function () {
        window.uiConfirm("Delete " + btn.dataset.name + "'s account? Their points history disappears too. This cannot be undone.", { danger: true, title: "Delete account", yes: "Delete account" })
          .then(function (ok) {
            if (!ok) return;
            apiSend("/api/admin/users/" + btn.dataset.id + "/delete", "POST")
              .then(function () { window.toast("Account deleted.", "ok"); location.reload(); })
              .catch(function (err) { window.toast(err.message, "bad"); });
          });
      });
    });
  }

  // ---------- settings ----------
  if (page === "settings") {
    var form = document.getElementById("settings-form");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var f = new FormData(form);
      var payload = {
        allowRegistration: f.get("allowRegistration") === "on",
        tabWarning: f.get("tabWarning") === "on",
        fullscreen: f.get("fullscreen") === "on",
        blockCopy: f.get("blockCopy") === "on",
        warningsCap: Number(f.get("warningsCap") || 3),
        quizBase: Number(f.get("quizBase") || 0),
        cardPoints: Number(f.get("cardPoints") || 0),
        streakBonus: Number(f.get("streakBonus") || 0),
      };
      window.uiConfirm("Apply these rules to every new live session and the points system?", { title: "Save settings", yes: "Save settings" })
        .then(function (ok) {
          if (!ok) return;
          apiSend("/api/admin/settings", "POST", payload)
            .then(function () {
              document.getElementById("settings-status").textContent = "Saved just now.";
              window.toast("Settings saved.", "ok");
            })
            .catch(function (err) { window.toast(err.message, "bad"); });
        });
    });
  }
})();
