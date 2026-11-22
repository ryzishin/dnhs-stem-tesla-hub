// public/js/app.js — shared UI kit: nav drawer, toasts, custom dialogs, custom select dropdowns.
// Everything here replaces native prompt()/confirm()/select popups with the hub's own design.
(function () {
  "use strict";

  // ----- mobile nav -----
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("click", function (e) {
      if (nav.classList.contains("open") && !nav.contains(e.target) && !toggle.contains(e.target)) {
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  // ----- flash dismiss -----
  document.querySelectorAll(".flash-close").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var wrap = btn.closest(".flash-wrap") || btn.closest(".flash");
      if (wrap) wrap.remove();
    });
  });
  var autoFlash = document.querySelector(".flash");
  if (autoFlash) setTimeout(function () {
    var wrap = autoFlash.closest(".flash-wrap");
    (wrap || autoFlash).style.transition = "opacity 300ms";
    (wrap || autoFlash).style.opacity = "0";
    setTimeout(function () { (wrap || autoFlash).remove(); }, 320);
  }, 4200);

  // ----- toasts -----
  var toastStack = null;
  function ensureStack() {
    if (!toastStack) {
      toastStack = document.createElement("div");
      toastStack.className = "toast-stack";
      document.body.appendChild(toastStack);
    }
    return toastStack;
  }
  window.toast = function (message, kind) {
    var el = document.createElement("div");
    el.className = "toast" + (kind === "ok" ? " toast-ok" : kind === "bad" ? " toast-bad" : "");
    el.setAttribute("role", "status");
    var icon = kind === "ok" ? "check" : kind === "bad" ? "alert" : "spark";
    el.innerHTML = '<svg class="icon icon-sm" aria-hidden="true"><use href="#i-' + icon + '"></use></svg><span></span>';
    el.querySelector("span").textContent = message;
    ensureStack().appendChild(el);
    setTimeout(function () {
      el.style.transition = "opacity 250ms";
      el.style.opacity = "0";
      setTimeout(function () { el.remove(); }, 280);
    }, 3400);
  };

  // ----- modal base (single overlay, promise-based) -----
  var openModal = null;
  function buildModal(innerHtml, opts) {
    opts = opts || {};
    if (openModal) openModal.remove();
    var dlg = document.createElement("dialog");
    dlg.className = "modal" + (opts.wide ? " modal-wide" : "");
    dlg.innerHTML = '<div class="modal-card">' + innerHtml + "</div>";
    document.body.appendChild(dlg);
    dlg.addEventListener("cancel", function (e) { e.preventDefault(); dlg.close(); dlg.remove(); openModal = null; after(opts.onClose); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) { dlg.close(); dlg.remove(); openModal = null; after(opts.onClose); } });
    openModal = dlg;
    function after(fn) { if (typeof fn === "function") setTimeout(fn, 0); }
    return dlg;
  }
  function closeModal(dlg) {
    dlg.close(); dlg.remove();
    if (openModal === dlg) openModal = null;
  }

  // ----- confirm dialog (styled, replaces window.confirm) -----
  window.uiConfirm = function (message, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var dlg = buildModal(
        '<div class="modal-icon ' + (opts.danger ? "is-danger" : "is-info") + '">' +
        '<svg class="icon" aria-hidden="true"><use href="#i-' + (opts.danger ? "alert" : "spark") + '"></use></svg></div>' +
        "<h2>" + escapeHtml(opts.title || "Are you sure?") + "</h2>" +
        '<p class="muted mt-2">' + message + "</p>" +
        '<div class="form-actions mt-4">' +
        '<button class="btn ' + (opts.danger ? "btn-danger" : "btn-primary") + '" data-yes type="button">' + escapeHtml(opts.yes || (opts.danger ? "Yes, continue" : "Confirm")) + "</button>" +
        '<button class="btn btn-ghost" data-no type="button">Cancel</button>' +
        "</div>",
        opts
      );
      var done = function (val) { closeModal(dlg); resolve(val); };
      dlg.querySelector("[data-yes]").addEventListener("click", function () { done(true); });
      dlg.querySelector("[data-no]").addEventListener("click", function () { done(false); });
      dlg.showModal();
      dlg.querySelector("[data-no]").focus();
    });
  };

  // ----- prompt dialog with an input (replaces window.prompt) -----
  window.uiPrompt = function (opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var dlg = buildModal(
        '<div class="modal-icon is-info"><svg class="icon" aria-hidden="true"><use href="#i-' + (opts.icon || "edit") + '"></use></svg></div>' +
        "<h2>" + escapeHtml(opts.title || "Name it") + "</h2>" +
        (opts.message ? '<p class="muted mt-2 small">' + escapeHtml(opts.message) + "</p>" : "") +
        '<div class="field mt-4"><label>' + escapeHtml(opts.label || "Title") + "</label>" +
        '<input class="input" data-input maxlength="' + (opts.maxlength || 120) + '" placeholder="' + escapeHtml(opts.placeholder || "") + '" value="' + escapeHtml(opts.value || "") + '"></div>' +
        '<div class="form-actions mt-4">' +
        '<button class="btn btn-primary" data-ok type="button">' + escapeHtml(opts.ok || "Create") + "</button>" +
        '<button class="btn btn-ghost" data-cancel type="button">Cancel</button>' +
        "</div>",
        opts
      );
      var input = dlg.querySelector("[data-input]");
      var done = function (val) { closeModal(dlg); resolve(val); };
      dlg.querySelector("[data-ok]").addEventListener("click", function () { done(input.value.trim()); });
      dlg.querySelector("[data-cancel]").addEventListener("click", function () { done(null); });
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); done(input.value.trim()); }
      });
      dlg.showModal();
      input.focus(); input.select();
    });
  };

  // ----- custom select dropdowns -----
  // Enhances every <select class="select"> with a styled button + listbox that matches the hub design.
  // The original <select> stays in the DOM (hidden) so form logic reading .value keeps working.
  var SELECT_LABELS = {
    student: "Student", moderator: "Moderator", admin: "Admin (adviser)",
    mcq: "Multiple choice", tf: "True / False", short: "Short answer",
    practice: "Practice quiz", live: "Live test",
    info: "Info (blue)", tip: "Tip (teal)", warn: "Careful (amber)",
    true: "Correct: True", false: "Correct: False",
  };
  function labelFor(select, value) {
    var opt = select.querySelector('option[value="' + CSS.escape(value) + '"]');
    return opt ? opt.textContent : (SELECT_LABELS[value] || value);
  }
  window.uiSelect = {
    enhance: function (select) {
      if (!select || select.dataset.uiSelect) return;
      select.dataset.uiSelect = "1";
      if (select.disabled) return;

      var wrap = document.createElement("div");
      wrap.className = "ui-select";
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ui-select-btn";
      btn.setAttribute("aria-haspopup", "listbox");
      var label = document.createElement("span");
      label.className = "ui-select-label";
      var caret = document.createElement("span");
      caret.className = "ui-select-caret";
      caret.innerHTML = '<svg class="icon icon-sm" aria-hidden="true"><use href="#i-down"></use></svg>';
      btn.append(label, caret);
      var menu = document.createElement("div");
      menu.className = "ui-select-menu";
      menu.setAttribute("role", "listbox");
      wrap.append(btn, menu);

      function renderMenu() {
        menu.innerHTML = "";
        Array.prototype.forEach.call(select.options, function (opt) {
          var item = document.createElement("button");
          item.type = "button";
          item.className = "ui-select-item" + (opt.value === select.value ? " is-active" : "");
          item.setAttribute("role", "option");
          item.dataset.value = opt.value;
          item.textContent = opt.textContent;
          menu.appendChild(item);
        });
      }
      function sync() {
        label.textContent = labelFor(select, select.value);
        renderMenu();
        btn.classList.toggle("is-placeholder", !!select.dataset.placeholder && !select.value);
      }
      function open() {
        closeAllMenus(wrap);
        wrap.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
        var active = menu.querySelector(".is-active");
        if (active) active.scrollIntoView({ block: "nearest" });
      }
      function close() { wrap.classList.remove("is-open"); btn.setAttribute("aria-expanded", "false"); }

      btn.addEventListener("click", function () { wrap.classList.contains("is-open") ? close() : open(); });
      menu.addEventListener("click", function (e) {
        var item = e.target.closest(".ui-select-item");
        if (!item) return;
        select.value = item.dataset.value;
        sync(); close();
        select.dispatchEvent(new Event("change", { bubbles: true }));
        btn.focus();
      });
      select.addEventListener("change", function () {
        // value changed from outside (e.g. JS reset)
        if (label.textContent !== labelFor(select, select.value)) sync();
      });

      select.parentNode.insertBefore(wrap, select);
      wrap.appendChild(select); // original select moves inside, hidden by CSS
      sync();
      wrap._sync = sync;
    },
    syncAll: function (root) {
      (root || document).querySelectorAll("select[data-ui-select]").forEach(function (s) {
        var wrap = s.closest(".ui-select");
        if (wrap && wrap._sync) wrap._sync();
      });
      (root || document).querySelectorAll("select.select").forEach(function (s) { window.uiSelect.enhance(s); });
    },
  };
  function closeAllMenus(except) {
    document.querySelectorAll(".ui-select.is-open").forEach(function (w) { if (w !== except) w.classList.remove("is-open"); });
  }
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".ui-select")) closeAllMenus();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeAllMenus();
  });

  // enhance all static selects once the page is ready
  function boot() { window.uiSelect.syncAll(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  // ----- countdown chips (e.g. the leaderboard's weekly reset) -----
  // any element with [data-countdown="<epoch ms>"] gets a live "2d 14h" style label
  function tickCountdowns() {
    document.querySelectorAll("[data-countdown]").forEach(function (el) {
      var t = parseInt(el.getAttribute("data-countdown"), 10);
      if (!t) return;
      var mins = Math.floor((t - Date.now()) / 60000);
      if (mins <= 0) { el.textContent = "any moment now"; return; }
      var d = Math.floor(mins / 1440);
      var h = Math.floor((mins % 1440) / 60);
      var m = mins % 60;
      el.textContent = (d ? d + "d " : "") + (d || h ? h + "h " : "") + m + "m";
    });
  }
  tickCountdowns();
  setInterval(tickCountdowns, 30000);

  // ----- fetch helper with loading button -----
  window.apiSend = function (url, method, body, btn) {
    if (btn) { btn.classList.add("is-loading"); btn.disabled = true; }
    return fetch(url, {
      method: method || "GET",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) throw new Error(data.error || "Request failed (" + res.status + ")");
        return data;
      });
    }).finally(function () {
      if (btn) { btn.classList.remove("is-loading"); btn.disabled = false; }
    });
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
