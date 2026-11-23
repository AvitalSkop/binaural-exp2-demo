// Top-view binaural geometry: listener at the centre facing up (0° = front, positive azimuth = right),
// requested speaker (filled, solid ray), interfering speaker (hollow, dashed ray), angular separation arc.
import { fmt, fmtDeg } from "./common.js";

const W = 340, H = 205, CX = 170, CY = 178, R = 128;
const rad = (a) => (a * Math.PI) / 180;
const pt = (a, r) => [CX + r * Math.sin(rad(a)), CY - r * Math.cos(rad(a))];

export function geometrySVG(target, interf, targetName, interfName, sirDb) {
  const parts = [];
  // frontal half-circle and ticks every 15°
  const [x0, y0] = pt(-90, R), [x1, y1] = pt(90, R);
  parts.push(`<path d="M${x0},${y0} A${R},${R} 0 0 1 ${x1},${y1}" fill="none" stroke="var(--line)" stroke-width="1.5"/>`);
  for (let a = -90; a <= 90; a += 15) {
    const [ax, ay] = pt(a, R), [bx, by] = pt(a, R - (a % 45 === 0 ? 8 : 4));
    parts.push(`<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="var(--muted)" stroke-width="1"/>`);
  }
  for (const a of [-90, -45, 0, 45, 90]) {
    const [lx, ly] = pt(a, R - 20);
    parts.push(`<text x="${lx}" y="${ly + 4}" text-anchor="middle" font-size="12" fill="var(--muted)">${fmtDeg(a)}</text>`);
  }
  parts.push(`<text x="${CX - R}" y="${CY + 18}" text-anchor="middle" font-size="12" fill="var(--muted)">left</text>`);
  parts.push(`<text x="${CX + R}" y="${CY + 18}" text-anchor="middle" font-size="12" fill="var(--muted)">right</text>`);

  // separation arc
  const lo = Math.min(target, interf), hi = Math.max(target, interf), ra = 56;
  const [sx, sy] = pt(lo, ra), [ex, ey] = pt(hi, ra);
  parts.push(`<path d="M${sx},${sy} A${ra},${ra} 0 0 1 ${ex},${ey}" fill="none" stroke="var(--ink2)" stroke-width="1.5"/>`);
  const mid = (lo + hi) / 2;
  if (hi - lo >= 30) {
    const [mx, my] = pt(mid, ra + 15);
    parts.push(`<text x="${mx}" y="${my + 4}" text-anchor="middle" font-size="14" fill="var(--ink2)">Δθ = ${hi - lo}°</text>`);
  } else {                      // small separation: label beside the arc, away from the rays
    const side = mid > 0 ? -1 : 1, [mx, my] = pt(mid, ra);
    parts.push(`<text x="${mx + side * 14}" y="${my + 4}" text-anchor="${side > 0 ? "start" : "end"}" font-size="14" fill="var(--ink2)">Δθ = ${hi - lo}°</text>`);
  }

  // rays and sources
  const src = (a, isTarget, name) => {
    const [px, py] = pt(a, R);
    const stroke = isTarget ? "var(--target)" : "var(--interf)";
    const [hx, hy] = pt(a, 22);
    parts.push(`<line x1="${hx}" y1="${hy}" x2="${px}" y2="${py}" stroke="${stroke}" stroke-width="${isTarget ? 2 : 1.5}" ${isTarget ? "" : 'stroke-dasharray="4 4"'}/>`);
    parts.push(isTarget
      ? `<circle cx="${px}" cy="${py}" r="7" fill="var(--target)" stroke="var(--card)" stroke-width="2"/>`
      : `<circle cx="${px}" cy="${py}" r="6" fill="var(--card)" stroke="var(--interf)" stroke-width="2"/>`);
    return [px, py];
  };
  src(interf, false, interfName);
  src(target, true, targetName);

  // labels outside the arc; when the sources are close, push them apart along the arc
  const sep = Math.abs(target - interf), push = sep < 30 ? (30 - sep) / 2 : 0;
  const lab = (a, isTarget, name) => {
    const dir = a === Math.max(target, interf) ? 1 : -1;
    const al = Math.max(-84, Math.min(84, a + dir * push));
    const [lx, ly] = pt(al, R + 16);
    const anchor = al > 8 ? "start" : al < -8 ? "end" : "middle";
    parts.push(`<text x="${lx}" y="${ly + 4}" text-anchor="${anchor}" font-size="15" font-weight="${isTarget ? 700 : 400}" fill="${isTarget ? "var(--ink)" : "var(--muted)"}">${name} ${fmtDeg(a)}</text>`);
  };
  lab(interf, false, interfName);
  lab(target, true, targetName);

  // listener: head, nose, ears
  parts.push(`<circle cx="${CX}" cy="${CY}" r="16" fill="var(--soft)" stroke="var(--ink2)" stroke-width="1.5"/>`);
  parts.push(`<path d="M${CX - 5},${CY - 15} L${CX},${CY - 23} L${CX + 5},${CY - 15}" fill="var(--soft)" stroke="var(--ink2)" stroke-width="1.5" stroke-linejoin="round"/>`);
  parts.push(`<rect x="${CX - 20}" y="${CY - 5}" width="4" height="10" rx="2" fill="var(--ink2)"/><rect x="${CX + 16}" y="${CY - 5}" width="4" height="10" rx="2" fill="var(--ink2)"/>`);

  // facts under the listener: separation and initial target SIR (requested over interfering speaker, dB)
  parts.push(`<text x="${CX}" y="${CY + 44}" text-anchor="middle" font-size="14" fill="var(--ink2)">Separation <tspan font-weight="700" fill="var(--ink)">${sep}°</tspan>   ·   Initial target SIR <tspan font-weight="700" fill="var(--ink)">${fmt(sirDb, 1, true)} dB</tspan></text>`);
  const title = `Requested speaker ${targetName} at ${fmtDeg(target)}, interfering speaker ${interfName} at ${fmtDeg(interf)}, separation ${sep}°, initial target SIR ${fmt(sirDb, 1, true)} dB.`;
  return `<svg viewBox="-46 -10 ${W + 92} ${H + 62}" role="img" aria-label="${title}"><title>${title}</title>${parts.join("")}</svg>`;
}
