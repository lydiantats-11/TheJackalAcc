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
    if (form.classList.contains("lang")) {
      var want = e.submitter && e.submitter.value;
      if (!want || want === locale) return;
      var key = currentKey();
      var file = location.pathname.split("/").pop() || "";
      var target = key && (window.SNAP_MANIFEST[other] || {})[key];
      if (!target && /--for-me-demo\.html$/.test(file)) target = other + "--for-me-demo.html";
      location.href = target || other + "--index.html";
      return;
    }
    if ((form.getAttribute("method") || "get").toLowerCase() === "get" && form.getAttribute("action")) {
      var params = [];
      new FormData(form).forEach(function (v, k) { params.push([k, String(v)]); });
      var path = new URL(form.getAttribute("action"), location.href).pathname;
      path = path.indexOf("/opportunities") >= 0 ? "/opportunities" : path;
      location.href = M[keyOf(path, params)] || locale + "--missing.html";
      return;
    }
    note(form, locale === "el" ? "Στην προεπισκόπηση αυτό δεν αποθηκεύεται — λειτουργεί στην πλήρη εφαρμογή." : "Nothing is saved in this preview — this works in the full app.");
  }, true);
})();
