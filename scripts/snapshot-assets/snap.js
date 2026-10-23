// Static-snapshot behaviour: filter forms jump to the saved page for that filter; actions that need the server are disabled.
(function () {
  var locale = document.body.getAttribute("data-snap-locale") || "el";
  var M = (window.SNAP_MANIFEST || {})[locale] || {};
  var other = locale === "el" ? "en" : "el";
  var DEFAULTS = { status: "current", page: "1" };
  function keyOf(path, params) {
    var p = params.filter(function (kv) { return kv[1] !== "" && DEFAULTS[kv[0]] !== kv[1]; }).sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
    return path + (p.length ? "?" + p.map(function (kv) { return kv[0] + "=" + kv[1]; }).join("&") : "");
  }
  function currentKey() {
    var file = location.pathname.split("/").pop() || "";
    for (var k in M) if (M[k] === file) return k;
    return null;
  }
  function note(form, text) {
    var n = form.querySelector(".snap-note");
    if (!n) { n = document.createElement("p"); n.className = "snap-note"; form.appendChild(n); }
    n.textContent = text;
  }
  document.addEventListener("submit", function (e) {
    var form = e.target;
    e.preventDefault();
    if (form.classList.contains("kn-search")) return; // Γνώση: filtered live below
    if (form.classList.contains("lang")) {
      var want = e.submitter && e.submitter.value;
      if (!want || want === locale) return;
      var key = currentKey();
      var file = location.pathname.split("/").pop() || "";
      var target = key && (window.SNAP_MANIFEST[other] || {})[key];
      if (!target && /--account-demo\.html$/.test(file)) target = other + "--account-demo.html";
      location.href = target || other + "--index.html";
      return;
    }
    if ((form.getAttribute("method") || "get").toLowerCase() === "get" && form.getAttribute("action")) {
      var params = [];
      new FormData(form).forEach(function (v, k) { params.push([k, String(v)]); });
      var path = new URL(form.getAttribute("action"), location.href).pathname;
      var m = path.match(/\/(politis|epixeiriseis)\/(eukairies|odigoi)/);
      path = m ? m[0] : path;
      location.href = M[keyOf(path, params)] || locale + "--missing.html";
      return;
    }
    note(form, locale === "el" ? "Στην προεπισκόπηση αυτό δεν αποθηκεύεται — λειτουργεί στην πλήρη εφαρμογή." : "Nothing is saved in this preview — this works in the full app.");
  }, true);

  // Γνώση (Knowledge): the same live search, topic chips and A–Ω index as the app, over the server-rendered list.
  function fold(s) { return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/ς/g, "σ"); }
  document.querySelectorAll(".kn-browser").forEach(function (box) {
    var input = box.querySelector("#kn-q"), count = box.querySelector(".kn-count");
    var items = [].slice.call(box.querySelectorAll(".kn-item"));
    var state = { topic: "", letter: "" };
    function press(sel, attr, value) {
      box.querySelectorAll(sel).forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute(attr) === value)); });
    }
    function apply() {
      var words = fold(input ? input.value : "").split(/[^\p{L}\p{N}]+/u).filter(Boolean), n = 0;
      items.forEach(function (li) {
        var hay = li.getAttribute("data-hay") || "";
        var show = (!state.topic || li.getAttribute("data-topic") === state.topic) && (!state.letter || li.getAttribute("data-letter") === state.letter)
          && words.every(function (w) { return hay.indexOf(w) !== -1; });
        li.hidden = !show; if (show) n++;
      });
      if (count) count.textContent = n + " " + (n === 1 ? count.getAttribute("data-one") : count.getAttribute("data-many"));
    }
    if (input) input.addEventListener("input", apply);
    box.querySelectorAll(".kn-chips button[data-topic]").forEach(function (b) {
      b.addEventListener("click", function () { var v = b.getAttribute("data-topic"); state.topic = state.topic === v ? "" : v; press(".kn-chips button", "data-topic", state.topic); apply(); });
    });
    box.querySelectorAll(".kn-letters button[data-letter]").forEach(function (b) {
      b.addEventListener("click", function () { var v = b.getAttribute("data-letter"); state.letter = state.letter === v ? "" : v; press(".kn-letters button", "data-letter", state.letter); apply(); });
    });
  });
})();
