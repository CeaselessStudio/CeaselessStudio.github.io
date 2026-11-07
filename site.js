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

  /* 8. переключатель языка на странице новеллы: EN по умолчанию, выбор помнится */
  const langSwitch = document.querySelector(".lang-switch");
  if (langSwitch) {
    const buttons = langSwitch.querySelectorAll("button[data-lang]");
    const nodes = document.querySelectorAll("[data-ru]");
    nodes.forEach((el) => { el.dataset.en = el.innerHTML; });

    const applyLang = (lang) => {
      const ru = lang === "ru";
      document.documentElement.lang = ru ? "ru" : "en";
      nodes.forEach((el) => {
        el.innerHTML = ru ? el.dataset.ru : el.dataset.en;
      });
      buttons.forEach((b) => {
        const on = b.dataset.lang === (ru ? "ru" : "en");
        b.classList.toggle("on", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      try { localStorage.setItem("dbd-lang", ru ? "ru" : "en"); } catch (e) { /* приватный режим */ }
    };

    let saved = "en";
    try { saved = localStorage.getItem("dbd-lang") || "en"; } catch (e) { /* приватный режим */ }
    const fromUrl = new URLSearchParams(window.location.search).get("lang");
    if (fromUrl === "ru" || fromUrl === "en") saved = fromUrl;

    applyLang(saved);
    buttons.forEach((b) => b.addEventListener("click", () => applyLang(b.dataset.lang)));
  }

  /* 9. гейт спойлеров в After hours: кадры скрыты, пока не нажмут кнопку */
  const gate = document.querySelector(".dbd-gate");
  if (gate) {
    const btn = gate.querySelector(".dbd-gate-btn");
    const panel = gate.querySelector(".dbd-gallery");
    btn.addEventListener("click", () => {
      const open = gate.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      panel.hidden = !open;
    });
  }

  /* 10. след из игральных карт за курсором (только мышь, без reduced-motion) */
  if (finePointer && !reduced) {
    const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
    const SUITS = ["\u2660", "\u2665", "\u2666", "\u2663"]; // пики, черви, бубны, трефы
    const RED = ["\u2665", "\u2666"];
    const MAX = 14;
    const STEP = 34; // столько пикселей пути между картами
    const PAUSE = 70; // не чаще одной карты в 70 мс
    const LIFE = 2600; // страховка: карта уходит не позже этого срока
    const live = [];
    let layer = null;
    let travel = 0;
    let lastX = null;
    let lastY = null;
    let lastT = 0;

    const rand = (min, max) => min + Math.random() * (max - min);

    // слой могли случайно снести - поднимаем заново, след не должен умирать навсегда
    function ensureLayer() {
      if (!layer || !layer.isConnected) {
        layer = document.createElement("div");
        layer.className = "trace-layer";
        layer.setAttribute("aria-hidden", "true");
        document.body.appendChild(layer);
      }
      return layer;
    }

    function retire(card) {
      const i = live.indexOf(card);
      if (i >= 0) live.splice(i, 1);
      if (card.isConnected) card.remove();
    }

    function drop(x, y) {
      const host = ensureLayer();
      if (live.length >= MAX) retire(live[0]);
      if (live.length >= MAX) retire(live[0]);

      const suit = SUITS[(Math.random() * SUITS.length) | 0];
      const card = document.createElement("span");
      card.className = "trace-card" + (RED.indexOf(suit) >= 0 ? " red" : "");
      card.style.setProperty("--rank", JSON.stringify(RANKS[(Math.random() * RANKS.length) | 0]));
      card.style.setProperty("--suit", JSON.stringify(suit));
      card.style.setProperty("--x0", (x + rand(-8, 8)).toFixed(1));
      card.style.setProperty("--y0", (y + rand(-8, 8)).toFixed(1));
      card.style.setProperty("--r0", rand(-26, 26).toFixed(1) + "deg");
      card.style.setProperty("--spin", rand(-35, 35).toFixed(1) + "deg");
      card.style.setProperty("--dx", rand(-16, 16).toFixed(1));
      card.style.setProperty("--dy", rand(14, 40).toFixed(1));
      card.style.setProperty("--scale", rand(.82, 1.12).toFixed(2));
      card.style.animationDuration = rand(.9, 1.4).toFixed(2) + "s";
      host.appendChild(card);
      live.push(card);
      card.addEventListener("animationend", () => retire(card), { once: true });
      setTimeout(() => retire(card), LIFE);
    }

    window.addEventListener("pointermove", (e) => {
      if (e.pointerType && e.pointerType !== "mouse") return;
      const now = performance.now();
      if (lastX === null) {
        lastX = e.clientX;
        lastY = e.clientY;
        lastT = now;
        return;
      }
      const d = Math.hypot(e.clientX - lastX, e.clientY - lastY);
      lastX = e.clientX;
      lastY = e.clientY;
      if (d > 120) { // телепорт курсора: линию не тянем
        travel = 0;
        return;
      }
      travel += d;
      if (travel < STEP || now - lastT < PAUSE) return;
      travel = 0;
      lastT = now;
      drop(e.clientX, e.clientY);
    }, { passive: true });

    // клик тоже оставляет карту - так след виден и при медленном движении
    window.addEventListener("pointerdown", (e) => {
      if (e.pointerType && e.pointerType !== "mouse") return;
      drop(e.clientX, e.clientY);
    }, { passive: true });
  }

  /* 10.5 пул обрывков: тексты перемешиваются, два ложатся в секцию, остальные разлетаются по полям */
  const NOTE_POOL = [
    { kicker: "found backstage", lines: [
      "Я дорожаю как хаты или как в маке соус, а.",
      "Я дорожая как тачки, и как в принципе всё у нас.",
      "И только ты всё также <span class=\"note-drag\">эээ</span>, короче, <b class=\"note-hot\">ты лох</b>, ебать",
    ] },
    { kicker: "page two, same night", lines: [
      { text: "Малышка, не пойти бы тебе нахуй?", cls: "note-yell" },
      "По твоим глазам и так понятно то, что тебе надо.",
      "Я знаю то, что я неадекватный.",
      "Я был в аду, вернулся и <b class=\"note-hot\">ушёл туда обратно</b>.",
    ] },
    { kicker: "torn from the call sheet", lines: [
      "Свет - по счёту.",
      "Кровь - по вкусу.",
      "Аплодисменты - по настроению.",
    ] },
    { kicker: "written on the mirror", lines: [
      "Если тебе не смешно,",
      "ты сидишь не в том ряду.",
    ] },
    { kicker: "found in the ticket booth", lines: [
      "Мне не нужна твоя жалость.",
      "Мне нужен твой <b class=\"note-hot\">билет</b>.",
    ] },
    { kicker: "left on the prop table", lines: [
      "Не трогай кулисы.",
      "<span class=\"note-drag\">Они</span> трогают в ответ.",
    ] },
    { kicker: "half-burned", lines: [
      "Здесь улыбаются за деньги.",
      "Остальное - <b class=\"note-hot\">бонус</b>.",
    ] },
    { kicker: "stage manager's copy", lines: [
      "Ты думал, это шутка?",
      "Шутка - <b class=\"note-hot\">ты</b>.",
    ] },
    { kicker: "costume note", lines: [
      "Кровь на костюме - часть реквизита.",
      "Пятна не отстирываются. Я пробовал.",
    ] },
    { kicker: "after the lights", lines: [
      "Если стало тихо,",
      "значит кто-то на сцене устал.",
    ] },
    { kicker: "no entry", lines: [
      "Некоторые гости остаются после шоу.",
      "Навсегда.",
    ] },
    { kicker: "found backstage", lines: [
      "Оставь телефон. Возьми маску.",
      "И не оборачивайся.",
    ] },
    { kicker: "page three", lines: [
      "Аплодисменты - единственная валюта,",
      "которую я не беру.",
    ] },
    { kicker: "torn in half", lines: [
      "Малышка, сцена не резиновая.",
      "И ты, к сожалению, тоже.",
    ] },
    { kicker: "written in the dark", lines: [
      "Ты пришёл за шоу.",
      "Шоу пришло за тобой.",
    ] },
    { kicker: "left on the mirror", lines: [
      "Сними маску.",
      "Нет, не эту.",
    ] },
    { kicker: "unsigned", lines: [
      "Я не злой.",
      "Я просто честный за твои деньги.",
    ] },
    { kicker: "box office", lines: [
      "Ты аплодируешь.",
      "Я считаю.",
    ] },
    { kicker: "second thought", lines: [
      "Тут добрые только к тем, кто платит.",
      "Ты, кажется, ошибся дверью.",
    ] },
    { kicker: "no refunds", lines: [
      "Останься после шоу.",
      "Обещаю, это будет недолго.",
    ] },
    { kicker: "torn ticket", lines: [
      "Мне не жаль тебя.",
      "Мне жаль потраченного света.",
    ] },
    { kicker: "the price", lines: [
      "Смейся.",
      "Это бесплатно. Пока.",
    ] },
    { kicker: "from the ring", lines: [
      "Кто-то должен быть клоуном.",
      "Ты так хорошо подходишь.",
    ] },
    { kicker: "after hours", lines: [
      "Я не помню твоего имени.",
      "И не буду.",
    ] },
    { kicker: "ink", lines: [
      "Твои деньги пахнут лучше,",
      "чем твои комплименты.",
    ] },
    { kicker: "curtain call", lines: [
      "Не надо меня спасать.",
      "Просто купи билет.",
    ] },
  ];

  const shuffle = (list) => {
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };

  const fillNote = (note, data) => {
    const kicker = note.querySelector(".note-kicker");
    if (kicker) kicker.textContent = data.kicker;
    const sign = note.querySelector(".note-sign");
    note.querySelectorAll(".note-line").forEach((line) => line.remove());
    data.lines.forEach((line) => {
      const text = typeof line === "string" ? line : line.text;
      const cls = typeof line === "string" ? "" : (line.cls || "");
      const p = document.createElement("p");
      p.className = cls ? "note-line " + cls : "note-line";
      p.innerHTML = text;
      note.insertBefore(p, sign);
    });
  };

  const pool = shuffle(NOTE_POOL.slice());
  const railPicked = [];
  let usedCount = 0;

  document.querySelectorAll(".notes-rail .note").forEach((note) => {
    if (usedCount >= pool.length) return;
    fillNote(note, pool[usedCount]);
    railPicked.push(pool[usedCount]);
    usedCount += 1;
  });

  /* облако: двенадцать листов, разбросанных по полям страницы */
  const pageMain = document.querySelector("main");
  const floats = [];
  let relayout = () => {};
  if (pageMain) {
    const cloud = document.createElement("div");
    cloud.className = "notes-cloud";
    cloud.setAttribute("aria-hidden", "true");
    document.documentElement.classList.add("notes-visible");
    pageMain.appendChild(cloud);
    for (let i = 0; i < 12 && usedCount < pool.length; i += 1) {
      const float = document.createElement("div");
      float.className = "note-float";
      const side = i % 2 === 0 ? "left" : "right";
      if (side === "left") float.style.left = "1.8vw";
      else float.style.right = "1.8vw";
      const shell = document.createElement("div");
      shell.className = "note-shell";
      shell.style.transform = "rotate(" + (Math.random() * 5 - 2.5).toFixed(2) + "deg)";
      const tape = document.createElement("span");
      tape.className = "note-tape";
      tape.setAttribute("aria-hidden", "true");
      const note = document.createElement("div");
      note.className = "note";
      note.setAttribute("role", "note");
      if (i % 3 === 0) {
        const scratch = document.createElement("span");
        scratch.className = "note-scratch";
        scratch.setAttribute("aria-hidden", "true");
        note.appendChild(scratch);
      }
      const kicker = document.createElement("span");
      kicker.className = "note-kicker";
      note.appendChild(kicker);
      const sign = document.createElement("p");
      sign.className = "note-sign";
      sign.textContent = "Cease Neverly";
      note.appendChild(sign);
      fillNote(note, pool[usedCount]);
      shell.appendChild(tape);
      shell.appendChild(note);
      float.appendChild(shell);
      cloud.appendChild(float);
      floats.push({ note, float, side, index: usedCount });
      usedCount += 1;
    }

    /* раскладываем листы по высоте так, чтобы на одной стороне они не наезжали друг на друга */
    const railShells = Array.from(document.querySelectorAll(".notes-rail .note-shell"));
    const layoutFloats = () => {
      const total = pageMain.offsetHeight;
      const mainTop = pageMain.getBoundingClientRect().top;
      const blocked = { left: [], right: [] };
      railShells.forEach((shell) => {
        const r = shell.getBoundingClientRect();
        if (!r.height) return;
        const sideName = r.left + r.width / 2 < innerWidth / 2 ? "left" : "right";
        blocked[sideName].push({ top: r.top - mainTop - 20, bottom: r.bottom - mainTop + 20 });
      });
      ["left", "right"].forEach((sideName) => {
        const sideFloats = floats.filter((f) => f.side === sideName);
        if (!sideFloats.length) return;
        const gap = 54;
        const margin = 48;
        const heights = sideFloats.map((f) => f.float.offsetHeight);
        const used = heights.reduce((sum, h) => sum + h, 0) + gap * (sideFloats.length - 1);
        const slack = Math.max(0, (total - margin * 2 - used) / sideFloats.length);
        let y = margin;
        sideFloats.forEach((f, idx) => {
          let top = y;
          blocked[sideName].forEach((zone) => {
            if (top < zone.bottom && top + heights[idx] > zone.top) top = zone.bottom;
          });
          f.float.style.top = Math.round(top) + "px";
          y = top + heights[idx] + gap + slack;
        });
      });
    };
    let layoutRaf = 0;
    relayout = () => {
      if (layoutRaf) return;
      layoutRaf = requestAnimationFrame(() => {
        layoutRaf = 0;
        layoutFloats();
      });
    };
    cloud.style.visibility = "hidden";
    requestAnimationFrame(() => {
      layoutFloats();
      cloud.style.visibility = "";
    });
    window.addEventListener("resize", relayout);
    if ("ResizeObserver" in window) new ResizeObserver(relayout).observe(pageMain);
  }

  /* на широких экранах один обрывок раз в несколько секунд меняет текст */
  if (floats.length && !reduced) {
    setInterval(() => {
      const slot = floats[Math.floor(Math.random() * floats.length)];
      const roll = Math.floor(Math.random() * NOTE_POOL.length);
      const next = NOTE_POOL[roll];
      const usedNow = new Set(railPicked.concat(floats.map((f) => pool[f.index])));
      if (usedNow.has(next) || next === pool[slot.index]) return;
      slot.note.classList.add("is-fading");
      setTimeout(() => {
        fillNote(slot.note, next);
        pool[slot.index] = next;
        slot.note.classList.remove("is-fading");
        relayout();
      }, 380);
    }, 9000);
  }

  /* 11. обрывки записок на главной: строки и подпись проявляются одна за другой */
  document.querySelectorAll(".note").forEach((note) => {
    const noteLines = note.querySelectorAll(".note-line");
    const noteSign = note.querySelector(".note-sign");
    const revealSign = () => {
      if (noteSign) setTimeout(() => noteSign.classList.add("on"), 260 + noteLines.length * 380);
    };
    if ("IntersectionObserver" in window && !reduced) {
      const noteIO = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          noteIO.unobserve(e.target);
          noteLines.forEach((line, i) => {
            setTimeout(() => line.classList.add("on"), 260 + i * 380);
          });
          revealSign();
        });
      }, { threshold: .3 });
      noteIO.observe(note);
    } else {
      noteLines.forEach((line) => line.classList.add("on"));
      if (noteSign) noteSign.classList.add("on");
    }
  });
  /* 12. ночной режим: после 22:00 включается сам, но кнопка важнее расписания */
  const nightBtn = document.querySelector(".night-toggle");
  const NIGHT_KEY = "cs-night-mode";
  const isNightNow = () => {
    const h = new Date().getHours();
    return h >= 22 || h < 6;
  };
  const readNightChoice = () => {
    try { return localStorage.getItem(NIGHT_KEY); } catch (e) { return null; }
  };
  const paintNight = (on) => {
    document.documentElement.classList.toggle("night", on);
    if (!nightBtn) return;
    nightBtn.setAttribute("aria-pressed", String(on));
    nightBtn.textContent = on ? "☀" : "☾";
    nightBtn.setAttribute("aria-label", on ? "Day mode" : "Night mode");
    nightBtn.title = on ? "Day mode" : "Night mode";
  };
  const savedNight = readNightChoice();
  paintNight(savedNight ? savedNight === "on" : isNightNow());
  if (nightBtn) {
    nightBtn.addEventListener("click", () => {
      const on = !document.documentElement.classList.contains("night");
      paintNight(on);
      try { localStorage.setItem(NIGHT_KEY, on ? "on" : "off"); } catch (e) { /* приватный режим */ }
    });
  }
  setInterval(() => {
    if (!readNightChoice()) paintNight(isNightNow());
  }, 60000);
  /* 13. билет ADMIT ONE: показывается один раз за визит и улетает по клику */
  (() => {
    const ADMIT_KEY = "cs-admit-ticket";
    let seen = null;
    try { seen = localStorage.getItem(ADMIT_KEY); } catch (e) { /* приватный режим */ }
    if (seen) return;
    const ticket = document.createElement("div");
    ticket.className = "admit-ticket";
    ticket.setAttribute("role", "button");
    ticket.setAttribute("tabindex", "0");
    ticket.setAttribute("aria-label", "Admit one ticket. Press Enter to put it away.");
    ticket.innerHTML =
      '<span class="admit-kicker">Cease Neverly presents</span>' +
      '<span class="admit-title">ADMIT ONE</span>' +
      '<span class="admit-sub">the show never stops</span>' +
      '<span class="admit-stub"><span class="admit-no">No. 013</span><span class="admit-code" aria-hidden="true"></span></span>';
    let going = false;
    const putAway = () => {
      if (going) return;
      going = true;
      try { localStorage.setItem(ADMIT_KEY, "1"); } catch (e) { /* приватный режим */ }
      ticket.classList.add("is-going");
      ticket.classList.remove("is-in");
      setTimeout(() => ticket.remove(), 620);
    };
    ticket.addEventListener("click", putAway);
    ticket.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
        e.preventDefault();
        putAway();
      }
    });
    document.body.appendChild(ticket);
    setTimeout(() => ticket.classList.add("is-in"), reduced ? 400 : 1400);
  })();

  /* 14. вывеска APPLAUSE в футере: клик запускает овацию */
  (() => {
    const footer = document.querySelector("footer");
    if (!footer) return;
    const sign = document.createElement("button");
    sign.className = "applause";
    sign.type = "button";
    sign.setAttribute("aria-pressed", "false");
    sign.setAttribute("aria-label", "Start the applause");
    sign.innerHTML =
      '<span class="applause-board"><span class="applause-word">APPLAUSE</span></span>' +
      '<span class="applause-cheer" aria-hidden="true">bravo</span>';
    footer.insertBefore(sign, footer.firstChild);
    let timer = 0;
    const clap = () => {
      sign.classList.add("is-clapping");
      sign.setAttribute("aria-pressed", "true");
      clearTimeout(timer);
      timer = setTimeout(() => {
        sign.classList.remove("is-clapping");
        sign.setAttribute("aria-pressed", "false");
      }, 2600);
    };
    sign.addEventListener("click", clap);
  })();

})();

