(function () {
"use strict";

// GSAP, ScrollTrigger, SplitText, Lenis are loaded as plain scripts before this file.
const { gsap, ScrollTrigger, SplitText, Lenis, createCrystalizedBall } = window;

const root = document.documentElement;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const smallScreen = window.matchMedia("(max-width: 768px)").matches;

const nav = document.querySelector("[data-nav]");

/* ---------------------------------------------------------------
   3. Smooth scroll (Lenis) wired into GSAP's ticker
---------------------------------------------------------------- */
let lenis = null;
gsap.registerPlugin(ScrollTrigger, SplitText);
ScrollTrigger.config({ ignoreMobileResize: true }); // phone address bars should not re-measure the pinned section

if (!reduceMotion) {
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

}

/* ---------------------------------------------------------------
   Loading screen: the amber logo fills from the bottom like water, 0 to 100, then the screen lifts away.
   The hero intro waits for it (window.__preloaded). It plays on arrival and refresh; the page head decides whether to skip it.
---------------------------------------------------------------- */
let preResolve = () => {};
window.__preloaded = new Promise((resolve) => (preResolve = resolve));
(function loadingScreen() {
  const pre = document.querySelector("[data-preloader]");
  if (!pre || root.classList.contains("no-pre")) {
    if (pre) pre.remove();
    preResolve();
    return;
  }
  if (lenis) lenis.stop();
  window.scrollTo(0, 0);

  const fillA = pre.querySelector(".pl-fill-a");
  const fillB = pre.querySelector(".pl-fill-b");
  const num = pre.querySelector("[data-pl-num]");
  const state = { v: 0, phase: 0 };
  const STEPS = 36;
  const AMP = 4; // wave height, in % of the logo height

  const surface = (level, phase, strength) => {
    const centre = 100 + AMP - level * (100 + 2 * AMP);
    const amp = AMP * strength * (0.3 + 0.7 * Math.sin(Math.PI * Math.min(Math.max(level, 0), 1)));
    let pts = "0% 100%";
    for (let i = 0; i <= STEPS; i++) {
      const x = (i / STEPS) * 100;
      const y = centre + amp * Math.sin((x / 100) * Math.PI * 3 + phase) + amp * 0.35 * Math.sin((x / 100) * Math.PI * 7 - phase * 1.4);
      pts += `, ${x.toFixed(2)}% ${y.toFixed(2)}%`;
    }
    return `polygon(${pts}, 100% 100%)`;
  };
  const render = () => {
    fillA.style.clipPath = surface(state.v, state.phase, 1);
    fillB.style.clipPath = surface(Math.min(state.v + 0.025, 1), state.phase + 1.3, 1.25);
    num.textContent = Math.round(state.v * 100);
  };
  const wave = (time, delta) => {
    state.phase += delta * 0.0042;
    render();
  };
  gsap.ticker.add(wave);
  render();

  const loaded = new Promise((resolve) => {
    if (document.readyState === "complete") resolve();
    else window.addEventListener("load", resolve, { once: true });
  });
  const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  const slowFill = new Promise((resolve) => {
    gsap.to(state, { v: 0.9, duration: 1.2, ease: "power1.inOut", onComplete: resolve });
  });
  const giveUp = new Promise((resolve) => setTimeout(resolve, 4000));

  Promise.race([Promise.all([loaded, fonts, slowFill]), giveUp]).then(() => {
    gsap.to(state, {
      v: 1,
      duration: 0.5,
      ease: "power2.inOut",
      onComplete: () => {
        gsap.ticker.remove(wave);
        fillA.style.clipPath = "none";
        fillB.style.clipPath = "none";
        num.textContent = "100";
        const out = gsap.timeline({ delay: 0.15 });
        out
          .to(pre.querySelector(".pl-count"), { yPercent: 30, autoAlpha: 0, duration: 0.5, ease: "power2.in" }, 0)
          .to(pre.querySelector(".pl-label"), { autoAlpha: 0, duration: 0.3 }, 0)
          .to(pre.querySelector(".pl-logo"), { scale: 0.94, duration: 0.7, ease: "power2.in" }, 0)
          .to(pre, { clipPath: "inset(0 0 100% 0)", duration: 0.85, ease: "expo.inOut" }, 0.3)
          .add(() => preResolve(), 0.6)
          .add(() => {
            root.classList.add("no-pre");
            pre.remove();
            if (lenis) lenis.start();
            ScrollTrigger.refresh();
          });
      },
    });
  });
})();

// The nav stays on screen. After a small scroll it shrinks into a tighter floating pill, and it relaxes again at the top.
if (nav) {
  const compact = () => nav.classList.toggle("is-compact", window.scrollY > 24);
  window.addEventListener("scroll", compact, { passive: true });
  compact();

}

// In-page links glide with Lenis, and keyboard focus follows the scroll.
// Scroll position (in px) for a moment on the Projects timeline. Set once that section is built.
let workScrollTo = null;
const glide = (y) => {
  if (lenis) lenis.scrollTo(y, { duration: 1.8, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else window.scrollTo(0, y);
};

document.querySelectorAll('a[href^="#"]:not([data-project-link])').forEach((link) => {
  link.addEventListener("click", (event) => {
    const id = link.getAttribute("href");
    if (!id || id === "#") return;
    const target = document.querySelector(id);
    if (!target) return;
    event.preventDefault();
    if (id === "#work" && workScrollTo) glide(workScrollTo(2.8)); // land just after the explosion, on the first project
    else if (lenis) lenis.scrollTo(target, { duration: 1.5, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else target.scrollIntoView({ behavior: "auto" });
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    history.replaceState(null, "", id);
  });
});

/* ---------------------------------------------------------------
   3b. Button labels: each letter is a small two-line roller. On hover the letters roll up one after another,
   and the second line (the accent colour on the outline button) rolls in. The real label stays in aria-label.
---------------------------------------------------------------- */
document.querySelectorAll(".cta > span, .talk > span, .c-send > span, .c-big > span, .foot-call > span").forEach((label) => {
  label.parentElement.classList.add("has-roll");
  const text = label.textContent.trim();
  label.setAttribute("aria-label", text);
  label.textContent = "";
  let n = 0;
  text.split(" ").forEach((word, w) => {
    if (w) label.appendChild(document.createTextNode(" "));
    // Each word stays together, so a long label wraps between words and never in the middle of one.
    const holder = document.createElement("span");
    holder.className = "rw";
    Array.from(word).forEach((c) => {
      const ch = document.createElement("span");
      ch.className = "ch";
      ch.setAttribute("aria-hidden", "true");
      ch.style.setProperty("--i", n++);
      ch.innerHTML = "<i>" + c + "</i><i>" + c + "</i>";
      holder.appendChild(ch);
    });
    label.appendChild(holder);
  });
});

/* ---------------------------------------------------------------
   3c. Full-screen menu. The round button opens a dark panel that grows out of it. The links, the prices, the
   call button and the contact details then come in one after another. Escape, the button or any link closes it.
   While it is open the page behind stops scrolling and keyboard focus stays inside.
---------------------------------------------------------------- */
const menuEl = document.querySelector("[data-menu]");
const menuBtn = document.querySelector("[data-menu-btn]");
if (nav && menuEl && menuBtn) {
  const items = Array.from(menuEl.querySelectorAll("[data-m]"));
  const focusables = () => Array.from(menuEl.querySelectorAll("a[href]")).concat(menuBtn);
  let isOpen = false;
  let tl = null;

  const setOpen = (open) => {
    if (open === isOpen) return;
    isOpen = open;
    nav.classList.toggle("menu-open", open);
    menuEl.classList.toggle("is-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.firstElementChild.textContent = open ? "Close menu" : "Menu";
    if (open) {
      const r = menuBtn.getBoundingClientRect();
      menuEl.style.setProperty("--mx", r.left + r.width / 2 + "px");
      menuEl.style.setProperty("--my", r.top + r.height / 2 + "px");
      menuEl.removeAttribute("inert");
      if (lenis) lenis.stop();
      else root.style.overflow = "hidden";
      menuEl.scrollTop = 0;
      if (tl) tl.kill();
      if (!reduceMotion) {
        tl = gsap.timeline({ defaults: { ease: "expo.out" } });
        items.forEach((el, i) => {
          const isLink = el.tagName === "SPAN";
          tl.fromTo(
            el,
            isLink ? { yPercent: 115 } : { y: 26, autoAlpha: 0 },
            isLink ? { yPercent: 0, duration: 1.1 } : { y: 0, autoAlpha: 1, duration: 0.9 },
            0.4 + i * 0.065
          );
        });
      }
      window.setTimeout(() => menuEl.querySelector(".menu-links a").focus({ preventScroll: true }), 60);
    } else {
      menuEl.setAttribute("inert", "");
      if (lenis) lenis.start();
      else root.style.overflow = "";
      menuBtn.focus({ preventScroll: true });
    }
  };

  menuBtn.addEventListener("click", () => setOpen(!isOpen));
  // Capture phase: the menu must close (and Lenis start again) before the in-page glide runs.
  menuEl.querySelectorAll("a").forEach((a) =>
    a.addEventListener(
      "click",
      () => {
        if (isOpen) {
          isOpen = false;
          nav.classList.remove("menu-open");
          menuEl.classList.remove("is-open");
          menuEl.setAttribute("inert", "");
          menuBtn.setAttribute("aria-expanded", "false");
          menuBtn.firstElementChild.textContent = "Menu";
          if (lenis) lenis.start();
          else root.style.overflow = "";
        }
      },
      true
    )
  );
  document.addEventListener("keydown", (e) => {
    if (!isOpen) return;
    if (e.key === "Escape") setOpen(false);
    if (e.key === "Tab") {
      const f = focusables();
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
  // Desktop and mobile layouts differ, so a resize while open just keeps it open and re-centres the circle.
}

/* ---------------------------------------------------------------
   4. Hero: one orchestrated entrance, then a scroll-linked exit
---------------------------------------------------------------- */
const heroTitle = document.querySelector(".hero h1");
const heroLines = gsap.utils.toArray(".hero h1 .line, .hero h1 .hero-tag");
const revealItems = gsap.utils.toArray(".hero [data-reveal]");
const heroBars = gsap.utils.toArray(".hbar");

const playIntro = () => {
  window.clearTimeout(window.__revealFallback);

  if (reduceMotion || !heroTitle) {
    gsap.set([heroTitle, ...revealItems], { autoAlpha: 1 });
    return;
  }

  // Order: the nav, the four black bars, the title line by line, the tagline, then the copy and the buttons.
  const split = SplitText.create(heroLines, { type: "lines", mask: "lines", linesClass: "split-line", aria: "none" });
  gsap.set(heroTitle, { autoAlpha: 1 });

  const tl = gsap.timeline({
    defaults: { ease: "expo.out" },
    onComplete: () => split.revert(), // restore the plain heading once the entrance is done
  });
  // The nav children have CSS transitions of their own, which would lag behind GSAP, so they are switched off during the entrance.
  const navParts = gsap.utils.toArray(".nav-bar > *");
  navParts.forEach((el) => (el.style.transition = "none"));
  tl.from(navParts, { y: -24, autoAlpha: 0, duration: 1, stagger: 0.1, clearProps: "transform,opacity,visibility", onComplete: () => navParts.forEach((el) => (el.style.transition = "")) }, 0.1)
    .from(heroBars, { scaleX: 0, duration: 1.1, stagger: 0.12 }, 0.2)
    .from(split.lines, { yPercent: 115, duration: 1.3, stagger: 0.14 }, 0.55)
    .from(revealItems, { y: 24, autoAlpha: 0, duration: 1, stagger: 0.14 }, 1.1);
};

const ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
Promise.all([ready, window.__preloaded]).then(playIntro);

if (!reduceMotion) {
  // As you scroll past the hero the copy drifts up a little and fades.
  const exit = { trigger: ".hero", start: "top top", end: "bottom top", scrub: true };
  gsap.to(".hero-copy, .hero-title, .ah-copy", { yPercent: -8, opacity: 0, ease: "none", scrollTrigger: exit });
}

/* ---------------------------------------------------------------
   5. Pricing: headings rise out of a mask, prices count up once.
   All text is already in the HTML, so nothing here affects what search engines read.
---------------------------------------------------------------- */
if (!reduceMotion) {
  document.querySelectorAll(".services h2, .service-name, .pricing h2, .package h3, .ab h2").forEach((heading) => {
    SplitText.create(heading, {
      type: "lines",
      aria: "none", // the text stays readable as lines; an aria-label on a span is not allowed
      mask: "lines",
      autoSplit: true, // re-splits if the font loads late or the width changes
      onSplit(self) {
        return gsap.from(self.lines, {
          yPercent: 110,
          duration: 1.2,
          ease: "expo.out",
          stagger: 0.1,
          scrollTrigger: { trigger: heading, start: "top 88%", once: true },
        });
      },
    });
  });

  document.querySelectorAll("[data-count]").forEach((el) => {
    const target = Number(el.dataset.count);
    const counter = { value: target };
    gsap.to(counter, {
      value: target,
      duration: 1.6,
      ease: "power3.out",
      paused: true,
      scrollTrigger: {
        trigger: el,
        start: "top 90%",
        once: true,
        onEnter: () => {
          counter.value = 0;
          gsap.to(counter, {
            value: target,
            duration: 1.6,
            ease: "power3.out",
            onUpdate: () => {
              el.textContent = Math.round(counter.value).toLocaleString("en-US");
            },
            onComplete: () => {
              el.textContent = target.toLocaleString("en-US");
            },
          });
        },
      },
    });
  });
}


/* ---------------------------------------------------------------
   5b. About page: paragraphs, rows, steps and tool tiles rise in as they scroll into view, in order.
   (Text is in the HTML either way. Nothing is hidden without JavaScript or with reduced motion.)
---------------------------------------------------------------- */
if (!reduceMotion && document.querySelector(".ab [data-rise]")) {
  gsap.set(".ab [data-rise]", { autoAlpha: 0, y: 28 });
  // Revealed on the way in, and also if a link glides straight past them or you jump back up, so nothing stays hidden.
  const rise = (els) => gsap.to(els, { autoAlpha: 1, y: 0, duration: 1.1, ease: "expo.out", stagger: 0.1, overwrite: "auto" });
  ScrollTrigger.batch(".ab [data-rise]", { start: "top 90%", onEnter: rise, onLeave: rise, onEnterBack: rise });
}

/* Projects page: each picture is uncovered from the top as it scrolls in (the clip is removed afterwards, so the edge stays). */
if (!reduceMotion) {
  gsap.utils.toArray(".pj-shot .pj-link").forEach((box) => {
    gsap.from(box, {
      clipPath: "inset(0 0 100% 0)",
      duration: 1.3,
      ease: "expo.out",
      clearProps: "clipPath",
      scrollTrigger: { trigger: box, start: "top 88%", once: true },
    });
  });
}

/* Legal pages: the table of contents marks the section being read. */
const tocLinks = gsap.utils.toArray(".lg-toc a");
if (tocLinks.length && "IntersectionObserver" in window) {
  const byId = new Map(tocLinks.map((a) => [a.getAttribute("href").slice(1), a]));
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        tocLinks.forEach((a) => a.classList.toggle("is-active", a === byId.get(e.target.id)));
      });
    },
    { rootMargin: "-25% 0px -65% 0px" }
  );
  document.querySelectorAll(".lg-sec").forEach((sec) => io.observe(sec));
}

/* ---------------------------------------------------------------
   6. Services accordion. One row is open at a time. Click or press Enter to open a row.
   The text of every row is always in the HTML, open or closed.
---------------------------------------------------------------- */
const serviceRows = Array.from(document.querySelectorAll("[data-accordion] .service"));
let refreshOrb = () => ScrollTrigger.refresh(); // rows change the page height, so the pinned section is measured again

const openService = (row) => {
  serviceRows.forEach((el) => {
    const open = el === row;
    el.classList.toggle("is-open", open);
    el.querySelector(".service-trigger").setAttribute("aria-expanded", String(open));
  });
};
serviceRows.forEach((row) => {
  row.querySelector(".service-trigger").addEventListener("click", () => openService(row));
  // The list changes height while a row opens, so the ball's path is measured again afterwards.
  row.querySelector(".service-panel").addEventListener("transitionend", (e) => {
    if (e.propertyName === "grid-template-rows") refreshOrb();
  });
});

/* ---------------------------------------------------------------
   7. Projects. The section is pinned. The ball arrives in the empty dark, explodes,
   and the first project opens out of the blast. Then each scroll step opens the next
   project with a wipe that starts in the middle and moves out to both sides.
   Without motion (or without JavaScript) the three projects simply stack.
---------------------------------------------------------------- */
const workEl = document.querySelector("#work");
const workStage = workEl && workEl.querySelector("[data-work-stage]");
const slides = workEl ? gsap.utils.toArray("#work .slide") : [];
const work = { ex: 0, st: null, tl: null }; // ex: how far the explosion has gone, 0 to 1

if (workEl && workStage && slides.length >= 3 && !reduceMotion) {
  workEl.classList.add("is-pinned");

  // Timeline length in "steps"; scroll distance is spread evenly over it. Each extra project adds 3.2 steps.
  const wipes = slides.slice(1).map((_, k) => 4.4 + 3.2 * k); // when slide 2, 3, 4... start to open (each takes 1 step)
  const TOTAL = wipes[wipes.length - 1] + 3.6;
  const links = gsap.utils.toArray("[data-project-link]");
  const slash = workEl.querySelector(".slash");

  // Text for each slide. Everything starts hidden; the active slide's text drops in.
  const parts = slides.map((slide) => {
    const title = SplitText.create(slide.querySelector(".slide-title"), { type: "words,chars" });
    const desc = SplitText.create(slide.querySelector(".slide-desc"), { type: "words", aria: "none" });
    const rest = [".slide-count", ".slide-sector", ".slide-meta", ".slide-link"].map((s) => slide.querySelector(s));
    gsap.set([title.chars, desc.words, rest], { autoAlpha: 0 });
    return { chars: title.chars, words: desc.words, rest };
  });

  const showText = (p) => {
    gsap.fromTo(p.chars, { yPercent: -120, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 1.1, ease: "expo.out", stagger: 0.045, overwrite: true });
    gsap.fromTo(p.words, { yPercent: -100, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.9, ease: "expo.out", stagger: 0.02, delay: 0.3, overwrite: true });
    gsap.fromTo(p.rest, { y: -24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, ease: "expo.out", stagger: 0.08, delay: 0.15, overwrite: true });
  };
  const hideText = (p) => {
    gsap.to(p.chars, { yPercent: 70, autoAlpha: 0, duration: 0.35, ease: "power2.in", stagger: 0.012, overwrite: true });
    gsap.to(p.words, { yPercent: 60, autoAlpha: 0, duration: 0.3, ease: "power2.in", stagger: 0.008, overwrite: true });
    gsap.to(p.rest, { y: 20, autoAlpha: 0, duration: 0.3, ease: "power2.in", overwrite: true });
  };

  // Which slide's text is on screen at a given moment. It leaves just before a wipe starts
  // and comes back once the wipe has opened, so text is never half covered by the next image.
  const textAt = (t) => {
    for (let i = 0; i < slides.length; i++) {
      const from = i === 0 ? 1.9 : wipes[i - 1] + 0.7;
      const to = i < wipes.length ? wipes[i] - 0.3 : Infinity;
      if (t >= from && t < to) return i;
    }
    return -1;
  };
  const imageAt = (t) => wipes.filter((w) => t >= w + 0.5).length;

  let shownText = -1;
  let shownImage = -1;
  const sync = () => {
    const t = work.tl.time();
    const text = textAt(t);
    if (text !== shownText) {
      if (shownText >= 0) hideText(parts[shownText]);
      if (text >= 0) showText(parts[text]);
      shownText = text;
    }
    const img = imageAt(t);
    if (img !== shownImage) {
      shownImage = img;
      links.forEach((a, i) => {
        a.classList.toggle("is-active", i === img);
        if (i === img) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
    }
  };

  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: workEl,
      start: "top top",
      end: () => "+=" + Math.round(window.innerHeight * TOTAL * 0.59),
      pin: true,
      scrub: 0.7,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
    onUpdate: sync,
  });
  work.tl = tl;
  work.st = tl.scrollTrigger;

  // The explosion. The ball is squeezed (first 0.7), then bursts: sparks fly out, and the section
  // opens from the centre of the screen through a circle with a ring riding its edge.
  tl.to(work, { ex: 1, duration: 2 }, 0);
  tl.fromTo(workStage, { "--r": 0 }, { "--r": 75, duration: 1.5, ease: "power3.out" }, 0.7);

  slides.forEach((slide, i) => {
    const open = i === 0 ? 0.9 : wipes[i - 1]; // when this image first shows
    const tint = open + (i === 0 ? 0.7 : 0.6); // when it starts losing its yellow
    // True colour is revealed as you scroll: yellow wash and grayscale fade out, the zoom settles.
    tl.fromTo(slide, { "--tint": 1 }, { "--tint": 0, duration: 1.8, immediateRender: false }, tint);
    tl.fromTo(slide, { "--z": 1.12 }, { "--z": 1, duration: tint + 1.8 - open, immediateRender: false }, open);
    if (i > 0) {
      // Horizontal wipe: the new image opens from the middle of the screen out to both sides.
      tl.fromTo(slide, { "--c": 50 }, { "--c": 0, duration: 1, ease: "power2.inOut", immediateRender: false }, open);
      tl.fromTo(slash, { "--c": 50 }, { "--c": 0, duration: 1, ease: "power2.inOut", immediateRender: false }, open);
      tl.fromTo(slash, { opacity: 0 }, { opacity: 1, duration: 0.15, immediateRender: false }, open);
      tl.to(slash, { opacity: 0, duration: 0.3 }, open + 0.7);
    }
  });
  tl.set({}, {}, TOTAL); // gives the timeline its full length

  // Scroll position for a moment on the timeline.
  workScrollTo = (time) => work.st.start + (time / tl.duration()) * (work.st.end - work.st.start);

  const clickTimes = [2.8, ...wipes.map((w) => w + 1.8)];
  links.forEach((a, i) => {
    a.addEventListener("click", (event) => {
      event.preventDefault();
      glide(workScrollTo(clickTimes[i]));
    });
  });

  sync();
}

/* ---------------------------------------------------------------
   8. Process. A staggered entrance: heading, then the grid lines, the bars one after another
   (each wiping in from the left), then the four steps. Everything is plain HTML underneath.
---------------------------------------------------------------- */
const processEl = document.querySelector("#process");
if (processEl && !reduceMotion) {
  SplitText.create("#process h2", {
    type: "lines",
    mask: "lines",
    autoSplit: true,
    onSplit(self) {
      return gsap.from(self.lines, {
        yPercent: 110,
        duration: 1.2,
        ease: "expo.out",
        stagger: 0.1,
        scrollTrigger: { trigger: "#process h2", start: "top 88%", once: true },
      });
    },
  });
  gsap.from("#process [data-stagger]", {
    y: 24,
    autoAlpha: 0,
    duration: 1,
    ease: "expo.out",
    stagger: 0.14,
    scrollTrigger: { trigger: ".process-intro", start: "top 90%", once: true },
  });

  gsap
    .timeline({
      defaults: { ease: "expo.out" },
      scrollTrigger: { trigger: ".gantt", start: "top 78%", once: true },
    })
    .from(".gantt-grid i", { scaleY: 0, transformOrigin: "top", duration: 1.2, stagger: 0.05 }, 0)
    .from(".gantt-nums span", { autoAlpha: 0, y: 10, duration: 0.8, stagger: 0.04 }, 0.25)
    .from(".bar", { clipPath: "inset(0 100% 0 0)", duration: 1.3, stagger: 0.2, clearProps: "clipPath" }, 0.35)
    .from(".bar > span", { autoAlpha: 0, x: -14, duration: 0.9, stagger: 0.1 }, 0.9);

  gsap.from(".step", {
    y: 40,
    autoAlpha: 0,
    duration: 1.1,
    ease: "expo.out",
    stagger: 0.14,
    scrollTrigger: { trigger: ".steps", start: "top 88%", once: true },
  });
}

/* ---------------------------------------------------------------
   9. About. A staggered entrance, and the portrait glitch.
   The glitch is a few copies of the photo stacked on top of each other (added here, so the page
   has a single image in its HTML). Hover turns it on with a mouse; on touch screens it
   plays by itself every few seconds while the portrait is on screen.
---------------------------------------------------------------- */
const portrait = document.querySelector("[data-portrait]");
if (portrait) {
  const stack = portrait.querySelector(".portrait-stack");
  const base = stack.querySelector(".p-base");
  ["p-ghost p-ghost-a", "p-ghost p-ghost-b", "p-slice p-slice-a", "p-slice p-slice-b", "p-slice p-slice-c"].forEach((cls) => {
    const layer = base.cloneNode(false);
    layer.className = "p-layer " + cls;
    layer.alt = "";
    layer.setAttribute("aria-hidden", "true");
    layer.removeAttribute("loading");
    stack.appendChild(layer);
  });
  // Lets the dot texture stay inside the shape of the person.
  stack.style.setProperty("--src", 'url("' + base.currentSrc + '")'); // the resolved address, so it works from the stylesheet

  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)");
  const setGlitch = (on) => portrait.classList.toggle("is-glitch", on);

  // Mouse: while the pointer is over the portrait it glitches in short random bursts.
  let hoverTimer = 0;
  const hoverBurst = () => {
    setGlitch(true);
    hoverTimer = setTimeout(() => {
      setGlitch(false);
      hoverTimer = setTimeout(hoverBurst, 120 + Math.random() * 650);
    }, 140 + Math.random() * 240);
  };
  portrait.addEventListener("pointerenter", (e) => {
    if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
    clearTimeout(hoverTimer);
    hoverBurst();
  });
  portrait.addEventListener("pointerleave", () => {
    clearTimeout(hoverTimer);
    setGlitch(false);
  });

  // Touch screens: a burst on its own every few seconds while the portrait is on screen.
  if (!reduceMotion) {
    let visible = false;
    let timers = [];
    const clear = () => {
      timers.forEach(clearTimeout);
      timers = [];
    };
    const burst = () => {
      clear();
      if (!visible || canHover.matches) return;
      setGlitch(true);
      timers.push(setTimeout(() => setGlitch(false), 260));
      timers.push(setTimeout(() => setGlitch(true), 420));
      timers.push(setTimeout(() => setGlitch(false), 760));
      timers.push(setTimeout(burst, 2600));
    };
    new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting;
        if (visible) timers.push(setTimeout(burst, 900));
        else {
          clear();
          setGlitch(false);
        }
      },
      { threshold: 0.4 }
    ).observe(portrait);
  }
}

const aboutEl = document.querySelector("#about");
if (aboutEl && !reduceMotion) {
  SplitText.create("#about h2", {
    type: "lines",
    mask: "lines",
    autoSplit: true,
    onSplit(self) {
      return gsap.from(self.lines, {
        yPercent: 110,
        duration: 1.2,
        ease: "expo.out",
        stagger: 0.12,
        scrollTrigger: { trigger: "#about h2", start: "top 88%", once: true },
      });
    },
  });
  gsap
    .timeline({
      defaults: { ease: "expo.out" },
      scrollTrigger: { trigger: ".about-inner", start: "top 72%", once: true },
    })
    .from(".about-lines i", { scaleY: 0, transformOrigin: "top", duration: 1.6, stagger: 0.1 }, 0)
    .from(".portrait-glow", { autoAlpha: 0, scale: 0.8, duration: 1.8 }, 0.1)
    .from(".portrait-stack", { clipPath: "inset(100% 0 0 0)", duration: 1.5 }, 0.2)
    .from(".portrait-stack img", { scale: 1.14, duration: 1.8 }, 0.2)
    .from("#about [data-about]", { y: 30, autoAlpha: 0, duration: 1, stagger: 0.12 }, 0.35)
    .from(".about-stack li", { y: 14, autoAlpha: 0, duration: 0.8, stagger: 0.06 }, 1.2);
}

/* ---------------------------------------------------------------
   10. Testimonials. Portraits sit on an arc and turn by themselves; click one to jump to it.
   All five quotes are in the HTML. Without JavaScript they are listed one after another.
---------------------------------------------------------------- */
const voicesEl = document.querySelector("[data-voices]");
const wheel = voicesEl && voicesEl.querySelector("[data-wheel]");
const figures = voicesEl ? Array.from(voicesEl.querySelectorAll("[data-voice]")) : [];

if (voicesEl && wheel && figures.length > 1) {
  voicesEl.classList.add("is-live");
  const n = figures.length;
  const NS = "http://www.w3.org/2000/svg";
  const arcSvg = document.createElementNS(NS, "svg");
  arcSvg.setAttribute("class", "wheel-arc");
  arcSvg.setAttribute("aria-hidden", "true");
  const arc = document.createElementNS(NS, "circle");
  arcSvg.appendChild(arc);
  wheel.appendChild(arcSvg);

  const voices = figures.map((el, i) => {
    const photo = el.querySelector(".voice-photo");
    const name = el.querySelector(".voice-by strong").textContent;
    const role = el.querySelector(".voice-by span").textContent;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "t-item";
    btn.setAttribute("aria-label", "Show the testimonial from " + name + ", " + role);
    const img = photo.cloneNode(false);
    img.className = "t-photo";
    img.alt = "";
    img.removeAttribute("loading");
    img.setAttribute("aria-hidden", "true");
    btn.appendChild(img);
    const meta = document.createElement("span");
    meta.className = "t-meta";
    meta.setAttribute("aria-hidden", "true");
    meta.innerHTML = "<strong></strong><span></span>";
    meta.firstChild.textContent = name;
    meta.lastChild.textContent = role;
    btn.appendChild(meta);
    wheel.appendChild(btn);
    const words = SplitText.create(el.querySelector(".voice-quote p"), { type: "words", aria: "none" }).words;
    return { el, btn, meta, words, by: el.querySelector(".voice-by") };
  });

  const wide = window.matchMedia("(min-width: 900px)");
  const state = { pos: 0, intro: reduceMotion ? 1 : 0 };
  let active = 0;
  let box = { w: 0, h: 0 };

  const wrap = (v) => {
    const m = ((v % n) + n) % n;
    return m >= n / 2 ? m - n : m;
  };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const measureWheel = () => {
    box = { w: wheel.clientWidth, h: wheel.clientHeight };
  };

  const render = () => {
    const vertical = wide.matches;
    const AV = vertical ? 88 : 72;
    const R = vertical ? 340 : 330;
    const step = vertical ? 0.33 : 0.27;
    // The centre of the arc, and where the open portrait sits on it.
    const ax = vertical ? AV / 2 + 56 : box.w / 2;
    const ay = vertical ? box.h / 2 : AV / 2 + 18;
    const cx = vertical ? ax - R : ax;
    const cy = vertical ? ay : ay + R;
    arc.setAttribute("cx", cx);
    arc.setAttribute("cy", cy);
    arc.setAttribute("r", R);
    voices.forEach((v, i) => {
      const d = wrap(i - state.pos);
      const ad = Math.abs(d);
      const intro = clamp((state.intro - 0.1 * ad) / 0.75, 0, 1);
      const th = d * step * (0.35 + 0.65 * intro);
      const x = vertical ? cx + R * Math.cos(th) : cx + R * Math.sin(th);
      const y = vertical ? cy + R * Math.sin(th) : cy - R * Math.cos(th);
      const scale = Math.max(0.5, 1 - 0.27 * ad) * (0.6 + 0.4 * intro);
      let o = ad <= 1 ? 1 - 0.3 * ad : ad <= 2 ? 0.7 - 0.45 * (ad - 1) : 0.25 * (1 - (ad - 2) / 0.5);
      o = clamp(o, 0, 1) * intro;
      v.btn.style.setProperty("--av", AV + "px");
      v.btn.style.setProperty("--g", clamp(ad * 1.2, 0, 1).toFixed(2));
      v.btn.style.setProperty("--ring", clamp(1 - ad * 1.5, 0, 1).toFixed(2));
      v.meta.style.setProperty("--role", clamp(1 - ad * 1.6, 0, 1).toFixed(2));
      v.btn.style.opacity = o.toFixed(3);
      v.btn.style.pointerEvents = o < 0.08 ? "none" : "auto";
      v.btn.style.zIndex = String(10 - Math.round(ad * 2));
      v.btn.style.transform = "translate3d(" + (x - AV / 2).toFixed(1) + "px," + (y - AV / 2).toFixed(1) + "px,0) scale(" + scale.toFixed(3) + ")";
      v.btn.tabIndex = o < 0.08 ? -1 : 0;
    });
  };

  const setCurrent = (i) => {
    voices.forEach((v, k) => {
      if (k === i) v.btn.setAttribute("aria-current", "true");
      else v.btn.removeAttribute("aria-current");
    });
  };

  const showQuote = (from, to) => {
    const out = voices[from];
    const inn = voices[to];
    gsap.killTweensOf([out.words, inn.words, out.by, inn.by]);
    if (reduceMotion) {
      out.el.classList.remove("is-active", "is-leaving");
      inn.el.classList.add("is-active");
      gsap.set([inn.words, inn.by], { clearProps: "all" });
      return;
    }
    out.el.classList.add("is-leaving");
    out.el.classList.remove("is-active");
    gsap.to([out.words, out.by], {
      yPercent: 70,
      autoAlpha: 0,
      duration: 0.35,
      ease: "power2.in",
      stagger: { each: 0.004, from: "start" },
      onComplete: () => out.el.classList.remove("is-leaving"),
    });
    inn.el.classList.add("is-active");
    gsap.fromTo(inn.words, { yPercent: -110, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.95, ease: "expo.out", stagger: Math.min(0.025, 0.7 / inn.words.length), delay: 0.32 });
    gsap.fromTo(inn.by, { y: -14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8, ease: "expo.out", delay: 0.5 });
  };

  let timer = null;
  let hovering = false;
  let inView = false;
  const schedule = () => {
    if (timer) timer.kill();
    timer = null;
    if (reduceMotion || hovering || !inView || document.hidden) return;
    timer = gsap.delayedCall(6, () => goTo(active + 1));
  };

  const goTo = (target) => {
    const next = ((target % n) + n) % n;
    if (next === active && !gsap.isTweening(state)) {
      schedule();
      return;
    }
    const delta = wrap(next - state.pos);
    const from = active;
    active = next;
    setCurrent(active);
    showQuote(from, active);
    gsap.killTweensOf(state, "pos");
    if (reduceMotion) {
      state.pos += delta;
      render();
    } else {
      gsap.to(state, { pos: "+=" + delta, duration: 0.8 + 0.18 * Math.abs(delta), ease: "power3.inOut", onUpdate: render });
    }
    schedule();
  };

  voices.forEach((v, i) => {
    v.btn.addEventListener("click", () => goTo(i));
    v.btn.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        goTo(active + 1);
        voices[(active + n) % n].btn.focus();
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        goTo(active - 1);
        voices[(active + n) % n].btn.focus();
      }
    });
  });

  // Quotes are only paused while the pointer is on the section, so a reader is never moved on mid-sentence.
  voicesEl.addEventListener("pointerenter", (e) => {
    if (e.pointerType === "mouse") {
      hovering = true;
      schedule();
    }
  });
  voicesEl.addEventListener("pointerleave", () => {
    hovering = false;
    schedule();
  });
  document.addEventListener("visibilitychange", schedule);
  new IntersectionObserver(
    (entries) => {
      inView = entries[0].isIntersecting;
      schedule();
    },
    { threshold: 0.35 }
  ).observe(voicesEl);

  // Starting state: the first quote shown, the others hidden.
  voices[0].el.classList.add("is-active");
  voices.slice(1).forEach((v) => gsap.set([v.words, v.by], { autoAlpha: 0 }));
  setCurrent(0);
  measureWheel();
  render();
  ScrollTrigger.addEventListener("refresh", () => {
    measureWheel();
    render();
  });
  window.addEventListener("resize", () => {
    measureWheel();
    render();
  });
  wide.addEventListener("change", () => {
    measureWheel();
    render();
  });

  if (!reduceMotion) {
    gsap.set([voices[0].words, voices[0].by], { autoAlpha: 0 });
    SplitText.create(".voices h2", {
      type: "lines",
      mask: "lines",
      autoSplit: true,
      onSplit(self) {
        return gsap.from(self.lines, {
          yPercent: 110,
          duration: 1.2,
          ease: "expo.out",
          stagger: 0.1,
          scrollTrigger: { trigger: ".voices h2", start: "top 88%", once: true },
        });
      },
    });
    gsap.from("[data-voices-fade]", { y: 16, autoAlpha: 0, duration: 0.9, ease: "expo.out", scrollTrigger: { trigger: ".voices-head", start: "top 88%", once: true } });
    ScrollTrigger.create({
      trigger: voicesEl,
      start: "top 75%",
      once: true,
      onEnter: () => {
        // The portraits fan out along the arc, then the first quote drops in word by word.
        gsap.to(state, { intro: 1, duration: 1.8, ease: "expo.out", onUpdate: render });
        gsap.fromTo(voices[0].words, { yPercent: -110, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.95, ease: "expo.out", stagger: Math.min(0.025, 0.7 / voices[0].words.length), delay: 0.5 });
        gsap.fromTo(voices[0].by, { y: -14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8, ease: "expo.out", delay: 0.8 });
      },
    });
  }
}

