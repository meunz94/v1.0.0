/* terminal.js — small shared utilities for terminal UX
   Exposes window.Terminal = { typewriter, typewriterHTML, typewriterLines, toast }
*/
(function () {
  "use strict";

  /**
   * Type `text` into `el` one character at a time.
   *
   * Returns { promise, skip() }
   *   - promise resolves when typing completes (naturally OR via skip).
   *   - skip() instantly fills the remaining text and resolves the promise.
   */
  function typewriter(el, text, opts) {
    opts = opts || {};
    const speed = opts.speed != null ? opts.speed : 18;
    const useCursor = !!opts.cursor;

    el.textContent = "";
    let i = 0;
    let cancelled = false;
    let done = false;
    let timerId = null;
    let cursorEl = null;
    let resolveFn = null;

    if (useCursor) {
      cursorEl = document.createElement("span");
      cursorEl.className = "cursor";
      el.appendChild(cursorEl);
    }

    function append(chunk) {
      if (cursorEl) {
        cursorEl.insertAdjacentText("beforebegin", chunk);
      } else {
        el.appendChild(document.createTextNode(chunk));
      }
    }

    function finish() {
      if (done) return;
      done = true;
      if (opts.onDone) opts.onDone();
      if (resolveFn) resolveFn();
    }

    function step() {
      if (done) return;
      if (cancelled) {
        append(text.slice(i));
        i = text.length;
        finish();
        return;
      }
      if (i >= text.length) {
        finish();
        return;
      }
      append(text[i]);
      i++;
      timerId = setTimeout(step, speed);
    }

    const promise = new Promise((resolve) => {
      resolveFn = resolve;
      step();
    });

    return {
      promise,
      skip() {
        if (done) return;
        cancelled = true;
        if (timerId) { clearTimeout(timerId); timerId = null; }
        step(); // runs synchronously, fills rest, resolves
      },
    };
  }

  /**
   * Type `html` into `el` one *visible* character at a time, while keeping
   * all HTML tags/attributes structurally intact.
   *
   * Returns { promise, skip() } — skip() fills remaining text and resolves.
   */
  function typewriterHTML(el, html, opts) {
    opts = opts || {};
    const speed = opts.speed != null ? opts.speed : 14;

    const tmpl = document.createElement("template");
    tmpl.innerHTML = html;

    el.textContent = "";
    el.appendChild(tmpl.content);

    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) {
      nodes.push({ node, original: node.textContent });
    }
    nodes.forEach((it) => { it.node.textContent = ""; });

    let cancelled = false;
    let done = false;
    let timerId = null;
    let nodeIdx = 0;
    let charIdx = 0;
    let resolveFn = null;

    function finish() {
      if (done) return;
      done = true;
      if (opts.onDone) opts.onDone();
      if (resolveFn) resolveFn();
    }

    function step() {
      if (done) return;
      if (cancelled) {
        for (let k = nodeIdx; k < nodes.length; k++) {
          nodes[k].node.textContent = nodes[k].original;
        }
        nodeIdx = nodes.length;
        finish();
        return;
      }
      // Skip empty text nodes
      while (nodeIdx < nodes.length && nodes[nodeIdx].original.length === 0) {
        nodeIdx++;
        charIdx = 0;
      }
      if (nodeIdx >= nodes.length) {
        finish();
        return;
      }

      charIdx++;
      const cur = nodes[nodeIdx];
      cur.node.textContent = cur.original.slice(0, charIdx);

      if (charIdx >= cur.original.length) {
        nodeIdx++;
        charIdx = 0;
      }

      timerId = setTimeout(step, speed);
    }

    const promise = new Promise((resolve) => {
      resolveFn = resolve;
      step();
    });

    return {
      promise,
      skip() {
        if (done) return;
        cancelled = true;
        if (timerId) { clearTimeout(timerId); timerId = null; }
        step();
      },
    };
  }

  /**
   * Type multiple lines into `el` sequentially.
   *
   * lines: array of strings or { text, className, delayAfter, speed }
   * Returns { promise, skip() } — skip jumps all remaining lines to completion.
   */
  function typewriterLines(el, lines, opts) {
    opts = opts || {};
    const defaultSpeed = opts.speed != null ? opts.speed : 14;
    const defaultDelay = opts.delayAfter != null ? opts.delayAfter : 180;

    let skipAll = false;
    let activeRun = null;
    let delayTimer = null;
    let delayResolve = null;

    function cancelDelay() {
      if (delayTimer) { clearTimeout(delayTimer); delayTimer = null; }
      if (delayResolve) { const r = delayResolve; delayResolve = null; r(); }
    }

    const promise = (async () => {
      for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const item = typeof raw === "string" ? { text: raw } : raw;

        const lineEl = document.createElement("div");
        if (item.className) lineEl.className = item.className;
        el.appendChild(lineEl);

        if (skipAll) {
          lineEl.textContent = item.text;
          continue;
        }

        activeRun = typewriter(lineEl, item.text, {
          speed: item.speed != null ? item.speed : defaultSpeed,
        });
        await activeRun.promise;
        activeRun = null;

        if (skipAll) continue;
        const wait = item.delayAfter != null ? item.delayAfter : defaultDelay;
        if (wait > 0) {
          await new Promise((r) => {
            delayResolve = r;
            delayTimer = setTimeout(() => {
              delayTimer = null;
              delayResolve = null;
              r();
            }, wait);
          });
        }
      }
    })();

    return {
      promise,
      skip() {
        skipAll = true;
        if (activeRun) activeRun.skip();
        cancelDelay();
      },
    };
  }

  /**
   * Show a brief error/info toast at bottom of screen.
   * Auto-dismisses after `duration` ms (default 2400).
   */
  function toast(message, duration) {
    duration = duration != null ? duration : 2400;
    const existing = document.querySelector(".toast");
    if (existing) existing.remove();

    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = message;
    document.body.appendChild(t);

    setTimeout(() => {
      t.style.transition = "opacity 0.2s";
      t.style.opacity = "0";
      setTimeout(() => t.remove(), 220);
    }, duration);
  }

  window.Terminal = { typewriter, typewriterHTML, typewriterLines, toast };
})();
