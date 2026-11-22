// public/js/note-toc.js — builds a mini table of contents from a note's headings.
// Desktop: sticky rail card in the side column with scroll-spy.
// Mobile: collapsible "On this page" right under the title.
(function () {
  "use strict";

  var MIN_HEADINGS = 3; // a 2-heading note doesn't need a TOC
  var rail = document.getElementById("note-toc");
  var railList = document.getElementById("note-toc-list");
  var inline = document.getElementById("note-toc-inline");
  var inlineList = document.getElementById("note-toc-list-inline");

  var headings = Array.prototype.slice.call(
    document.querySelectorAll(".note-body h2[id], .note-body h3[id]")
  );
  if (headings.length < MIN_HEADINGS || (!rail && !inline)) return;

  function build(list, compact) {
    if (!list) return;
    list.innerHTML = "";
    headings.forEach(function (h) {
      var li = document.createElement("li");
      if (h.tagName === "H3" && !compact) li.className = "is-sub";
      var a = document.createElement("a");
      a.href = "#" + h.id;
      a.textContent = h.textContent;
      a.addEventListener("click", function (e) {
        e.preventDefault();
        h.scrollIntoView({ behavior: "smooth", block: "start" });
        history.replaceState(null, "", "#" + h.id);
        if (inline && inline.open && window.matchMedia("(max-width: 1023px)").matches) {
          inline.removeAttribute("open"); // jump made — fold the list away on mobile
        }
      });
      li.appendChild(a);
      list.appendChild(li);
    });
  }

  build(railList, false);
  build(inlineList, true);
  if (rail) rail.hidden = false;
  if (inline) inline.hidden = false;

  // scroll-spy: highlight the section currently on screen (desktop rail only)
  if (rail && "IntersectionObserver" in window) {
    var links = {};
    railList.querySelectorAll("a").forEach(function (a) {
      links[a.getAttribute("href").slice(1)] = a;
    });
    var active = null;
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        if (active) active.classList.remove("is-active");
        active = links[entry.target.id];
        if (active) active.classList.add("is-active");
      });
    }, { rootMargin: "-84px 0px -65% 0px" });
    headings.forEach(function (h) { spy.observe(h); });
  }
})();
