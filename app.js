const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const deck = $("#deck");
const progressBar = $("#progress-bar");
const slideNum = $("#slide-num");
const dotsWrap = $("#dots");
const slides = $$(".slide");
const total = slides.length;

slides.forEach((_, i) => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.setAttribute("aria-label", `Go to slide ${i + 1}`);
  btn.addEventListener("click", () => goTo(i));
  dotsWrap.append(btn);
});

const dots = $$(".dots button");

function currentIndex() {
  let current = 0;
  const mid = window.innerHeight * 0.45;
  slides.forEach((slide, i) => {
    if (slide.getBoundingClientRect().top < mid) current = i;
  });
  return current;
}

function isMobileLayout() {
  return window.matchMedia("(max-width: 980px)").matches;
}

function sync() {
  const i = currentIndex();
  const scroller = isMobileLayout() ? document.scrollingElement : deck;
  const max = scroller.scrollHeight - scroller.clientHeight;
  const pct = max > 0 ? (scroller.scrollTop / max) * 100 : 0;
  progressBar.style.width = `${pct}%`;
  dots.forEach((dot, n) => dot.classList.toggle("is-on", n === i));
  slideNum.textContent = `${String(i + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
}

function goTo(index) {
  const next = Math.min(total - 1, Math.max(0, index));
  slides[next].scrollIntoView({ behavior: "smooth", block: "start" });
}

function go(delta) {
  goTo(currentIndex() + delta);
}

deck.addEventListener("scroll", sync, { passive: true });
window.addEventListener("scroll", sync, { passive: true });
window.addEventListener("resize", sync);
sync();

function slideForHash() {
  const id = decodeURIComponent(location.hash.replace(/^#/, ""));
  if (!id) return null;
  const el = document.getElementById(id);
  return el ? el.closest(".slide") || el : null;
}

function openHash(behavior) {
  const slide = slideForHash();
  if (slide) slide.scrollIntoView({ behavior, block: "start" });
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[href^='#']");
  if (!link) return;
  const id = decodeURIComponent(link.getAttribute("href").slice(1));
  if (!id || !document.getElementById(id)) return;
  event.preventDefault();
  const next = `#${id}`;
  if (location.hash !== next) history.pushState(null, "", next);
  openHash("smooth");
});

window.addEventListener("hashchange", () => openHash("smooth"));
openHash("auto");

const presentBtn = $("#present-btn");
presentBtn.addEventListener("click", async () => {
  if (!document.fullscreenElement) {
    try {
      await document.documentElement.requestFullscreen();
      presentBtn.textContent = "Exit";
    } catch {
      /* ignore */
    }
  } else {
    await document.exitFullscreen();
  }
});

document.addEventListener("fullscreenchange", () => {
  presentBtn.textContent = document.fullscreenElement ? "Exit" : "Fullscreen";
});

$("#prev-btn").addEventListener("click", () => go(-1));
$("#next-btn").addEventListener("click", () => go(1));

