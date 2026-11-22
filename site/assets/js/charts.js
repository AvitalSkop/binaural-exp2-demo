// Lightweight responsive SVG line chart: measured points only (marker per model, fixed colour + shape),
// thin connecting lines between measured points, crosshair tooltip, data-table view. No interpolation, no CI bands.
import { MARKERS, chip, color, fmt, h, markerPath } from "./common.js";

function niceStep(raw) {
  const p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}
function ticks(lo, hi, n = 5) {
  const step = niceStep((hi - lo) / n || 1), out = [];
  const top = Math.ceil(hi / step - 1e-9) * step;
  for (let v = Math.floor(lo / step + 1e-9) * step; v <= top + step * 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

export class LineChart {
  /**
   * cfg: { title, subtitle, xTitle, xLabels: [..], xValues?: [..] (numeric axis), models: [{key,name}],
   *        values: {key: [stat,...]}, nLabel: (i) => string | null, tipN: (i) => string, caption, unit }
   */
  constructor(el, cfg) {
    this.el = el;
    this.cfg = cfg;
    this.metric = cfg.metric;
    el.innerHTML = "";
    this.head = h("div");
    this.box = h("div", { class: "chart" });
    this.tip = h("div", { class: "tip", hidden: true, role: "presentation" });
    this.box.append(this.tip);
    this.caption = h("figcaption", { class: "caption" }, cfg.caption || "");
    this.details = h("details");
    el.append(this.head, this.box, this.caption, this.details);
    new ResizeObserver(() => this.draw()).observe(this.box);
    this.setMetric(cfg.metric, cfg.metricLabel);
  }

  setMetric(metric, label) {
    this.metric = metric;
    this.metricLabel = label;
    this.head.innerHTML = `<h3>${this.cfg.title}</h3>${this.cfg.subtitle ? `<p class="small" style="margin:0 0 6px">${this.cfg.subtitle}</p>` : ""}`;
    this.draw();
    this.table();
  }

  val(key, i) { const s = this.cfg.values[key][i]; return s ? s[this.metric] : null; }

  draw() {
    const { xLabels, xValues, models } = this.cfg;
    const W = Math.max(280, this.box.clientWidth || 520);
    const H = Math.round(Math.min(330, Math.max(240, W * 0.6)));
    const n = xLabels.length;
    const rotate = !xValues && Math.max(...xLabels.map((l) => l.length)) * 7.4 > (W - 60) / n - 6;
    const m = { l: 46, r: 14, t: 14, b: rotate ? 74 : this.cfg.nLabel ? 50 : 38 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b;

    let xs;
    if (xValues) {
      const lo = xValues[0], hi = xValues[n - 1], pad = (hi - lo) * 0.06;
      xs = xValues.map((v) => m.l + ((v - lo + pad) / (hi - lo + 2 * pad)) * pw);
    } else xs = xLabels.map((_, i) => m.l + (pw / n) * (i + 0.5));
    const band = xValues ? Math.min(...xs.slice(1).map((x, i) => x - xs[i])) : pw / n;
    const dodge = xValues ? 0 : Math.min(6, band * 0.07);   // numeric (training-step) axis: true positions, no offset

    const all = models.flatMap((md) => xLabels.map((_, i) => this.val(md.key, i))).filter((v) => v !== null);
    let lo = Math.min(...all), hi = Math.max(...all);
    const pad = (hi - lo) * 0.12 || 1;
    const yt = ticks(lo - pad, hi + pad);
    lo = yt[0]; hi = yt[yt.length - 1];
    const y = (v) => m.t + ph - ((v - lo) / (hi - lo)) * ph;

    const s = [];
    s.push(`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${this.cfg.title}: ${this.metricLabel}">`);
    for (const t of yt) {
      s.push(`<line class="${t === 0 && lo < 0 ? "baseline" : "grid"}" x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}"/>`);
      s.push(`<text x="${m.l - 8}" y="${y(t) + 4}" text-anchor="end">${fmt(t, Number.isInteger(t) ? 0 : 1)}</text>`);
    }
    s.push(`<text class="axis-title" transform="translate(12 ${m.t + ph / 2}) rotate(-90)" text-anchor="middle">${this.metricLabel}</text>`);
    xLabels.forEach((lab, i) => {
      if (rotate) {   // narrow screens: rotated labels; n stays in the tooltip and the data table
        s.push(`<text transform="translate(${xs[i] + 4} ${m.t + ph + 12}) rotate(-40)" text-anchor="end" style="fill:var(--ink2)">${lab}</text>`);
        return;
      }
      s.push(`<text x="${xs[i]}" y="${m.t + ph + 17}" text-anchor="middle" style="fill:var(--ink2)">${lab}</text>`);
      const nl = this.cfg.nLabel && this.cfg.nLabel(i);
      if (nl) s.push(`<text x="${xs[i]}" y="${m.t + ph + 32}" text-anchor="middle">${nl}</text>`);
    });
    if (this.cfg.xTitle) s.push(`<text class="axis-title" x="${m.l + pw / 2}" y="${H - 3}" text-anchor="middle">${this.cfg.xTitle}</text>`);
    s.push(`<line class="cross" x1="0" x2="0" y1="${m.t}" y2="${m.t + ph}" visibility="hidden"/>`);
    models.forEach((md, k) => {
      const off = (k - (models.length - 1) / 2) * dodge;
      const pts = xLabels.map((_, i) => [xs[i] + off, this.val(md.key, i)]);
      let d = "", pen = false;
      for (const [px, v] of pts) { if (v === null) { pen = false; continue; } d += `${pen ? "L" : "M"}${px},${y(v)}`; pen = true; }
      s.push(`<g class="series"><path class="line" d="${d}" stroke="${color(md.key)}"/>`);
      for (const [px, v] of pts) if (v !== null) s.push(`<path class="pt" d="${markerPath(MARKERS[md.key], px, y(v), 4.5)}" fill="${color(md.key)}"/>`);
      s.push("</g>");
    });
    xLabels.forEach((_, i) => {
      const left = i === 0 ? m.l : (xs[i - 1] + xs[i]) / 2, right = i === n - 1 ? W - m.r : (xs[i] + xs[i + 1]) / 2;
      s.push(`<rect class="hit" data-i="${i}" x="${left}" y="${m.t}" width="${right - left}" height="${ph}"/>`);
    });
    s.push("</svg>");
    this.box.querySelector("svg")?.remove();
    this.box.insertAdjacentHTML("afterbegin", s.join(""));
    const svg = this.box.querySelector("svg"), cross = svg.querySelector(".cross");
    const show = (e) => {
      const i = Number(e.target.dataset.i);
      cross.setAttribute("x1", xs[i]); cross.setAttribute("x2", xs[i]); cross.setAttribute("visibility", "visible");
      this.tip.innerHTML = `<div class="tip-h">${this.cfg.tipTitle ? this.cfg.tipTitle(i) : xLabels[i]}</div>
        <div class="tip-n">${this.cfg.tipN(i, this.metric)}</div>` +
        models.map((md) => `<div class="tip-r">${chip(md.key)}<span>${md.key} ${md.name}</span><b>${fmt(this.val(md.key, i), 2, true)} dB</b></div>`).join("");
      this.tip.hidden = false;
      const tw = this.tip.offsetWidth, x = xs[i] + 14 + tw > W ? xs[i] - 14 - tw : xs[i] + 14;
      this.tip.style.left = `${Math.max(0, x)}px`;
      this.tip.style.top = `${m.t}px`;
    };
    const hide = () => { this.tip.hidden = true; cross.setAttribute("visibility", "hidden"); };
    svg.querySelectorAll(".hit").forEach((r) => {
      r.addEventListener("pointerenter", show);
      r.addEventListener("pointerdown", show);
      r.addEventListener("pointerleave", hide);
    });
  }

  table() {
    const { xLabels, models } = this.cfg;
    const rows = xLabels.map((lab, i) => `<tr><td>${lab}</td>${models.map((md) => `<td>${fmt(this.val(md.key, i), 2, true)}</td>`).join("")}<td>${this.cfg.tableN(i, this.metric)}</td></tr>`).join("");
    this.details.innerHTML = `<summary>Data table</summary><div class="table-wrap"><table>
      <thead><tr><th>${this.cfg.xTitle || "Checkpoint"}</th>${models.map((md) => `<th>${md.key}</th>`).join("")}<th>n</th></tr></thead>
      <tbody>${rows}</tbody><caption>${this.metricLabel}, mean per bin; n = ${this.cfg.tableNText}.</caption></table></div>`;
  }
}
