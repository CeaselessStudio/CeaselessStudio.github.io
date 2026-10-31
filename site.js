/* Сцена сайта: появление блоков, прогресс, прожектор, наклон карточек, пыль, занавес.
   Без библиотек. Всё движение отключается при prefers-reduced-motion. */
(() => {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;

  /* 1. блоки появляются при прокрутке (виньетка гаснет вместе с ними) */
  const reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduced) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("in"));
  }

  /* 2. полоса прочитанного под меню и медальон: параллакс по скроллу + наклон за курсором */
  const progress = document.querySelector(".progress");
  const medallion = document.querySelector(".medallion");
  let lookX = 0;
  let lookY = 0;
  let queued = false;

  function frame() {
    queued = false;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) {
      progress.style.width = (max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0) + "%";
    }
    if (medallion && !reduced) {
      const shift = Math.min(window.scrollY * 0.08, 48);
      medallion.style.transform =
        "perspective(900px) translate3d(0, " + shift.toFixed(1) + "px, 0) " +
        "rotateX(" + (lookY * -1).toFixed(2) + "deg) rotateY(" + lookX.toFixed(2) + "deg)";
    }
  }

  function onScroll() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(frame);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  if (medallion && finePointer && !reduced) {
    window.addEventListener("pointermove", (e) => {
      lookX = (e.clientX / window.innerWidth - 0.5) * 6;
      lookY = (e.clientY / window.innerHeight - 0.5) * 4;
      onScroll();
    }, { passive: true });
  }
  frame();

  /* 3. свет за курсором */
  const torch = document.querySelector(".torch");
  if (torch && finePointer && !reduced) {
    window.addEventListener("pointermove", (e) => {
      document.documentElement.style.setProperty("--mx", e.clientX + "px");
      document.documentElement.style.setProperty("--my", e.clientY + "px");
      torch.classList.add("on");
    }, { passive: true });
    document.addEventListener("pointerleave", () => torch.classList.remove("on"));
  }

  /* 4. наклон карточек под курсором */
  if (finePointer && !reduced) {
    document.querySelectorAll(".card").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        const rx = ((e.clientY - r.top) / r.height - 0.5) * -6;
        const ry = ((e.clientX - r.left) / r.width - 0.5) * 6;
        card.style.transform = "perspective(760px) rotateX(" + rx.toFixed(2) + "deg) rotateY(" +
          ry.toFixed(2) + "deg) translateY(-3px)";
      });
      card.addEventListener("pointerleave", () => { card.style.transform = ""; });
    });
  }

  /* 5. пыль в луче прожектора */
  const canvas = document.querySelector(".dust");
  if (canvas && !reduced) {
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let width = 0;
    let height = 0;
    let raf = 0;
    let last = 0;
    let parts = [];

    const spawn = (y) => ({
      x: Math.random() * width,
      y: typeof y === "number" ? y : Math.random() * height,
      r: 0.7 + Math.random() * 1.8,
      vy: 5 + Math.random() * 13,
      sway: 4 + Math.random() * 14,
      phase: Math.random() * Math.PI * 2,
      a: 0.1 + Math.random() * 0.26,
      warm: Math.random() > 0.78
    });

    function tick(now) {
      if (document.hidden) {
        raf = 0;
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      ctx.clearRect(0, 0, width, height);
      for (const p of parts) {
        p.y -= p.vy * dt;
        p.x += Math.sin(now / 1400 + p.phase) * p.sway * dt;
        if (p.y < -12) { p.y = height + 12; p.x = Math.random() * width; }
        if (p.x < -12) p.x = width + 12;
        if (p.x > width + 12) p.x = -12;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.warm
          ? "rgba(192, 64, 47, " + p.a + ")"
          : "rgba(237, 232, 224, " + p.a + ")";
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    }

    function size() {
      width = window.innerWidth;
      height = window.innerHeight;
      if (width <= 720) {
        canvas.style.display = "none";
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        return;
      }
      canvas.style.display = "";
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      parts = Array.from({ length: width < 1100 ? 40 : 70 }, () => spawn());
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    }

    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(size, 180);
    }, { passive: true });

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && !raf && canvas.style.display !== "none") {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    });

    size();
  }

  /* 6. занавес на входе: только первый заход за сессию */
  const curtain = document.querySelector(".curtain");
  if (curtain) {
    let seen = false;
    try { seen = sessionStorage.getItem("cs-curtain") === "1"; } catch (e) { seen = true; }

    if (reduced || seen) {
      curtain.classList.add("done");
    } else {
      try { sessionStorage.setItem("cs-curtain", "1"); } catch (e) { /* приватный режим */ }
      const panels = curtain.querySelectorAll("i");
      const lastPanel = panels[panels.length - 1];
      if (lastPanel) {
        lastPanel.addEventListener("animationend", () => curtain.classList.add("done"), { once: true });
      }
      setTimeout(() => curtain.classList.add("done"), 2400);
    }
  }
  /* 7. контакты: копировать ник по клику */
  document.querySelectorAll("[data-copy]").forEach((el) => {
    const value = el.getAttribute("data-copy");
    const label = el.querySelector(".social-v");
    const flash = () => {
      if (!label) return;
      const old = label.textContent;
      label.textContent = "copied";
      setTimeout(() => { label.textContent = old; }, 1500);
    };
    el.addEventListener("click", () => {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(value).then(flash).catch(() => fallbackCopy(value, flash));
      } else {
        fallbackCopy(value, flash);
      }
    });
  });

  function fallbackCopy(value, done) {
    const field = document.createElement("textarea");
    field.value = value;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.top = "-1000px";
    document.body.appendChild(field);
    field.select();
    try {
      if (document.execCommand("copy")) done();
    } catch (e) { /* браузер не дал скопировать */ }
    document.body.removeChild(field);
  }
})();