window.addEventListener("keydown", (event) => {
  if (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
  if (["ArrowDown", "ArrowRight", "PageDown", " ", "j"].includes(event.key)) {
    event.preventDefault();
    go(1);
  }
  if (["ArrowUp", "ArrowLeft", "PageUp", "k"].includes(event.key)) {
    event.preventDefault();
    go(-1);
  }
  if (event.key === "Home") {
    event.preventDefault();
    goTo(0);
  }
  if (event.key === "End") {
    event.preventDefault();
    goTo(total - 1);
  }
});

$$('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const id = link.getAttribute("href");
    const slide = id ? $(id) : null;
    if (!slide || !slide.classList.contains("slide")) return;
    event.preventDefault();
    slide.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

function bindMap({
  img,
  frame,
  pinsWrap,
  tip,
  items,
  renderTip,
  onClick,
  openLabel,
  reachFor,
  areasById,
  labelScan,
  dotsOnly,
}) {
  if (!img || !frame || !pinsWrap || !Array.isArray(items)) return;

  const viewport = frame.parentElement;
  const coarse = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  const minZoom = 1;
  const maxZoom = coarse ? 5.5 : 3.6;
  let scale = 1;
  let panX = 0;
  let panY = 0;
  let dragged = false;
  let lastX = 0;
  let lastY = 0;
  let fittedFor = 0;
  const pointers = new Map();
  let gesture = null;

  const ui = document.createElement("div");
  ui.className = "map-zoom";
  ui.innerHTML = `
    <button type="button" data-zoom="in" aria-label="Zoom in">+</button>
    <button type="button" data-zoom="out" aria-label="Zoom out">−</button>
    <button type="button" data-zoom="reset" aria-label="Reset zoom">↺</button>
  `;
  viewport.append(ui);

  items.forEach((ch) => {
    if (ch.x == null || ch.y == null) return;
    const mark = document.createElement("span");
    mark.className = `map-pin ${ch.zone}`;
    mark.dataset.id = ch.id;
    mark.style.left = `${ch.x}%`;
    mark.style.top = `${ch.y}%`;
    mark.setAttribute("aria-hidden", "true");
    pinsWrap.append(mark);
  });

  function points(ch) {
    const pts = [];
    if (ch.x != null && ch.y != null) pts.push({ x: ch.x, y: ch.y });
    if (Array.isArray(ch.hits)) {
      for (const hit of ch.hits) {
        if (hit.x != null && hit.y != null) pts.push({ x: hit.x, y: hit.y });
      }
    }
    return pts;
  }

  const stage = viewport.parentElement;

  let scanned = null;
  let hitPoint = null;

  function showTip(ch, clientX, clientY) {
    if (!tip || !ch) return;
    tip.innerHTML = renderTip(ch);
    const close = document.createElement("button");
    close.type = "button";
    close.className = "tip-close";
    close.setAttribute("aria-label", "Close");
    close.textContent = "×";
    close.addEventListener("click", (event) => {
      event.stopPropagation();
      event.preventDefault();
      hideTip();
    });
    tip.append(close);
    if (stage && tip.parentElement !== stage) stage.append(tip);
    if (coarse) {
      tip.classList.add("is-docked");
      tip.classList.remove("flip-x", "flip-y");
      tip.style.left = "";
      tip.style.top = "";
      const hint = tip.querySelector(".tip-hint");
      if (hint) hint.remove();
      const label = openLabel ? openLabel(ch) : "";
      if (label && onClick) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "tip-open";
        btn.textContent = label;
        btn.addEventListener("click", (event) => {
          event.stopPropagation();
          onClick(ch);
        });
        tip.append(btn);
      }
      tip.hidden = false;
      return;
    }
    tip.classList.remove("is-docked");
    const hostRect = (stage || viewport).getBoundingClientRect();
    let pinX;
    let pinY;
    if (dotsOnly && hitPoint) {
      const imgRect = img.getBoundingClientRect();
      pinX = imgRect.left + (hitPoint.x / 100) * imgRect.width;
      pinY = imgRect.top + (hitPoint.y / 100) * imgRect.height;
    } else if (clientX != null && clientY != null) {
      pinX = clientX;
      pinY = clientY;
    } else {
      const imgRect = img.getBoundingClientRect();
      pinX = imgRect.left + (ch.x / 100) * imgRect.width;
      pinY = imgRect.top + (ch.y / 100) * imgRect.height;
    }
    tip.style.left = `${pinX - hostRect.left}px`;
    tip.style.top = `${pinY - hostRect.top}px`;
    const roomRight = hostRect.right - pinX;
    const roomLeft = pinX - hostRect.left;
    const roomAbove = pinY - hostRect.top;
    const roomBelow = hostRect.bottom - pinY;
    tip.classList.toggle("flip-x", roomRight < 220 && roomLeft > roomRight);
    tip.classList.toggle("flip-y", roomAbove < 140 && roomBelow > roomAbove);
    tip.hidden = false;
  }

  function hideTip() {
    if (tip) tip.hidden = true;
  }

  function closeTipOnScroll() {
    if (tip && !tip.hidden) hideTip();
  }
  window.addEventListener("scroll", closeTipOnScroll, { capture: true, passive: true });
  const deck = document.querySelector(".deck");
  if (deck) deck.addEventListener("scroll", closeTipOnScroll, { passive: true });

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function applyView() {
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const cw = frame.offsetWidth;
    const ch = frame.offsetHeight;
    if (scale <= 1) {
      scale = 1;
      panX = 0;
      panY = 0;
    } else {
      panX = clamp(panX, Math.min(0, vw - cw * scale), 0);
      panY = clamp(panY, Math.min(0, vh - ch * scale), 0);
    }
    frame.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    viewport.classList.toggle("is-zoomed", scale > 1.01);
  }

  function zoomAt(clientX, clientY, nextScale) {
    const rect = viewport.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const contentX = (mx - panX) / scale;
    const contentY = (my - panY) / scale;
    scale = clamp(nextScale, minZoom, maxZoom);
    panX = mx - contentX * scale;
    panY = my - contentY * scale;
    applyView();
  }

  function zoomStep(factor) {
    const rect = viewport.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, scale * factor);
  }

  function areasFor(ch) {
    if (scanned && scanned.has(ch.id)) return scanned.get(ch.id);
    if (areasById && areasById[ch.id]) return areasById[ch.id];
    return null;
  }

  function near(event) {
    const rect = img.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    if (px < 0 || py < 0 || px > rect.width || py > rect.height) return null;
    const x = (px / rect.width) * 100;
    const y = (py / rect.height) * 100;
    let best = null;
    let bestDist = Infinity;
    for (const ch of items) {
      const areas = areasFor(ch);
      if (!areas) continue;
      for (const box of areas) {
        if (x < box.x || y < box.y || x > box.x + box.w || y > box.y + box.h) continue;
        const cx = box.x + box.w / 2;
        const cy = box.y + box.h / 2;
        const dist2 = (cx - x) ** 2 + (cy - y) ** 2;
        if (dist2 < bestDist) {
          bestDist = dist2;
          best = ch;
          hitPoint = { x: cx, y: cy };
        }
      }
    }
    if (best) return best;
    if (dotsOnly) {
      const natural = img.naturalWidth || rect.width;
      const limit = ((coarse ? 16 : 8) / natural) * rect.width;
      const max2 = limit * limit;
      hitPoint = null;
      for (const ch of items) {
        for (const pt of points(ch)) {
          const dx = (pt.x / 100) * rect.width - px;
          const dy = (pt.y / 100) * rect.height - py;
          const dist2 = dx * dx + dy * dy;
          if (dist2 <= max2 && dist2 < bestDist) {
            bestDist = dist2;
            best = ch;
            hitPoint = pt;
          }
        }
      }
      return best;
    }
    hitPoint = null;
    for (const ch of items) {
      if (areasFor(ch)) continue;
      const base = reachFor ? reachFor(ch) : 20;
      const reach = coarse ? Math.max(base, 28) : base;
      const max2 = reach * reach;
      for (const pt of points(ch)) {
        const dx = (pt.x / 100) * rect.width - px;
        const dy = (pt.y / 100) * rect.height - py;
        const dist2 = dx * dx + dy * dy;
        if (dist2 < max2 && dist2 < bestDist) {
          bestDist = dist2;
          best = ch;
        }
      }
    }
    return best;
  }

  ui.addEventListener("click", (event) => {
    event.stopPropagation();
    const btn = event.target.closest("button");
    if (!btn) return;
    hideTip();
    if (btn.dataset.zoom === "in") zoomStep(1.35);
    if (btn.dataset.zoom === "out") zoomStep(1 / 1.35);
    if (btn.dataset.zoom === "reset") {
      scale = 1;
      panX = 0;
      panY = 0;
      applyView();
    }
  });

  img.setAttribute("draggable", "false");
  viewport.addEventListener("contextmenu", (event) => event.preventDefault());
  viewport.addEventListener("copy", (event) => event.preventDefault());
  viewport.addEventListener("dragstart", (event) => event.preventDefault());

  function scrollPage(dy) {
    const deck = document.querySelector(".deck");
    const deckScrolls = deck && deck.scrollHeight > deck.clientHeight + 1 && getComputedStyle(deck).overflowY !== "visible";
    if (deckScrolls) deck.scrollTop -= dy;
    else window.scrollBy(0, -dy);
  }

  function endGesture() {
    pointers.clear();
    gesture = null;
    viewport.classList.remove("is-panning");
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
  }

  function onPointerMove(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (gesture === "pinch" && pointers.size >= 2) {
      event.preventDefault();
      const pts = [...pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      zoomAt((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2, pointers.pinchScale * (dist / pointers.pinchDist));
      dragged = true;
      hideTip();
      return;
    }

    if (pointers.size !== 1) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    const movedX = Math.abs(event.clientX - pointers.originX);
    const movedY = Math.abs(event.clientY - pointers.originY);
    const touch = event.pointerType === "touch" || event.pointerType === "pen";

    if (gesture === "pending") {
      if (movedX < 8 && movedY < 8) return;
      if (!touch) {
        if (scale <= 1.01) {
          dragged = true;
          return;
        }
        gesture = "pan";
      } else if (scale > 1.01) {
        gesture = "pan";
      } else if (movedY >= movedX) {
        gesture = "scroll";
      } else {
        gesture = "ignore";
        dragged = true;
      }
    }

    if (gesture === "scroll") return;

    if (gesture === "pan") {
      event.preventDefault();
      viewport.classList.add("is-panning");
      panX += dx;
      panY += dy;
      lastX = event.clientX;
      lastY = event.clientY;
      dragged = true;
      applyView();
      hideTip();
    }
  }

  function onPointerUp(event) {
    pointers.delete(event.pointerId);
    if (gesture === "pinch" && pointers.size < 2) {
      gesture = pointers.size === 0 ? null : "pending";
      if (pointers.size === 1) {
        const remaining = [...pointers.values()][0];
        pointers.originX = lastX = remaining.x;
        pointers.originY = lastY = remaining.y;
      }
    }
    if (pointers.size === 0) endGesture();
  }

  viewport.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".map-zoom") || event.target.closest(".map-tip")) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const starting = pointers.size === 0;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) {
      gesture = "pending";
      dragged = false;
      pointers.originX = lastX = event.clientX;
      pointers.originY = lastY = event.clientY;
    } else if (pointers.size === 2) {
      const pts = [...pointers.values()];
      pointers.pinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      pointers.pinchScale = scale;
      gesture = "pinch";
      dragged = true;
      hideTip();
    }
    if (!starting) return;
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  });

  viewport.addEventListener("pointermove", (event) => {
    if (coarse || gesture || event.pointerType !== "mouse") return;
    const ch = near(event);
    if (ch) showTip(ch, event.clientX, event.clientY);
    else hideTip();
  });

  viewport.addEventListener("pointerleave", (event) => {
    if (coarse || gesture) return;
    if (tip && !tip.hidden && event.relatedTarget instanceof Node && tip.contains(event.relatedTarget)) return;
    hideTip();
  });

  frame.addEventListener("click", (event) => {
    if (dragged) {
      dragged = false;
      return;
    }
    const ch = near(event);
    if (!ch) {
      hideTip();
      return;
    }
    showTip(ch, coarse ? undefined : event.clientX, coarse ? undefined : event.clientY);
    if (!coarse && onClick) onClick(ch);
  });

  document.addEventListener("click", (event) => {
    if (viewport.contains(event.target) || (tip && tip.contains(event.target))) return;
    hideTip();
  });

  function fitFrame() {
    const mobile = window.matchMedia("(max-width: 1280px)").matches;
    if (!mobile) {
      if (viewport.style.width || frame.style.width) {
        viewport.style.width = "";
        frame.style.width = "";
        scale = 1;
        panX = 0;
        panY = 0;
      }
      fittedFor = 0;
      return;
    }
    const parent = stage || viewport.parentElement;
    if (!parent || !img.naturalWidth || !img.naturalHeight) return;
    const maxW = parent.clientWidth;
    if (!maxW || (maxW === fittedFor && frame.style.width)) return;
    fittedFor = maxW;
    viewport.style.width = `${maxW}px`;
    frame.style.width = `${maxW}px`;
    scale = 1;
    panX = 0;
    panY = 0;
  }

  function layout() {
    fitFrame();
    applyView();
    if (labelScan) scanned = scanLabelAreas(img, items);
  }

  if (img.complete && img.naturalWidth) layout();
  else img.addEventListener("load", layout, { once: true });
  window.addEventListener("resize", layout);
}

