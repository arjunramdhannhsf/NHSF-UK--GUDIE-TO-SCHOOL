(function () {
  var base = location.origin;
  if (!/^https?:$/i.test(location.protocol) || !base || base === "null") return;
  var root = base + location.pathname.replace(/[^/]*$/, "");
  var canon = document.querySelector('link[rel="canonical"]');
  var page = root;
  if (canon) {
    page = new URL(canon.getAttribute("href") || "./", root).href;
    canon.setAttribute("href", page);
  }
  document.querySelectorAll('meta[property="og:url"], meta[name="twitter:url"]').forEach(function (el) {
    el.setAttribute("content", page);
  });
  document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]').forEach(function (el) {
    var value = el.getAttribute("content") || "";
    if (value && !/^https?:/i.test(value)) el.setAttribute("content", new URL(value, root).href);
  });
  document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(function (el) {
    var value = el.getAttribute("href") || "./";
    if (!/^https?:/i.test(value)) el.setAttribute("href", new URL(value, root).href);
  });
  var data = document.getElementById("seo-json");
  if (data && data.textContent.indexOf("__ROOT__") !== -1) {
    data.textContent = data.textContent.split("__ROOT__").join(root);
  }
})();
