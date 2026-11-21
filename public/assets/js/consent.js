/* Cookie choice and tracker loading. Google Analytics, Microsoft Clarity and Meta Pixel start only for what the visitor allowed.
   This is a file (not an inline script) so the security policy does not need to allow inline scripts for it. */
(function () {
  var started = { a: false, m: false };
  function startAnalytics() {
    if (started.a) return;
    started.a = true;
    // Google tag (gtag.js)
    var g = document.createElement("script");
    g.async = true;
    g.src = "https://www.googletagmanager.com/gtag/js?id=G-KMTM0S15G4";
    document.head.appendChild(g);
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-KMTM0S15G4');

    // Microsoft Clarity
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "vpbr5gjf7k");
  }
  function startMeta() {
    if (started.m) return;
    started.m = true;
    // Meta Pixel
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '1454874593031556');
    fbq('track', 'PageView');
  }

  // Trackers only run for what the visitor allowed. The choice is kept in this browser (local storage), not in a cookie.
  // It is saved as {"a":1,"m":0}: a = analytics (Google Analytics, Clarity), m = advertising measurement (Meta Pixel).
  var KEY = "mad-consent";
  function read() {
    try {
      var v = localStorage.getItem(KEY);
      if (!v) return null;
      if (v === "granted") return { a: 1, m: 1 };
      if (v === "denied") return { a: 0, m: 0 };
      var o = JSON.parse(v);
      return { a: o.a ? 1 : 0, m: o.m ? 1 : 0 };
    } catch (e) { return null; }
  }
  function write(c) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} }
  function startAllowed() {
    var c = read();
    if (!c) return;
    if (c.a) startAnalytics();
    if (c.m) startMeta();
  }
  function clearTrackerCookies() {
    var host = location.hostname, hosts = [host, "." + host], parts = host.split(".");
    while (parts.length > 2) { parts.shift(); hosts.push(parts.join("."), "." + parts.join(".")); }
    document.cookie.split(";").forEach(function (c) {
      var name = c.split("=")[0].trim();
      if (!/^(_ga|_gid|_gat|_gcl|_fbp|_fbc|_clck|_clsk|CLID|ANONCHK|MUID|SM|MR|SRM_|_uet)/.test(name)) return;
      hosts.forEach(function (d) { document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + d; });
      document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
    });
  }
  var choice = read();
  if (choice && (choice.a || choice.m)) {
    ["pointerdown", "keydown", "scroll", "touchstart"].forEach(function (t) {
      window.addEventListener(t, startAllowed, { once: true, passive: true });
    });
    window.addEventListener("load", function () { setTimeout(startAllowed, 5000); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var box = document.getElementById("consent");
    if (!box) return;
    var more = box.querySelector("[data-consent=more]");
    var panel = box.querySelector("#consent-panel");
    var sign = box.querySelector("[data-more-sign]");
    var boxes = box.querySelectorAll("[data-cat]");
    var timers = [];
    var decided = false;
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function stopTimers() { timers.forEach(clearTimeout); timers = []; }
    function setPanel(open) {
      panel.hidden = !open;
      more.setAttribute("aria-expanded", open ? "true" : "false");
      sign.textContent = open ? "\u2212" : "+";
    }
    function fillSwitches() {
      var c = read() || { a: 0, m: 0 };
      Array.prototype.forEach.call(boxes, function (b) { b.checked = !!c[b.getAttribute("data-cat")]; });
    }
    function show(manual) {
      stopTimers();
      fillSwitches();
      setPanel(!!manual);
      box.hidden = false;
      requestAnimationFrame(function () { box.classList.add("is-in"); });
      if (manual) boxes[0].focus();
    }
    function hide() {
      box.classList.remove("is-in");
      setTimeout(function () { box.hidden = true; }, 450);
    }
    function save(c) {
      decided = true;
      stopTimers(); // no pending "ask now" timer may bring the bar back after a choice
      write(c);
      hide();
      // A tracker that is already running but is now switched off: clear its cookies and load the page again without it.
      if ((started.a && !c.a) || (started.m && !c.m)) {
        clearTrackerCookies();
        location.replace(location.href);
        return;
      }
      startAllowed();
    }
    more.addEventListener("click", function () { setPanel(panel.hidden); });
    box.querySelector("[data-consent=accept]").addEventListener("click", function () { save({ a: 1, m: 1 }); });
    box.querySelector("[data-consent=refuse]").addEventListener("click", function () { save({ a: 0, m: 0 }); });
    box.querySelector("[data-consent=save]").addEventListener("click", function () {
      var c = { a: 0, m: 0 };
      Array.prototype.forEach.call(boxes, function (b) { c[b.getAttribute("data-cat")] = b.checked ? 1 : 0; });
      save(c);
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-consent-open]"), function (el) {
      el.addEventListener("click", function () { show(true); });
    });
    if (!choice) {
      // First visit: ask after the loading screen, so the question never competes with it.
      var go = function () { if (!decided && !read() && box.hidden) show(false); };
      Promise.resolve(window.__preloaded).then(function () { later(go, 900); });
      later(go, 8000);
    }
  });
})();