/* ---------------------------------------------------------------
   10b. FAQ. Questions open and close independently; the answers are always in the HTML.
---------------------------------------------------------------- */
const faqList = document.querySelector("[data-faq]");
if (faqList) {
  faqList.addEventListener("click", (event) => {
    const button = event.target.closest(".faq-q");
    if (!button) return;
    const item = button.closest(".faq-item");
    const open = !item.classList.contains("is-open");
    item.classList.toggle("is-open", open);
    button.setAttribute("aria-expanded", String(open));
    // Heights change, so ScrollTrigger positions below the FAQ are measured again once the collapse ends.
    clearTimeout(faqList._t);
    faqList._t = setTimeout(() => ScrollTrigger.refresh(), 600);
  });

  if (!reduceMotion) {
    SplitText.create(".faq h2", {
      type: "lines",
      mask: "lines",
      autoSplit: true,
      onSplit(self) {
        return gsap.from(self.lines, {
          yPercent: 110,
          duration: 1.2,
          ease: "expo.out",
          stagger: 0.1,
          scrollTrigger: { trigger: ".faq h2", start: "top 88%", once: true },
        });
      },
    });
    gsap.from("[data-faq-fade]", { y: 16, autoAlpha: 0, duration: 0.9, ease: "expo.out", stagger: 0.12, scrollTrigger: { trigger: ".faq-side", start: "top 85%", once: true } });
    gsap.from(".faq-item", { y: 28, autoAlpha: 0, duration: 0.9, ease: "expo.out", stagger: 0.07, scrollTrigger: { trigger: ".faq-list", start: "top 85%", once: true } });
  }
}

