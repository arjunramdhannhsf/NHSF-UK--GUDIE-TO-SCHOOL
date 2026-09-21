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

function sync() {
  const i = currentIndex();
  const max = deck.scrollHeight - deck.clientHeight;
  const pct = max > 0 ? (deck.scrollTop / max) * 100 : 0;
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
sync();

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

const form = $("#contact-form");
const status = $("#form-status");

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const name = String(data.get("name") || "").trim();
  const email = String(data.get("email") || "").trim();
  const subjectField = String(data.get("subject") || "").trim();
  const message = String(data.get("message") || "").trim();

  if (!name || !email || !message) {
    status.textContent = "Please complete name, email and message.";
    return;
  }

  const subject = encodeURIComponent(subjectField || `NHSF Schools guide: ${name}`);
  const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`);
  window.location.href = `mailto:info@nhsf.org.uk?subject=${subject}&body=${body}`;
  status.textContent = "Opening your email to info@nhsf.org.uk…";
});

function bindMap({
  img,
  frame,
  pinsWrap,
  tip,
  items,
  renderTip,
  onClick,
  reachFor,
}) {
  if (!img || !frame || !pinsWrap || !Array.isArray(items)) return;

  const viewport = frame.parentElement;
  const minZoom = 1;
  const maxZoom = 3.6;
  let scale = 1;
  let panX = 0;
  let panY = 0;
  let dragging = false;
  let dragged = false;
  let lastX = 0;
  let lastY = 0;

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
    if (ch.id === "westminster" && Array.isArray(ch.hits)) {
      for (const hit of ch.hits) {
        if (hit.x != null && hit.y != null) pts.push({ x: hit.x, y: hit.y });
      }
    }
    return pts;
  }

  const stage = viewport.parentElement;

  function showTip(ch) {
    if (!tip || !ch) return;
    tip.innerHTML = renderTip(ch);
    if (stage && tip.parentElement !== stage) stage.append(tip);
    const imgRect = img.getBoundingClientRect();
    const hostRect = (stage || viewport).getBoundingClientRect();
    const pinX = imgRect.left + (ch.x / 100) * imgRect.width;
    const pinY = imgRect.top + (ch.y / 100) * imgRect.height;
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
    frame.style.width = "";
    frame.style.height = "";
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

  function near(event) {
    const rect = img.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    if (px < 0 || py < 0 || px > rect.width || py > rect.height) return null;
    let best = null;
    let bestDist = Infinity;
    for (const ch of items) {
      const reach = reachFor ? reachFor(ch) : 20;
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

  function onDragMove(event) {
    if (!dragging) return;
    event.preventDefault();
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragged = true;
    lastX = event.clientX;
    lastY = event.clientY;
    panX += dx;
    panY += dy;
    applyView();
    hideTip();
  }

  function endPan() {
    if (!dragging) return;
    dragging = false;
    viewport.classList.remove("is-panning");
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup", endPan);
    window.removeEventListener("pointercancel", endPan);
  }

  viewport.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".map-zoom")) return;
    if (scale <= 1) return;
    event.preventDefault();
    dragging = true;
    dragged = false;
    lastX = event.clientX;
    lastY = event.clientY;
    viewport.classList.add("is-panning");
    window.addEventListener("pointermove", onDragMove, { passive: false });
    window.addEventListener("pointerup", endPan);
    window.addEventListener("pointercancel", endPan);
  });

  viewport.addEventListener("pointermove", (event) => {
    if (dragging) return;
    const ch = near(event);
    if (ch) showTip(ch);
    else hideTip();
  });

  viewport.addEventListener("pointerleave", () => {
    if (!dragging) hideTip();
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
    showTip(ch);
    if (onClick) onClick(ch);
  });

  document.addEventListener("click", (event) => {
    if (viewport.contains(event.target)) return;
    hideTip();
  });
}

bindMap({
  img: $("#school-map-img"),
  frame: $("#school-frame"),
  pinsWrap: $("#school-pins"),
  tip: $("#school-tip"),
  items: window.SCHOOLS || [],
  reachFor: () => 16,
  renderTip: (ch) => `
    <span class="zone-tag">${ch.zone} zone</span>
    ${ch.group ? `<p>${ch.group}</p>` : ""}
    <h3>${ch.school}</h3>
    ${ch.location ? `<p>${ch.location}</p>` : ""}
    <span class="aff-tag">${ch.affiliated ? "Affiliated" : "Not affiliated yet"}</span>
    ${ch.website ? `<p>Click to open the school website</p>` : ""}
  `,
  onClick: (ch) => {
    if (!ch?.website) return;
    window.open(ch.website, "_blank", "noopener,noreferrer");
  },
});

bindMap({
  img: $("#uni-map-img"),
  frame: $("#uni-frame"),
  pinsWrap: $("#map-pins"),
  tip: $("#map-tip"),
  items: window.CHAPTERS || [],
  reachFor: (ch) => (ch.zone === "london" ? 16 : 18),
  renderTip: (ch) => `
    <span class="zone-tag">${ch.zone} zone</span>
    <h3>${ch.society}</h3>
    <p>${ch.university}</p>
    ${ch.location ? `<p>${ch.location}</p>` : ""}
  `,
  onClick: (ch) => {
    if (!ch?.instagram) return;
    window.open(ch.instagram, "_blank", "noopener,noreferrer");
  },
});