function scanLabelAreas(image, chapters) {
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  if (!w || !h) return null;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  let data;
  try {
    ctx.drawImage(image, 0, 0, w, h);
    data = ctx.getImageData(0, 0, w, h).data;
  } catch (err) {
    return null;
  }

  function sample(x, y) {
    const i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  }

  function isText(zone, r, g, b) {
    if (zone === "north" && r > 130 && g < 140 && b < 160 && r > g + 40 && r > b + 30) return true;
    if (zone === "central" && g > 70 && r < 140 && b < 140 && g > r + 20 && g > b + 10) return true;
    if (zone === "south" && r > 120 && g > 80 && b < 110 && r + g > b + 80 && g > b + 20) return true;
    if (zone === "london" && b > 150 && r < 80 && b > r + 80 && b > g) return true;
    const lum = r * 0.3 + g * 0.59 + b * 0.11;
    return lum < 115 && r < 90 && g < 100;
  }

  function columnText(zone, x, dy) {
    if (x < 0 || x >= w) return false;
    const y0 = Math.max(0, dy - 8);
    const y1 = Math.min(h - 1, dy + 8);
    for (let y = y0; y <= y1; y += 1) {
      const [r, g, b] = sample(x, y);
      if (isText(zone, r, g, b)) return true;
    }
    return false;
  }

  function lineY(zone, dx, dy) {
    let bestY = dy;
    let best = -Infinity;
    for (let y = Math.max(0, dy - 14); y <= Math.min(h - 1, dy + 14); y += 1) {
      let count = 0;
      for (let x = Math.max(0, dx - 8); x <= Math.min(w - 1, dx + 56); x += 1) {
        const [r, g, b] = sample(x, y);
        if (isText(zone, r, g, b)) count += 1;
      }
      const score = count - Math.abs(y - dy) * 2;
      if (score > best) {
        best = score;
        bestY = y;
      }
    }
    return bestY;
  }

  function walk(zone, dx, dy) {
    const baseline = lineY(zone, dx, dy);
    let left = dx;
    let gap = 0;
    for (let x = dx; x >= Math.max(0, dx - 120); x -= 1) {
      if (columnText(zone, x, baseline)) {
        left = x;
        gap = 0;
      } else {
        gap += 1;
        if (gap > 4) break;
      }
    }
    let right = dx;
    gap = 0;
    for (let x = dx; x <= Math.min(w - 1, dx + 140); x += 1) {
      if (columnText(zone, x, baseline)) {
        right = x;
        gap = 0;
      } else {
        gap += 1;
        if (gap > 4) break;
      }
    }
    if (right - left > 108) {
      if (right - dx >= dx - left) left = Math.max(left, dx - 12);
      else right = Math.min(right, dx + 12);
    }
    if (right - left < 10) return null;
    let miny = baseline;
    let maxy = baseline;
    const y0 = Math.max(0, baseline - 9);
    const y1 = Math.min(h - 1, baseline + 9);
    for (let x = left; x <= right; x += 1) {
      for (let y = y0; y <= y1; y += 1) {
        const [r, g, b] = sample(x, y);
        if (!isText(zone, r, g, b)) continue;
        if (y < miny) miny = y;
        if (y > maxy) maxy = y;
      }
    }
    const pad = 3;
    return {
      x: ((left - pad) / w) * 100,
      y: ((miny - pad) / h) * 100,
      w: ((right - left + pad * 2) / w) * 100,
      h: ((maxy - miny + pad * 2) / h) * 100,
    };
  }

  const map = new Map();
  for (const ch of chapters) {
    if (ch.x == null || ch.y == null) continue;
    const seeds = [{ x: ch.x, y: ch.y }];
    if (Array.isArray(ch.hits)) seeds.push(...ch.hits);
    const boxes = [];
    for (const seed of seeds) {
      if (seed.x == null || seed.y == null) continue;
      const box = walk(ch.zone, Math.round((seed.x / 100) * w), Math.round((seed.y / 100) * h));
      if (box) boxes.push(box);
    }
    if (boxes.length) map.set(ch.id, boxes);
  }
  return map;
}