/* ---------------------------------------------------------------
   11. The ball. One ball sits in the empty space in Services, then flies down and
   across while rotating, and lands in the empty space in Pricing.
---------------------------------------------------------------- */
const orbEl = document.querySelector("[data-orb]");
const slotA = document.querySelector('[data-orb-slot="a"]');
const slotB = document.querySelector('[data-orb-slot="b"]');
const stage = document.querySelector("[data-stage]");
const pricingEl = document.querySelector("#pricing");

if (orbEl && slotA && slotB && stage && pricingEl && createCrystalizedBall) {
  const ball = createCrystalizedBall(orbEl, {
    preset: "plasma",
    color: "#E57A1A", // the shader brightens and yellows this; on screen it lands on the brand amber #EFA831
    size: 0.7,
    crackle: 0.85,
    fill: 0.5,
    interactive: true,
    hoverStrength: 0.7,
    strands: 6,
    flares: 0.4,
    glow: 0.45,
    sparks: 0.4,
    particleCount: smallScreen ? 9000 : 15000, // fewer particles on phones to keep scrolling smooth
    motion: "rise",
    particleShape: "square",
    depth: 0.6,
    sway: 0.5,
    twinkle: 0.5,
    haze: 0.5,
    dustSpeed: 1,
    speed: 1,
    intro: true,
    paused: false,
  });

  if (ball.supported) {
    const phone = window.matchMedia("(max-width: 767px)");
    const stickyLayout = window.matchMedia("(min-width: 960px) and (min-height: 520px)");
    const flightEase = gsap.parseEase("power2.inOut");
    let geo = null;
    let lastSpin = -1;

    // Works out how far the page has to scroll for the flight to start and to finish.
    const measure = () => {
      stage.classList.add("is-measuring"); // briefly un-sticks the pricing column so its resting place can be read
      const y = window.scrollY;
      const vh = window.innerHeight;
      const a = slotA.getBoundingClientRect();
      const b = slotB.getBoundingClientRect();
      const pr = pricingEl.getBoundingClientRect();
      const side = pricingEl.querySelector(".pricing-side");
      const stickTop = parseFloat(getComputedStyle(side).top) || 112;
      const pad = parseFloat(getComputedStyle(pricingEl).paddingTop) || 0;
      const aY = a.top + y + a.height / 2;
      const bY = b.top + y + b.height / 2;
      const pricingTop = pr.top + y;
      stage.classList.remove("is-measuring");

      let start;
      let end;
      if (stickyLayout.matches) {
        // The flight starts as Pricing comes into view and ends the moment its left column locks in place.
        start = pricingTop - vh * 0.95;
        end = pricingTop + pad - stickTop;
      } else {
        // Single column: the ball leaves when Services ends and arrives as its slot reaches mid-screen.
        end = bY - vh * 0.5;
        start = end - 0.7 * (bY - aY);
      }
      sizeDebris();
      geo = { size: orbEl.offsetWidth, start, end: Math.max(end, start + 1) };
      // Second flight: from the Pricing slot to the middle of the screen, arriving as Projects locks in place.
      if (work.st) {
        const s2end = work.st.start;
        geo.s2end = s2end;
        geo.s2start = Math.min(Math.max(geo.end, s2end - vh * 0.9), s2end - 1);
      } else {
        geo.s2start = geo.s2end = 0;
      }
    };

    const clamp01 = (v) => Math.min(1, Math.max(0, v));
    let wasDone = false;
    const POP = 0.35; // the moment of the burst, as a share of the explosion (0.7 of 2 steps on the timeline)
    const BURSTS = [{ at: 0.04, power: 0.9 }, { at: 0.18, power: 1.2 }, { at: 0.3, power: 1.4 }];
    const fired = BURSTS.map(() => false);

    // Sparks thrown out by the burst. Position is worked out from scroll progress alone,
    // so it plays smoothly forwards and backwards while you scroll.
    const dCanvas = document.querySelector("[data-debris]");
    const dctx = dCanvas && dCanvas.getContext("2d");
    let dW = 0;
    let dH = 0;
    let dDpr = 1;
    let debrisOn = false;
    const sizeDebris = () => {
      if (!dctx) return;
      dDpr = Math.min(window.devicePixelRatio || 1, smallScreen ? 1 : 1.5);
      dW = window.innerWidth;
      dH = window.innerHeight;
      dCanvas.width = Math.round(dW * dDpr);
      dCanvas.height = Math.round(dH * dDpr);
    };
    let seed = 7;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const palette = ["#EFA831"]; // every spark is the brand colour
    const sparks = Array.from({ length: smallScreen ? 420 : 900 }, () => {
      const big = rnd() < 0.06;
      return {
        ang: rnd() * Math.PI * 2,
        rr: Math.sqrt(rnd()),
        v: 0.1 + Math.pow(rnd(), 1.6),
        size: big ? 5 + rnd() * 5 : 1.2 + rnd() * 3,
        col: palette[Math.floor(rnd() * palette.length)],
        life: 0.55 + rnd() * 0.45,
        curl: (rnd() - 0.5) * 0.6,
      };
    });
    const drawDebris = (ex) => {
      if (!dctx) return;
      const q = clamp01((ex - POP) / (1 - POP));
      if (q <= 0 || q >= 1) {
        if (debrisOn) {
          dctx.setTransform(1, 0, 0, 1, 0, 0);
          dctx.clearRect(0, 0, dCanvas.width, dCanvas.height);
          debrisOn = false;
        }
        return;
      }
      debrisOn = true;
      dctx.setTransform(dDpr, 0, 0, dDpr, 0, 0);
      dctx.clearRect(0, 0, dW, dH);
      dctx.globalCompositeOperation = "lighter";
      const cx = dW / 2;
      const cy = dH / 2;
      const R = geo.size * 0.37; // the ball's own radius on screen
      const reach = Math.hypot(dW, dH) * 0.62;

      // The flash at the moment of the burst.
      const f = 1 - clamp01(q / 0.2);
      if (f > 0) {
        const fr = R * (1.2 + 4 * (1 - f));
        const g = dctx.createRadialGradient(cx, cy, 0, cx, cy, fr);
        g.addColorStop(0, "rgba(239,168,49," + (0.95 * f).toFixed(3) + ")");
        g.addColorStop(0.4, "rgba(239,168,49," + (0.5 * f).toFixed(3) + ")");
        g.addColorStop(1, "rgba(239,168,49,0)");
        dctx.fillStyle = g;
        dctx.beginPath();
        dctx.arc(cx, cy, fr, 0, Math.PI * 2);
        dctx.fill();
      }

      dctx.lineCap = "butt";
      for (let i = 0; i < sparks.length; i++) {
        const s = sparks[i];
        const qi = q / s.life;
        if (qi >= 1) continue;
        const e = 1 - Math.pow(1 - qi, 3);
        const e0 = 1 - Math.pow(1 - Math.max(0, qi - 0.05), 3);
        const a = s.ang + s.curl * qi;
        const base = s.rr * R * 0.9;
        const d1 = base + s.v * reach * e;
        const d0 = base + s.v * reach * e0;
        const drop = 36 * qi * qi;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        dctx.globalAlpha = Math.pow(1 - qi, 1.3);
        dctx.strokeStyle = s.col;
        dctx.lineWidth = s.size * (1 - 0.5 * qi);
        dctx.beginPath();
        dctx.moveTo(cx + ca * d0, cy + sa * d0 + drop);
        dctx.lineTo(cx + ca * d1 + 0.01, cy + sa * d1 + drop);
        dctx.stroke();
      }
      dctx.globalAlpha = 1;
    };

    const place = () => {
      if (!geo) return;
      const sy = window.scrollY;
      const t1 = reduceMotion ? (sy < geo.start + (geo.end - geo.start) / 2 ? 0 : 1) : flightEase(clamp01((sy - geo.start) / (geo.end - geo.start)));
      const t2 = geo.s2end > geo.s2start ? flightEase(clamp01((sy - geo.s2start) / (geo.s2end - geo.s2start))) : 0;
      const a = slotA.getBoundingClientRect();
      const b = slotB.getBoundingClientRect();
      const ax = a.left + a.width / 2;
      const ay = a.top + a.height / 2;
      // The ball's visible edge lines up with the left edge of the Pricing text, not its middle.
      const bx = phone.matches ? b.left + b.width / 2 : b.left + Math.min(geo.size * 0.4, b.width / 2); // phones: centred
      let cx = ax + (bx - ax) * t1;
      let cy = ay + (b.top + b.height / 2 - ay) * t1;
      cx += (window.innerWidth / 2 - cx) * t2; // second flight: to the middle of the screen
      cy += (window.innerHeight / 2 - cy) * t2;

      // The explosion. First the ball is squeezed and trembles while its rim crackles,
      // then it bursts: it vanishes in a flash and its sparks fly out in every direction.
      const ex = work.ex;
      const charge = clamp01(ex / POP);
      const pop = clamp01((ex - POP) / 0.03);
      let scale = 1 - 0.32 * charge * charge;
      if (pop > 0) scale = 0.68 + 0.55 * pop;
      if (ex > 0.005 && ex < POP) {
        const now = performance.now();
        const amp = 6 * charge * charge;
        cx += (Math.sin(now * 0.071) + Math.sin(now * 0.113)) * 0.5 * amp;
        cy += (Math.cos(now * 0.083) + Math.sin(now * 0.127)) * 0.5 * amp;
      }
      BURSTS.forEach((at, i) => {
        if (ex > at.at && !fired[i]) {
          fired[i] = true;
          ball.burst(at.power);
        } else if (ex < 0.01) {
          fired[i] = false;
        }
      });
      const done = pop >= 1;
      if (done !== wasDone) {
        wasDone = done;
        orbEl.classList.toggle("is-done", done);
        ball.update({ paused: done }); // stops drawing once it has gone
      }
      drawDebris(ex);

      // Dims a little while crossing over text, full strength at the start and the end of each flight.
      const opacity = (1 - 0.55 * Math.sin(Math.PI * t1)) * (1 - 0.4 * Math.sin(Math.PI * t2)) * (1 - pop);
      orbEl.style.opacity = opacity.toFixed(3);
      orbEl.style.transform = "translate3d(" + (cx - geo.size / 2).toFixed(1) + "px," + (cy - geo.size / 2).toFixed(1) + "px,0) scale(" + scale.toFixed(3) + ")";
      const spin = (t1 + t2) * Math.PI * 2;
      if (Math.abs(spin - lastSpin) > 0.0005) {
        lastSpin = spin;
        ball.setSpin(spin);
      }
    };

    // The ball only exists on screen while the two sections do.
    // With reduced motion the projects just stack, so the ball is gone once Pricing has passed.
    ScrollTrigger.create({
      trigger: stage,
      start: "top bottom",
      endTrigger: work.st ? stage : pricingEl,
      end: work.st ? "bottom top" : "bottom 30%",
      onToggle: (self) => orbEl.classList.toggle("is-on", self.isActive),
    });

    ScrollTrigger.addEventListener("refresh", measure);
    window.addEventListener("load", measure);
    stickyLayout.addEventListener("change", measure);
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => ScrollTrigger.refresh());
    measure();
    gsap.ticker.add(place); // runs after Lenis in the same frame, so the ball never lags the scroll
  }
}

