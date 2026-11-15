// Every animation on the site except the 3D shuttle itself (see shuttle3d.js),
// done with Motion: Framer Motion's library for plain JavaScript, loaded from
// the CDN as window.Motion.
//
// The <head> of each page adds the class "fx" to <html> unless the visitor
// prefers reduced motion. style.css hides things that animate in only while
// that class is there, so if Motion is missing everything simply shows.
//
// Pages call:
//   revealIn(element)  after adding play cards, to animate and wire them up
//   popIn(dialog)      when the video player opens
//   popOut(dialog)     before it closes (returns a promise)
// signup.js calls window.signupFx (start, done, reset, invalid).

(function () {
  const root = document.documentElement;
  const Motion = window.Motion;
  const header = document.querySelector(".site-header");
  const stage = document.querySelector(".stage");
  const story = document.querySelector(".story");
  const isHome = document.body.classList.contains("home");
  const fxOn = Boolean(Motion) && root.classList.contains("fx");
  const clamp01 = (n) => Math.min(1, Math.max(0, n));

  // ---------- Tied straight to the scroll position (works without Motion too) ----------
  // The header has three looks on the home page: clear over the yellow hero,
  // dark glass over the night court, cream glass everywhere else.
  const HEADER = {
    top: { backgroundColor: "rgba(255, 210, 63, 0)", borderBottomColor: "rgba(29, 27, 46, 0)", color: "rgb(29, 27, 46)" },
    scrolled: { backgroundColor: "rgba(255, 248, 236, 0.78)", borderBottomColor: "rgba(29, 27, 46, 0.08)", color: "rgb(29, 27, 46)" },
    dark: { backgroundColor: "rgba(15, 14, 26, 0.55)", borderBottomColor: "rgba(255, 255, 255, 0.1)", color: "rgb(255, 255, 255)" },
  };
  let headerLook = null;

  function onScroll() {
    let look = window.scrollY > 8 ? "scrolled" : "top";
    if (stage && story) {
      const top = story.getBoundingClientRect().top;
      const lastTop = story.lastElementChild.getBoundingClientRect().top;
      if (top < 40 && stage.getBoundingClientRect().bottom > 40) look = "dark";
      // The night court fades in as the story arrives; the view from above takes over for the last step.
      stage.style.setProperty("--court", clamp01((innerHeight * 0.9 - top) / (innerHeight * 0.4)).toFixed(3));
      stage.style.setProperty("--above", clamp01((innerHeight * 0.85 - lastTop) / (innerHeight * 0.5)).toFixed(3));
    }
    if (look === headerLook) return;
    headerLook = look;
    header.classList.toggle("is-scrolled", look === "scrolled");
    header.classList.toggle("is-dark", look === "dark");
    if (fxOn && isHome) Motion.animate(header, HEADER[look], { duration: 0.35, ease: "easeOut" });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  if (!fxOn) {
    root.classList.remove("fx");
    window.revealIn = () => {};
    window.popIn = () => {};
    window.popOut = () => Promise.resolve();
    onScroll();
    return;
  }

  const { animate, inView, hover, press, scroll, stagger } = Motion;
  onScroll();

  // ---------- Motion presets ----------
  const settle = { type: "spring", bounce: 0.25, duration: 0.8 };   // things arriving
  const snappy = { type: "spring", stiffness: 380, damping: 26 };   // hover and press
  const glide = { type: "spring", stiffness: 220, damping: 24 };    // cards following the mouse
  const quick = { duration: 0.1, ease: "easeOut" };                 // press down
  const smooth = [0.22, 1, 0.36, 1];
  const canHover = matchMedia("(hover: hover) and (pointer: fine)").matches;

  // Card shadows at rest and lifted (same layers in both, so Motion can blend them)
  const CARD_REST = "0px 1px 2px 0px rgba(29, 27, 46, 0.06), 0px 8px 20px -6px rgba(29, 27, 46, 0.12), 0px 0px 0px 1px rgba(29, 27, 46, 0.08)";
  const CARD_UP = "0px 6px 10px 0px rgba(29, 27, 46, 0.08), 0px 34px 60px -14px rgba(29, 27, 46, 0.34), 0px 0px 0px 1px rgba(29, 27, 46, 0.08)";
  const FIELD_REST = "inset 0px 0px 0px 1px rgba(29, 27, 46, 0.08), 0px 14px 34px -12px rgba(29, 27, 46, 0.35)";
  const FIELD_FOCUS = "inset 0px 0px 0px 2px rgba(255, 90, 54, 0.9), 0px 16px 38px -12px rgba(255, 90, 54, 0.5)";

  // ---------- Hover and press ----------
  // Buttons rise a little on hover and sink when pressed.
  function lift(el) {
    hover(el, () => {
      animate(el, { y: -2, scale: 1.04 }, snappy);
      return () => animate(el, { y: 0, scale: 1 }, snappy);
    });
    press(el, () => {
      animate(el, { y: 0, scale: 0.96 }, quick);
      return () => animate(el, { scale: el.matches(":hover") ? 1.04 : 1 }, snappy);
    });
  }

  // Cards tilt in 3D towards the mouse, and a soft highlight follows it across them.
  function tilt(card, degrees) {
    card.style.boxShadow = CARD_REST;
    press(card, () => {
      animate(card, { scale: 0.98 }, quick);
      return () => animate(card, { scale: 1 }, snappy);
    });
    if (!canHover) return;
    const glare = document.createElement("span");
    glare.className = "glare";
    card.append(glare);
    const follow = (event) => {
      const box = card.getBoundingClientRect();
      const px = clamp01((event.clientX - box.left) / box.width);
      const py = clamp01((event.clientY - box.top) / box.height);
      animate(card, { rotateX: (0.5 - py) * degrees * 2, rotateY: (px - 0.5) * degrees * 2 }, glide);
      glare.style.setProperty("--gx", `${px * 100}%`);
      glare.style.setProperty("--gy", `${py * 100}%`);
    };
    hover(card, () => {
      animate(card, { transformPerspective: 900, y: -6, boxShadow: CARD_UP }, glide);
      animate(glare, { opacity: 1 }, { duration: 0.3 });
      card.addEventListener("pointermove", follow);
      return () => {
        card.removeEventListener("pointermove", follow);
        animate(card, { rotateX: 0, rotateY: 0, y: 0, boxShadow: CARD_REST }, glide);
        animate(glare, { opacity: 0 }, { duration: 0.4 });
      };
    });
  }

  function wire(scope) {
    const fresh = (selector) =>
      [...scope.querySelectorAll(selector)].filter((el) => {
        if (el.dataset.fx) return false;
        el.dataset.fx = "1";
        return true;
      });

    fresh(".button, .header-cta").forEach(lift);

    fresh(".play-card").forEach((card) => {
      tilt(card, 7);
      hoverPreview(card);
      const thumb = card.querySelector(".play-thumb");
      const badge = card.querySelector(".play-badge");
      hover(card, () => {
        animate(thumb, { scale: 1.07 }, { duration: 0.7, ease: smooth });
        animate(badge, { scale: 1.15 }, snappy);
        return () => {
          animate(thumb, { scale: 1 }, { duration: 0.6, ease: smooth });
          animate(badge, { scale: 1 }, snappy);
        };
      });
    });

    fresh(".signup button").forEach((el) => {
      hover(el, () => {
        if (el.form.dataset.state) return; // sending or sent: the button belongs to the envelope
        animate(el, { backgroundColor: "#e8431f" }, { duration: 0.2 });
        return () => animate(el, { backgroundColor: "#ff5a36" }, { duration: 0.2 });
      });
      press(el, () => {
        animate(el, { scale: 0.95 }, quick);
        return () => animate(el, { scale: 1 }, snappy);
      });
    });

    // The email box glows tomato while you type in it.
    fresh(".signup").forEach((form) => {
      form.addEventListener("focusin", () => animate(form, { boxShadow: [FIELD_REST, FIELD_FOCUS] }, { duration: 0.25 }));
      form.addEventListener("focusout", () =>
        animate(form, { boxShadow: FIELD_REST }, { duration: 0.25 }).then(() => form.style.removeProperty("box-shadow")));
    });

    fresh(".nav-link:not([aria-current])").forEach((el) => {
      hover(el, () => {
        animate(el, { "--u": 1 }, { duration: 0.3, ease: smooth });
        return () => animate(el, { "--u": 0 }, { duration: 0.25, ease: "easeIn" });
      });
    });

    fresh(".see-all, .watch-link").forEach((el) => {
      hover(el, () => {
        animate(el, { "--nudge": "5px" }, snappy);
        return () => animate(el, { "--nudge": "0px" }, snappy);
      });
    });

    fresh(".logo").forEach((el) => {
      const mark = el.querySelector(".logo-mark");
      hover(el, () => {
        animate(mark, { rotate: -22, scale: 1.1 }, snappy);
        return () => animate(mark, { rotate: 0, scale: 1 }, snappy);
      });
    });

    fresh(".dialog-close").forEach((el) => {
      hover(el, () => {
        animate(el, { rotate: 90, scale: 1.08 }, snappy);
        return () => animate(el, { rotate: 0, scale: 1 }, snappy);
      });
    });
  }

  // ---------- Past plays: a muted preview while you hover (mouse only) ----------
  function hoverPreview(card) {
    if (!canHover || !card.dataset.id) return;
    const media = card.querySelector(".play-media");
    const badge = card.querySelector(".play-badge");
    let timer = null;
    let frame = null;
    hover(card, () => {
      // A short wait, so sweeping the mouse across the grid doesn't load every video.
      timer = setTimeout(() => {
        const src = new URL(`https://www.youtube-nocookie.com/embed/${card.dataset.id}`);
        src.search = new URLSearchParams({
          autoplay: 1, mute: 1, controls: 0, playsinline: 1, rel: 0,
          loop: 1, playlist: card.dataset.id, start: parseInt(card.dataset.start, 10) || 0,
        });
        frame = document.createElement("iframe");
        frame.className = "play-preview";
        frame.src = src;
        frame.title = "";
        frame.tabIndex = -1;
        frame.setAttribute("aria-hidden", "true");
        frame.allow = "autoplay; encrypted-media";
        // Fade in a moment after loading, once YouTube's own black start screen has passed.
        frame.addEventListener("load", () => {
          animate(frame, { opacity: 1 }, { duration: 0.4, delay: 0.7 });
          animate(badge, { opacity: 0 }, { duration: 0.3, delay: 0.7 });
        });
        media.insertBefore(frame, badge);
      }, 450);
      return () => {
        clearTimeout(timer);
        animate(badge, { opacity: 1 }, { duration: 0.2 });
        if (!frame) return;
        const leaving = frame;
        frame = null;
        animate(leaving, { opacity: 0 }, { duration: 0.2 }).then(() => leaving.remove());
      };
    });
  }

  // ---------- Signups (signup.js calls these) ----------
  const confettiColours = ["#ffd23f", "#ff5a36", "#2ec4b6", "#ffffff"];
  const wait = (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));

  function centre(el, block) {
    const r = el.getBoundingClientRect();
    const b = block.getBoundingClientRect();
    return { x: r.left + r.width / 2 - b.left, y: r.top + r.height / 2 - b.top };
  }

  function confetti(block, at, count, reach = 1) {
    for (let i = 0; i < count; i++) {
      const bit = document.createElement("span");
      bit.className = "confetti";
      bit.style.left = `${at.x}px`;
      bit.style.top = `${at.y}px`;
      bit.style.background = confettiColours[i % confettiColours.length];
      if (i % 3 === 0) bit.style.borderRadius = "50%";
      block.append(bit);
      const angle = Math.random() * Math.PI * 2;
      const distance = (40 + Math.random() * 70) * reach;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;
      animate(bit, {
        x: [0, dx, dx * 1.1],
        y: [0, dy - 20, dy + 45],  // up and out, then falling
        rotate: [0, Math.random() * 540 - 270],
        scale: [0.6, 1, 0.8],
        opacity: [1, 1, 0],
      }, { duration: 0.9 + Math.random() * 0.5, ease: "easeOut" }).then(() => bit.remove());
    }
  }

  function swapWordmark(wordmark, which) {
    const old = [...wordmark.querySelectorAll(".wm-letter")];
    return animate(old, { y: "110%" }, { duration: 0.3, ease: [0.5, 0, 0.75, 0.3], delay: stagger(0.03) })
      .then(() => {
        const lines = (which === "done" ? wordmark.dataset.done : wordmark.dataset.lines).split("|");
        const letters = setWordmark(wordmark, lines);
        return animate(letters, { y: ["-110%", "0%"] },
          { type: "spring", bounce: 0.35, duration: 0.6, delay: stagger(0.045) });
      });
  }

  function signupParts(block) {
    const button = block.querySelector(".signup button");
    return {
      button,
      label: button.querySelector(".btn-label"),
      env: button.querySelector(".btn-env"),
      draws: button.querySelectorAll(".btn-draw"),
      flap: button.querySelector(".btn-flap"),
      check: button.querySelector(".btn-check"),
      done: block.querySelector(".signup-done"),
    };
  }

  window.signupFx = {
    invalid(form) {
      animate(form, { x: [0, -9, 9, -6, 6, 0] }, { duration: 0.45 });
    },

    // The button squashes into a circle and an envelope draws itself inside it.
    start(block) {
      const { button, label, env, draws, flap } = signupParts(block);
      const style = getComputedStyle(button);
      button.dataset.rest = JSON.stringify({ width: `${button.offsetWidth}px`, padding: style.paddingLeft });
      button.style.width = `${button.offsetWidth}px`;
      animate(label, { opacity: 0, y: -8 }, { duration: 0.15 });
      animate(button, { width: `${button.offsetHeight}px`, paddingLeft: "0px", paddingRight: "0px" },
        { type: "spring", bounce: 0.4, duration: 0.6 });
      animate(env, { opacity: 1, scaleX: 1, scaleY: 1 }, { duration: 0.01, delay: 0.25 });
      animate(draws, { strokeDashoffset: [1, 0] }, { duration: 0.55, delay: stagger(0.12, { startDelay: 0.3 }) });
      animate(flap, { scaleY: [1, -1] }, { type: "spring", bounce: 0.5, duration: 0.45, delay: 0.8 });
      return wait(1.15);
    },

    // Flap shuts, the envelope flies off on an arc trailing confetti, a check mark draws.
    async done(block) {
      const { button, env, flap, check, done } = signupParts(block);
      await animate(flap, { scaleY: 1 }, { duration: 0.2, ease: "easeIn" });
      await animate(env, { scaleX: 0.6, scaleY: 0.8 }, { duration: 0.16 });
      env.style.opacity = 0;

      const from = centre(button, block);
      const fly = document.createElement("span");
      fly.className = "signup-fly";
      fly.innerHTML = '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2.2"/>'
        + '<polyline points="3.4,6.6 12,13 20.6,6.6" fill="none"/></svg>'; // fixed markup, no data
      fly.style.left = `${from.x}px`;
      fly.style.top = `${from.y}px`;
      block.append(fly);
      confetti(block, from, 10, 0.6);
      setTimeout(() => confetti(block, centre(fly, block), 6, 0.5), 450);
      await animate(fly, {
        x: [0, -60, 50, 170],
        y: [0, -90, -200, -250],
        rotate: [-20, -40, 10, 40],
        scale: [1, 1.1, 0.8, 0.45],
      }, { duration: 1, ease: "easeInOut" });
      confetti(block, centre(fly, block), 18);
      fly.remove();

      animate(button, { backgroundColor: "#2ec4b6", scale: [1, 1.14, 1] }, { duration: 0.35 });
      animate(check, { opacity: 1 }, { duration: 0.01 });
      animate(check.querySelector("path"), { strokeDashoffset: [1, 0] }, { duration: 0.45, ease: "easeOut" });
      done.hidden = false;
      animate(done, { opacity: [0, 1], y: [14, 0] }, settle);
      if (block.dataset.style === "wordmark") {
        swapWordmark(block.closest(".wordmark-cta").querySelector(".wordmark"), "done");
      }
    },

    // "Wrong address?": everything back to how it started.
    reset(block) {
      const { button, label, draws, flap, check } = signupParts(block);
      const rest = JSON.parse(button.dataset.rest || "{}");
      animate(check, { opacity: 0 }, { duration: 0.15 });
      animate(draws, { strokeDashoffset: 1 }, { duration: 0 });
      animate(flap, { scaleY: 1 }, { duration: 0 });
      animate(button, {
        width: rest.width, paddingLeft: rest.padding, paddingRight: rest.padding, backgroundColor: "#ff5a36",
      }, { type: "spring", bounce: 0.3, duration: 0.5 }).then(() => {
        ["width", "padding-left", "padding-right", "background-color"].forEach((p) => button.style.removeProperty(p));
      });
      animate(label, { opacity: 1, y: 0 }, { duration: 0.25, delay: 0.3 });
      if (block.dataset.style === "wordmark") {
        swapWordmark(block.closest(".wordmark-cta").querySelector(".wordmark"), "brand");
      }
    },
  };

  // ---------- Scroll-triggered reveals ----------
  // Fires once, when a fifth of the element is on screen.
  function once(el, run) {
    const stop = inView(el, () => {
      run();
      stop();
    }, { amount: 0.2 });
  }

  function reveal(scope) {
    scope.querySelectorAll("[data-reveal]:not([data-revealed])").forEach((el) => {
      el.dataset.revealed = "1";
      once(el, () => animate(el, { opacity: [0, 1], y: [32, 0] }, settle));
    });
    // Groups (card grids) come in one after another.
    const groups = [...scope.querySelectorAll("[data-reveal-group]")];
    if (scope.matches && scope.matches("[data-reveal-group]")) groups.push(scope);
    groups.forEach((group) => {
      const items = [...group.children].filter((child) => !child.dataset.revealed);
      if (items.length === 0) return;
      items.forEach((child) => (child.dataset.revealed = "1"));
      once(group, () =>
        animate(items, { opacity: [0, 1], y: [44, 0], scale: [0.94, 1] }, { ...settle, delay: stagger(0.1) }));
    });
  }

  window.revealIn = (scope) => {
    reveal(scope);
    wire(scope);
  };

  // ---------- Video player ----------
  window.popIn = (dialog) => {
    wire(dialog);
    animate(dialog, { opacity: [0, 1], scale: [0.9, 1], y: [30, 0] },
      { type: "spring", bounce: 0.3, duration: 0.55 });
  };
  window.popOut = (dialog) =>
    animate(dialog, { opacity: 0, scale: 0.94, y: 16 }, { duration: 0.16, ease: "easeIn" })
      .then(() => animate(dialog, { opacity: 1, scale: 1, y: 0 }, { duration: 0 }));

  // ---------- Hero (home page) ----------
  const hero = document.querySelector(".hero");
  if (hero) {
    animate(hero.querySelector(".hero-badge"), { opacity: [0, 1], y: [12, 0] }, settle);
    animate(hero.querySelectorAll("h1 .line > span"), { y: ["110%", "0%"] },
      { type: "spring", bounce: 0.2, duration: 1, delay: stagger(0.12, { startDelay: 0.1 }) });
    animate([hero.querySelector(".lede"), hero.querySelector(".signup"), hero.querySelector(".fine-print")],
      { opacity: [0, 1], y: [22, 0] }, { ...settle, delay: stagger(0.08, { startDelay: 0.4 }) });
    animate([hero.querySelector(".grip-hint"), hero.querySelector(".scroll-cue")],
      { opacity: [0, 0.75] }, { duration: 0.8, delay: 1.8 });

    // The pulsing "live" dot, and the line that keeps pointing down
    animate(hero.querySelector(".hero-badge-dot"),
      { boxShadow: ["rgba(255, 90, 54, 0.7) 0px 0px 0px 0px", "rgba(255, 90, 54, 0) 0px 0px 0px 9px"] },
      { duration: 1.6, repeat: Infinity, repeatDelay: 0.6, ease: "easeOut" });
    animate(hero.querySelector(".scroll-cue span"), { scaleY: [0, 1, 1], opacity: [1, 1, 0] },
      { duration: 1.8, repeat: Infinity, ease: "easeInOut" });

    // The hero's words drift up and fade as the night court takes over.
    scroll(animate(hero.querySelector(".hero-text"), { opacity: [1, 0], y: [0, -60] }, { ease: "linear" }),
      { target: hero, offset: ["8% start", "48% start"] });
    scroll(animate(hero.querySelectorAll(".hero-grip, .scroll-cue"), { opacity: [1, 0] }, { ease: "linear" }),
      { target: hero, offset: ["2% start", "14% start"] });
  }

  // ---------- Scroll story ----------
  if (story) {
    // Each glass card rises in, holds, then drifts away (the last one stays).
    const cards = [...story.querySelectorAll(".story-card")];
    cards.forEach((card, i) => {
      const last = i === cards.length - 1;
      scroll(animate(card, {
        opacity: last ? [0, 1, 1, 1] : [0, 1, 1, 0],
        y: last ? [80, 0, 0, 0] : [80, 0, 0, -80],
        scale: last ? [0.92, 1, 1, 1] : [0.92, 1, 1, 0.96],
      }, { ease: "linear" }), { target: card, offset: ["start end", "end start"] });
    });

    // The court slowly pushes in, and the light in the air drifts.
    scroll(animate(stage.querySelectorAll(".court-img"), { scale: [1.2, 1] }, { ease: "linear" }),
      { target: story, offset: ["start end", "end end"] });
    animate(stage.querySelector(".court-haze"), { x: ["-4%", "4%"], y: ["-2%", "3%"] },
      { duration: 16, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" });
    dust(stage.querySelector(".court-dust"), story);
  }

  // Dust floating through the spotlights: small bright specks on a canvas.
  function dust(canvas, watch) {
    const g = canvas.getContext("2d");
    const motes = Array.from({ length: 80 }, () => ({
      x: Math.random(),
      y: Math.random() * 0.8,
      size: 0.5 + Math.random() * 1.7,
      vx: (Math.random() - 0.5) * 0.008,
      vy: -(0.002 + Math.random() * 0.007),
      phase: Math.random() * Math.PI * 2,
    }));
    let running = false;
    let previous = 0;

    function draw(now) {
      if (!running) return;
      const dt = Math.min(0.05, (now - previous) / 1000);
      previous = now;
      const ratio = Math.min(devicePixelRatio, 2);
      const w = canvas.clientWidth * ratio;
      const h = canvas.clientHeight * ratio;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      g.clearRect(0, 0, w, h);
      for (const mote of motes) {
        mote.x = (mote.x + mote.vx * dt + 1) % 1;
        mote.y += mote.vy * dt;
        if (mote.y < -0.02) mote.y = 0.8;
        const twinkle = 0.35 + 0.35 * Math.sin(now / 900 + mote.phase);
        g.globalAlpha = twinkle * (1 - mote.y); // brightest near the lamps
        g.fillStyle = "#fff1d0";
        g.beginPath();
        g.arc(mote.x * w, mote.y * h, mote.size * ratio, 0, Math.PI * 2);
        g.fill();
      }
      requestAnimationFrame(draw);
    }

    inView(watch, () => {
      running = true;
      previous = performance.now();
      requestAnimationFrame(draw);
      return () => (running = false);
    });
  }

  // ---------- Today's play: the card tips up towards you as it scrolls in ----------
  const scene = document.querySelector(".clip-scene");
  if (scene) {
    scroll(animate(scene.querySelector(".clip-card"), { rotateX: [26, 0], scale: [0.86, 1], y: [50, 0], opacity: [0.3, 1] },
      { ease: "easeOut" }), { target: scene, offset: ["start end", "start 35%"] });
  }

  // ---------- Photo band: the picture slides slower than the page, the words light up ----------
  const band = document.querySelector(".photo-band");
  if (band) {
    scroll(animate(band.querySelector(".photo-band-img"), { y: ["-7%", "7%"] }, { ease: "linear" }),
      { target: band, offset: ["start end", "end start"] });
    const line = band.querySelector(".word-reveal");
    const words = line.textContent.trim().split(/\s+/).map((text) => {
      const word = document.createElement("span");
      word.className = "word";
      word.textContent = text;
      return word;
    });
    line.replaceChildren(...words.flatMap((word, i) => (i ? [" ", word] : [word])));
    scroll(animate(words, { opacity: [0.18, 1] }, { duration: 0.3, delay: stagger(0.2), ease: "linear" }),
      { target: band, offset: ["start 80%", "center 45%"] });
  }

  // ---------- Stats: each number counts up from zero when it scrolls into view ----------
  document.querySelectorAll("[data-count]").forEach((el) => {
    const total = Number(el.dataset.count);
    if (total === 0) return;
    el.textContent = "0";
    once(el, () => animate(0, total, {
      duration: 1.4,
      ease: smooth,
      onUpdate: (value) => (el.textContent = Math.round(value)),
    }));
  });

  // ---------- Play-type ticker ----------
  const track = document.querySelector(".ticker-track");
  if (track) {
    const run = animate(track, { x: ["0%", "-50%"] }, { duration: 36, ease: "linear", repeat: Infinity });
    hover(track, () => {
      run.speed = 0.25;  // slows down so you can read it
      return () => (run.speed = 1);
    });
  }

  // ---------- Wordmark: the letters drop in when the band scrolls into view ----------
  document.querySelectorAll(".wordmark").forEach((wordmark) => {
    once(wordmark, () => animate(wordmark.querySelectorAll(".wm-letter"), { y: ["110%", "0%"] },
      { type: "spring", bounce: 0.35, duration: 0.7, delay: stagger(0.05) }));
  });

  window.revealIn(document);
})();