function schoolBox(x0, y0, x1, y1) {
  return {
    x: (x0 / 820) * 100,
    y: (y0 / 690) * 100,
    w: ((x1 - x0) / 820) * 100,
    h: ((y1 - y0) / 690) * 100,
  };
}

const SCHOOL_AREAS = {
  sale: [schoolBox(233, 284, 278, 304), schoolBox(490, 80, 800, 100)],
  "altrincham-boys": [schoolBox(233, 302, 340, 320), schoolBox(490, 100, 800, 117)],
  "altrincham-girls": [schoolBox(233, 320, 340, 340), schoolBox(490, 117, 800, 134)],
  "ke-boys": [schoolBox(240, 412, 308, 436), schoolBox(490, 168, 800, 185)],
  "ke-girls": [schoolBox(240, 436, 308, 458), schoolBox(490, 185, 800, 202)],
  perse: [schoolBox(372, 444, 448, 470), schoolBox(490, 148, 800, 168)],
  "upton-court": [schoolBox(226, 530, 312, 558), schoolBox(490, 216, 800, 236)],
  challoners: [schoolBox(534, 408, 642, 440), schoolBox(490, 250, 800, 270)],
  alperton: [schoolBox(564, 448, 646, 478), schoolBox(490, 270, 800, 287)],
  "dhyan-group": [schoolBox(490, 287, 800, 308)],
  nonsuch: [schoolBox(506, 524, 562, 560)],
  "sutton-grammar": [schoolBox(542, 562, 610, 598)],
  "wallington-girls": [schoolBox(606, 524, 688, 558)],
  "wallington-boys": [schoolBox(626, 554, 706, 582)],
  wilsons: [schoolBox(560, 590, 620, 624)],
  "st-olaves": [schoolBox(662, 566, 728, 608)],
};