/* ---------------------------------------------------------------
   11. Contact form: custom dropdowns, validation, and sending.
   Messages are saved to Supabase when data-supabase-url and data-supabase-key are set (Contact.astro fills them from
   PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY). data-endpoint can post to a form service instead. With neither,
   the message opens in the visitor's email app, addressed to data-email.
---------------------------------------------------------------- */
const cform = document.querySelector("[data-cform]");
if (cform) {
  // --- Dropdowns (listbox pattern: the button holds focus, arrow keys move the highlighted option)
  const dds = Array.from(cform.querySelectorAll("[data-dd]"));
  const closeAll = (except) => dds.forEach((d) => d !== except && d._close && d._close());
  dds.forEach((dd) => {
    const btn = dd.querySelector(".dd-btn");
    const list = dd.querySelector(".dd-list");
    const input = dd.querySelector('input[type="hidden"]');
    const val = dd.querySelector(".dd-val");
    const opts = Array.from(list.children);
    let active = -1;
    let typed = "";
    let typedT = 0;
    val.classList.add("is-empty");

    const setActive = (i) => {
      active = Math.max(0, Math.min(opts.length - 1, i));
      opts.forEach((o, k) => o.classList.toggle("is-active", k === active));
      btn.setAttribute("aria-activedescendant", opts[active].id);
      opts[active].scrollIntoView({ block: "nearest" });
    };
    const open = () => {
      closeAll(dd);
      dd.classList.add("is-open");
      dd.closest(".cform > *").classList.add("has-open");
      btn.setAttribute("aria-expanded", "true");
      const sel = opts.findIndex((o) => o.getAttribute("aria-selected") === "true");
      setActive(sel < 0 ? 0 : sel);
    };
    const close = () => {
      dd.classList.remove("is-open");
      dd.closest(".cform > *").classList.remove("has-open");
      btn.setAttribute("aria-expanded", "false");
      btn.removeAttribute("aria-activedescendant");
    };
    dd._close = close;
    const choose = (i) => {
      opts.forEach((o, k) => o.setAttribute("aria-selected", String(k === i)));
      input.value = opts[i].dataset.value.replace(/&amp;/g, "&");
      val.textContent = opts[i].textContent;
      val.classList.remove("is-empty");
      dd.closest(".field").classList.remove("is-invalid");
      const err = dd.closest(".field").querySelector(".err");
      if (err) err.textContent = "";
      close();
    };

    btn.addEventListener("click", () => (dd.classList.contains("is-open") ? close() : open()));
    opts.forEach((o, i) => {
      o.addEventListener("mousemove", () => active !== i && setActive(i));
      o.addEventListener("mousedown", (e) => e.preventDefault()); // keep focus on the button
      o.addEventListener("click", () => {
        choose(i);
        btn.focus();
      });
    });
    btn.addEventListener("keydown", (e) => {
      const isOpen = dd.classList.contains("is-open");
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!isOpen) return open();
        setActive(active + (e.key === "ArrowDown" ? 1 : -1));
      } else if (e.key === "Home" && isOpen) {
        e.preventDefault();
        setActive(0);
      } else if (e.key === "End" && isOpen) {
        e.preventDefault();
        setActive(opts.length - 1);
      } else if ((e.key === "Enter" || e.key === " ") && isOpen) {
        e.preventDefault();
        choose(active);
      } else if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        close();
      } else if (e.key === "Tab" && isOpen) {
        close();
      } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && e.key !== " ") {
        // type the first letters of an option to jump to it
        typed += e.key.toLowerCase();
        clearTimeout(typedT);
        typedT = setTimeout(() => (typed = ""), 700);
        const hit = opts.findIndex((o) => o.textContent.toLowerCase().startsWith(typed));
        if (hit > -1) {
          if (!isOpen) open();
          setActive(hit);
        }
      }
    });
  });
  document.addEventListener("pointerdown", (e) => {
    if (!e.target.closest("[data-dd]")) closeAll();
  });

  // --- Validation
  const status = cform.querySelector("[data-cstatus]");
  const fieldOf = (el) => el.closest(".field");
  const setError = (field, msg) => {
    field.classList.toggle("is-invalid", !!msg);
    let err = field.querySelector(".err");
    if (!err) {
      err = document.createElement("span");
      err.className = "err";
      field.appendChild(err);
    }
    err.textContent = msg || "";
  };
  const checks = {
    name: (v) => (v.trim() ? "" : "Enter your name."),
    email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? "" : "Enter an email address I can reply to."),
    project: (v) => (v ? "" : "Choose the closest match."),
    timeline: (v) => (v ? "" : "Choose when you would like to start."),
    message: (v) => (v.trim().length >= 10 ? "" : "Add a few words about what you need."),
  };
  const validate = (el) => {
    const fn = checks[el.name];
    if (!fn) return true;
    const msg = fn(el.value);
    setError(fieldOf(el), msg);
    return !msg;
  };
  cform.querySelectorAll("input[name]:not([name=company_site]), textarea").forEach((el) => {
    el.addEventListener("blur", () => el.value && validate(el));
    el.addEventListener("input", () => fieldOf(el).classList.contains("is-invalid") && validate(el));
  });

  const say = (html, bad) => {
    status.classList.toggle("is-error", !!bad);
    status.innerHTML = html;
  };
  const submit = cform.querySelector(".c-send");
  cform.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fields = Array.from(cform.querySelectorAll("input[name]:not([name=company_site]), textarea"));
    const results = fields.map(validate);
    if (results.includes(false)) {
      const first = fields.find((el) => fieldOf(el).classList.contains("is-invalid"));
      say("Please check the highlighted fields.", true);
      (first.type === "hidden" ? fieldOf(first).querySelector(".dd-btn") : first).focus();
      return;
    }
    const data = Object.fromEntries(new FormData(cform).entries());
    if (data.company_site) return; // the hidden trap field: a person leaves it empty
    delete data.company_site;
    const endpoint = cform.dataset.endpoint;
    const sbUrl = (cform.dataset.supabaseUrl || "").replace(/\/$/, "");
    const sbKey = cform.dataset.supabaseKey || "";
    const mail = cform.dataset.email;
    if ((sbUrl && sbKey) || endpoint) {
      submit.disabled = true;
      say("Sending…");
      try {
        let res;
        if (sbUrl && sbKey) {
          // Supabase: one row in the "inquiries" table (see supabase/migrations). The public key can only add rows, never read them.
          const row = {
            name: data.name.trim(),
            email: data.email.trim(),
            business: (data.business || "").trim() || null,
            website: (data.website || "").trim() || null,
            project: data.project,
            budget: data.budget || null,
            timeline: data.timeline,
            message: data.message.trim(),
            source_page: location.pathname,
          };
          res = await fetch(sbUrl + "/rest/v1/inquiries", {
            method: "POST",
            headers: Object.assign({ "Content-Type": "application/json", apikey: sbKey, Prefer: "return=minimal" }, sbKey.indexOf("eyJ") === 0 ? { Authorization: "Bearer " + sbKey } : {}), // newer sb_publishable_ keys go in apikey only
            body: JSON.stringify(row),
          });
        } else {
          res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data) });
        }
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          const err = new Error(String(res.status));
          err.limited = /too many/i.test(detail);
          throw err;
        }
        const first = data.name.trim().split(/\s+/)[0];
        cform.reset();
        cform.querySelectorAll(".dd-val").forEach((v) => {
          v.textContent = v.dataset.ph;
          v.classList.add("is-empty");
        });
        cform.querySelectorAll('[role="option"]').forEach((o) => o.setAttribute("aria-selected", "false"));
        status.classList.remove("is-error");
        status.textContent = "Well, that’s one step closer. I’ve got your message, " + first + ". Thanks for taking the time to send it over.";
        if (window.fbq) window.fbq("track", "Lead");
      } catch (err) {
        if (err && err.limited) {
          say("You have sent a few messages in a short time. They have all reached me, and I will reply to the address you gave.");
        } else {
          say('That did not go through. Try again in a moment, or email <a href="mailto:' + mail + '">' + mail + "</a>.", true);
        }
      }
      submit.disabled = false;
    } else {
      const lines = [
        "Name: " + data.name,
        "Email: " + data.email,
        "Business: " + (data.business || "-"),
        "Website: " + (data.website || "-"),
        "Project: " + data.project,
        "Budget: " + (data.budget || "-"),
        "Start: " + data.timeline,
        "",
        data.message,
      ];
      const href = "mailto:" + mail + "?subject=" + encodeURIComponent("New project enquiry from " + data.name) + "&body=" + encodeURIComponent(lines.join("\n"));
      window.location.href = href;
      say('Your email app should open with the message ready to send. If it does not, write to <a href="mailto:' + mail + '">' + mail + "</a>.");
    }
  });

  if (!reduceMotion) {
    SplitText.create(".contact h2", {
      type: "lines",
      mask: "lines",
      autoSplit: true,
      onSplit(self) {
        return gsap.from(self.lines, { yPercent: 110, duration: 1.2, ease: "expo.out", stagger: 0.1, scrollTrigger: { trigger: ".contact h2", start: "top 88%", once: true } });
      },
    });
    gsap.from("[data-contact-fade]", { y: 18, autoAlpha: 0, duration: 0.9, ease: "expo.out", stagger: 0.12, scrollTrigger: { trigger: ".contact-inner", start: "top 80%", once: true } });
    gsap.from(".cform .row, .cform > .field, .c-actions", { y: 26, autoAlpha: 0, duration: 0.9, ease: "expo.out", stagger: 0.08, scrollTrigger: { trigger: ".cform", start: "top 88%", once: true } });
  }
}

