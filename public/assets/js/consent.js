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
  // Bump VERSION when the trackers or what they do change: everyone is then asked again.
  var VERSION = 1;
  var MAX_AGE = 365 * 24 * 60 * 60 * 1000; // a choice is asked again after 12 months
  function read() {
    try {
      var v = localStorage.getItem(KEY);
      if (!v) return null;
      var o = JSON.parse(v);
      if (!o || o.v !== VERSION || !o.t || Date.now() - o.t > MAX_AGE || o.t > Date.now() + 86400000) return null; // old, expired or from an older policy
      return { a: o.a ? 1 : 0, m: o.m ? 1 : 0 };
    } catch (e) { return null; }
  }
  function write(c) { try { localStorage.setItem(KEY, JSON.stringify({ a: c.a, m: c.m, v: VERSION, t: Date.now() })); } catch (e) {} }
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
  try {
    // A saved choice that is no longer valid (expired or older version): forget it and remove tracker cookies from it.
    if (!choice && localStorage.getItem(KEY)) { localStorage.removeItem(KEY); clearTrackerCookies(); }
  } catch (e) {}
  // Global Privacy Control (a browser setting that says "do not sell or share my data") counts as Refuse, so the bar does not ask.
  // The visitor can still opt in later with "Cookie settings" in the footer.
  if (!choice && navigator.globalPrivacyControl === true) { write({ a: 0, m: 0 }); choice = read(); }
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
    // While the bar is open, keep the end of the page scrollable above it (so it never hides the form or footer links).
    if (window.ResizeObserver) {
      new ResizeObserver(function () {
        document.documentElement.style.setProperty("--consent-h", box.hidden ? "0px" : box.offsetHeight + "px");
      }).observe(box);
    }
    // A choice made in another tab of this browser applies here too.
    window.addEventListener("storage", function (e) {
      if (e.key !== KEY || !e.newValue) return;
      var c = read();
      if (!c) return;
      decided = true;
      stopTimers();
      hide();
      if ((started.a && !c.a) || (started.m && !c.m)) {
        clearTrackerCookies();
        location.replace(location.href);
        return;
      }
      startAllowed();
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-consent-open]"), function (el) {
      el.addEventListener("click", function () { show(true); });
    });
    if (!choice) {
      // Ask once per visit, after the loading screen. If the visitor ignores it, stay quiet on other pages
      // and ask again only on the Contact page, where they are about to send personal details.
      var SEEN = "mad-consent-seen";
      var onContact = /^\/contact(\.html)?\/?$/.test(location.pathname);
      var seen = false;
      try { seen = !!sessionStorage.getItem(SEEN); } catch (e) {}
      var go = function () {
        if (decided || read() || !box.hidden) return;
        try { sessionStorage.setItem(SEEN, "1"); } catch (e) {}
        show(false);
      };
      if (seen && !onContact) return;
      Promise.resolve(window.__preloaded).then(function () { later(go, 900); });
      later(go, 8000);
    }
  });
})();