function schoolOpenUrl(ch) {
  if (!ch) return "";
  return ch.instagram || ch.groupInstagram || ch.website || "";
}

function schoolOpenLabel(ch) {
  if (ch?.instagram || ch?.groupInstagram) return "Open Instagram";
  if (ch?.website) return "Open school website";
  return "";
}

function schoolOpenHint(ch) {
  const label = schoolOpenLabel(ch);
  if (!label) return "";
  return `<p class="tip-hint">Click to ${label.charAt(0).toLowerCase()}${label.slice(1)}</p>`;
}

bindMap({
  img: $("#school-map-img"),
  frame: $("#school-frame"),
  pinsWrap: $("#school-pins"),
  tip: $("#school-tip"),
  items: window.SCHOOLS || [],
  areasById: SCHOOL_AREAS,
  reachFor: () => 16,
  renderTip: (ch) => `
    <span class="zone-tag">${ch.zone} zone</span>
    ${ch.group ? `<p>${ch.group}</p>` : ""}
    <h3>${ch.school}</h3>
    ${ch.location ? `<p>${ch.location}</p>` : ""}
    ${typeof ch.affiliated === "boolean" ? `<span class="aff-tag">${ch.affiliated ? "Affiliated" : "Not affiliated yet"}</span>` : ""}
    ${ch.groupInstagram ? `<p><a href="${ch.groupInstagram}" target="_blank" rel="noopener">@${ch.groupInstagram.split("/").filter(Boolean).pop()}</a></p>` : ""}
    ${ch.instagram ? `<p><a href="${ch.instagram}" target="_blank" rel="noopener">@${ch.instagram.split("/").filter(Boolean).pop()}</a></p>` : ""}
    ${schoolOpenHint(ch)}
  `,
  openLabel: (ch) => schoolOpenLabel(ch),
  onClick: (ch) => {
    const url = schoolOpenUrl(ch);
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  },
});