/* ---------------------------------------------------------------
   11b. Footer: the MAD wordmark is cut into horizontal bands. They slide in from alternating sides, the
   gaps between them close, and the bands settle into the solid word as the footer scrolls into view.
   The clock shows Manila time. The year updates itself.
---------------------------------------------------------------- */
document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
const clocks = document.querySelectorAll("[data-clock]");
if (clocks.length) {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit" });
  const tick = () => {
    const now = new Date();
    clocks.forEach((c) => {
      c.textContent = fmt.format(now);
      c.dateTime = now.toISOString();
    });
  };
  tick();
  setInterval(tick, 20000);
}

const mark = document.querySelector("[data-mark]");
if (mark && !reduceMotion) {
  const holder = mark.querySelector(".mark-slices");
  const real = mark.querySelector(".mark-real");
  const BANDS = 7;
  const slices = [];
  for (let i = 0; i < BANDS; i++) {
    const el = document.createElement("span");
    el.className = "mark-slice";
    el.innerHTML = real.innerHTML;
    el.style.setProperty("--t", (i * 100) / BANDS + "%");
    el.style.setProperty("--b", ((BANDS - 1 - i) * 100) / BANDS + "%");
    holder.appendChild(el);
    slices.push(el);
  }
  mark.classList.add("is-sliced");

  // Each band starts pushed out to one side (alternating), by a different amount.
  const throwBy = [-0.55, 0.42, -0.3, 0.62, -0.46, 0.34, -0.6];
  const tl = gsap.timeline({
    defaults: { ease: "power3.inOut" },
    scrollTrigger: {
      trigger: ".foot",
      start: "top 92%",
      end: "top 18%",
      scrub: 0.8,
      onUpdate: (self) => mark.classList.toggle("is-sliced", self.progress < 0.995),
    },
  });
  slices.forEach((el, i) => {
    tl.fromTo(el, { xPercent: throwBy[i] * 100 }, { xPercent: 0, duration: 0.62 }, i * 0.06);
  });
  tl.fromTo(holder, { "--g": "1.6%" }, { "--g": "0%", ease: "power2.in", duration: 0.7 }, 0.3);

  gsap.from(".foot-grid > *, .foot-time", { y: 30, autoAlpha: 0, duration: 1, ease: "expo.out", stagger: 0.1, scrollTrigger: { trigger: ".foot-grid", start: "top 92%", once: true } });
}

/* ---------------------------------------------------------------
   13. Arriving from another page with a #section in the link (for example index.html#pricing from the About page).
   The page is measured first, then glides to the section.
---------------------------------------------------------------- */
if (location.hash.length > 1) {
  window.addEventListener("load", () => {
    const target = document.querySelector(location.hash);
    if (!target) return;
    window.setTimeout(() => {
      ScrollTrigger.refresh();
      if (location.hash === "#work" && workScrollTo) glide(workScrollTo(2.8));
      else if (lenis) lenis.scrollTo(target, { duration: 1.5, easing: (t) => 1 - Math.pow(1 - t, 4) });
      else target.scrollIntoView({ behavior: "auto" });
    }, 350);
  });
}

})();
