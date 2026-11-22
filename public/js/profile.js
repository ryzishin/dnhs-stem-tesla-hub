// public/js/profile.js — click-the-avatar photo upload, resized client-side to a 256px square.
(function () {
  "use strict";

  var btn = document.getElementById("avatar-btn");
  var file = document.getElementById("avatar-file");
  var removeBtn = document.getElementById("avatar-remove");
  if (!btn || !file) return;

  var MAX_BYTES = 800 * 1024;   // what the server accepts after resize
  var SIZE = 256;               // square output

  btn.addEventListener("click", function () { file.click(); });

  file.addEventListener("change", function () {
    var f = file.files && file.files[0];
    file.value = "";
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { window.toast("Pick a JPG, PNG or WebP image.", "bad"); return; }
    if (f.size > 12 * 1024 * 1024) { window.toast("That photo is huge — pick one under 12MB.", "bad"); return; }

    btn.classList.add("is-busy");
    var img = new Image();
    var url = URL.createObjectURL(f);
    img.onload = function () {
      URL.revokeObjectURL(url);
      try { upload(resize(img)); }
      catch (e) { btn.classList.remove("is-busy"); window.toast("Couldn't read that image — try another.", "bad"); }
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      btn.classList.remove("is-busy");
      window.toast("Couldn't read that image — try another.", "bad");
    };
    img.src = url;
  });

  function resize(img) {
    var canvas = document.createElement("canvas");
    canvas.width = SIZE; canvas.height = SIZE;
    var ctx = canvas.getContext("2d");
    // center-crop the source to a square, then scale it down
    var side = Math.min(img.naturalWidth, img.naturalHeight);
    var sx = (img.naturalWidth - side) / 2;
    var sy = (img.naturalHeight - side) / 2;
    ctx.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE);
    return canvas.toDataURL("image/jpeg", 0.86);
  }

  function upload(dataUrl) {
    apiSend("/profile/avatar", "POST", { image: dataUrl })
      .then(function (res) {
        window.toast("Photo updated.", "ok");
        if (removeBtn) removeBtn.hidden = false;
        refreshAvatars(res.avatarUrl);
      })
      .catch(function (err) { window.toast(err.message, "bad"); })
      .finally(function () { btn.classList.remove("is-busy"); });
  }

  // swap every avatar on the page (nav + profile) without a reload
  function refreshAvatars(avatarUrl) {
    document.querySelectorAll(".avatar").forEach(function (av) {
      var img = av.querySelector("img");
      if (!img) { img = document.createElement("img"); av.appendChild(img); }
      img.src = avatarUrl + "?v=" + Date.now();
    });
  }

  if (removeBtn) {
    removeBtn.addEventListener("click", function () {
      window.uiConfirm("Remove your photo? Your initials will show instead.", { danger: true, title: "Remove photo", yes: "Remove" })
        .then(function (ok) {
          if (!ok) return;
          apiSend("/profile/avatar/remove", "POST", {})
            .then(function () { location.reload(); })
            .catch(function (err) { window.toast(err.message, "bad"); });
        });
    });
  }
})();