function uniBox(x0, y0, x1, y1) {
  return {
    x: (x0 / 723) * 100,
    y: (y0 / 1024) * 100,
    w: ((x1 - x0) / 723) * 100,
    h: ((y1 - y0) / 1024) * 100,
  };
}

function uniList(side, y0, y1) {
  const x0 = side === "L" ? 462 : 586;
  const x1 = side === "L" ? 582 : 710;
  return [uniBox(x0, y0, x1, y1)];
}

const UNI_AREAS = {
  aberdeen: uniList("L", 150, 169),
  durham: uniList("L", 169, 183.5),
  edinburgh: uniList("L", 183.5, 199),
  glasgow: uniList("L", 199, 213.5),
  hull: uniList("L", 213.5, 228.5),
  keele: uniList("L", 228.5, 248),
  lancaster: uniList("R", 150, 170),
  leeds: uniList("R", 170, 184),
  manchester: uniList("R", 184, 198),
  sheffield: uniList("R", 198, 213),
  lancashire: uniList("R", 213, 228.5),
  york: uniList("R", 228.5, 248),
  aston: uniList("L", 286, 306),
  birmingham: uniList("L", 306, 321),
  cambridge: uniList("L", 321, 336),
  coventry: uniList("L", 336, 351.5),
  dmu: uniList("L", 351.5, 367),
  leicester: uniList("L", 367, 388),
  loughborough: uniList("R", 286, 305),
  northampton: uniList("R", 305, 320),
  nottingham: uniList("R", 320, 336),
  ntu: uniList("R", 336, 351),
  uea: uniList("R", 351, 367),
  warwick: uniList("R", 367, 388),
  bath: uniList("L", 426, 446),
  "brighton-sussex": uniList("L", 446, 461.5),
  bristol: uniList("L", 461.5, 476.5),
  cardiff: uniList("L", 476.5, 491.5),
  exeter: uniList("L", 491.5, 507),
  kent: uniList("L", 507, 522.5),
  oxford: uniList("L", 522.5, 537),
  "oxford-brookes": uniList("L", 537, 558),
  plymouth: uniList("R", 426, 446),
  portsmouth: uniList("R", 446, 461.5),
  reading: uniList("R", 461.5, 476.5),
  solent: uniList("R", 476.5, 492),
  southampton: uniList("R", 492, 507.5),
  surrey: uniList("R", 507.5, 523),
  swansea: uniList("R", 523, 545),
  "anglia-ruskin": uniList("L", 598, 614.5),
  brunel: uniList("L", 614.5, 630),
  city: uniList("L", 630, 645),
  "east-london": uniList("L", 645, 660),
  essex: uniList("L", 660, 676),
  greenwich: uniList("L", 676, 690),
  hertfordshire: uniList("L", 690, 704.5),
  imperial: uniList("L", 704.5, 722),
  kings: uniList("R", 598, 615),
  lse: uniList("R", 615, 630),
  qmul: uniList("R", 630, 645),
  holloway: uniList("R", 645, 660.5),
  "st-georges": uniList("R", 660.5, 675.5),
  ucl: uniList("R", 675.5, 691),
  westminster: uniList("R", 691, 710),
};

bindMap({
  img: $("#uni-map-img"),
  frame: $("#uni-frame"),
  pinsWrap: $("#map-pins"),
  tip: $("#map-tip"),
  items: window.CHAPTERS || [],
  areasById: UNI_AREAS,
  dotsOnly: true,
  renderTip: (ch) => `
    <span class="zone-tag">${ch.zone} zone</span>
    <h3>${ch.society}</h3>
    <p>${ch.university}</p>
    ${ch.location ? `<p>${ch.location}</p>` : ""}
  `,
  openLabel: (ch) => (ch.instagram ? "Open Instagram" : ""),
  onClick: (ch) => {
    if (!ch?.instagram) return;
    window.open(ch.instagram, "_blank", "noopener,noreferrer");
  },
});
