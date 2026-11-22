// Shared helpers: model identity (fixed colour + marker shape), number formatting, tiny DOM helper.
export const MODEL_KEYS = ["B", "C", "D", "E1", "F"];   // display order
export const MARKERS = { C: "circle", F: "square", B: "diamond", D: "triangle", E1: "triangle-down" };
export const color = (key) => `var(--m-${key})`;

/** SVG path for a marker of the given shape centred at (x, y) with "radius" r. */
export function markerPath(shape, x, y, r) {
  const s = r * 0.9, t = r * 1.15;
  switch (shape) {
    case "square": return `M${x - s},${y - s}h${2 * s}v${2 * s}h${-2 * s}Z`;
    case "diamond": return `M${x},${y - t}L${x + t},${y}L${x},${y + t}L${x - t},${y}Z`;
    case "triangle": return `M${x},${y - t}L${x + t},${y + t * 0.75}L${x - t},${y + t * 0.75}Z`;
    case "triangle-down": return `M${x},${y + t}L${x + t},${y - t * 0.75}L${x - t},${y - t * 0.75}Z`;
    default: return `M${x - r},${y}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0Z`;
  }
}

/** Inline SVG chip: the model's marker in its colour (identity never by colour alone). */
export const chip = (key) =>
  `<svg class="mk" viewBox="-7 -7 14 14" aria-hidden="true"><path d="${markerPath(MARKERS[key], 0, 0, 5)}" fill="${color(key)}"/></svg>`;

const MINUS = "−";
export function fmt(v, digits = 1, signed = false) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const s = Math.abs(v).toFixed(digits);
  if (Number(s) === 0) return (0).toFixed(digits);
  return (v < 0 ? MINUS : signed ? "+" : "") + s;
}
export const fmtDeg = (a) => `${a > 0 ? "+" : a < 0 ? MINUS : ""}${Math.abs(a)}°`;
export const fmtTime = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;

export function h(tag, attrs = {}, html = "") {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === null || v === undefined) continue;
    el.setAttribute(k, v === true ? "" : v);
  }
  if (html) el.innerHTML = html;
  return el;
}

export function legendHTML(models) {
  return models.map((m) => `<span>${chip(m.key)}<b>${m.key}</b>&nbsp;${m.name}</span>`).join("");
}

/** Segmented radio control; returns the container. */
export function segmented(container, options, value, onChange, label) {
  container.innerHTML = "";
  const seg = h("div", { class: "seg", role: "radiogroup", "aria-label": label });
  for (const [val, text] of options) {
    const b = h("button", { type: "button", role: "radio", "aria-checked": String(val === value) }, text);
    b.addEventListener("click", () => {
      seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
      onChange(val);
    });
    seg.append(b);
  }
  container.append(seg);
  return seg;
}

const SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="currentColor"/></svg>';

/** Light / dark toggle: sets data-theme on <html> (the CSS defines both); remembered per browser when storage works. */
export function initThemeToggle(button) {
  const root = document.documentElement, media = window.matchMedia("(prefers-color-scheme: dark)");
  const current = () => root.getAttribute("data-theme") || (media.matches ? "dark" : "light");
  const render = () => {
    const next = current() === "dark" ? "light" : "dark";
    button.innerHTML = `${next === "dark" ? MOON : SUN}<span>${next === "dark" ? "Dark" : "Light"} mode</span>`;
    button.setAttribute("aria-label", `Switch to ${next} mode`);
  };
  button.addEventListener("click", () => {
    const next = current() === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (_) { /* storage unavailable: theme lasts for this page view */ }
    render();
  });
  media.addEventListener?.("change", render);
  render();
}

/** One global tooltip for elements with data-tip (hover, keyboard focus, tap). */
export function initTips() {
  const box = h("div", { class: "tipbox", id: "tipbox", role: "tooltip", hidden: true });
  document.body.append(box);
  let owner = null;
  const show = (el) => {
    owner = el;
    box.textContent = el.dataset.tip;
    box.hidden = false;
    el.setAttribute("aria-describedby", "tipbox");
    const r = el.getBoundingClientRect(), bw = Math.min(320, window.innerWidth - 24);
    box.style.maxWidth = `${bw}px`;
    const left = Math.max(12, Math.min(window.innerWidth - box.offsetWidth - 12, r.left + r.width / 2 - box.offsetWidth / 2));
    const below = r.bottom + 8 + box.offsetHeight < window.innerHeight;
    box.style.left = `${left}px`;
    box.style.top = `${below ? r.bottom + 8 : r.top - 8 - box.offsetHeight}px`;
  };
  const hide = () => { if (owner) owner.removeAttribute("aria-describedby"); owner = null; box.hidden = true; };
  document.addEventListener("pointerover", (e) => { const el = e.target.closest("[data-tip]"); if (el) show(el); });
  document.addEventListener("pointerout", (e) => { if (owner && !owner.contains(e.relatedTarget)) hide(); });
  document.addEventListener("focusin", (e) => { const el = e.target.closest("[data-tip]"); el ? show(el) : hide(); });
  document.addEventListener("focusout", hide);
  document.addEventListener("click", (e) => { const el = e.target.closest("[data-tip]"); if (el) { e.preventDefault(); show(el); } else hide(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });
  window.addEventListener("scroll", () => { if (owner && owner !== document.activeElement) hide(); else if (owner) show(owner); }, { passive: true });
}

export const info = (label, text) =>
  `<button type="button" class="info" data-tip="${text.replace(/"/g, "&quot;")}" aria-label="About ${label}">i</button>`;
