/* Pre-hydration theme: keep in sync with src/components/providers/theme-provider.tsx */
(function () {
  var k = "theme",
    d = "system";
  function sys() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  try {
    var t = localStorage.getItem(k) || d;
    var r = t === "system" ? sys() : t;
    var el = document.documentElement;
    el.classList.remove("light", "dark");
    if (r === "light" || r === "dark") el.classList.add(r);
    el.style.colorScheme = r;
  } catch {
    /* private mode / storage blocked */
  }
})();
