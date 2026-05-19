(function () {
  "use strict";

  const LOADING_DURATION_MS = 1800;
  const FALLBACK_TEXT = "등록되지 않은 숫자입니다.";
  const DATA_DIR = "../data/numbers/";

  // Dial tuning — value changes one "click" at a time, where one click
  // equals exactly one tick on the dial (so drag, wheel, and arrow keys
  // all move the notch by the same visible amount).
  const TICK_COUNT = 24;                    // visible ticks around the dial
  const TICK_DEG = 360 / TICK_COUNT;        // 15°
  const STEP_DEG = TICK_DEG;                // notch rotation per +1 value
  const DRAG_STEP_DEG = TICK_DEG;           // drag °  per +1 value

  const $ = (id) => document.getElementById(id);

  const screenBoot = $("screen-boot");
  const screenApp = $("screen-app");
  const bootLog = $("boot-log");
  const loadingBar = $("loading-bar");
  const skipHint = $("skip-hint"); // optional
  const btnSubmit = $("btn-submit");
  const btnPrev = $("btn-prev");
  const btnNext = $("btn-next");
  const btnRandom = $("btn-random");
  const resultBox = $("result-box");
  const resultHeader = $("result-header");
  const resultBody = $("result-body");
  const tvEmpty = $("tv-empty");
  const statusField = $("status-field");

  const dial = $("dial");
  const rotator = $("dial-rotator");
  const ticksGroup = $("dial-ticks");
  const dHundreds = $("d-hundreds");
  const dTens = $("d-tens");
  const dOnes = $("d-ones");

  const T = window.Terminal;

  // --- State ---
  let currentValue = 1;
  let notchRotation = 0;          // visual rotation of the inner knob (deg)
  let activeResultRun = null;
  let inFlightController = null;

  // -------------------------------------------------------
  //  Boot sequence + fake loading bar
  // -------------------------------------------------------
  // How many block chars currently fit across .loading-bar's width.
  // Recomputed on init, on font-load, and on window resize.
  let barWidth = 28;
  let lastBarPercent = 0;

  function computeBarWidth() {
    if (!loadingBar) return;
    const probe = document.createElement("span");
    probe.style.visibility = "hidden";
    probe.style.position = "absolute";
    probe.style.whiteSpace = "pre";
    probe.style.font = window.getComputedStyle(loadingBar).font;
    probe.textContent = "█".repeat(10);
    document.body.appendChild(probe);
    const charW = probe.getBoundingClientRect().width / 10;
    probe.remove();

    const containerW = loadingBar.clientWidth;
    if (!charW || !containerW) return;

    // Reserve room for "[" + "]" + " 100%" + a safety char ≈ 8 chars
    const overhead = 8 * charW;
    const fits = Math.floor((containerW - overhead) / charW);
    barWidth = Math.max(10, Math.min(200, fits));
  }

  function renderLoadingBar(percent) {
    lastBarPercent = percent;
    const filled = Math.round((percent / 100) * barWidth);
    const empty = barWidth - filled;
    const bar = "█".repeat(filled) + "░".repeat(empty);
    const pct = String(percent).padStart(3, " ");
    loadingBar.textContent = `[${bar}] ${pct}%`;
  }

  function onLoadingResize() {
    computeBarWidth();
    renderLoadingBar(lastBarPercent);
  }
  window.addEventListener("resize", onLoadingResize);
  // Recompute once webfont loads — char metrics shift between fallback and Galmuri
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(onLoadingResize);
  }

  /**
   * Returns { promise, skip } so the loading bar is skippable in the same
   * way the boot sequence is. `skip()` jumps straight to 100% and resolves.
   */
  function startFakeLoading() {
    let resolveFn;
    let done = false;
    let skipped = false;
    const promise = new Promise((r) => { resolveFn = r; });

    const start = performance.now();
    let lastPercent = -1;
    function tick(now) {
      if (done) return;
      if (skipped) {
        renderLoadingBar(100);
        done = true;
        resolveFn();
        return;
      }
      const elapsed = now - start;
      const raw = Math.min(100, (elapsed / LOADING_DURATION_MS) * 100);
      const stepped = Math.floor(raw / 4) * 4;
      if (stepped !== lastPercent) {
        renderLoadingBar(stepped);
        lastPercent = stepped;
      }
      if (elapsed < LOADING_DURATION_MS) {
        requestAnimationFrame(tick);
      } else {
        renderLoadingBar(100);
        done = true;
        resolveFn();
      }
    }
    computeBarWidth();
    renderLoadingBar(0);
    requestAnimationFrame(tick);

    return { promise, skip() { skipped = true; } };
  }

  function startBootSequence() {
    const lines = [
      { text: "[ limbic-system / 100 of memories ]", className: "bright", delayAfter: 220 },
      { text: "> initializing system........... OK", className: "ok", delayAfter: 140 },
      { text: "> mounting /data/numbers/....... OK", className: "ok", delayAfter: 140 },
      { text: "> calibrating dial.............. OK", className: "ok", delayAfter: 140 },
      { text: "> ready.", className: "ok", delayAfter: 280 },
    ];
    return T.typewriterLines(bootLog, lines, { speed: 10, delayAfter: 140 });
  }

  function showApp() {
    screenBoot.classList.add("hidden");
    screenApp.classList.remove("hidden");
    statusField.textContent = "ready";
    dial.focus();
  }

  // -------------------------------------------------------
  //  Odometer + dial rendering
  // -------------------------------------------------------
  function buildDigitStrip(strip) {
    strip.innerHTML = "";
    for (let i = 0; i <= 9; i++) {
      const cell = document.createElement("div");
      cell.className = "digit-cell";
      cell.textContent = String(i);
      strip.appendChild(cell);
    }
  }

  function setDigit(strip, digit) {
    // Translate by digit * 100% of one cell height
    strip.style.transform = `translateY(-${digit * 10}%)`;
    // ↑ strip is 10 cells tall (1000% of one cell), so each cell = 10% of strip
  }

  function renderOdometer(value) {
    const v = String(value).padStart(3, "0");
    setDigit(dHundreds, Number(v[0]));
    setDigit(dTens, Number(v[1]));
    setDigit(dOnes, Number(v[2]));
  }

  function applyNotchRotation() {
    rotator.style.transform = `rotate(${notchRotation}deg)`;
  }

  function clamp(n, lo, hi) { return Math.min(Math.max(n, lo), hi); }

  /**
   * Update current value. Pass `rotateNotch: false` when the caller
   * already mutated `notchRotation` (e.g. during a pointer drag, where
   * the notch follows the pointer angle directly).
   */
  function setValue(v, opts) {
    opts = opts || {};
    const newValue = clamp(v, 1, 100);
    const delta = newValue - currentValue;
    if (delta === 0 && !opts.force) return;

    if (opts.rotateNotch !== false && delta !== 0) {
      notchRotation += delta * STEP_DEG;
      applyNotchRotation();
    }
    currentValue = newValue;
    renderOdometer(currentValue);
    dial.setAttribute("aria-valuenow", String(currentValue));
  }

  function generateTicks() {
    const SVG_NS = "http://www.w3.org/2000/svg";
    for (let i = 0; i < TICK_COUNT; i++) {
      const angle = (i / TICK_COUNT) * 360;
      const major = i % 6 === 0;
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", "0");
      line.setAttribute("y1", "-92");
      line.setAttribute("x2", "0");
      line.setAttribute("y2", major ? "-78" : "-84");
      line.setAttribute("transform", `rotate(${angle})`);
      line.setAttribute("class", "dial-tick" + (major ? " major" : ""));
      ticksGroup.appendChild(line);
    }
  }

  // -------------------------------------------------------
  //  Dial interaction: drag, wheel, keyboard
  // -------------------------------------------------------
  let dragPointerId = null;
  let dragLastAngle = null;
  let dragAccDeg = 0;

  function angleFromCenter(clientX, clientY) {
    const r = dial.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    return Math.atan2(clientY - cy, clientX - cx) * 180 / Math.PI;
  }

  function onPointerDown(e) {
    if (dragPointerId !== null) return;
    dragPointerId = e.pointerId;
    dragLastAngle = angleFromCenter(e.clientX, e.clientY);
    dragAccDeg = 0;
    try { dial.setPointerCapture(e.pointerId); } catch (_) {}
    dial.classList.add("dragging");
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (dragPointerId !== e.pointerId) return;
    const a = angleFromCenter(e.clientX, e.clientY);
    let d = a - dragLastAngle;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    dragLastAngle = a;
    dragAccDeg += d;

    // Ratchet: only commit a value step once accumulated drag crosses one
    // full tick. The notch is moved through setValue() so it always snaps
    // exactly to a tick line — never floats between ticks.
    while (dragAccDeg >= DRAG_STEP_DEG && currentValue < 100) {
      setValue(currentValue + 1);
      dragAccDeg -= DRAG_STEP_DEG;
    }
    while (dragAccDeg <= -DRAG_STEP_DEG && currentValue > 1) {
      setValue(currentValue - 1);
      dragAccDeg += DRAG_STEP_DEG;
    }

    // Clamp accumulator at bounds so reversing direction responds immediately
    // (without having to drag back through "wasted" rotation past the limit).
    if (currentValue >= 100 && dragAccDeg > 0) dragAccDeg = 0;
    if (currentValue <= 1 && dragAccDeg < 0) dragAccDeg = 0;
  }

  function onPointerUp(e) {
    if (dragPointerId !== e.pointerId) return;
    try { dial.releasePointerCapture(e.pointerId); } catch (_) {}
    dragPointerId = null;
    dragLastAngle = null;
    dial.classList.remove("dragging");
  }

  function onWheel(e) {
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : -1;
    setValue(currentValue + dir);
  }

  function onDialKeyDown(e) {
    let step = 0;
    switch (e.key) {
      case "ArrowUp":
      case "ArrowRight": step = 1; break;
      case "ArrowDown":
      case "ArrowLeft": step = -1; break;
      case "PageUp": step = 10; break;
      case "PageDown": step = -10; break;
      case "Home": e.preventDefault(); setValue(1); return;
      case "End": e.preventDefault(); setValue(100); return;
      case "Enter":
      case " ": e.preventDefault(); handleSubmit(); return;
    }
    if (step !== 0) {
      e.preventDefault();
      setValue(currentValue + step);
    }
  }

  function bindDial() {
    dial.addEventListener("pointerdown", onPointerDown);
    dial.addEventListener("pointermove", onPointerMove);
    dial.addEventListener("pointerup", onPointerUp);
    dial.addEventListener("pointercancel", onPointerUp);
    dial.addEventListener("wheel", onWheel, { passive: false });
    dial.addEventListener("keydown", onDialKeyDown);
  }

  // -------------------------------------------------------
  //  Number lookup
  // -------------------------------------------------------
  /**
   * Render-time text transform. Source `.txt` files use this convention:
   *   - `<span style="...">…</span>` — visual color marker (dialogue vs narration)
   *   - `*…*` wrapped lines — narration / stage direction
   *   - bare lines — dialogue
   *
   * For the on-screen output we strip the visual markers and instead express
   * the distinction structurally:
   *   - `<span>` tags are removed (inner text kept)
   *   - `*…*` wrapping is removed (narration shown as plain text)
   *   - unwrapped lines become `"…"` (dialogue gets quote marks)
   *
   * Empty lines are preserved so paragraph breaks survive.
   * The source file is not modified — this only affects rendering.
   */
  /**
   * Split a fetched .txt file into an optional title and the body.
   *
   * Convention: the very first line of the file is the scene title.
   * It must be followed by a blank line before the body begins:
   *
   *   <title line>
   *                     <-- blank
   *   <body line 1>
   *   ...
   *
   * Title tags / asterisks are stripped so the header stays plain.
   * If the file does not follow the convention, returns title: "" and
   * the whole text as body.
   */
  function splitTitleAndBody(raw) {
    const m = raw.match(/^([^\n]+)\r?\n\s*\r?\n([\s\S]*)$/);
    if (m) {
      const title = m[1]
        .replace(/<\/?span\b[^>]*>/gi, "")
        .replace(/^\*+\s*|\s*\*+$/g, "")
        .trim();
      return { title, body: m[2] };
    }
    return { title: "", body: raw };
  }

  function transformText(raw) {
    return raw
      .split(/\r?\n/)
      .map((line) => {
        // 1. Strip <span ...> and </span> but keep inner text
        const stripped = line.replace(/<\/?span\b[^>]*>/gi, "");
        const trimmed = stripped.trim();
        if (!trimmed) return "";

        // 2. *…* → strip asterisks and mark as narration (rendered dim)
        if (
          trimmed.startsWith("*") &&
          trimmed.endsWith("*") &&
          trimmed.length > 1
        ) {
          const inner = trimmed.slice(1, -1).trim();
          return `<span class="narration">${inner}</span>`;
        }

        // 3. Dialogue — plain text, default bright color
        return trimmed;
      })
      .join("\n");
  }

  async function fetchNumberText(n) {
    if (inFlightController) inFlightController.abort();
    inFlightController = new AbortController();

    const url = `${DATA_DIR}${n}.txt`;
    try {
      const res = await fetch(url, { cache: "no-cache", signal: inFlightController.signal });
      if (res.status === 404) return FALLBACK_TEXT;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = (await res.text()).replace(/\s+$/, "");
      return text || FALLBACK_TEXT;
    } catch (err) {
      if (err.name === "AbortError") return null;
      console.error(`Failed to load ${url}`, err);
      T.toast("파일을 불러오지 못했습니다.");
      return null;
    } finally {
      inFlightController = null;
    }
  }

  function setupSkipOnTap() {
    function safeHandler(e) {
      const t = e.target;
      if (t.closest("button") || t.closest("a") || t.closest("svg")) return;
      if (activeResultRun) activeResultRun.skip();
    }
    document.addEventListener("click", safeHandler);
    document.addEventListener("touchstart", safeHandler, { passive: true });
    document.addEventListener("keydown", (e) => {
      if (!activeResultRun) return;
      // dial owns Enter/Space when result is being typed — let it skip too
      if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
        activeResultRun.skip();
      }
    });
  }

  async function handleSubmit() {
    const n = currentValue;
    if (activeResultRun) { activeResultRun.skip(); activeResultRun = null; }

    statusField.textContent = `loading #${n}...`;
    btnSubmit.disabled = true;

    const text = await fetchNumberText(n);

    btnSubmit.disabled = false;
    if (text === null) return;

    // Pull an optional title line off the top of the file.
    const { title, body } = text === FALLBACK_TEXT
      ? { title: "", body: text }
      : splitTitleAndBody(text);

    const nnn = String(n).padStart(3, "0");
    resultHeader.textContent = title
      ? `>>> SCENE # ${nnn} - ${title}`
      : `>>> SCENE # ${nnn}`;

    resultBody.textContent = "";
    resultBox.classList.remove("hidden");
    if (tvEmpty) tvEmpty.classList.add("hidden");
    // Hide prev/next at boundaries — no wrap.
    btnPrev.classList.toggle("hidden", n <= 1);
    btnNext.classList.toggle("hidden", n >= 100);
    statusField.textContent = `#${n}`;

    // Skip transform for the fallback string so it doesn't get quote-wrapped.
    const rendered = text === FALLBACK_TEXT ? body : transformText(body);

    const visibleLen = rendered.replace(/<[^>]+>/g, "").length;
    const speed = visibleLen > 600 ? 6 : visibleLen > 300 ? 10 : 14;

    activeResultRun = T.typewriterHTML(resultBody, rendered, { speed });
    activeResultRun.promise.then(() => {
      activeResultRun = null;
      statusField.textContent = `#${n} done`;
    });
  }

  /**
   * Step the dial one tick in either direction and fetch that number.
   * Buttons are hidden at boundaries so these early-returns are belt-and-
   * suspenders for keyboard / programmatic callers.
   */
  function handlePrev() {
    if (currentValue <= 1) return;
    setValue(currentValue - 1);
    handleSubmit();
  }

  function handleNext() {
    if (currentValue >= 100) return;
    setValue(currentValue + 1);
    handleSubmit();
  }

  /**
   * Jump to a random number in 1..100, excluding the current value so the
   * dial visibly moves every time. The dial + odometer animate via setValue.
   */
  function handleRandom() {
    let target;
    do {
      target = 1 + Math.floor(Math.random() * 100);
    } while (target === currentValue);
    setValue(target);
    handleSubmit();
  }

  function bindEvents() {
    btnSubmit.addEventListener("click", handleSubmit);
    btnPrev.addEventListener("click", handlePrev);
    btnNext.addEventListener("click", handleNext);
    btnRandom.addEventListener("click", handleRandom);
  }

  // -------------------------------------------------------
  //  Init
  // -------------------------------------------------------
  async function init() {
    buildDigitStrip(dHundreds);
    buildDigitStrip(dTens);
    buildDigitStrip(dOnes);
    generateTicks();
    setValue(1, { force: true, rotateNotch: false });
    applyNotchRotation();

    bindDial();
    bindEvents();
    setupSkipOnTap();

    const bootRun = startBootSequence();
    const loadingRun = startFakeLoading();

    // A single tap/key skips BOTH boot sequence and loading bar so the
    // user is never stuck waiting on the slower of the two.
    function skipIntro() {
      bootRun.skip();
      loadingRun.skip();
    }
    document.addEventListener("keydown", skipIntro, { once: true });
    document.addEventListener("click", skipIntro, { once: true });
    document.addEventListener("touchstart", skipIntro, { once: true });

    await Promise.all([bootRun.promise, loadingRun.promise]);

    document.removeEventListener("keydown", skipIntro);
    document.removeEventListener("click", skipIntro);
    document.removeEventListener("touchstart", skipIntro);

    if (skipHint) skipHint.classList.add("hidden");
    showApp();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
